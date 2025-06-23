export type Platform = 'darwin' | 'linux' | 'win32';
export type Architecture = 'x64' | 'arm64';
export interface DownloadOptions {
    /** Target directory to extract PostgreSQL binaries */
    targetDir: string;
    /** Platform to download for (auto-detected if not specified) */
    platform?: Platform;
    /** Architecture to download for (auto-detected if not specified) */
    arch?: Architecture;
    /** Package version to download (uses package.json version if not specified) */
    version?: string;
    /** GitHub repository owner/name */
    repository?: string;
    /** Force download even if binaries already exist */
    force?: boolean;
}
export interface PlatformInfo {
    platform: Platform;
    arch: Architecture;
}
export interface DownloadProgress {
    /** Total bytes to download */
    total: number;
    /** Bytes downloaded so far */
    downloaded: number;
    /** Download percentage (0-100) */
    percent: number;
}
export interface PostgresServerOptions {
    /** Directory containing PostgreSQL binaries */
    binariesDir: string;
    /** Data directory for PostgreSQL (will be created if it doesn't exist) */
    dataDir: string;
    /** Port to run PostgreSQL on */
    port?: number;
    /** Host to bind PostgreSQL to */
    host?: string;
    /** PostgreSQL superuser name */
    username?: string;
    /** PostgreSQL superuser password */
    password?: string;
    /** Additional PostgreSQL configuration options */
    config?: Record<string, string>;
}
//# sourceMappingURL=types.d.ts.map