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

cleanup() {
  rm -f "$COUNTS_BEFORE" "$COUNTS_AFTER" "$BASELINE_TMP" "$SCRATCH_DB"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
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

echo "[1/10] Validate Prisma schema"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate

echo "[2/10] Verify working DB matches current Prisma schema"
set +e
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-schema-datasource \
  --to-schema "$ROOT_DIR/prisma/schema.prisma" \
  --exit-code >/tmp/bureaucat-prisma-diff.txt 2>&1
DIFF_STATUS=$?
set -e
if [[ $DIFF_STATUS -ne 0 ]]; then
  cat /tmp/bureaucat-prisma-diff.txt >&2 || true
  if [[ $DIFF_STATUS -eq 2 ]]; then
    fail "Working DB schema differs from prisma/schema.prisma. Consolidation aborted."
  fi
  fail "Unable to compare working DB with Prisma schema. Consolidation aborted."
fi
rm -f /tmp/bureaucat-prisma-diff.txt

echo "[3/10] Snapshot business-row counts"
sqlite3 "$DB_PATH" >"$COUNTS_BEFORE" <<'SQL'
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
cat "$COUNTS_BEFORE"

echo "[4/10] Create byte-for-byte safety backup"
cp -p "$DB_PATH" "$BACKUP_DB"

echo "[5/10] Archive legacy migration files and create new baseline directory"
mv "$MIGRATIONS_DIR" "$ARCHIVE_DIR"
mkdir -p "$MIGRATIONS_DIR/$BASELINE_NAME"
if [[ -f "$ARCHIVE_DIR/migration_lock.toml" ]]; then
  cp "$ARCHIVE_DIR/migration_lock.toml" "$MIGRATIONS_DIR/migration_lock.toml"
else
  printf 'provider = "sqlite"\n' > "$MIGRATIONS_DIR/migration_lock.toml"
fi

echo "[6/10] Generate consolidated baseline SQL from current schema"
if DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
  --from-empty \
  --to-schema "$ROOT_DIR/prisma/schema.prisma" \
  --script >"$BASELINE_TMP"; then
  :
else
  echo "Primary migrate diff syntax failed; trying Prisma 6 compatibility syntax." >&2
  DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate diff \
    --from-empty \
    --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" \
    --script >"$BASELINE_TMP"
fi
[[ -s "$BASELINE_TMP" ]] || fail "Generated baseline migration is empty"
mv "$BASELINE_TMP" "$MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"

echo "[7/10] Verify new migration history on a fresh scratch database"
rm -f "$SCRATCH_DB"
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate deploy
DATABASE_URL="file:./baseline-verify.sqlite" npx prisma migrate status
rm -f "$SCRATCH_DB"

echo "[8/10] Preserve legacy Prisma migration metadata and rebaseline working DB"
if sqlite3 "$DB_PATH" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='_prisma_migrations_legacy_20260818';" | grep -q 1; then
  fail "Legacy migration metadata archive table already exists; refusing to overwrite it."
fi
sqlite3 "$DB_PATH" <<'SQL'
BEGIN IMMEDIATE;
CREATE TABLE "_prisma_migrations_legacy_20260818" AS
  SELECT * FROM "_prisma_migrations";
DELETE FROM "_prisma_migrations";
COMMIT;
SQL
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate resolve --applied "$BASELINE_NAME"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate status
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma migrate deploy

echo "[9/10] Verify business-row counts are unchanged"
sqlite3 "$DB_PATH" >"$COUNTS_AFTER" <<'SQL'
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
if ! diff -u "$COUNTS_BEFORE" "$COUNTS_AFTER"; then
  fail "Business row counts changed. Restore from $BACKUP_DB before continuing."
fi
cat "$COUNTS_AFTER"

echo "[10/10] Final validation"
DATABASE_URL="file:../data/bureaucat.sqlite" npx prisma validate

echo
echo "SUCCESS: Prisma baseline consolidation completed locally."
echo "Legacy migrations: $ARCHIVE_DIR"
echo "New baseline: $MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"
echo "Safety DB backup: $BACKUP_DB"
echo "Legacy migration metadata preserved in table: _prisma_migrations_legacy_20260818"
echo
echo "Review with: git status --short && git diff --stat"
echo "Do not delete the DB backup until the new baseline has been committed and re-verified."
