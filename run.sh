#!/usr/bin/env bash
# Test de rechten per klant in een lege lokale PostgreSQL-database (zonder Supabase).
# Gebruik: supabase/tests/run.sh   (vereist psql en een PostgreSQL-server; DB-naam via $DB, standaard fp_rls_test)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB:-fp_rls_test}"
dropdb --if-exists "$DB" && createdb "$DB"
cat tests/supabase_stub.sql migrations/*.sql seed.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/rls_test.sql
