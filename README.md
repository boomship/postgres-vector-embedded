<img src="./assets/boomship-logo.svg" alt="Boomship" width="80" align="left">

# @boomship/postgres-vector-embedded

[![Build](https://github.com/boomship/postgres-vector-embedded/actions/workflows/build.yml/badge.svg)](https://github.com/boomship/postgres-vector-embedded/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@boomship/postgres-vector-embedded)](https://www.npmjs.com/package/@boomship/postgres-vector-embedded)


✅ **Ready to Use** - Cross-platform binaries now available via GitHub Releases

Embedded PostgreSQL with pgvector extension for Node.js applications.

## Overview

A complete embedded PostgreSQL + pgvector solution for Node.js applications:

- **PostgreSQL 17.2** — full database engine included
- **pgvector 0.8.0** — enables fast vector similarity search
- **Cross-platform binaries** — macOS, Linux, Windows (x64 + ARM64)
- **No manual setup** — everything is precompiled and ready to run
- **TypeScript API** — spin up a local vector-ready database with one import

Ideal for projects needing vector search *without* relying on external Postgres instances or Docker.

> ⚠️ Note: The included TypeScript code is intended as **example usage only**. It is not production-ready and is provided to demonstrate how to use the embedded binaries. The real value of this package lies in its cross-platform PostgreSQL + pgvector binaries.

## Quick Start

```bash
npm install @boomship/postgres-vector-embedded
```

> This will install the package and prepare your environment for running an embedded Postgres server. All example code provided is for demonstration purposes only.

## Platform Support

| Platform | Architecture | Status |
|----------|-------------|---------|
| macOS    | ARM64 (M1+) | ✅ Supported |
| macOS    | x64 (Intel) | ✅ Supported |
| Linux    | x64         | ✅ Supported |
| Windows  | x64         | ✅ Supported |
| Linux    | ARM64       | ⏸️ Planned |

### Basic Usage

```typescript
import { downloadBinaries, PostgresServer } from '@boomship/postgres-vector-embedded';

// Download platform-specific binaries
await downloadBinaries();

// Start embedded PostgreSQL server
const server = new PostgresServer({
  dataDir: './postgres-data',
  port: 5432
});

await server.start();

// Use with your favorite PostgreSQL client
// The server includes pgvector extension ready to use

await server.stop();
```

### Vector Search Example

```typescript
import { PostgresServer } from '@boomship/postgres-vector-embedded';
import { Client } from 'pg';

const server = new PostgresServer();
await server.start();

const client = new Client({ port: server.port });
await client.connect();

// Create table with vector column
await client.query(`
  CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(384)
  )
`);

// Insert documents with embeddings
await client.query(`
  INSERT INTO documents (content, embedding) VALUES 
  ('Hello world', '[0.1, 0.2, 0.3, ...]'),
  ('Goodbye world', '[0.4, 0.5, 0.6, ...]')
`);

// Vector similarity search
const result = await client.query(`
  SELECT content, embedding <-> '[0.1, 0.2, 0.3, ...]' as distance 
  FROM documents 
  ORDER BY distance 
  LIMIT 5
`);

await client.end();
await server.stop();
```

## Build System

This package includes a complete cross-platform build system:

- **Makefile** with platform detection and compilation
- **GitHub Actions** for automated CI/CD
- **Functional tests** to verify binary integrity
- **Binary distribution** via GitHub Releases

### Local Development

```bash
# Build binaries locally
npm run build:binaries

# Test built binaries
make test

# Clean build artifacts
make clean
```

## API Reference

### `downloadBinaries(options?)`

Downloads platform-specific PostgreSQL + pgvector binaries.

```typescript
interface DownloadOptions {
  version?: string;           // Default: latest
  platform?: PlatformType;   // Auto-detected
  architecture?: ArchType;   // Auto-detected  
  downloadDir?: string;       // Default: './postgres-binaries'
}
```
> Note: The first time you run this, platform-specific binaries will be downloaded and cached.

### `PostgresServer`

An example of embedded PostgreSQL server management.

```typescript
interface PostgresServerOptions {
  dataDir?: string;        // Default: './postgres-data'
  port?: number;          // Default: 5432
  host?: string;          // Default: 'localhost'
  database?: string;      // Default: 'postgres'
  user?: string;         // Default: 'postgres'
  password?: string;     // Default: none
}
```

#### Methods

- `async start()` - Initialize and start the server
- `async stop()` - Stop the server gracefully
- `async restart()` - Restart the server
- `isRunning()` - Check if server is running

## Why This Package?

Existing solutions are incomplete - they're either client libraries that require existing PostgreSQL installations, PostgreSQL-only packages without pgvector, or solutions with older versions.

This package provides **the complete embedded solution** with latest versions of both PostgreSQL 17.2 and pgvector 0.8.0.


## 🤝 Curated Release

This repository is published as a **curated release**. That means:

- It’s open-source and freely usable under the terms of the license
- It’s not a community-driven project — we’re not accepting PRs or feature requests
- Issues may be disabled or ignored, depending on capacity
- You’re encouraged to fork it if you want to extend or modify it

> This is a stable, production-ready **binary release** from an internal system. The accompanying code is illustrative and may not be suitable for production use.


## License

MIT - See LICENSE file for details.

PostgreSQL and pgvector maintain their respective licenses (see licenses/ directory).
