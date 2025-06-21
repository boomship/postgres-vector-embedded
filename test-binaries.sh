#!/bin/bash
set -e  # Exit on any error

# Basic functional test for PostgreSQL + pgvector binaries
# Tests that the built binaries actually work, not just compile

PLATFORM=${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}
ARCH=${ARCH:-$(uname -m)}
if [ "$ARCH" = "x86_64" ]; then ARCH="x64"; fi
if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi

POSTGRES_DIR="dist/postgres-${PLATFORM}-${ARCH}"
TEST_DIR="/tmp/pg-test-$$"  # Use PID to avoid conflicts
TEST_PORT=$((5433 + RANDOM % 1000))  # Random port to avoid conflicts

echo "🧪 Testing PostgreSQL + pgvector binaries for ${PLATFORM}-${ARCH}"
echo "   Using test directory: ${TEST_DIR}"
echo "   Using test port: ${TEST_PORT}"

# Debug: Check what's actually in the dist directory
echo "📁 Contents of dist directory:"
ls -la dist/ || echo "No dist directory found"

if [ -d "dist/" ]; then
    echo "📁 Contents of dist subdirectories:"
    ls -la dist/*/
fi

# Check binaries exist
if [ ! -f "${POSTGRES_DIR}/bin/postgres" ]; then
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

# Test 1: Binary versions
echo "📋 Testing binary versions..."
${POSTGRES_DIR}/bin/postgres --version
${POSTGRES_DIR}/bin/initdb --version
${POSTGRES_DIR}/bin/psql --version

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
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "SELECT version();"
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "CREATE TABLE test_table (id int, name text);"
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "INSERT INTO test_table VALUES (1, 'test');"
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "SELECT * FROM test_table;"

# Test 5: pgvector extension
echo "🔢 Testing pgvector extension..."
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "CREATE EXTENSION vector;"
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "SELECT '[1,2,3]'::vector;"

# Test 6: Vector operations
echo "📐 Testing vector operations..."
${POSTGRES_DIR}/bin/psql -p ${TEST_PORT} -d postgres -c "
CREATE TABLE test_vectors (id int, embedding vector(3));
INSERT INTO test_vectors VALUES 
  (1, '[1,2,3]'),
  (2, '[4,5,6]'),
  (3, '[7,8,9]');
SELECT id, embedding, embedding <-> '[1,2,3]' as distance 
FROM test_vectors 
ORDER BY distance;
"

# Test 7: Clean shutdown
echo "🛑 Testing server shutdown..."
${POSTGRES_DIR}/bin/pg_ctl -D ${TEST_DIR}/data stop

# Cleanup
echo "🧹 Cleaning up test files..."
rm -rf ${TEST_DIR}

echo "✅ All tests passed! PostgreSQL + pgvector binaries are functional."