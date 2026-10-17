import { PrivateKey, PublicKey } from 'symbol-sdk';
import { KeyPair, Network } from 'symbol-sdk/symbol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { spawnSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    vi.unstubAllEnvs();
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

  it.each([
    { command: 'encrypt', option: '--input', excluded: '--rest-url' },
    { command: 'decrypt', option: '--input', excluded: '--cache-file' },
    { command: 'discover', option: '--rest-url', excluded: '--input' },
    { command: 'restore', option: '--cache-file', excluded: '--input' },
  ])('各コマンドのヘルプに対応する引数だけを表示する（$command）', ({ command, option, excluded }) => {
    const result = run(command, '--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(option);
    expect(result.stdout).toContain('--key-file');
    expect(result.stdout).not.toContain(excluded);
    expect(result.stderr).toBe('');
  });

  it.each([
    { command: 'encrypt', forbidden: '--rest-url' },
    { command: 'decrypt', forbidden: '--cache-file' },
    { command: 'discover', forbidden: '--input' },
    { command: 'restore', forbidden: '--rest-url' },
  ])('他コマンド用のオプションを値を表示せず拒否する（$command）', ({ command, forbidden }) => {
    const args = [command, '--output', jsonFile, '--key-file', privateFile];
    if (command === 'encrypt' || command === 'decrypt') args.push('--input', dataFile);
    if (command === 'restore') args.push('--cache-file', join(directory, 'cache.json'));
    const result = run(...args, forbidden, '表示しない秘密値');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--help');
    expect(result.stderr).not.toContain('表示しない秘密値');
    expect(result.stdout).toBe('');
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

  it('探索CLIが秘密鍵PEM・フルREST・キャッシュを使い、リンク高さと残高をJSONへ保存する', async () => {
    const nodeAddress = Network.TESTNET.publicKeyToAddress(new PublicKey(publicHex));
    const requestLog = join(directory, 'requests.jsonl');
    const preload = join(directory, 'mock-rest.mjs');
    const linked = {
      id: '000000000000000000000001',
      meta: { height: '2', index: 0 },
      transaction: { network: 152, type: 16972, signerPublicKey: publicHex, linkedPublicKey: publicHex, linkAction: 1 },
    };
    const plaintext = (await decryptHarvesters(await readFile(fixture), privateHex))[0];
    const delegation = {
      id: '000000000000000000000002',
      meta: { height: '3', index: 1 },
      transaction: {
        network: 152,
        type: 16724,
        signerPublicKey: publicHex,
        recipientAddress: Buffer.from(nodeAddress.bytes).toString('hex'),
        message: 'FE2A8061577301E2' + (await readFile(fixture)).subarray(0, 124).toString('hex').toUpperCase(),
      },
    };
    const account = {
      publicKey: publicHex,
      address: Buffer.from(nodeAddress.bytes).toString('hex'),
      supplementalPublicKeys: {
        node: { publicKey: publicHex },
        linked: { publicKey: new KeyPair(new PrivateKey(plaintext.signingPrivateKey)).publicKey.toString() },
        vrf: { publicKey: new KeyPair(new PrivateKey(plaintext.vrfPrivateKey)).publicKey.toString() },
      },
      mosaics: [{ id: '6BED913FA20223F8', amount: '1000000' }],
    };
    // 子プロセスへRESTの公開応答だけを注入し、秘密鍵を送信していないことも確認します。
    await writeFile(
      preload,
      `
      import { appendFile } from 'node:fs/promises';
      globalThis.fetch = async (input) => {
        const url = new URL(input);
        await appendFile(${JSON.stringify(requestLog)}, url.toString() + '\\n');
        if (url.pathname === '/node/info') return Response.json({ networkIdentifier: 152, networkGenerationHashSeed: 'A'.repeat(64) });
        if (url.pathname === '/chain/info') return Response.json({ height: '102', latestFinalizedBlock: { height: '100', hash: '64'.padStart(64, '0') } });
        if (url.pathname.startsWith('/blocks/')) {
          const height = url.pathname.split('/').at(-1);
          return Response.json({ block: { height }, meta: { hash: BigInt(height).toString(16).padStart(64, '0').toUpperCase() } });
        }
        if (url.pathname === '/transactions/confirmed') return Response.json({ data: url.searchParams.get('type') === '16972' ? [${JSON.stringify(linked)}] : [${JSON.stringify(delegation)}], pagination: { pageNumber: 1, pageSize: 100 } });
        if (url.pathname.startsWith('/accounts/')) return Response.json({ account: ${JSON.stringify(account)} });
        return new Response('', { status: 404 });
      };
    `
    );
    vi.stubEnv('NODE_OPTIONS', `--import=${pathToFileURL(preload).href}`);
    const cache = join(directory, 'discovery-cache.json');
    const first = run(
      'discover',
      '--output',
      jsonFile,
      '--key-file',
      privateFile,
      '--rest-url',
      'https://full-rest.example:3001',
      '--cache-file',
      cache
    );
    expect(first.status).toBe(0);
    const result = JSON.parse(await readFile(jsonFile, 'utf8'));
    expect(result.accounts[0]).toMatchObject({
      publicKey: publicHex,
      linkedHeight: '2',
      balances: [{ mosaicId: '6BED913FA20223F8', amount: '1000000' }],
    });
    const requests = await readFile(requestLog, 'utf8');
    expect(requests).toContain('https://full-rest.example:3001/transactions/confirmed');
    expect(requests).not.toContain(privateHex);
    expect(first.stderr).toContain('リンク探索');
    const second = run(
      'discover',
      '--output',
      join(directory, 'next.json'),
      '--key-file',
      privateFile,
      '--cache-file',
      cache
    );
    expect(second.status).toBe(0);
    expect(second.stderr).toBe('');
    expect(await readFile(requestLog, 'utf8')).toContain('http://localhost:3000/accounts/');
    const offline = join(directory, 'offline.mjs');
    await writeFile(offline, `globalThis.fetch = () => { throw new Error('復元中のREST通信は禁止'); };`);
    vi.stubEnv('NODE_OPTIONS', `--import=${pathToFileURL(offline).href}`);
    const restoredFile = join(directory, 'restored.json');
    const restored = run('restore', '--output', restoredFile, '--key-file', privateFile, '--cache-file', cache);
    expect(restored.status).toBe(0);
    expect(restored.stderr).toContain('復元1件、復元不可0件');
    const expected = [
      {
        signingPrivateKey: Buffer.from(plaintext.signingPrivateKey).toString('hex').toUpperCase(),
        vrfPrivateKey: Buffer.from(plaintext.vrfPrivateKey).toString('hex').toUpperCase(),
      },
    ];
    expect(JSON.parse(await readFile(restoredFile, 'utf8'))).toEqual(expected);
    expect(restored.stdout + restored.stderr).not.toContain(expected[0].signingPrivateKey);
    expect((await stat(restoredFile)).mode & 0o777).toBe(0o600);
    expect(run('encrypt', '--input', restoredFile, '--output', dataFile, '--key-file', privateFile).status).toBe(0);
    expect(await decryptHarvesters(await readFile(dataFile), privateHex)).toEqual([plaintext]);
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
