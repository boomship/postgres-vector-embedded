import { existsSync } from 'node:fs';
import { access, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar';
import { detectPlatform, getDownloadUrl, validatePlatformArch } from './platform.js';
/**
 * Download and extract PostgreSQL + pgvector binaries for the current or specified platform
 */
export async function downloadBinaries(options) {
    const { targetDir, platform: requestedPlatform, arch: requestedArch, variant = 'lite', version = await getPackageVersion(), repository = 'boomship/postgres-vector-embedded', force = false, } = options;
    // Detect platform if not specified
    const { platform, arch } = requestedPlatform && requestedArch
        ? { platform: requestedPlatform, arch: requestedArch }
        : detectPlatform();
    validatePlatformArch(platform, arch, variant);
    console.log(`📦 Downloading PostgreSQL + pgvector binaries for ${variant}-${platform}-${arch}`);
    // Check if binaries already exist
    const binariesPath = join(targetDir, 'bin', 'postgres');
    if (!force && existsSync(binariesPath)) {
        console.log('✅ Binaries already exist, skipping download. Use force: true to re-download.');
        return;
    }
    // Create target directory
    await mkdir(targetDir, { recursive: true });
    // Download and extract
    const downloadUrl = getDownloadUrl(repository, version, platform, arch, variant);
    console.log(`🌐 Downloading from: ${downloadUrl}`);
    try {
        await downloadAndExtract(downloadUrl, targetDir);
        console.log('✅ PostgreSQL + pgvector binaries downloaded and extracted successfully');
        // Verify critical files exist
        await verifyInstallation(targetDir);
        console.log('✅ Installation verified');
    }
    catch (error) {
        // Clean up on failure
        try {
            await rm(targetDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
        throw new Error(`Failed to download binaries: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Download and extract a tar.gz file
 */
async function downloadAndExtract(url, targetDir) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    if (!response.body) {
        throw new Error('No response body');
    }
    // Create extraction pipeline: fetch -> gunzip -> tar extract
    const gunzip = createGunzip();
    const tarExtract = extract({
        cwd: targetDir,
        strip: 1, // Remove the top-level directory from the archive
    });
    // Convert fetch response to buffer and then to readable stream
    const buffer = Buffer.from(await response.arrayBuffer());
    const nodeReadable = Readable.from(buffer);
    // Pipeline the download through gunzip and tar extraction
    await pipeline(nodeReadable, gunzip, tarExtract);
}
/**
 * Verify that critical PostgreSQL files were installed correctly
 */
async function verifyInstallation(targetDir) {
    // Critical PostgreSQL binaries
    const criticalFiles = ['bin/postgres', 'bin/pg_ctl', 'bin/initdb', 'bin/psql'];
    // Check for pgvector extension (our builds place it directly in lib/)
    const vectorLibPaths = [
        'lib/vector.so', // Linux
        'lib/vector.dylib', // macOS
        'lib/vector.dll', // Windows
    ];
    // Verify critical binaries exist (try both Unix and Windows paths)
    for (const file of criticalFiles) {
        const unixPath = join(targetDir, file);
        const windowsPath = join(targetDir, `${file}.exe`);
        let found = false;
        try {
            await access(unixPath);
            found = true;
        }
        catch {
            try {
                await access(windowsPath);
                found = true;
            }
            catch {
                // Neither path exists
            }
        }
        if (!found) {
            throw new Error(`Critical file missing: ${file} (checked both Unix and Windows paths)`);
        }
    }
    // Check for pgvector library (try multiple possible locations)
    let vectorFound = false;
    for (const vectorPath of vectorLibPaths) {
        try {
            await access(join(targetDir, vectorPath));
            vectorFound = true;
            console.log(`✅ Found pgvector at: ${vectorPath}`);
            break;
        }
        catch {
            // Continue checking other paths
        }
    }
    if (!vectorFound) {
        throw new Error(`pgvector extension not found. Checked: ${vectorLibPaths.join(', ')}`);
    }
}
/**
 * Get the current package version from package.json
 */
async function getPackageVersion() {
    try {
        // Try to read from package.json in the same directory as this module
        const packageJsonPath = join(dirname(new URL(import.meta.url).pathname), '..', '..', 'package.json');
        const packageJson = await import(packageJsonPath, { with: { type: 'json' } });
        return packageJson.default.version;
    }
    catch {
        // Fallback version if package.json can't be read (should match current package.json)
        return '0.2.1';
    }
}
//# sourceMappingURL=download.js.map