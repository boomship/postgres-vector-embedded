import { arch, platform } from 'node:os';
import type { Architecture, Platform, PlatformInfo } from './types.js';

/**
 * Detect the current platform and architecture
 */
export function detectPlatform(): PlatformInfo {
  const nodePlatform = platform();
  const nodeArch = arch();

  // Map Node.js platform names to our platform type
  let detectedPlatform: Platform;
  switch (nodePlatform) {
    case 'darwin':
      detectedPlatform = 'darwin';
      break;
    case 'linux':
      detectedPlatform = 'linux';
      break;
    case 'win32':
      detectedPlatform = 'win32';
      break;
    default:
      throw new Error(`Unsupported platform: ${nodePlatform}`);
  }

  // Map Node.js architecture names to our architecture type
  let detectedArch: Architecture;
  switch (nodeArch) {
    case 'x64':
      detectedArch = 'x64';
      break;
    case 'arm64':
      detectedArch = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${nodeArch}`);
  }

  return {
    platform: detectedPlatform,
    arch: detectedArch,
  };
}

/**
 * Validate platform and architecture combination
 */
export function validatePlatformArch(platform: Platform, arch: Architecture): void {
  const validCombinations: [Platform, Architecture][] = [
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['win32', 'x64'],
  ];

  const isValid = validCombinations.some(([p, a]) => p === platform && a === arch);
  if (!isValid) {
    throw new Error(`Unsupported platform/architecture combination: ${platform}-${arch}`);
  }
}

/**
 * Generate the binary filename for a given platform and architecture
 */
export function getBinaryFilename(platform: Platform, arch: Architecture): string {
  validatePlatformArch(platform, arch);
  return `postgres-${platform}-${arch}.tar.gz`;
}

/**
 * Get the download URL for binaries from GitHub Releases
 */
export function getDownloadUrl(
  repository: string,
  version: string,
  platform: Platform,
  arch: Architecture
): string {
  const filename = getBinaryFilename(platform, arch);
  const tagVersion = version.startsWith('v') ? version : `v${version}`;
  return `https://github.com/${repository}/releases/download/${tagVersion}/${filename}`;
}
