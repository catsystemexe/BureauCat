#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASELINE_NAME="0_baseline_20260818"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
DB_PATH="$ROOT_DIR/data/bureaucat.sqlite"
MIGRATIONS_DIR="$ROOT_DIR/prisma/migrations"
ARCHIVE_DIR="$ROOT_DIR/prisma/migrations_legacy_prebaseline_20260818"
SCRATCH_DB="$ROOT_DIR/prisma/baseline-verify.sqlite"
BACKUP_DB="$ROOT_DIR/data/bureaucat.pre-baseline-$RUN_ID.sqlite"
ORPHAN_INSIGHTS_TSV="$ROOT_DIR/data/orphan-document-insights-prebaseline-$RUN_ID.tsv"
LEGACY_HISTORY_TSV="$ROOT_DIR/data/prisma-migration-history-prebaseline-$RUN_ID.tsv"
COUNTS_BEFORE="$(mktemp)"
COUNTS_AFTER="$(mktemp)"
BASELINE_TMP="$(mktemp)"
ALIGN_SQL="$(mktemp)"
VERIFY_DIFF="$(mktemp)"
MIGRATIONS_SWAPPED=0

cleanup() {
  rm -f "$COUNTS_BEFORE" "$COUNTS_AFTER" "$BASELINE_TMP" "$ALIGN_SQL" "$VERIFY_DIFF" "$SCRATCH_DB"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

restore_everything() {
  if [[ -f "$BACKUP_DB" ]]; then
    echo "Restoring working DB from safety backup..." >&2
    cp -f "$BACKUP_DB" "$DB_PATH"
  fi
  if [[ "$MIGRATIONS_SWAPPED" == "1" && -d "$ARCHIVE_DIR" ]]; then
    echo "Restoring legacy migration directory..." >&2
    rm -rf "$MIGRATIONS_DIR"
    mv "$ARCHIVE_DIR" "$MIGRATIONS_DIR"
    MIGRATIONS_SWAPPED=0
  fi
}

abort_after_backup() {
  restore_everything
  fail "$1"
}

count_non_insight_rows() {
  local target="$1"
  sqlite3 "$DB_PATH" >"$target" <<'SQL'
SELECT 'Case', COUNT(*) FROM "Case";
SELECT 'Situation', COUNT(*) FROM "Situation";
SELECT 'Goal', COUNT(*) FROM "Goal";
SELECT 'Document', COUNT(*) FROM "Document";
SELECT 'DocumentAnnotation', COUNT(*) FROM "DocumentAnnotation";
SELECT 'DocumentPin', COUNT(*) FROM "DocumentPin";
SELECT 'SituationDocument', COUNT(*) FROM "SituationDocument";
SELECT 'JournalItem', COUNT(*) FROM "JournalItem";
SELECT 'ChatMessage', COUNT(*) FROM "ChatMessage";
SELECT 'AISuggestion', COUNT(*) FROM "AISuggestion";
SQL
}

echo "== BureauCat Prisma baseline consolidation =="
echo "Baseline: $BASELINE_NAME"
echo "Database: $DB_PATH"

[[ -f "$DB_PATH" ]] || fail "Working database not found: $DB_PATH"
[[ -d "$MIGRATIONS_DIR" ]] || fail "Migration directory not found: $MIGRATIONS_DIR"
[[ ! -e "$ARCHIVE_DIR" ]] || fail "Legacy archive directory already exists: $ARCHIVE_DIR"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 is required"
command -v npx >/dev/null 2>&1 || fail "npx is required"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working tree is not clean. Commit/stash changes before consolidation."
fi

echo "[1/15] Validate Prisma schema"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate

echo "[2/15] Detect schema drift and render alignment SQL"
set +e
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-schema-datasource "$ROOT_DIR/prisma/schema.prisma" \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --script --exit-code >"$ALIGN_SQL" 2>&1
DIFF_STATUS=$?
set -e
[[ $DIFF_STATUS -ne 1 ]] || { cat "$ALIGN_SQL" >&2; fail "Unable to compute working DB/schema diff."; }
[[ $DIFF_STATUS -eq 0 || $DIFF_STATUS -eq 2 ]] || fail "Unexpected prisma migrate diff exit code: $DIFF_STATUS"
if [[ $DIFF_STATUS -eq 2 ]]; then
  echo "Structural drift detected; controlled alignment required."
else
  echo "No structural drift detected."
fi

echo "[3/15] Preflight target constraints and historical FK debt"
ORPHAN_SITUATIONS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "JournalItem" j LEFT JOIN "Situation" s ON s.id=j.situation_id WHERE j.situation_id IS NOT NULL AND s.id IS NULL;')
ORPHAN_PARENTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "Document" d LEFT JOIN "Document" p ON p.id=d.parent_document_id WHERE d.parent_document_id IS NOT NULL AND p.id IS NULL;')
ORPHAN_INSIGHTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight" i LEFT JOIN "Document" d ON d.id=i.document_id WHERE d.id IS NULL;')
DUPLICATE_CHILD_KEYS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM (SELECT parent_document_id, document_type, analysis_type, COUNT(*) c FROM "Document" WHERE parent_document_id IS NOT NULL AND analysis_type IS NOT NULL GROUP BY parent_document_id, document_type, analysis_type HAVING c > 1);')
INSIGHTS_BEFORE=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight";')

echo "JournalItem orphan situation_id rows: $ORPHAN_SITUATIONS"
echo "Document orphan parent_document_id rows: $ORPHAN_PARENTS"
echo "DocumentInsight orphan document_id rows: $ORPHAN_INSIGHTS"
echo "Document duplicate non-null unique-key groups: $DUPLICATE_CHILD_KEYS"
[[ "$ORPHAN_SITUATIONS" == "0" ]] || fail "Cannot add JournalItem situation FK while orphan rows exist."
[[ "$DUPLICATE_CHILD_KEYS" == "0" ]] || fail "Cannot add Document composite unique index while duplicate rows exist."

echo "[4/15] Snapshot non-insight business-row counts"
count_non_insight_rows "$COUNTS_BEFORE"
cat "$COUNTS_BEFORE"
echo "DocumentInsight|$INSIGHTS_BEFORE"

echo "[5/15] Create SQLite safety backup"
sqlite3 "$DB_PATH" ".backup '$BACKUP_DB'"
[[ -s "$BACKUP_DB" ]] || fail "Safety backup was not created successfully."

echo "[6/15] Archive and clean orphan DocumentInsight rows"
if [[ "$ORPHAN_INSIGHTS" != "0" ]]; then
  sqlite3 -header -separator $'\t' "$DB_PATH" \
    'SELECT i.id, i.document_id, i.source_document_id, i.source_pin_id, i.status, i.journal_item_id, i.insight_type, i.created_at, i.updated_at FROM "DocumentInsight" i LEFT JOIN "Document" d ON d.id=i.document_id WHERE d.id IS NULL ORDER BY i.created_at, i.id;' \
    > "$ORPHAN_INSIGHTS_TSV"
  sqlite3 -bail "$DB_PATH" \
    'DELETE FROM "DocumentInsight" WHERE NOT EXISTS (SELECT 1 FROM "Document" d WHERE d.id="DocumentInsight".document_id);'
fi
REMAINING_ORPHAN_INSIGHTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight" i LEFT JOIN "Document" d ON d.id=i.document_id WHERE d.id IS NULL;')
[[ "$REMAINING_ORPHAN_INSIGHTS" == "0" ]] || abort_after_backup "Orphan DocumentInsight rows remain after cleanup."
EXPECTED_INSIGHTS=$((INSIGHTS_BEFORE - ORPHAN_INSIGHTS))
ACTUAL_INSIGHTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight";')
[[ "$ACTUAL_INSIGHTS" == "$EXPECTED_INSIGHTS" ]] || abort_after_backup "Unexpected DocumentInsight row count after cleanup."

echo "[7/15] Normalize orphan Document parent references to SetNull semantics"
if [[ "$ORPHAN_PARENTS" != "0" ]]; then
  sqlite3 -bail "$DB_PATH" <<'SQL'
UPDATE "Document"
SET "parent_document_id" = NULL
WHERE "parent_document_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Document" parent
    WHERE parent."id" = "Document"."parent_document_id"
  );
SQL
fi
REMAINING_ORPHAN_PARENTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "Document" d LEFT JOIN "Document" p ON p.id=d.parent_document_id WHERE d.parent_document_id IS NOT NULL AND p.id IS NULL;')
[[ "$REMAINING_ORPHAN_PARENTS" == "0" ]] || abort_after_backup "Orphan Document parent references remain after normalization."

echo "[8/15] Align working DB schema to current prisma/schema.prisma"
if [[ $DIFF_STATUS -eq 2 ]]; then
  sqlite3 -bail "$DB_PATH" <"$ALIGN_SQL" || abort_after_backup "Schema alignment failed."
fi
FK_ERRORS=$(sqlite3 "$DB_PATH" 'PRAGMA foreign_key_check;' || true)
if [[ -n "$FK_ERRORS" ]]; then
  echo "$FK_ERRORS" >&2
  abort_after_backup "Foreign-key check failed after cleanup/alignment."
fi
count_non_insight_rows "$COUNTS_AFTER"
diff -u "$COUNTS_BEFORE" "$COUNTS_AFTER" || abort_after_backup "A non-insight business table changed row count."
ACTUAL_INSIGHTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight";')
[[ "$ACTUAL_INSIGHTS" == "$EXPECTED_INSIGHTS" ]] || abort_after_backup "DocumentInsight count changed unexpectedly during alignment."

echo "[9/15] Verify zero schema drift"
set +e
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-schema-datasource "$ROOT_DIR/prisma/schema.prisma" \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --exit-code >"$VERIFY_DIFF" 2>&1
VERIFY_STATUS=$?
set -e
if [[ $VERIFY_STATUS -ne 0 ]]; then
  cat "$VERIFY_DIFF" >&2 || true
  abort_after_backup "Working DB still differs from prisma/schema.prisma after alignment."
fi

echo "[10/15] Preserve applied legacy migration metadata"
sqlite3 -header -separator $'\t' "$DB_PATH" \
  'SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at;' \
  > "$LEGACY_HISTORY_TSV"

echo "[11/15] Generate consolidated baseline SQL"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --script >"$BASELINE_TMP"
[[ -s "$BASELINE_TMP" ]] || abort_after_backup "Generated baseline migration is empty."

echo "[12/15] Swap legacy migration chain for consolidated baseline"
mv "$MIGRATIONS_DIR" "$ARCHIVE_DIR"
MIGRATIONS_SWAPPED=1
mkdir -p "$MIGRATIONS_DIR/$BASELINE_NAME"
if [[ -f "$ARCHIVE_DIR/migration_lock.toml" ]]; then
  cp "$ARCHIVE_DIR/migration_lock.toml" "$MIGRATIONS_DIR/migration_lock.toml"
else
  printf 'provider = "sqlite"\n' > "$MIGRATIONS_DIR/migration_lock.toml"
fi
cp "$BASELINE_TMP" "$MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"

echo "[13/15] Verify consolidated baseline on fresh scratch DB"
rm -f "$SCRATCH_DB"
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate deploy || abort_after_backup "Fresh scratch migrate deploy failed."
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate status || abort_after_backup "Fresh scratch migrate status failed."
rm -f "$SCRATCH_DB"

echo "[14/15] Rebaseline Prisma metadata in working DB"
sqlite3 "$DB_PATH" 'DELETE FROM "_prisma_migrations";'
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate resolve --applied "$BASELINE_NAME" || abort_after_backup "Unable to mark baseline as applied."
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate status || abort_after_backup "Working DB migrate status failed."
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate deploy || abort_after_backup "Working DB migrate deploy failed."

echo "[15/15] Final integrity and schema validation"
FK_ERRORS=$(sqlite3 "$DB_PATH" 'PRAGMA foreign_key_check;' || true)
[[ -z "$FK_ERRORS" ]] || { echo "$FK_ERRORS" >&2; abort_after_backup "Final foreign-key check failed."; }
count_non_insight_rows "$COUNTS_AFTER"
diff -u "$COUNTS_BEFORE" "$COUNTS_AFTER" || abort_after_backup "A non-insight business table changed row count after rebaseline."
ACTUAL_INSIGHTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "DocumentInsight";')
[[ "$ACTUAL_INSIGHTS" == "$EXPECTED_INSIGHTS" ]] || abort_after_backup "Final DocumentInsight row count mismatch."
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate status

echo
echo "SUCCESS: Prisma baseline consolidation completed locally."
echo "DocumentInsight rows: $INSIGHTS_BEFORE -> $ACTUAL_INSIGHTS (removed historical orphans: $ORPHAN_INSIGHTS)"
echo "Legacy migrations: $ARCHIVE_DIR"
echo "New baseline: $MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"
echo "Safety DB backup: $BACKUP_DB"
echo "Orphan insight audit metadata: $ORPHAN_INSIGHTS_TSV"
echo "Legacy migration metadata: $LEGACY_HISTORY_TSV"
echo
echo "Review with: git status --short && git diff --stat"
echo "Do not delete the safety backup until the migration baseline is committed and re-verified."
