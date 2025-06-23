import { arch, platform } from 'node:os';
import type { Architecture, Platform, PlatformInfo, Variant } from './types.js';

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
 * Validate platform, architecture, and variant combination
 */
export function validatePlatformArch(
  platform: Platform,
  arch: Architecture,
  variant: Variant = 'lite'
): void {
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

  // Check variant-specific restrictions
  if (variant === 'full' && platform === 'win32') {
    throw new Error(`Full variant is not available on Windows. Use 'lite' variant instead.`);
  }
}

/**
 * Generate the binary filename for a given platform, architecture, and variant
 */
export function getBinaryFilename(
  platform: Platform,
  arch: Architecture,
  variant: Variant = 'lite'
): string {
  validatePlatformArch(platform, arch, variant);
  return `postgres-${variant}-${platform}-${arch}.tar.gz`;
}

/**
 * Get the download URL for binaries from GitHub Releases
 */
export function getDownloadUrl(
  repository: string,
  version: string,
  platform: Platform,
  arch: Architecture,
  variant: Variant = 'lite'
): string {
  const filename = getBinaryFilename(platform, arch, variant);
  const tagVersion = version.startsWith('v') ? version : `v${version}`;
  return `https://github.com/${repository}/releases/download/${tagVersion}/${filename}`;
}
