import { existsSync } from 'node:fs';
import { access, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar';
import { detectPlatform, getDownloadUrl, validatePlatformArch } from './platform.js';
/**
 * Download and extract PostgreSQL + pgvector + pg_trgm binaries for the current or specified platform
 */
export async function downloadBinaries(options) {
    const { targetDir, platform: requestedPlatform, arch: requestedArch, variant = 'lite', version = await getPackageVersion(), repository = 'boomship/postgres-vector-embedded', force = false, } = options;
    // Detect platform if not specified
    const { platform, arch } = requestedPlatform && requestedArch
        ? { platform: requestedPlatform, arch: requestedArch }
        : detectPlatform();
    validatePlatformArch(platform, arch, variant);
    console.log(`📦 Downloading PostgreSQL + pgvector + pg_trgm binaries for ${variant}-${platform}-${arch}`);
    // Check if binaries already exist
    const binariesPath = join(targetDir, 'bin', 'postgres');
    if (!force && (existsSync(binariesPath) || existsSync(`${binariesPath}.exe`))) {
        await verifyInstallation(targetDir);
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
        console.log('✅ PostgreSQL + pgvector + pg_trgm binaries downloaded and extracted successfully');
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
    const criticalFiles = [
        'bin/postgres',
        'bin/pg_ctl',
        'bin/initdb',
        'bin/psql',
        'bin/pg_upgrade',
        'bin/pg_controldata',
        'bin/pg_dump',
        'bin/pg_dumpall',
        'bin/pg_restore',
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
    for (const extension of ['vector', 'pg_trgm']) {
        const libraries = ['so', 'dylib', 'dll'].flatMap((suffix) => [
            `lib/${extension}.${suffix}`,
            `lib/postgresql/${extension}.${suffix}`,
        ]);
        if (!libraries.some((file) => existsSync(join(targetDir, file)))) {
            throw new Error(`${extension} extension library missing`);
        }
        const shareDirs = ['share/extension', 'share/postgresql/extension'];
        let found = false;
        for (const dir of shareDirs) {
            try {
                const files = await readdir(join(targetDir, dir));
                if (files.includes(`${extension}.control`) &&
                    files.some((file) => file.startsWith(`${extension}--`) && file.endsWith('.sql'))) {
                    found = true;
                    break;
                }
            }
            catch {
                // Try the other installation layout.
            }
        }
        if (!found)
            throw new Error(`${extension} extension control or SQL files missing`);
    }
}
/**
 * Get the current package version from package.json
 */
async function getPackageVersion() {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    return packageJson.version;
}
//# sourceMappingURL=download.js.map