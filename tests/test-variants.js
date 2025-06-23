import { downloadBinaries } from '../dist/index.js';

console.log('🧪 Testing variant system...');

const tests = [
  {
    name: 'Lite variant (current platform)',
    options: {
      targetDir: './tests/downloads/lite',
      variant: 'lite',
      version: '0.2.0',
    },
  },
  {
    name: 'Full variant (current platform)',
    options: {
      targetDir: './tests/downloads/full',
      variant: 'full',
      version: '0.2.0',
    },
  },
  {
    name: 'Windows lite variant',
    options: {
      targetDir: './tests/downloads/win-lite',
      variant: 'lite',
      version: '0.2.0',
      platform: 'win32',
      arch: 'x64',
    },
  },
  {
    name: 'Windows full variant (should reject)',
    options: {
      targetDir: './tests/downloads/win-full',
      variant: 'full',
      version: '0.2.0',
      platform: 'win32',
      arch: 'x64',
    },
    shouldFail: true,
  },
];

for (const test of tests) {
  try {
    console.log(`\n📋 Testing: ${test.name}`);
    await downloadBinaries(test.options);

    if (test.shouldFail) {
      console.log(`❌ UNEXPECTED: ${test.name} should have failed!`);
    } else {
      console.log(`✅ PASS: ${test.name}`);
    }
  } catch (e) {
    if (test.shouldFail) {
      console.log(`✅ PASS: ${test.name} correctly rejected - ${e.message}`);
    } else {
      console.log(`❌ FAIL: ${test.name} - ${e.message}`);
    }
  }
}

console.log('\n🎯 Variant system testing complete!');
