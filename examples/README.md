# Examples

This directory contains examples showing how to use @boomship/postgres-vector-embedded.

## basic-server.ts

A complete example showing:

1. **Binary download** - Downloads PostgreSQL + pgvector binaries for your platform
2. **Server startup** - Starts an embedded PostgreSQL instance
3. **Vector operations** - Creates tables, inserts vector data, performs similarity search
4. **Graceful shutdown** - Properly stops the database server

### Running the example

```bash
# Install dependencies (you'll need 'pg' client library)
npm install pg @types/pg

# Compile TypeScript (from the package root)
npm run build

# Run the example
node dist/examples/basic-server.js
```

### What it does

1. Downloads ~15MB of PostgreSQL + pgvector binaries (one-time)
2. Starts PostgreSQL on port 5433
3. Creates a table with `VECTOR(3)` column
4. Inserts sample 3-dimensional vectors
5. Queries for vectors similar to `[1.0, 0.1, 0.0]` using cosine distance (`<->`)
6. Prints results and shuts down cleanly

### Expected output

```
📦 Downloading binaries...
🌐 Downloading from: https://github.com/boomship/postgres-vector-embedded/releases/download/v0.1.0/postgres-darwin-arm64.tar.gz
✅ PostgreSQL + pgvector binaries downloaded and extracted successfully
✅ Installation verified
🚀 Starting PostgreSQL server...
🔧 Initializing PostgreSQL data directory: ./postgres-data
✅ PostgreSQL data directory initialized
🔌 Installing pgvector extension
✅ pgvector extension installed
✅ PostgreSQL server started successfully
✅ Connected to PostgreSQL with pgvector
✅ Inserted sample vector data
🔍 Most similar vectors:
  "Hello world" (distance: 0.1)
  "Machine learning" (distance: 1.41421)
  "Goodbye world" (distance: 1.41421)
✅ Database connection closed
✅ PostgreSQL server stopped
```

### Customization

You can modify the example to:

- Use different vector dimensions
- Try different distance operators (`<->` cosine, `<#>` negative inner product, `<=>` L2)
- Add more complex vector operations
- Integrate with your embedding models
- Use in production with proper error handling and logging