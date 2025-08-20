import { downloadBinaries } from '../dist/index.js';

console.log('🧪 Running comprehensive test suite...');

// Test JIT issue first (diagnostic test)
console.log('\n=== JIT ISSUE DIAGNOSIS ===');
try {
  console.log('🔬 Running JIT issue test...');
  const { spawn } = await import('child_process');
  const jitTest = spawn('node', ['tests/test-jit-issue.js'], { stdio: 'inherit' });
  await new Promise((resolve) => {
    jitTest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ PASS: JIT issue successfully demonstrated');
      } else {
        console.log('⚠️  INFO: JIT test completed with warnings');
      }
      resolve();
    });
  });
} catch (e) {
  console.log('❌ INFO: JIT test unavailable -', e.message);
}

// Test current platform detection and basic functionality
console.log('\n=== BASIC FUNCTIONALITY ===');
try {
  console.log('📋 Testing current platform auto-detection...');
  await downloadBinaries({
    targetDir: './tests/downloads/auto-detect-lite',
    variant: 'lite',
    version: '0.2.0',
  });
  console.log('✅ PASS: Auto-detection works');
} catch (e) {
  console.log('❌ FAIL: Auto-detection -', e.message);
}

// Test all explicit platform/arch combinations
console.log('\n=== ALL ARCHITECTURES ===');
const allCombinations = [
  // Lite variants (all platforms)
  { platform: 'darwin', arch: 'arm64', variant: 'lite' },
  { platform: 'darwin', arch: 'x64', variant: 'lite' },
  { platform: 'linux', arch: 'x64', variant: 'lite' },
  { platform: 'linux', arch: 'arm64', variant: 'lite' },
  { platform: 'win32', arch: 'x64', variant: 'lite' },

  // Full variants (macOS and Linux only)
  { platform: 'darwin', arch: 'arm64', variant: 'full' },
  { platform: 'darwin', arch: 'x64', variant: 'full' },
  { platform: 'linux', arch: 'x64', variant: 'full' },
  { platform: 'linux', arch: 'arm64', variant: 'full' },
];

for (const combo of allCombinations) {
  try {
    const name = `${combo.variant}-${combo.platform}-${combo.arch}`;
    console.log(`📋 Testing: ${name}`);

    await downloadBinaries({
      targetDir: `./tests/downloads/${name}`,
      platform: combo.platform,
      arch: combo.arch,
      variant: combo.variant,
      version: '0.2.0',
    });

    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${combo.variant}-${combo.platform}-${combo.arch} - ${e.message}`);
  }
}

// Test validation (should fail)
console.log('\n=== VALIDATION TESTS ===');
try {
  console.log('📋 Testing Windows full variant rejection...');
  await downloadBinaries({
    targetDir: './tests/temp/should-fail',
    platform: 'win32',
    arch: 'x64',
    variant: 'full',
    version: '0.2.0',
  });
  console.log('❌ UNEXPECTED: Windows full should have been rejected!');
} catch (e) {
  console.log('✅ PASS: Windows full correctly rejected -', e.message);
}

console.log('\n🎯 Test suite complete!');
