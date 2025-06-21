import type { PostgresServerOptions } from './types.js';
/**
 * Simple PostgreSQL server wrapper for embedded use
 *
 * This is a basic implementation. For production use, consider more robust
 * process management, logging, and error handling.
 */
export declare class PostgresServer {
    private binariesDir;
    private dataDir;
    private port;
    private host;
    private username;
    private password;
    private config;
    private process;
    private isInitialized;
    constructor(options: PostgresServerOptions);
    /**
     * Initialize the PostgreSQL data directory (only needed once)
     */
    initialize(): Promise<void>;
    /**
     * Start the PostgreSQL server
     */
    start(): Promise<void>;
    /**
     * Stop the PostgreSQL server
     */
    stop(): Promise<void>;
    /**
     * Get connection string for this PostgreSQL instance
     */
    getConnectionString(): string;
    /**
     * Check if the server is running
     */
    isRunning(): boolean;
    /**
     * Wait for PostgreSQL to be ready to accept connections
     */
    private waitForReady;
    /**
     * Install the pgvector extension
     */
    private installPgVector;
    /**
     * Write PostgreSQL configuration file
     */
    private writeConfig;
}
//# sourceMappingURL=server.d.ts.map