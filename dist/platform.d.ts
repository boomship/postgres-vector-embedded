import type { Architecture, Platform, PlatformInfo } from './types.js';
/**
 * Detect the current platform and architecture
 */
export declare function detectPlatform(): PlatformInfo;
/**
 * Validate platform and architecture combination
 */
export declare function validatePlatformArch(platform: Platform, arch: Architecture): void;
/**
 * Generate the binary filename for a given platform and architecture
 */
export declare function getBinaryFilename(platform: Platform, arch: Architecture): string;
/**
 * Get the download URL for binaries from GitHub Releases
 */
export declare function getDownloadUrl(repository: string, version: string, platform: Platform, arch: Architecture): string;
//# sourceMappingURL=platform.d.ts.map