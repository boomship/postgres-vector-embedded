# Test Suite

Internal test files for the variant system. Downloads are gitignored and safe to run repeatedly.

## Usage

```bash
# Build first
npm run build

# Run all tests
node tests/run-all.js

# Or run specific test suites
node tests/test-variants.js
node tests/test-all-architectures.js  
node tests/test-validation.js

# Clean test downloads
rm -rf tests/downloads/ tests/temp/
```

## Test Files

- `run-all.js` - Complete test suite (recommended)
- `test-api-coverage.js` - **TypeScript API testing (33 tests)**
- `test-variants.js` - Basic variant testing with downloads
- `test-all-architectures.js` - All 9 platform combinations with downloads
- `test-validation.js` - Error handling and validation with downloads
- `downloads/` - Download cache (gitignored)
- `temp/` - Temporary test files (gitignored)

## Test Coverage

**API Testing (no downloads required):**
- ✅ Filename generation for all 9 platform combinations  
- ✅ URL generation and validation
- ✅ Platform/architecture validation logic
- ✅ Windows full variant rejection
- ✅ Invalid combination handling
- ✅ API options and defaults

**Integration Testing (downloads v0.2.0 binaries):**
- ✅ All 5 lite variants (macOS, Linux, Windows)
- ✅ All 4 full variants (macOS, Linux only)  
- ✅ Platform auto-detection
- ✅ Cross-platform file verification (.exe handling)
- ✅ Binary structure validation