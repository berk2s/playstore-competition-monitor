import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalDriver } from './storage.ts';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-storage-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('LocalDriver', () => {
  it('writes the buffer at root/key and returns the public url', async () => {
    const driver = new LocalDriver(tmpDir, 'http://localhost:4000/screenshots');
    const body = Buffer.from('fake-png-bytes');
    const res = await driver.put('apps/abc/2026-01-01.png', body, 'image/png');

    expect(res.key).toBe('apps/abc/2026-01-01.png');
    expect(res.url).toBe('http://localhost:4000/screenshots/apps/abc/2026-01-01.png');

    const written = await fs.readFile(path.join(tmpDir, 'apps/abc/2026-01-01.png'));
    expect(written.equals(body)).toBe(true);
  });

  it('creates intermediate directories', async () => {
    const driver = new LocalDriver(tmpDir, 'http://localhost:4000/screenshots');
    await driver.put('deeply/nested/path/file.png', Buffer.from('x'), 'image/png');

    const stat = await fs.stat(path.join(tmpDir, 'deeply/nested/path/file.png'));
    expect(stat.isFile()).toBe(true);
  });

  it('strips a trailing slash from the public base url', async () => {
    const driver = new LocalDriver(tmpDir, 'http://localhost:4000/screenshots/');
    const res = await driver.put('a/b.png', Buffer.from('x'), 'image/png');
    expect(res.url).toBe('http://localhost:4000/screenshots/a/b.png');
  });
});
