import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { downloadBinaries, PostgresServer } from '../dist/index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pg-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'bin'));
  await mkdir(join(root, 'lib'));
  await mkdir(join(root, 'share/extension'), { recursive: true });
  for (const binary of ['postgres', 'initdb', 'psql', 'pg_ctl', 'pg_upgrade', 'pg_controldata', 'pg_dump', 'pg_dumpall', 'pg_restore']) {
    await writeFile(join(root, 'bin', binary), '');
  }
  for (const ext of ['vector', 'pg_trgm']) {
    await writeFile(join(root, 'lib', `${ext}.so`), '');
    await writeFile(join(root, 'share/extension', `${ext}.control`), '');
    await writeFile(join(root, 'share/extension', `${ext}--1.0.sql`), '');
  }
  return root;
}

test('complete cached installation is accepted without downloading', async (t) => {
  await downloadBinaries({ targetDir: await fixture(t), platform: 'linux', arch: 'x64' });
});

for (const missing of ['bin/pg_upgrade', 'lib/pg_trgm.so', 'share/extension/pg_trgm.control', 'share/extension/pg_trgm--1.0.sql']) {
  test(`cached installation rejects missing ${missing}`, async (t) => {
    const root = await fixture(t);
    await rm(join(root, missing));
    await assert.rejects(downloadBinaries({ targetDir: root, platform: 'linux', arch: 'x64' }), /missing/);
  });
}

test('existing PG17 data is rejected before startup and remains intact', { skip: process.platform === 'win32' }, async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'bin/postgres'), '#!/bin/sh\necho "postgres (PostgreSQL) 18.6"\n', { mode: 0o755 });
  // fixture created this file already, so chmod explicitly.
  const { chmod, readFile } = await import('node:fs/promises');
  await chmod(join(root, 'bin/postgres'), 0o755);
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/PG_VERSION'), '17\n');
  const server = new PostgresServer({ binariesDir: root, dataDir: join(root, 'data') });
  await assert.rejects(server.start(), /version 17.*version 18.*pg_upgrade/);
  assert.equal(await readFile(join(root, 'data/PG_VERSION'), 'utf8'), '17\n');
  assert.equal(server.isRunning(), false);
});

test('matching existing cluster is accepted', { skip: process.platform === 'win32' }, async (t) => {
  const root = await fixture(t);
  const { chmod } = await import('node:fs/promises');
  await writeFile(join(root, 'bin/postgres'), '#!/bin/sh\necho "postgres (PostgreSQL) 18.6"\n');
  await chmod(join(root, 'bin/postgres'), 0o755);
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/PG_VERSION'), '18\n');
  await new PostgresServer({ binariesDir: root, dataDir: join(root, 'data') }).initialize();
});

test('download extracts current package archive and uses its release version', async (t) => {
  const root = await fixture(t);
  const { create } = await import('tar');
  const { readFile } = await import('node:fs/promises');
  const { dirname, basename } = await import('node:path');
  const archive = join(root, 'bundle.tar.gz');
  await create({ gzip: true, file: archive, cwd: dirname(root) }, [
    `${basename(root)}/bin`, `${basename(root)}/lib`, `${basename(root)}/share`,
  ]);
  const bytes = await readFile(archive);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    assert.ok(url.includes(`/v${pkg.version}/postgres-lite-linux-x64.tar.gz`));
    return new Response(bytes);
  };
  await downloadBinaries({ targetDir: join(root, 'download'), platform: 'linux', arch: 'x64' });
  assert.equal(await readFile(join(root, 'download/share/extension/pg_trgm.control'), 'utf8'), '');
});
