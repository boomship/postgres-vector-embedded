import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PostgresServerOptions } from './types.js';

/**
 * Simple PostgreSQL server wrapper for embedded use
 *
 * This is a basic implementation. For production use, consider more robust
 * process management, logging, and error handling.
 */
export class PostgresServer {
  private binariesDir: string;
  private dataDir: string;
  private port: number;
  private host: string;
  private username: string;
  private password: string;
  private config: Record<string, string>;
  private process: ReturnType<typeof spawn> | null = null;
  private isInitialized = false;

  constructor(options: PostgresServerOptions) {
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
  async initialize(): Promise<void> {
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
      '--auth-local=trust',
      '--auth-host=trust',
    ];

    await new Promise<void>((resolve, reject) => {
      const initdb = spawn(initdbPath, args, {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...globalThis.process.env, DYLD_LIBRARY_PATH: join(this.binariesDir, 'lib') },
      });

      initdb.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('✅ PostgreSQL data directory initialized');
          this.isInitialized = true;
          resolve();
        } else {
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
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('PostgreSQL server is already running');
    }

    await this.initialize();

    console.log(`🚀 Starting PostgreSQL server on ${this.host}:${this.port}`);

    const postgresPath = join(this.binariesDir, 'bin', 'postgres');
    const args = ['-D', this.dataDir, '-p', this.port.toString(), '-h', this.host];

    this.process = spawn(postgresPath, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...globalThis.process.env, DYLD_LIBRARY_PATH: join(this.binariesDir, 'lib') },
    });

    this.process.on('close', (code: number | null) => {
      console.log(`PostgreSQL server exited with code ${code}`);
      this.process = null;
    });

    this.process.on('error', (error: Error) => {
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
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('🛑 Stopping PostgreSQL server');

    // Try graceful shutdown first
    this.process.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
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
  getConnectionString(): string {
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/postgres`;
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Wait for PostgreSQL to be ready to accept connections
   */
  private async waitForReady(timeoutMs = 30000): Promise<void> {
    const psqlPath = join(this.binariesDir, 'bin', 'psql');
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await new Promise<void>((resolve, reject) => {
          const psql = spawn(
            psqlPath,
            [
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
            ],
            {
              stdio: 'ignore',
              env: {
                ...globalThis.process.env,
                PGPASSWORD: this.password,
                DYLD_LIBRARY_PATH: join(this.binariesDir, 'lib'),
              },
            }
          );

          psql.on('close', (code: number | null) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`psql failed with exit code ${code}`));
            }
          });

          psql.on('error', reject);
        });

        return; // Success!
      } catch {
        // Server not ready yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error('PostgreSQL server failed to become ready within timeout');
  }

  /**
   * Install the pgvector extension
   */
  private async installPgVector(): Promise<void> {
    console.log('🔌 Installing pgvector extension');

    const psqlPath = join(this.binariesDir, 'bin', 'psql');

    await new Promise<void>((resolve, reject) => {
      const psql = spawn(
        psqlPath,
        [
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
        ],
        {
          stdio: 'inherit',
          env: {
            ...globalThis.process.env,
            PGPASSWORD: this.password,
            DYLD_LIBRARY_PATH: join(this.binariesDir, 'lib'),
          },
        }
      );

      psql.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('✅ pgvector extension installed');
          resolve();
        } else {
          reject(new Error(`Failed to install pgvector extension, exit code ${code}`));
        }
      });

      psql.on('error', reject);
    });
  }

  /**
   * Write PostgreSQL configuration file
   */
  private async writeConfig(): Promise<void> {
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
      .join('\n');

    await writeFile(configPath, configLines);
  }
}
