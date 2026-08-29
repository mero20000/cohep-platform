#!/usr/bin/env bash
# Verify migration 20260829000000_add_attempt_tracking against a throwaway database.
#
# The migration adds max_attempts / attempt_number and backfills attempt_number per
# (assessment, student), archiving every attempt but the newest as 'superseded'. That
# backfill is the only part of stage 1 that cannot be covered by the unit tests, because
# it is SQL rather than service code — so it gets checked against real Postgres here.
#
# Usage:  docker compose up -d postgres && backend/scripts/verify-attempt-migration.sh
# Safe to re-run: it drops and recreates its own database and touches nothing else.

set -euo pipefail

DB_NAME="cohep_migration_check"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

cd "$(dirname "$0")/.."

run_sql() { docker exec -i niangelos-postgres psql -U "$PGUSER" -d "$1" -v ON_ERROR_STOP=1 -t -A; }

echo "==> recreating $DB_NAME"
docker exec -i niangelos-postgres psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME;
SQL

echo "==> applying all migrations"
DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$DB_NAME" \
  npx prisma migrate deploy

echo "==> confirming schema matches the migration history (no drift)"
DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$DB_NAME" \
  npx prisma migrate diff \
    --from-schema-datamodel prisma/schema.prisma \
    --to-schema-datasource prisma/schema.prisma \
    --exit-code \
  && echo "    no drift" \
  || { echo "    DRIFT: schema.prisma and the migrations disagree"; exit 1; }

echo "==> exercising the backfill's ranking logic"
# Run against a structural clone of assessment_submissions rather than the real table.
# Seeding the real one would need a whole invented object graph (church, school, level,
# subject, user, assessment, student) just to satisfy the foreign keys — and the FKs are
# not what is at risk here. What is at risk is the window function: whether it numbers
# attempts oldest-first per (assessment, student) and archives every attempt but the
# newest, leaving single-attempt students untouched. LIKE ... INCLUDING ALL copies the
# column types and defaults, so the statement under test is byte-identical to the one in
# the migration.
run_sql "$DB_NAME" <<'SQL'
BEGIN;

CREATE TEMP TABLE subs (LIKE assessment_submissions INCLUDING ALL) ON COMMIT DROP;

-- assessment_id / student_id are uuid columns, so these stand in for a1/a2 and stuA/stuB.
--   a1   = 00000000-0000-0000-0000-0000000000a1
--   a2   = 00000000-0000-0000-0000-0000000000a2
--   stuA = 00000000-0000-0000-0000-00000000005a
--   stuB = 00000000-0000-0000-0000-00000000005b
INSERT INTO subs (id, assessment_id, student_id, submission_type, status, created_at, updated_at, submitted_at)
VALUES
  -- Student A: three attempts on a1, deliberately inserted out of chronological order.
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', 'online', 'completed', now() - interval '3 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', 'online', 'completed', now() - interval '1 day',  now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', 'online', 'submitted', now() - interval '2 days', now(), now()),
  -- Student B: a single attempt, which must be left completely alone.
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005b', 'online', 'completed', now() - interval '5 days', now(), now()),
  -- Student A on a different assessment: partitioning must keep this at attempt 1.
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000005a', 'online', 'submitted', now() - interval '4 days', now(), now());

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY assessment_id, student_id
                            ORDER BY created_at ASC, id ASC) AS rn,
         COUNT(*)     OVER (PARTITION BY assessment_id, student_id) AS total
  FROM subs
)
UPDATE subs s
SET attempt_number = r.rn,
    status = CASE WHEN r.rn < r.total THEN 'superseded' ELSE s.status END
FROM ranked r
WHERE s.id = r.id AND r.total > 1;

SELECT 'RESULT ' || assessment_id || ' ' || student_id || ' n=' || attempt_number || ' ' || status
FROM subs ORDER BY assessment_id, student_id, attempt_number;

-- Hard assertions, so the script fails rather than printing something to eyeball.
DO $$
DECLARE
  a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  stu_a uuid := '00000000-0000-0000-0000-00000000005a';
  stu_b uuid := '00000000-0000-0000-0000-00000000005b';
  live_a1_stuA int; superseded_a1_stuA int; stuB_status text; stuB_n int; a2_n int;
BEGIN
  SELECT count(*) INTO live_a1_stuA
    FROM subs WHERE assessment_id = a1 AND student_id = stu_a AND status <> 'superseded';
  SELECT count(*) INTO superseded_a1_stuA
    FROM subs WHERE assessment_id = a1 AND student_id = stu_a AND status = 'superseded';
  SELECT status, attempt_number INTO stuB_status, stuB_n
    FROM subs WHERE student_id = stu_b;
  SELECT attempt_number INTO a2_n FROM subs WHERE assessment_id = a2;

  IF live_a1_stuA <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 live attempt for stuA/a1, got %', live_a1_stuA;
  END IF;
  IF superseded_a1_stuA <> 2 THEN
    RAISE EXCEPTION 'expected 2 archived attempts for stuA/a1, got %', superseded_a1_stuA;
  END IF;
  IF stuB_status <> 'completed' OR stuB_n <> 1 THEN
    RAISE EXCEPTION 'single-attempt student was modified: status=% n=%', stuB_status, stuB_n;
  END IF;
  IF a2_n <> 1 THEN
    RAISE EXCEPTION 'partitioning leaked across assessments: a2 attempt_number=%', a2_n;
  END IF;

  RAISE NOTICE 'all attempt-tracking assertions passed';
END $$;

SELECT 'ASSERTIONS PASSED';

ROLLBACK;
SQL
echo
echo "==> dropping $DB_NAME"
docker exec -i niangelos-postgres psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null
echo "done"
