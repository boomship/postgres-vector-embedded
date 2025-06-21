import { existsSync } from 'node:fs';
import { access, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar';
import { detectPlatform, getDownloadUrl, validatePlatformArch } from './platform.js';
import type { DownloadOptions } from './types.js';

/**
 * Download and extract PostgreSQL + pgvector binaries for the current or specified platform
 */
export async function downloadBinaries(options: DownloadOptions): Promise<void> {
  const {
    targetDir,
    platform: requestedPlatform,
    arch: requestedArch,
    version = await getPackageVersion(),
    repository = 'boomship/postgres-vector-embedded',
    force = false,
  } = options;

  // Detect platform if not specified
  const { platform, arch } =
    requestedPlatform && requestedArch
      ? { platform: requestedPlatform, arch: requestedArch }
      : detectPlatform();

  validatePlatformArch(platform, arch);

  console.log(`📦 Downloading PostgreSQL + pgvector binaries for ${platform}-${arch}`);

  // Check if binaries already exist
  const binariesPath = join(targetDir, 'bin', 'postgres');
  if (!force && existsSync(binariesPath)) {
    console.log('✅ Binaries already exist, skipping download. Use force: true to re-download.');
    return;
  }

  // Create target directory
  await mkdir(targetDir, { recursive: true });

  // Download and extract
  const downloadUrl = getDownloadUrl(repository, version, platform, arch);
  console.log(`🌐 Downloading from: ${downloadUrl}`);

  try {
    await downloadAndExtract(downloadUrl, targetDir);
    console.log('✅ PostgreSQL + pgvector binaries downloaded and extracted successfully');

    // Verify critical files exist
    await verifyInstallation(targetDir);
    console.log('✅ Installation verified');
  } catch (error) {
    // Clean up on failure
    try {
      await rm(targetDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(
      `Failed to download binaries: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Download and extract a tar.gz file
 */
async function downloadAndExtract(url: string, targetDir: string): Promise<void> {
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
async function verifyInstallation(targetDir: string): Promise<void> {
  const criticalFiles = [
    'bin/postgres',
    'bin/pg_ctl',
    'bin/initdb',
    'bin/psql',
    'lib/postgresql/vector.so', // pgvector extension (Linux/macOS)
  ];

  for (const file of criticalFiles) {
    const filePath = join(targetDir, file);
    try {
      await access(filePath);
    } catch {
      // For Windows, .so files will be .dll
      if (file.endsWith('.so')) {
        const windowsFile = file.replace('.so', '.dll');
        const windowsPath = join(targetDir, windowsFile);
        try {
          await access(windowsPath);
          continue;
        } catch {
          // Fall through to error
        }
      }
      throw new Error(`Critical file missing: ${file}`);
    }
  }
}

/**
 * Get the current package version from package.json
 */
async function getPackageVersion(): Promise<string> {
  try {
    // Try to read from package.json in the same directory as this module
    const packageJsonPath = join(
      dirname(new URL(import.meta.url).pathname),
      '..',
      '..',
      'package.json'
    );
    const packageJson = await import(packageJsonPath, { with: { type: 'json' } });
    return packageJson.default.version;
  } catch {
    // Fallback version if package.json can't be read
    return '0.1.0';
  }
}
