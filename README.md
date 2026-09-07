<img src="./assets/boomship-logo.svg" alt="Boomship" width="80" align="left">

# @boomship/postgres-vector-embedded

[![Build](https://github.com/boomship/postgres-vector-embedded/actions/workflows/build.yml/badge.svg)](https://github.com/boomship/postgres-vector-embedded/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@boomship/postgres-vector-embedded)](https://www.npmjs.com/package/@boomship/postgres-vector-embedded)


✅ **Ready to Use** - Cross-platform binaries now available via GitHub Releases

Embedded PostgreSQL with pgvector extension for Node.js applications.

## Overview

An embedded PostgreSQL + pgvector + pg_trgm solution for Node.js applications:

- **PostgreSQL 18.6** — latest stable database engine
- **pgvector 0.8.6** — enables vector similarity search with HNSW indexing
- **pg_trgm** — trigram similarity and indexed text search, included in both variants
- **pg_upgrade** — bundled alongside pg_dump, pg_dumpall, pg_restore and pg_controldata
- **Dual variants** — lite (basic) and full (with SSL, compression, XML) builds available
- **Advanced capabilities** — SSL/TLS, compression, XML support, JIT compilation
- **No manual setup** — precompiled binaries ready to run
- **TypeScript API** — example code to get started quickly

Ideal for projects needing vector search *without* relying on external Postgres instances or Docker.

> ⚠️ Note: The included TypeScript code is intended as **example usage only**. It is not production-ready and is provided to demonstrate how to use the embedded binaries. The real value of this package lies in its cross-platform PostgreSQL + pgvector + pg_trgm binaries.

## Quick Start

```bash
npm install @boomship/postgres-vector-embedded
```

> This will install the package and prepare your environment for running an embedded Postgres server. All example code provided is for demonstration purposes only.

## Platform Support

### Lite Variant (Basic PostgreSQL + pgvector + pg_trgm)
| Platform | Architecture | Status |
|----------|-------------|---------|
| macOS    | ARM64 (M1+) | ✅ Supported |
| macOS    | x64 (Intel) | ✅ Supported |
| Linux    | x64         | ✅ Supported |
| Linux    | ARM64       | ✅ Supported |
| Windows  | x64         | ✅ Supported |

### Full Variant (Additional Features)
| Platform | Architecture | Status | Features |
|----------|-------------|---------|----------|
| macOS    | ARM64 (M1+) | ✅ Supported | SSL, ICU, LZ4, ZSTD, XML, LLVM, UUID |
| macOS    | x64 (Intel) | ✅ Supported | SSL, ICU, LZ4, ZSTD, XML, LLVM, UUID |
| Linux    | x64         | ✅ Supported | SSL, ICU, LZ4, ZSTD, XML, LLVM, UUID |
| Linux    | ARM64       | ✅ Supported | SSL, ICU, LZ4, ZSTD, XML, LLVM, UUID |
| Windows  | x64         | ❌ Unsupported | Not available |

> **Windows Full Variant**: Not available in current release. Use lite variant on Windows. Full variant with additional PostgreSQL features coming in v1.0.

### Basic Usage

```typescript
import { downloadBinaries, PostgresServer } from '@boomship/postgres-vector-embedded';

// Download platform-specific binaries (choose variant)
await downloadBinaries({ variant: 'full' }); // or 'lite'

// Start embedded PostgreSQL server
const server = new PostgresServer({
  dataDir: './postgres-data',
  port: 5432
});

await server.start();

// Use with your favorite PostgreSQL client
// Full variant includes SSL, compression, and additional PostgreSQL features (macOS/Linux)

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

This package includes a cross-platform build system:

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

Downloads platform-specific PostgreSQL + pgvector + pg_trgm binaries.

```typescript
interface DownloadOptions {
  version?: string;           // Default: latest
  platform?: PlatformType;   // Auto-detected
  architecture?: ArchType;   // Auto-detected
  variant?: Variant;          // 'lite' | 'full' (default: 'lite')
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

This package provides **a complete embedded solution** with PostgreSQL 18.6 and pgvector 0.8.6, offering both lite and full variants.

## Advanced Capabilities

The full variant includes additional PostgreSQL features:

- **Security** — Complete SSL/TLS encryption support for secure connections *(macOS, Linux)*
- **Performance** — LLVM JIT compilation for accelerated complex queries *(macOS, Linux)*
- **Compression** — LZ4 and Zstandard algorithms for optimal storage efficiency *(macOS, Linux)*
- **Data Types** — Full XML processing and UUID generation capabilities *(macOS, Linux)*
- **Internationalization** — Complete Unicode and collation support via ICU *(macOS, Linux)*
- **Vector Search** — pgvector with HNSW indexing for high-performance similarity search *(all platforms)*

**Choose Your Variant:**
- **Lite** — Core PostgreSQL + pgvector + pg_trgm (smaller footprint, faster startup)
- **Full** — Additional PostgreSQL features enabled (SSL, compression, XML, JIT compilation)

> Full variant features are currently available on macOS and Linux. Windows full variant is coming in v1.0.


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

## PostgreSQL 18 migration (package 0.3.0)

Existing PostgreSQL 17 data directories require migration. The wrapper checks the
actual server binary major version against `PG_VERSION` and rejects a mismatch.
It never upgrades or deletes an existing database automatically.

Keep the old binaries (including their extension libraries) and data directory.
Download the new binaries into a separate directory; cached installations without
pg_trgm are rejected. Release 0.3.0 assets must be published before the default
downloader can fetch them.

The new bundle includes `bin/pg_upgrade`. Stop both servers, back up your database,
and initialize a separate empty PostgreSQL 18 cluster with matching encoding,
locale and checksum settings. PG18 enables checksums by default; for an old cluster
without checksums, use `initdb --no-data-checksums`. Do not create extensions in the
new cluster before pg_upgrade; their library and SQL files are already shipped.

Run the **new** pg_upgrade with `--old-bindir`, `--new-bindir`, `--old-datadir`,
`--new-datadir` and `--check` first. After a successful check, run it without
`--check` (default copy mode preserves the old data files). Follow any generated
extension-update instructions. See the [official upgrade procedure](https://www.postgresql.org/docs/18/pgupgrade.html).

`PostgresServer.start()` enables both `vector` and `pg_trgm` in the `postgres`
database. For another database, enable them explicitly:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX documents_title_trgm ON documents USING gin (title gin_trgm_ops);
SELECT similarity('postgres', 'postgress');
```

Run `npm test` for local package regression tests, and `make test` to build and
exercise the native binaries, extensions and upgrade tools. Set `TEST_BINARIES_DIR` to a built bundle directory to include the live wrapper
startup/restart integration test in `npm test`. Historical download
diagnostics are available separately via `npm run test:legacy`.

## Relocatable binary packaging (0.3.1)

Version 0.3.0 archives passed tests inside the build directory but were not fully
portable: macOS libraries retained absolute install names, Linux tools retained
absolute RUNPATH entries, and Windows omitted a MinGW runtime DLL. Use 0.3.1
archives once released; do not rely on a compiler installation or library-path
overrides to make 0.3.0 work.

macOS packaging now copies non-system dynamic dependencies recursively, rewrites
references relative to the loading image, and signs every changed Mach-O file.
Linux tools resolve bundled libpq through `$ORIGIN` paths; other Linux system
libraries (including the full variant's LLVM, ICU, SSL and compression dependencies)
remain host requirements. Windows packaging copies non-system DLL dependencies
beside the executables.

CI extracts each archive to a temporary directory, hides the build installation,
and runs database/extension tests without library-path overrides. macOS also audits
all library references and signatures; Linux verifies pg_upgrade resolves bundled
libpq; Windows checks DLL completeness and removes compiler directories from PATH.
