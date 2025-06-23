import { downloadBinaries } from '../dist/index.js';

console.log('🧪 Testing all architectures and variants...');

// All available combinations from v0.2.0
const testMatrix = [
  // Lite variants (all platforms)
  { platform: 'darwin', arch: 'arm64', variant: 'lite', name: 'macOS ARM64 lite' },
  { platform: 'darwin', arch: 'x64', variant: 'lite', name: 'macOS x64 lite' },
  { platform: 'linux', arch: 'x64', variant: 'lite', name: 'Linux x64 lite' },
  { platform: 'linux', arch: 'arm64', variant: 'lite', name: 'Linux ARM64 lite' },
  { platform: 'win32', arch: 'x64', variant: 'lite', name: 'Windows x64 lite' },

  // Full variants (macOS and Linux only)
  { platform: 'darwin', arch: 'arm64', variant: 'full', name: 'macOS ARM64 full' },
  { platform: 'darwin', arch: 'x64', variant: 'full', name: 'macOS x64 full' },
  { platform: 'linux', arch: 'x64', variant: 'full', name: 'Linux x64 full' },
  { platform: 'linux', arch: 'arm64', variant: 'full', name: 'Linux ARM64 full' },

  // Invalid combinations (should reject)
  {
    platform: 'win32',
    arch: 'x64',
    variant: 'full',
    name: 'Windows x64 full (should reject)',
    shouldFail: true,
  },
];

let passed = 0;
let failed = 0;

for (const test of testMatrix) {
  try {
    console.log(`\n📋 Testing: ${test.name}`);

    const targetDir = `./tests/downloads/${test.variant}-${test.platform}-${test.arch}`;

    await downloadBinaries({
      targetDir,
      platform: test.platform,
      arch: test.arch,
      variant: test.variant,
      version: '0.2.0',
    });

    if (test.shouldFail) {
      console.log(`❌ UNEXPECTED: ${test.name} should have failed!`);
      failed++;
    } else {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    }
  } catch (e) {
    if (test.shouldFail) {
      console.log(`✅ PASS: ${test.name} correctly rejected - ${e.message}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name} - ${e.message}`);
      failed++;
    }
  }
}

console.log('\n🎯 Testing complete!');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${testMatrix.length} tests`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Variant system works across all architectures.');
} else {
  console.log('\n⚠️  Some tests failed. Check the output above.');
  process.exit(1);
}
