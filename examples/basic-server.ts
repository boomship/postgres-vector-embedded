/**
 * Basic example of using @boomship/postgres-vector-embedded
 * 
 * This shows how to:
 * 1. Download PostgreSQL + pgvector binaries
 * 2. Start an embedded PostgreSQL server
 * 3. Create a table with vector columns
 * 4. Insert and query vector data
 * 5. Clean shutdown
 */

import { downloadBinaries, PostgresServer } from '@boomship/postgres-vector-embedded';
import { Client } from 'pg';

async function main() {
  const binariesDir = './postgres-binaries';
  const dataDir = './postgres-data';

  try {
    // Step 1: Download PostgreSQL + pgvector binaries
    console.log('📦 Downloading binaries...');
    await downloadBinaries({
      targetDir: binariesDir,
      force: false, // Skip if already downloaded
    });

    // Step 2: Create and start PostgreSQL server
    console.log('🚀 Starting PostgreSQL server...');
    const server = new PostgresServer({
      binariesDir,
      dataDir,
      port: 5433, // Use non-standard port to avoid conflicts
      host: 'localhost',
      username: 'postgres',
      password: 'password123',
    });

    await server.start();

    // Step 3: Connect to the database
    const client = new Client({
      connectionString: server.getConnectionString(),
    });

    await client.connect();
    console.log('✅ Connected to PostgreSQL with pgvector');

    // Step 4: Create a table with vector column
    await client.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        content TEXT,
        embedding VECTOR(3)
      );
    `);

    // Step 5: Insert some sample vector data
    const sampleData = [
      { content: 'Hello world', embedding: [1.0, 0.0, 0.0] },
      { content: 'Goodbye world', embedding: [0.0, 1.0, 0.0] },
      { content: 'Machine learning', embedding: [0.0, 0.0, 1.0] },
    ];

    for (const item of sampleData) {
      await client.query(
        'INSERT INTO embeddings (content, embedding) VALUES ($1, $2)',
        [item.content, JSON.stringify(item.embedding)]
      );
    }

    console.log('✅ Inserted sample vector data');

    // Step 6: Query similar vectors
    const queryVector = [1.0, 0.1, 0.0];
    const result = await client.query(`
      SELECT 
        content,
        embedding,
        embedding <-> $1 AS distance
      FROM embeddings
      ORDER BY embedding <-> $1
      LIMIT 3;
    `, [JSON.stringify(queryVector)]);

    console.log('🔍 Most similar vectors:');
    for (const row of result.rows) {
      console.log(`  "${row.content}" (distance: ${row.distance})`);
    }

    // Step 7: Clean up
    await client.end();
    console.log('✅ Database connection closed');

    await server.stop();
    console.log('✅ PostgreSQL server stopped');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the example
main().catch(console.error);