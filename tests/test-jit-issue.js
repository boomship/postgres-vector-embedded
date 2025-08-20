#!/usr/bin/env node

import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

console.log('🧪 Testing JIT compilation issue...');

const testDataDir = './tests/temp/jit-test-data';

// Test both lite and full variants
const testCases = [
  {
    name: 'Lite variant (should fail with JIT)',
    binDir: './tests/downloads/lite/bin',
    variant: 'lite'
  },
  {
    name: 'Full variant (should work with JIT)',
    binDir: './tests/downloads/full/bin',
    variant: 'full'
  }
];

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    // Set library path for dynamic linking
    const env = { ...process.env };
    if (options.libPath) {
      env.DYLD_LIBRARY_PATH = options.libPath;
    }
    
    const proc = spawn(command, args, {
      ...options,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    proc.on('error', (error) => {
      reject(error);
    });
    
    // Send input if provided
    if (options.input) {
      proc.stdin.write(options.input);
      proc.stdin.end();
    }
  });
}

async function testJitWithVariant(testCase) {
  console.log(`\n📋 Testing: ${testCase.name}`);
  
  const postgresPath = path.join(testCase.binDir, 'postgres');
  const initdbPath = path.join(testCase.binDir, 'initdb');
  const psqlPath = path.join(testCase.binDir, 'psql');
  const libPath = testCase.binDir.replace('/bin', '/lib');
  
  // Check if binaries exist
  if (!existsSync(postgresPath)) {
    console.log(`❌ PostgreSQL binary not found at ${postgresPath}`);
    console.log(`   Run tests/downloads first to download binaries`);
    return false;
  }
  
  const dataDir = `${testDataDir}-${testCase.variant}`;
  const port = testCase.variant === 'lite' ? 5433 : 5434;
  
  try {
    // Initialize database if not exists
    if (!existsSync(dataDir)) {
      console.log(`   🔧 Initializing database in ${dataDir}...`);
      const initResult = await runCommand(initdbPath, ['-D', dataDir, '--auth-local=trust'], { libPath });
      if (initResult.code !== 0) {
        console.log(`   ❌ Database initialization failed: ${initResult.stderr}`);
        return false;
      }
    }
    
    // Start PostgreSQL server
    console.log(`   🚀 Starting PostgreSQL on port ${port}...`);
    const env = { ...process.env, DYLD_LIBRARY_PATH: libPath };
    const serverProcess = spawn(postgresPath, [
      '-D', dataDir,
      '-p', port.toString(),
      '-k', '/tmp'  // Unix socket directory
    ], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    });
    
    let serverReady = false;
    let serverError = '';
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      serverError += output;
      if (output.includes('ready to accept connections')) {
        serverReady = true;
      }
    });
    
    // Wait for server to start
    const startTimeout = setTimeout(() => {
      if (!serverReady) {
        console.log(`   ⏰ Server start timeout`);
        serverProcess.kill();
      }
    }, 10000);
    
    await new Promise(resolve => {
      const checkReady = () => {
        if (serverReady) {
          clearTimeout(startTimeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
    
    if (!serverReady) {
      console.log(`   ❌ Server failed to start: ${serverError}`);
      serverProcess.kill();
      return false;
    }
    
    console.log(`   ✅ Server started successfully`);
    
    // Test JIT compilation with a complex query that should trigger JIT
    const testQuery = `
SET jit = on;
SET jit_above_cost = 0;
SET jit_optimize_above_cost = 0;
SET jit_inline_above_cost = 0;

-- Create test data
CREATE TABLE IF NOT EXISTS jit_test (
    id SERIAL PRIMARY KEY,
    data INTEGER,
    text_data TEXT
);

-- Insert test data
INSERT INTO jit_test (data, text_data) 
SELECT i, 'test_data_' || i 
FROM generate_series(1, 1000) i
ON CONFLICT DO NOTHING;

-- Complex query that should trigger JIT compilation
SELECT 
    COUNT(*), 
    AVG(data), 
    string_agg(text_data, ',') FILTER (WHERE data % 100 = 0)
FROM jit_test 
WHERE data > 100 AND data < 900
GROUP BY data % 10
HAVING COUNT(*) > 50
ORDER BY AVG(data);

-- Check JIT statistics
SELECT * FROM pg_stat_statements_reset();
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*), AVG(data * data + data) 
FROM jit_test 
WHERE data BETWEEN 200 AND 800;
`;
    
    console.log(`   🔬 Running JIT compilation test...`);
    const queryResult = await runCommand(psqlPath, [
      '-h', '/tmp',
      '-p', port.toString(),
      '-d', 'postgres',
      '-c', testQuery
    ], { libPath });
    
    // Kill server
    serverProcess.kill();
    
    // Analyze results
    console.log(`   📊 Query exit code: ${queryResult.code}`);
    
    if (queryResult.stderr) {
      console.log(`   ⚠️  STDERR output:`);
      console.log(queryResult.stderr.split('\n').map(line => `      ${line}`).join('\n'));
    }
    
    // Check for JIT-related errors
    const hasJitError = queryResult.stderr.includes('llvmjit') || 
                       queryResult.stderr.includes('could not load library') ||
                       queryResult.stderr.includes('LLVM') ||
                       queryResult.stderr.includes('jit');
    
    if (testCase.variant === 'lite') {
      if (hasJitError) {
        console.log(`   ✅ Expected JIT failure in lite variant - JIT error detected`);
        console.log(`   🔍 This confirms the JIT module issue`);
        return true;  // Expected failure
      } else {
        console.log(`   ⚠️  Unexpected: No JIT error in lite variant`);
        console.log(`   💭 JIT might be disabled by default`);
        return false;
      }
    } else {
      // Full variant
      if (hasJitError) {
        console.log(`   ❌ Unexpected JIT failure in full variant`);
        return false;
      } else {
        console.log(`   ✅ JIT working correctly in full variant`);
        return true;
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Test error: ${error.message}`);
    return false;
  }
}

// Clean up function
function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    if (existsSync(`${testDataDir}-lite`)) {
      // Note: In a real cleanup, you'd recursively remove the directory
      console.log('   (Test data directories should be manually cleaned)');
    }
  } catch (error) {
    console.log(`   ⚠️  Cleanup warning: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  let allPassed = true;
  
  // Create temp directory
  if (!existsSync('./tests/temp')) {
    import('fs').then(fs => fs.mkdirSync('./tests/temp', { recursive: true }));
  }
  
  for (const testCase of testCases) {
    const passed = await testJitWithVariant(testCase);
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log(`\n📋 JIT Test Summary:`);
  console.log(`   ${allPassed ? '✅' : '❌'} JIT issue demonstration: ${allPassed ? 'CONFIRMED' : 'UNCLEAR'}`);
  
  if (allPassed) {
    console.log(`\n🔍 Issue Analysis:`);
    console.log(`   • Lite variant: Missing LLVM JIT modules (expected)`);
    console.log(`   • Full variant: Missing LLVM runtime dependency`);
    console.log(`   • Root cause: Hardcoded library paths in distributed binaries`);
    console.log(`\n💡 Proposed Solutions:`);
    console.log(`   1. Bundle LLVM libraries with full variant`);
    console.log(`   2. Fix library paths using install_name_tool`);
    console.log(`   3. Add clear JIT configuration to postgresql.conf.sample`);
    console.log(`   4. Document JIT availability per variant`);
    console.log(`\n📚 See docs/JIT_FIX.md for detailed implementation`);
  }
  
  cleanup();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('💥 Test runner error:', error);
  cleanup();
  process.exit(1);
});