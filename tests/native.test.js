import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import test from 'node:test';
import pg from 'pg';
import { PostgresServer } from '../dist/index.js';

test('wrapper starts, enables both extensions, queries and restarts', { skip: !process.env.TEST_BINARIES_DIR }, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'pg-native-'));
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const server = new PostgresServer({ binariesDir: resolve(process.env.TEST_BINARIES_DIR), dataDir, port, host: '127.0.0.1' });
  t.after(async () => { await server.stop(); await rm(dataDir, { recursive: true, force: true }); });
  for (let attempt = 0; attempt < 2; attempt++) {
    await server.start();
    const client = new pg.Client({ connectionString: server.getConnectionString() });
    await client.connect();
    try {
      const { rows } = await client.query("SELECT similarity('postgres', 'postgres') AS similarity, '[1,2,3]'::vector <-> '[1,2,3]'::vector AS distance");
      assert.equal(rows[0].similarity, 1);
      assert.equal(rows[0].distance, 0);
    } finally { await client.end(); }
    await server.stop();
  }
});
