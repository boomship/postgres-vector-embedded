# @boomship/postgres-vector-embedded

⚠️ **Work in Progress** - Not ready for use

Embedded PostgreSQL with pgvector extension for Node.js applications.

## What this will be

A complete embedded PostgreSQL + pgvector solution that:

- Includes PostgreSQL 17.2 binaries
- Includes pgvector 0.8.0 extension
- Works without external PostgreSQL installation
- Supports vector similarity search out of the box
- Cross-platform: macOS, Linux, Windows
- Zero-config embedded database

## Why this doesn't exist yet

Existing solutions are incomplete:

- `pgvector` - Client library only, requires existing PostgreSQL + pgvector
- `embedded-postgres` - PostgreSQL only, no pgvector extension
- `@mastra/vector-pg` - Client for existing installations
- `pgserver` - Python solution with older PostgreSQL/pgvector versions

This package will be the missing piece: **the complete embedded solution for Node.js with latest versions**.

## Current Status

🚧 Building the compilation pipeline and binary distribution system.

## License

MIT - See LICENSE file for details.

PostgreSQL and pgvector maintain their respective licenses (see licenses/ directory when available).