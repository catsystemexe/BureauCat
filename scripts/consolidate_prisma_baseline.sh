#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASELINE_NAME="0_baseline_20260818"
DB_PATH="$ROOT_DIR/data/bureaucat.sqlite"
MIGRATIONS_DIR="$ROOT_DIR/prisma/migrations"
ARCHIVE_DIR="$ROOT_DIR/prisma/migrations_legacy_prebaseline_20260818"
SCRATCH_DB="$ROOT_DIR/prisma/baseline-verify.sqlite"
BACKUP_DB="$ROOT_DIR/data/bureaucat.pre-baseline-20260818.sqlite"
COUNTS_BEFORE="$(mktemp)"
COUNTS_AFTER="$(mktemp)"
BASELINE_TMP="$(mktemp)"
ALIGN_SQL="$(mktemp)"
VERIFY_DIFF="$(mktemp)"

cleanup() {
  rm -f "$COUNTS_BEFORE" "$COUNTS_AFTER" "$BASELINE_TMP" "$ALIGN_SQL" "$VERIFY_DIFF" "$SCRATCH_DB"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

restore_backup() {
  if [[ -f "$BACKUP_DB" ]]; then
    echo "Restoring working DB from safety backup..." >&2
    cp -f "$BACKUP_DB" "$DB_PATH"
  fi
}

count_rows() {
  local target="$1"
  sqlite3 "$DB_PATH" >"$target" <<'SQL'
SELECT 'Case', COUNT(*) FROM "Case";
SELECT 'Situation', COUNT(*) FROM "Situation";
SELECT 'Goal', COUNT(*) FROM "Goal";
SELECT 'Document', COUNT(*) FROM "Document";
SELECT 'DocumentAnnotation', COUNT(*) FROM "DocumentAnnotation";
SELECT 'DocumentPin', COUNT(*) FROM "DocumentPin";
SELECT 'DocumentInsight', COUNT(*) FROM "DocumentInsight";
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
[[ ! -e "$ARCHIVE_DIR" ]] || fail "Archive directory already exists: $ARCHIVE_DIR"
[[ ! -e "$BACKUP_DB" ]] || fail "Backup database already exists: $BACKUP_DB"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 is required"
command -v npx >/dev/null 2>&1 || fail "npx is required"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working tree is not clean. Commit/stash changes before consolidation."
fi

echo "[1/12] Validate Prisma schema"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate

echo "[2/12] Detect schema drift and render alignment SQL"
set +e
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-schema-datasource "$ROOT_DIR/prisma/schema.prisma" \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --script --exit-code >"$ALIGN_SQL" 2>&1
DIFF_STATUS=$?
set -e
if [[ $DIFF_STATUS -eq 1 ]]; then
  cat "$ALIGN_SQL" >&2 || true
  fail "Unable to compute working DB/schema diff."
fi
if [[ $DIFF_STATUS -eq 0 ]]; then
  echo "No structural drift detected."
elif [[ $DIFF_STATUS -eq 2 ]]; then
  echo "Structural drift detected; controlled schema alignment is required before baselining."
else
  fail "Unexpected prisma migrate diff exit code: $DIFF_STATUS"
fi

echo "[3/12] Preflight data-integrity checks for target constraints"
ORPHAN_SITUATIONS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "JournalItem" j LEFT JOIN "Situation" s ON s.id=j.situation_id WHERE j.situation_id IS NOT NULL AND s.id IS NULL;')
ORPHAN_PARENTS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "Document" d LEFT JOIN "Document" p ON p.id=d.parent_document_id WHERE d.parent_document_id IS NOT NULL AND p.id IS NULL;')
DUPLICATE_CHILD_KEYS=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM (SELECT parent_document_id, document_type, analysis_type, COUNT(*) c FROM "Document" WHERE parent_document_id IS NOT NULL AND analysis_type IS NOT NULL GROUP BY parent_document_id, document_type, analysis_type HAVING c > 1);')

echo "JournalItem orphan situation_id rows: $ORPHAN_SITUATIONS"
echo "Document orphan parent_document_id rows: $ORPHAN_PARENTS"
echo "Document duplicate non-null unique-key groups: $DUPLICATE_CHILD_KEYS"
[[ "$ORPHAN_SITUATIONS" == "0" ]] || fail "Cannot add JournalItem situation FK while orphan rows exist."
[[ "$ORPHAN_PARENTS" == "0" ]] || fail "Cannot add Document parent FK while orphan rows exist."
[[ "$DUPLICATE_CHILD_KEYS" == "0" ]] || fail "Cannot add Document composite unique index while duplicate rows exist."

echo "[4/12] Snapshot business-row counts"
count_rows "$COUNTS_BEFORE"
cat "$COUNTS_BEFORE"

echo "[5/12] Create SQLite safety backup"
sqlite3 "$DB_PATH" ".backup '$BACKUP_DB'"
[[ -s "$BACKUP_DB" ]] || fail "Safety backup was not created successfully."

echo "[6/12] Align working DB schema to current prisma/schema.prisma if needed"
if [[ $DIFF_STATUS -eq 2 ]]; then
  if ! sqlite3 -bail "$DB_PATH" <"$ALIGN_SQL"; then
    restore_backup
    fail "Schema alignment failed; working DB restored from backup."
  fi
fi

FK_ERRORS=$(sqlite3 "$DB_PATH" 'PRAGMA foreign_key_check;' || true)
if [[ -n "$FK_ERRORS" ]]; then
  echo "$FK_ERRORS" >&2
  restore_backup
  fail "Foreign-key check failed after schema alignment; working DB restored from backup."
fi

count_rows "$COUNTS_AFTER"
if ! diff -u "$COUNTS_BEFORE" "$COUNTS_AFTER"; then
  restore_backup
  fail "Business row counts changed during schema alignment; working DB restored from backup."
fi

echo "[7/12] Verify schema drift is now zero"
set +e
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-schema-datasource "$ROOT_DIR/prisma/schema.prisma" \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --exit-code >"$VERIFY_DIFF" 2>&1
VERIFY_STATUS=$?
set -e
if [[ $VERIFY_STATUS -ne 0 ]]; then
  cat "$VERIFY_DIFF" >&2 || true
  restore_backup
  fail "Working DB still differs from prisma/schema.prisma after alignment; DB restored."
fi

echo "[8/12] Archive legacy migration files and applied-history metadata"
mv "$MIGRATIONS_DIR" "$ARCHIVE_DIR"
mkdir -p "$MIGRATIONS_DIR/$BASELINE_NAME"
if [[ -f "$ARCHIVE_DIR/migration_lock.toml" ]]; then
  cp "$ARCHIVE_DIR/migration_lock.toml" "$MIGRATIONS_DIR/migration_lock.toml"
else
  printf 'provider = "sqlite"\n' > "$MIGRATIONS_DIR/migration_lock.toml"
fi
sqlite3 -header -separator $'\t' "$DB_PATH" \
  'SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at;' \
  > "$ARCHIVE_DIR/applied_history.tsv"

echo "[9/12] Generate consolidated baseline SQL from current schema"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
  --script >"$BASELINE_TMP"
[[ -s "$BASELINE_TMP" ]] || fail "Generated baseline migration is empty"
mv "$BASELINE_TMP" "$MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"

echo "[10/12] Verify new baseline on a fresh scratch database"
rm -f "$SCRATCH_DB"
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate deploy
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate status
rm -f "$SCRATCH_DB"

echo "[11/12] Rebaseline only Prisma migration metadata in working DB"
sqlite3 "$DB_PATH" 'DELETE FROM "_prisma_migrations";'
if ! DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate resolve --applied "$BASELINE_NAME"; then
  restore_backup
  fail "Unable to mark consolidated baseline as applied; working DB restored from backup."
fi
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate status
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate deploy

count_rows "$COUNTS_AFTER"
if ! diff -u "$COUNTS_BEFORE" "$COUNTS_AFTER"; then
  restore_backup
  fail "Business row counts changed after migration metadata rebaseline; working DB restored from backup."
fi

echo "[12/12] Final validation"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate status
cat "$COUNTS_AFTER"

echo
echo "SUCCESS: Prisma baseline consolidation completed locally."
echo "Legacy migrations: $ARCHIVE_DIR"
echo "Legacy applied history: $ARCHIVE_DIR/applied_history.tsv"
echo "New baseline: $MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"
echo "Safety DB backup: $BACKUP_DB"
echo
echo "Review with: git status --short && git diff --stat"
echo "Do not delete the DB backup until the new baseline has been committed and re-verified."
