import { downloadBinaries } from '../dist/index.js';

console.log('🧪 Testing validation logic...');

const validationTests = [
  {
    name: 'Invalid platform',
    options: {
      targetDir: './tests/temp/invalid-platform',
      platform: 'invalidOS',
      arch: 'x64',
      variant: 'lite',
      version: '0.2.0',
    },
    shouldFail: true,
  },
  {
    name: 'Invalid architecture',
    options: {
      targetDir: './tests/temp/invalid-arch',
      platform: 'darwin',
      arch: 'invalidArch',
      variant: 'lite',
      version: '0.2.0',
    },
    shouldFail: true,
  },
  {
    name: 'Invalid variant',
    options: {
      targetDir: './tests/temp/invalid-variant',
      platform: 'darwin',
      arch: 'arm64',
      variant: 'invalidVariant',
      version: '0.2.0',
    },
    shouldFail: true,
  },
  {
    name: 'Windows full variant restriction',
    options: {
      targetDir: './tests/temp/win-full-blocked',
      platform: 'win32',
      arch: 'x64',
      variant: 'full',
      version: '0.2.0',
    },
    shouldFail: true,
  },
  {
    name: 'Valid combination (baseline)',
    options: {
      targetDir: './tests/temp/valid-baseline',
      platform: 'darwin',
      arch: 'arm64',
      variant: 'lite',
      version: '0.2.0',
    },
    shouldFail: false,
  },
];

let passed = 0;
let failed = 0;

for (const test of validationTests) {
  try {
    console.log(`\n📋 Testing: ${test.name}`);
    await downloadBinaries(test.options);

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

console.log('\n🎯 Validation testing complete!');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All validation tests passed!');
} else {
  console.log('\n⚠️  Some validation tests failed.');
  process.exit(1);
}
