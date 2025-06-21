import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/**
 * Simple PostgreSQL server wrapper for embedded use
 *
 * This is a basic implementation. For production use, consider more robust
 * process management, logging, and error handling.
 */
export class PostgresServer {
    binariesDir;
    dataDir;
    port;
    host;
    username;
    password;
    config;
    process = null;
    isInitialized = false;
    constructor(options) {
        this.binariesDir = options.binariesDir;
        this.dataDir = options.dataDir;
        this.port = options.port ?? 5432;
        this.host = options.host ?? 'localhost';
        this.username = options.username ?? 'postgres';
        this.password = options.password ?? 'postgres';
        this.config = options.config ?? {};
    }
    /**
     * Initialize the PostgreSQL data directory (only needed once)
     */
    async initialize() {
        if (this.isInitialized || existsSync(join(this.dataDir, 'PG_VERSION'))) {
            this.isInitialized = true;
            return;
        }
        console.log(`🔧 Initializing PostgreSQL data directory: ${this.dataDir}`);
        await mkdir(this.dataDir, { recursive: true });
        const initdbPath = join(this.binariesDir, 'bin', 'initdb');
        const args = [
            '-D',
            this.dataDir,
            '-U',
            this.username,
            '--pwfile=-',
            '--auth-local=trust',
            '--auth-host=scram-sha-256',
        ];
        await new Promise((resolve, reject) => {
            const initdb = spawn(initdbPath, args, {
                stdio: ['pipe', 'inherit', 'inherit'],
            });
            // Write password to stdin
            initdb.stdin?.write(`${this.password}\\n`);
            initdb.stdin?.end();
            initdb.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ PostgreSQL data directory initialized');
                    this.isInitialized = true;
                    resolve();
                }
                else {
                    reject(new Error(`initdb failed with exit code ${code}`));
                }
            });
            initdb.on('error', reject);
        });
        // Create postgresql.conf with custom settings
        await this.writeConfig();
    }
    /**
     * Start the PostgreSQL server
     */
    async start() {
        if (this.process) {
            throw new Error('PostgreSQL server is already running');
        }
        await this.initialize();
        console.log(`🚀 Starting PostgreSQL server on ${this.host}:${this.port}`);
        const postgresPath = join(this.binariesDir, 'bin', 'postgres');
        const args = ['-D', this.dataDir, '-p', this.port.toString(), '-h', this.host];
        this.process = spawn(postgresPath, args, {
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        this.process.on('close', (code) => {
            console.log(`PostgreSQL server exited with code ${code}`);
            this.process = null;
        });
        this.process.on('error', (error) => {
            console.error('PostgreSQL server error:', error);
            this.process = null;
        });
        // Wait a moment for the server to start
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Verify server is responsive
        await this.waitForReady();
        // Install pgvector extension
        await this.installPgVector();
        console.log('✅ PostgreSQL server started successfully');
    }
    /**
     * Stop the PostgreSQL server
     */
    async stop() {
        if (!this.process) {
            return;
        }
        console.log('🛑 Stopping PostgreSQL server');
        // Try graceful shutdown first
        this.process.kill('SIGTERM');
        // Wait for process to exit
        await new Promise((resolve) => {
            if (!this.process) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                // Force kill if graceful shutdown takes too long
                this.process?.kill('SIGKILL');
            }, 10000);
            this.process.on('close', () => {
                clearTimeout(timeout);
                this.process = null;
                resolve();
            });
        });
        console.log('✅ PostgreSQL server stopped');
    }
    /**
     * Get connection string for this PostgreSQL instance
     */
    getConnectionString() {
        return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/postgres`;
    }
    /**
     * Check if the server is running
     */
    isRunning() {
        return this.process !== null && !this.process.killed;
    }
    /**
     * Wait for PostgreSQL to be ready to accept connections
     */
    async waitForReady(timeoutMs = 30000) {
        const psqlPath = join(this.binariesDir, 'bin', 'psql');
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise((resolve, reject) => {
                    const psql = spawn(psqlPath, [
                        '-h',
                        this.host,
                        '-p',
                        this.port.toString(),
                        '-U',
                        this.username,
                        '-d',
                        'postgres',
                        '-c',
                        'SELECT 1;',
                    ], {
                        stdio: 'ignore',
                        env: { ...globalThis.process.env, PGPASSWORD: this.password },
                    });
                    psql.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        }
                        else {
                            reject(new Error(`psql failed with exit code ${code}`));
                        }
                    });
                    psql.on('error', reject);
                });
                return; // Success!
            }
            catch {
                // Server not ready yet, wait and retry
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        throw new Error('PostgreSQL server failed to become ready within timeout');
    }
    /**
     * Install the pgvector extension
     */
    async installPgVector() {
        console.log('🔌 Installing pgvector extension');
        const psqlPath = join(this.binariesDir, 'bin', 'psql');
        await new Promise((resolve, reject) => {
            const psql = spawn(psqlPath, [
                '-h',
                this.host,
                '-p',
                this.port.toString(),
                '-U',
                this.username,
                '-d',
                'postgres',
                '-c',
                'CREATE EXTENSION IF NOT EXISTS vector;',
            ], {
                stdio: 'inherit',
                env: { ...globalThis.process.env, PGPASSWORD: this.password },
            });
            psql.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ pgvector extension installed');
                    resolve();
                }
                else {
                    reject(new Error(`Failed to install pgvector extension, exit code ${code}`));
                }
            });
            psql.on('error', reject);
        });
    }
    /**
     * Write PostgreSQL configuration file
     */
    async writeConfig() {
        const configPath = join(this.dataDir, 'postgresql.conf');
        const defaultConfig = {
            listen_addresses: `'${this.host}'`,
            port: this.port.toString(),
            shared_preload_libraries: `'vector'`,
            log_statement: `'all'`,
            log_min_duration_statement: '0',
            ...this.config,
        };
        const configLines = Object.entries(defaultConfig)
            .map(([key, value]) => `${key} = ${value}`)
            .join('\\n');
        await writeFile(configPath, configLines);
    }
}
//# sourceMappingURL=server.js.map