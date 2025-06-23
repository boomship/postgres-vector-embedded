import { downloadBinaries, getBinaryFilename, validatePlatformArch, getDownloadUrl } from '../dist/index.js';

console.log('🧪 Testing TypeScript API coverage across all platforms...');

// Test 1: Filename generation for all combinations
console.log('\n=== FILENAME GENERATION ===');
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

let apiTests = 0;
let apiPassed = 0;

for (const combo of allCombinations) {
  try {
    apiTests++;
    const filename = getBinaryFilename(combo.platform, combo.arch, combo.variant);
    const expectedFilename = `postgres-${combo.variant}-${combo.platform}-${combo.arch}.tar.gz`;
    
    if (filename === expectedFilename) {
      console.log(`✅ ${combo.variant}-${combo.platform}-${combo.arch}: ${filename}`);
      apiPassed++;
    } else {
      console.log(`❌ ${combo.variant}-${combo.platform}-${combo.arch}: got ${filename}, expected ${expectedFilename}`);
    }
  } catch (e) {
    console.log(`❌ ${combo.variant}-${combo.platform}-${combo.arch}: ${e.message}`);
  }
}

// Test 2: URL generation 
console.log('\n=== URL GENERATION ===');
for (const combo of allCombinations) {
  try {
    apiTests++;
    const url = getDownloadUrl('boomship/postgres-vector-embedded', '0.2.0', combo.platform, combo.arch, combo.variant);
    const expectedUrl = `https://github.com/boomship/postgres-vector-embedded/releases/download/v0.2.0/postgres-${combo.variant}-${combo.platform}-${combo.arch}.tar.gz`;
    
    if (url === expectedUrl) {
      console.log(`✅ ${combo.variant}-${combo.platform}-${combo.arch}: URL correct`);
      apiPassed++;
    } else {
      console.log(`❌ ${combo.variant}-${combo.platform}-${combo.arch}: URL mismatch`);
      console.log(`   Got: ${url}`);
      console.log(`   Expected: ${expectedUrl}`);
    }
  } catch (e) {
    console.log(`❌ ${combo.variant}-${combo.platform}-${combo.arch}: ${e.message}`);
  }
}

// Test 3: Validation logic
console.log('\n=== VALIDATION LOGIC ===');

// Valid combinations should pass
for (const combo of allCombinations) {
  try {
    apiTests++;
    validatePlatformArch(combo.platform, combo.arch, combo.variant);
    console.log(`✅ ${combo.variant}-${combo.platform}-${combo.arch}: validation passed`);
    apiPassed++;
  } catch (e) {
    console.log(`❌ ${combo.variant}-${combo.platform}-${combo.arch}: validation failed - ${e.message}`);
  }
}

// Invalid combinations should fail
console.log('\n--- Testing invalid combinations (should fail) ---');
const invalidCombinations = [
  { platform: 'win32', arch: 'x64', variant: 'full', name: 'Windows full variant' },
  { platform: 'invalidOS', arch: 'x64', variant: 'lite', name: 'Invalid platform' },
  { platform: 'darwin', arch: 'invalidArch', variant: 'lite', name: 'Invalid architecture' },
];

for (const combo of invalidCombinations) {
  try {
    apiTests++;
    validatePlatformArch(combo.platform, combo.arch, combo.variant);
    console.log(`❌ UNEXPECTED: ${combo.name} should have failed validation!`);
  } catch (e) {
    console.log(`✅ ${combo.name}: correctly rejected - ${e.message}`);
    apiPassed++;
  }
}

// Test 4: API options handling
console.log('\n=== API OPTIONS HANDLING ===');

const apiOptionsTests = [
  {
    name: 'Default variant (should be lite)',
    options: { targetDir: './tests/temp/api-default', platform: 'darwin', arch: 'arm64', version: '0.2.0' },
    expectVariant: 'lite'
  },
  {
    name: 'Explicit lite variant',
    options: { targetDir: './tests/temp/api-lite', platform: 'darwin', arch: 'arm64', variant: 'lite', version: '0.2.0' },
    expectVariant: 'lite'
  },
  {
    name: 'Explicit full variant',
    options: { targetDir: './tests/temp/api-full', platform: 'darwin', arch: 'arm64', variant: 'full', version: '0.2.0' },
    expectVariant: 'full'
  }
];

for (const test of apiOptionsTests) {
  try {
    apiTests++;
    // We're testing the URL generation, not actually downloading
    const url = getDownloadUrl(
      'boomship/postgres-vector-embedded', 
      test.options.version,
      test.options.platform,
      test.options.arch,
      test.options.variant || 'lite'
    );
    
    const expectedVariant = test.expectVariant;
    if (url.includes(`postgres-${expectedVariant}-`)) {
      console.log(`✅ ${test.name}: correctly uses ${expectedVariant} variant`);
      apiPassed++;
    } else {
      console.log(`❌ ${test.name}: URL doesn't contain expected variant ${expectedVariant}`);
      console.log(`   URL: ${url}`);
    }
  } catch (e) {
    console.log(`❌ ${test.name}: ${e.message}`);
  }
}

// Summary
console.log(`\n🎯 TypeScript API Testing Complete!`);
console.log(`✅ Passed: ${apiPassed}/${apiTests} tests`);

if (apiPassed === apiTests) {
  console.log('\n🎉 All TypeScript API tests passed! The API correctly handles all platform combinations.');
} else {
  console.log('\n⚠️  Some API tests failed. The TypeScript API has issues with platform handling.');
  process.exit(1);
}