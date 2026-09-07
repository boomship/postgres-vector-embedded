#!/bin/bash
set -euo pipefail
export PGOPTIONS="-c exit_on_error=on"

# Basic functional test for PostgreSQL + pgvector binaries
# Tests that the built binaries actually work, not just compile

PLATFORM=${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}
ARCH=${ARCH:-$(uname -m)}
VARIANT=${VARIANT:-lite}
if [ "$ARCH" = "x86_64" ]; then ARCH="x64"; fi
if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi

POSTGRES_DIR="postgres-dist/postgres-${VARIANT}-${PLATFORM}-${ARCH}"
TEST_DIR="/tmp/pg-test-$$"  # Use PID to avoid conflicts
TEST_PORT=$((5433 + RANDOM % 1000))  # Random port to avoid conflicts

echo "🧪 Testing PostgreSQL + pgvector binaries for ${VARIANT}-${PLATFORM}-${ARCH}"
echo "   Using test directory: ${TEST_DIR}"
echo "   Using test port: ${TEST_PORT}"

# Debug: Check what's actually in the postgres-dist directory
echo "📁 Contents of postgres-dist directory:"
ls -la postgres-dist/ || echo "No postgres-dist directory found"

if [ -d "postgres-dist/" ]; then
    echo "📁 Contents of postgres-dist subdirectories:"
    ls -la postgres-dist/*/
fi

# Check binaries exist
if [ ! -f "${POSTGRES_DIR}/bin/postgres" ] && [ ! -f "${POSTGRES_DIR}/bin/postgres.exe" ]; then
    echo "❌ PostgreSQL binary not found at ${POSTGRES_DIR}/bin/postgres"
    echo "📁 Expected directory contents:"
    ls -la "${POSTGRES_DIR}/" 2>/dev/null || echo "Directory ${POSTGRES_DIR} does not exist"
    exit 1
fi

# Check for pgvector library (extension varies by platform)
VECTOR_LIB=""
if [ -f "${POSTGRES_DIR}/lib/vector.dylib" ]; then
    VECTOR_LIB="${POSTGRES_DIR}/lib/vector.dylib"
elif [ -f "${POSTGRES_DIR}/lib/vector.so" ]; then
    VECTOR_LIB="${POSTGRES_DIR}/lib/vector.so"
elif [ -f "${POSTGRES_DIR}/lib/vector.dll" ]; then
    VECTOR_LIB="${POSTGRES_DIR}/lib/vector.dll"
else
    echo "❌ pgvector library not found (checked .dylib, .so, .dll)"
    exit 1
fi
echo "📦 Found pgvector library: ${VECTOR_LIB}"

cleanup() {
    "${POSTGRES_DIR}/bin/pg_ctl" -D "${TEST_DIR}/data" -m fast stop >/dev/null 2>&1 || true
    rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

# Test 1: Binary versions
echo "📋 Testing binary versions..."
${POSTGRES_DIR}/bin/pg_upgrade --version
${POSTGRES_DIR}/bin/pg_controldata --version
${POSTGRES_DIR}/bin/pg_dump --version
${POSTGRES_DIR}/bin/pg_dumpall --version
${POSTGRES_DIR}/bin/pg_restore --version
${POSTGRES_DIR}/bin/postgres --version
${POSTGRES_DIR}/bin/initdb --version
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 --version

# Test 2: Database initialization
echo "🗃️  Testing database initialization..."
mkdir -p ${TEST_DIR}
${POSTGRES_DIR}/bin/initdb -D ${TEST_DIR}/data --auth-local=trust --auth-host=trust

# Test 3: Server startup
echo "🚀 Testing server startup..."
${POSTGRES_DIR}/bin/pg_ctl -D ${TEST_DIR}/data -o "-p ${TEST_PORT}" -l ${TEST_DIR}/logfile start

# Wait for server to be ready
sleep 2

# Test 4: Basic PostgreSQL functionality
echo "🔧 Testing basic PostgreSQL operations..."
# Connect as the current user to template1 database
TEST_USER=$(whoami)
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "SELECT version();"
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "CREATE TABLE test_table (id int, name text);"
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "INSERT INTO test_table VALUES (1, 'test');"
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "SELECT * FROM test_table;"

# Test 5: pgvector extension
echo "🔢 Testing pgvector extension..."
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "CREATE EXTENSION vector;"
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "SELECT '[1,2,3]'::vector;"

# Test 6: Vector operations
echo "📐 Testing vector operations..."
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "
CREATE TABLE test_vectors (id int, embedding vector(3));
INSERT INTO test_vectors VALUES 
  (1, '[1,2,3]'),
  (2, '[4,5,6]'),
  (3, '[7,8,9]');
SELECT id, embedding, embedding <-> '[1,2,3]' as distance 
FROM test_vectors 
ORDER BY distance;
"

# Exercise trigram functions and both supported index types.
${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} <<'SQL'
CREATE EXTENSION pg_trgm;
CREATE TABLE test_trigrams (name text);
INSERT INTO test_trigrams VALUES ('postgres'), ('postgress'), ('unrelated');
CREATE INDEX test_trigrams_gin ON test_trigrams USING gin (name gin_trgm_ops);
CREATE INDEX test_trigrams_gist ON test_trigrams USING gist (name gist_trgm_ops);
SET enable_seqscan = off;
DO $$
BEGIN
  IF similarity('postgres', 'postgres') <> 1 THEN
    RAISE EXCEPTION 'Unexpected trigram similarity';
  END IF;
  IF (SELECT count(*) FROM test_trigrams WHERE name ILIKE '%postgre%') <> 2 THEN
    RAISE EXCEPTION 'Trigram indexed search failed';
  END IF;
END $$;
SELECT name FROM test_trigrams ORDER BY name <-> 'postgres' LIMIT 2;
CREATE INDEX test_vectors_hnsw ON test_vectors USING hnsw (embedding vector_l2_ops);
DO $$
BEGIN
  IF (SELECT id FROM test_vectors ORDER BY embedding <-> '[1,2,3]'::vector LIMIT 1) <> 1 THEN
    RAISE EXCEPTION 'Vector nearest-neighbor search failed';
  END IF;
END $$;
SQL

# Test 7: JIT functionality (full variant only)
if [ "$VARIANT" = "full" ]; then
  echo "🔬 Testing JIT compilation (full variant)..."
  
  # Test basic JIT availability
  echo "   Testing JIT availability..."
  ${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "SHOW jit;" || {
    echo "❌ ERROR: JIT parameter not available"
    exit 1
  }
  
  # Test JIT can be enabled without errors
  echo "   Testing JIT enable/disable..."
  ${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "SET jit = on;" || {
    echo "❌ ERROR: Failed to enable JIT"
    exit 1
  }
  
  # Test JIT with actual compilation (force low cost threshold)
  echo "   Testing JIT compilation with complex query..."
  ${POSTGRES_DIR}/bin/psql -X -v ON_ERROR_STOP=1 -p ${TEST_PORT} -d template1 -U ${TEST_USER} -c "
    SET jit = on;
    SET jit_above_cost = 0;
    SET jit_optimize_above_cost = 0;
    SET jit_inline_above_cost = 0;
    
    -- Create larger dataset for JIT to kick in
    CREATE TABLE jit_test AS 
    SELECT i as id, random() as value, 'test_' || i as name 
    FROM generate_series(1, 1000) i;
    
    -- Complex query that should trigger JIT
    SELECT COUNT(*), AVG(value), MIN(value), MAX(value)
    FROM jit_test 
    WHERE value > 0.5 AND id % 3 = 0
    GROUP BY (id / 100)::int
    HAVING COUNT(*) > 5;
    
    DROP TABLE jit_test;
  " || {
    echo "❌ ERROR: JIT compilation failed"
    exit 1
  }
  
  echo "   ✅ JIT functionality working correctly"
  
elif [ "$VARIANT" = "lite" ]; then
  echo "ℹ️  Skipping JIT test (lite variant - JIT not available)"
else
  echo "⚠️  Unknown variant: $VARIANT - skipping JIT test"
fi

# Test 8: Clean shutdown
echo "🛑 Testing server shutdown..."
${POSTGRES_DIR}/bin/pg_ctl -D ${TEST_DIR}/data stop

# Cleanup
echo "🧹 Cleaning up test files..."
rm -rf ${TEST_DIR}

echo "✅ All tests passed! PostgreSQL + pgvector binaries are functional."