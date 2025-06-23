import type { Architecture, Platform, PlatformInfo, Variant } from './types.js';
/**
 * Detect the current platform and architecture
 */
export declare function detectPlatform(): PlatformInfo;
/**
 * Validate platform, architecture, and variant combination
 */
export declare function validatePlatformArch(platform: Platform, arch: Architecture, variant?: Variant): void;
/**
 * Generate the binary filename for a given platform, architecture, and variant
 */
export declare function getBinaryFilename(platform: Platform, arch: Architecture, variant?: Variant): string;
/**
 * Get the download URL for binaries from GitHub Releases
 */
export declare function getDownloadUrl(repository: string, version: string, platform: Platform, arch: Architecture, variant?: Variant): string;
//# sourceMappingURL=platform.d.ts.map