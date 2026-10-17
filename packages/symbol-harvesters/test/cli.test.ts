import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decryptHarvesters } from '../src/index.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/shoestring-harvesters.dat', import.meta.url));
// 公式fixtureの公開テスト専用鍵です。
const privateHex = '9DD63D277F1DC004FDB849CDD0262AB9FE7BFAF70AB13709DA3D5B1DB01710B2';
const publicHex = '148C8ADE25845040BDB95A0293EB5BD5DB483C606748470B607DCB179FECE4C4';
const fixturePrivateKey = createPrivateKey({
  key: {
    kty: 'OKP',
    crv: 'Ed25519',
    d: Buffer.from(privateHex, 'hex').toString('base64url'),
    x: Buffer.from(publicHex, 'hex').toString('base64url'),
  },
  format: 'jwk',
});
const fixturePrivatePem = fixturePrivateKey.export({ format: 'pem', type: 'pkcs8' });

describe('暗号化・復号CLI', () => {
  let directory: string;
  let privateFile: string;
  let jsonFile: string;
  let dataFile: string;

  function run(...args: string[]) {
    // 子プロセスの出力をファイルに記録し、秘密情報が混入していないことを検証します。
    const stdoutPath = join(directory, 'stdout.log');
    const stderrPath = join(directory, 'stderr.log');
    const stdout = openSync(stdoutPath, 'w', 0o600);
    const stderr = openSync(stderrPath, 'w', 0o600);
    try {
      const result = spawnSync(process.execPath, [cli, ...args], {
        stdio: ['ignore', stdout, stderr],
        timeout: 10_000,
      });
      if (result.error) throw result.error;
      return {
        status: result.status,
        stdout: readFileSync(stdoutPath, 'utf8'),
        stderr: readFileSync(stderrPath, 'utf8'),
      };
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'symbol-harvesters-cli-'));
    privateFile = join(directory, 'node.key.pem');
    jsonFile = join(directory, 'harvesters.json');
    dataFile = join(directory, 'harvesters.dat');
    await writeFile(privateFile, fixturePrivatePem, { mode: 0o600 });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('ヘルプにコマンドと鍵ファイルの指定方法を表示する', () => {
    const result = run('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('encrypt');
    expect(result.stdout).toContain('decrypt');
    expect(result.stdout).toContain('--key-file');
    expect(result.stdout).toContain('ノード証明書の秘密鍵');
    expect(result.stderr).toBe('');
  });

  it('公式データをJSONへ復号し、再暗号化して全件の秘密鍵を復元する', async () => {
    const decrypted = run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile);
    expect(decrypted.status).toBe(0);
    expect(decrypted.stdout).toBe('完了しました。\n');
    const json = JSON.parse(await readFile(jsonFile, 'utf8'));
    expect(json).toHaveLength(4);
    expect(json[0].signingPrivateKey).toMatch(/^[A-F0-9]{64}$/);
    expect(json[0].vrfPrivateKey).toMatch(/^[A-F0-9]{64}$/);
    expect((await stat(jsonFile)).mode & 0o777).toBe(0o600);
    const encrypted = run('encrypt', '--input', jsonFile, '--output', dataFile, '--key-file', privateFile);
    expect(encrypted.status).toBe(0);
    expect((await stat(dataFile)).size).toBe(4 * 124);
    expect((await stat(dataFile)).mode & 0o777).toBe(0o600);
    const restored = join(directory, 'restored.json');
    expect(run('decrypt', '--input', dataFile, '--output', restored, '--key-file', privateFile).status).toBe(0);
    expect(JSON.parse(await readFile(restored, 'utf8'))).toEqual(json);
    expect(decrypted.stdout + decrypted.stderr + encrypted.stdout + encrypted.stderr).not.toContain(
      json[0].signingPrivateKey
    );
    expect(decrypted.stdout + decrypted.stderr).not.toContain(privateHex);
  });

  it('別ノードの秘密鍵PEMから導出した公開鍵で暗号化し、移行先の秘密鍵で復号できる', async () => {
    expect(run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile).status).toBe(0);
    const destination = generateKeyPairSync('ed25519').privateKey;
    const destinationFile = join(directory, 'destination-node.key.pem');
    await writeFile(destinationFile, destination.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
    expect(run('encrypt', '--input', jsonFile, '--output', dataFile, '--key-file', destinationFile).status).toBe(0);
    const encrypted = await readFile(dataFile);
    const destinationKey = Buffer.from(destination.export({ format: 'jwk' }).d!, 'base64url');
    const decrypted = await decryptHarvesters(encrypted, destinationKey);
    expect(
      decrypted.map((entry) => ({
        signingPrivateKey: Buffer.from(entry.signingPrivateKey).toString('hex').toUpperCase(),
        vrfPrivateKey: Buffer.from(entry.vrfPrivateKey).toString('hex').toUpperCase(),
      }))
    ).toEqual(JSON.parse(await readFile(jsonFile, 'utf8')));
    await expect(decryptHarvesters(encrypted, privateHex)).rejects.toThrow('Unable to decrypt');
  });

  it('既存の出力ファイルを上書きしない', async () => {
    await writeFile(jsonFile, '既存の内容');
    const result = run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile);
    expect(result.status).toBe(1);
    expect(await readFile(jsonFile, 'utf8')).toBe('既存の内容');
  });

  it('出力が入力と同じ場合も元データを変更しない', async () => {
    const original = await readFile(fixture);
    await writeFile(dataFile, original);
    expect(run('decrypt', '--input', dataFile, '--output', dataFile, '--key-file', privateFile).status).toBe(1);
    expect(await readFile(dataFile)).toEqual(original);
  });

  it('出力先のシンボリックリンクをたどらない', async () => {
    await writeFile(dataFile, '既存の内容');
    await symlink(dataFile, jsonFile);
    expect(run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile).status).toBe(1);
    expect(await readFile(dataFile, 'utf8')).toBe('既存の内容');
  });

  it('鍵が違う場合は出力を作成せず、秘密鍵を表示しない', async () => {
    const wrongKey = generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' });
    await writeFile(privateFile, wrongKey);
    const result = run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain(wrongKey);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('16進数のノード秘密鍵を拒否しPEMでの入力を必須にする', async () => {
    await writeFile(privateFile, privateHex);
    const result = run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(privateHex);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('公開鍵PEMを秘密鍵として渡した場合は拒否する', async () => {
    await writeFile(privateFile, createPublicKey(fixturePrivateKey).export({ format: 'pem', type: 'spki' }));
    expect(run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile).status).toBe(1);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['16進数の公開鍵', '16進数の秘密鍵', '公開鍵PEM', 'Ed25519以外の秘密鍵PEM'])(
    '暗号化でも%sを拒否しノード秘密鍵PEMを必須にする',
    async (format) => {
      const keys = {
        '16進数の公開鍵': publicHex,
        '16進数の秘密鍵': privateHex,
        公開鍵PEM: createPublicKey(fixturePrivateKey).export({ format: 'pem', type: 'spki' }),
        Ed25519以外の秘密鍵PEM: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
          format: 'pem',
          type: 'pkcs8',
        }),
      };
      await writeFile(privateFile, keys[format as keyof typeof keys]);
      await writeFile(jsonFile, '[]');
      const result = run('encrypt', '--input', jsonFile, '--output', dataFile, '--key-file', privateFile);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).not.toContain(privateHex);
      expect(result.stderr).not.toContain('-----BEGIN PRIVATE KEY-----');
      await expect(stat(dataFile)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  );

  it('後続レコードが改ざんされていても平文ファイルを作成しない', async () => {
    const data = await readFile(fixture);
    data[data.length - 1] ^= 1;
    await writeFile(dataFile, data);
    expect(run('decrypt', '--input', dataFile, '--output', jsonFile, '--key-file', privateFile).status).toBe(1);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['{"secret":"漏えいさせない値"', '{}', '[null]', '[{"signingPrivateKey":123,"vrfPrivateKey":"不正"}]'])(
    '不正なJSONを拒否し内容をエラーに含めない（%#）',
    async (input) => {
      await writeFile(jsonFile, input);
      const result = run('encrypt', '--input', jsonFile, '--output', dataFile, '--key-file', privateFile);
      expect(result.status).toBe(1);
      expect(result.stderr).not.toContain(input);
      expect(result.stderr).not.toContain('漏えいさせない値');
      await expect(stat(dataFile)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  );

  it('空のJSON配列と空ファイルを相互変換する', async () => {
    await writeFile(jsonFile, '[]');
    expect(run('encrypt', '--input', jsonFile, '--output', dataFile, '--key-file', privateFile).status).toBe(0);
    expect((await stat(dataFile)).size).toBe(0);
    const output = join(directory, 'empty.json');
    expect(run('decrypt', '--input', dataFile, '--output', output, '--key-file', privateFile).status).toBe(0);
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual([]);
  });

  it('Ed25519以外の鍵を拒否する', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    await writeFile(privateFile, privateKey.export({ format: 'pem', type: 'pkcs8' }));
    expect(run('decrypt', '--input', fixture, '--output', jsonFile, '--key-file', privateFile).status).toBe(1);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('読めない入力ファイルで失敗しても出力を作成しない', async () => {
    expect(run('decrypt', '--input', dataFile, '--output', jsonFile, '--key-file', privateFile).status).toBe(1);
    await expect(stat(jsonFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(
    [[], ['unknown'], ['decrypt'], ['decrypt', '--unknown', '秘密値'], ['decrypt', '--key', privateHex]].map(
      (args) => ({ args })
    )
  )('不正なコマンドや引数を秘密情報を表示せず拒否する（%#）', ({ args }) => {
    const result = run(...args);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--help');
    expect(result.stderr).not.toContain(privateHex);
    expect(result.stderr).not.toContain('秘密値');
  });
});
