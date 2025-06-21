# @boomship/postgres-vector-embedded

⚠️ **Work in Progress** - Build system ready, binaries coming soon

Embedded PostgreSQL with pgvector extension for Node.js applications.

## Overview

A complete embedded PostgreSQL + pgvector solution that includes:

- **PostgreSQL 17.2** binaries with latest features
- **pgvector 0.8.0** extension for vector similarity search
- **Cross-platform support**: macOS (ARM64/x64), Linux (x64/ARM64), Windows (x64)
- **Zero-config** embedded database setup
- **TypeScript** support with full type definitions

## Quick Start

```bash
npm install @boomship/postgres-vector-embedded
```

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

### `PostgresServer`

Embedded PostgreSQL server management.

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

## Platform Support

| Platform | Architecture | Status |
|----------|-------------|---------|
| macOS    | ARM64 (M1+) | ✅ Supported |
| macOS    | x64 (Intel) | ✅ Supported |
| Linux    | x64         | ✅ Supported |
| Windows  | x64         | ✅ Supported |
| Linux    | ARM64       | ⏸️ Planned |

## Why This Package?

Existing solutions are incomplete - they're either client libraries that require existing PostgreSQL installations, PostgreSQL-only packages without pgvector, or solutions with older versions.

This package provides **the complete embedded solution** with latest versions of both PostgreSQL 17.2 and pgvector 0.8.0.

## Contributing

The build system is designed for easy contribution:

1. Fork and clone the repository
2. Make changes to build system or TypeScript code
3. Test locally with `make test`
4. Submit PR - GitHub Actions will test all platforms

## License

MIT - See LICENSE file for details.

PostgreSQL and pgvector maintain their respective licenses (see licenses/ directory).