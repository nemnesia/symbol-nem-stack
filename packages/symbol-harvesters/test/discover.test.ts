import { PrivateKey, PublicKey } from 'symbol-sdk';
import { KeyPair, MessageEncoder, Network } from 'symbol-sdk/symbol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  decryptHarvesters,
  discoverLinkedAccounts,
  encryptHarvesters,
  restoreHarvestersFromCache,
} from '../src/index.js';

// テスト専用の架空の鍵です。
const nodePrivateKey = new Uint8Array(32).fill(1);
const nodePublicKey = new KeyPair(new PrivateKey(nodePrivateKey)).publicKey.toString();
const signer = new KeyPair(new PrivateKey(new Uint8Array(32).fill(2))).publicKey.toString();
const otherSigner = new KeyPair(new PrivateKey(new Uint8Array(32).fill(3))).publicKey.toString();
const anotherNode = new KeyPair(new PrivateKey(new Uint8Array(32).fill(4))).publicKey.toString();
const address = (key: string) => Network.TESTNET.publicKeyToAddress(new PublicKey(key));
const hash = (height: string) => BigInt(height).toString(16).padStart(64, '0').toUpperCase();

function transaction(id: number, signerPublicKey = signer, linkedPublicKey = nodePublicKey, blockHeight = '2') {
  return {
    id: id.toString(16).padStart(24, '0'),
    meta: { height: blockHeight, index: id, aggregateHash: undefined as string | undefined },
    transaction: { type: 16972, network: 152, signerPublicKey, linkedPublicKey, linkAction: 1 },
  };
}

function transfer(id: number, message: string, blockHeight = '3', blockIndex = 1) {
  return {
    id: id.toString(16).padStart(24, '0'),
    meta: { height: blockHeight, index: blockIndex, aggregateHash: undefined as string | undefined },
    transaction: {
      type: 16724,
      network: 152,
      signerPublicKey: signer,
      recipientAddress: Buffer.from(address(nodePublicKey).bytes).toString('hex'),
      message,
    },
  };
}

async function delegationMessage(signingSeed = 5) {
  const encoder = new MessageEncoder(new KeyPair(new PrivateKey(nodePrivateKey)));
  return Buffer.from(
    await encoder.encodePersistentHarvestingDelegation(
      new PublicKey(nodePublicKey),
      new KeyPair(new PrivateKey(new Uint8Array(32).fill(signingSeed))),
      new KeyPair(new PrivateKey(new Uint8Array(32).fill(6)))
    )
  )
    .toString('hex')
    .toUpperCase();
}

describe('ノードキーに現在もリンクしているアカウントの探索', () => {
  let directory: string;
  let cacheFile: string;
  let finalizedHeight: string;
  let generationHashSeed: string;
  let transactions: ReturnType<typeof transaction>[];
  let transfers: ReturnType<typeof transfer>[];
  let linkedKeys: Map<string, string | undefined>;
  let balances: { id: string; amount: string }[];
  let calls: URL[];
  let intercept: ((url: URL) => Response | undefined) | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'symbol-node-link-test-'));
    cacheFile = join(directory, 'cache.json');
    finalizedHeight = '100';
    generationHashSeed = 'A'.repeat(64);
    transactions = [transaction(1)];
    transfers = [];
    linkedKeys = new Map([[signer, nodePublicKey]]);
    balances = [{ id: '6BED913FA20223F8', amount: '9007199254740993' }];
    calls = [];
    intercept = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL) => {
        const url = new URL(input);
        calls.push(url);
        const intercepted = intercept?.(url);
        if (intercepted) return intercepted;
        if (url.pathname === '/node/info')
          return Response.json({ networkIdentifier: 152, networkGenerationHashSeed: generationHashSeed });
        if (url.pathname === '/chain/info')
          return Response.json({
            height: (BigInt(finalizedHeight) + 2n).toString(),
            latestFinalizedBlock: { height: finalizedHeight, hash: hash(finalizedHeight) },
          });
        if (url.pathname.startsWith('/blocks/')) {
          const height = url.pathname.split('/').at(-1)!;
          return Response.json({ meta: { hash: hash(height) }, block: { height } });
        }
        if (url.pathname === '/transactions/confirmed') {
          const pageNumber = Number(url.searchParams.get('pageNumber'));
          const from = BigInt(url.searchParams.get('fromHeight')!);
          const to = BigInt(url.searchParams.get('toHeight')!);
          const source = url.searchParams.has('address')
            ? [...transactions, ...transfers]
                .filter((entry) => !entry.meta.aggregateHash)
                .sort((lhs, rhs) => lhs.id.localeCompare(rhs.id))
            : url.searchParams.get('type') === '16972'
              ? transactions.filter(
                  (entry) => entry.transaction.signerPublicKey === url.searchParams.get('signerPublicKey')
                )
              : transfers.filter(
                  (entry) => entry.transaction.signerPublicKey === url.searchParams.get('signerPublicKey')
                );
          const filtered = source.filter(
            (entry) => BigInt(entry.meta.height) >= from && BigInt(entry.meta.height) <= to
          );
          return Response.json({
            data: filtered.slice((pageNumber - 1) * 100, pageNumber * 100),
            pagination: { pageNumber, pageSize: 100 },
          });
        }
        if (url.pathname.startsWith('/accounts/')) {
          const key = [signer, otherSigner].find((key) => url.pathname.endsWith(address(key).toString()));
          if (!key) return new Response('', { status: 404 });
          const node = linkedKeys.get(key);
          return Response.json({
            account: {
              publicKey: key,
              address: Buffer.from(address(key).bytes).toString('hex'),
              supplementalPublicKeys: node
                ? {
                    node: { publicKey: node },
                    linked: { publicKey: new KeyPair(new PrivateKey(new Uint8Array(32).fill(5))).publicKey.toString() },
                    vrf: { publicKey: new KeyPair(new PrivateKey(new Uint8Array(32).fill(6))).publicKey.toString() },
                  }
                : {},
              mosaics: balances,
            },
          });
        }
        return new Response('', { status: 404 });
      })
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  });

  const scans = (urls: URL[]) =>
    urls.filter((url) => url.pathname === '/transactions/confirmed' && url.searchParams.has('address'));
  const messageScans = () =>
    calls.filter((url) => url.pathname === '/transactions/confirmed' && url.searchParams.get('type') === '16724');
  const discover = (restUrl?: string) => discoverLinkedAccounts({ nodePrivateKey, cacheFile, restUrl });

  it('ノードのaddressで履歴を探索し、候補の現在のリンクと残高を取得する', async () => {
    transactions.push(transaction(2, otherSigner), transaction(3, otherSigner, anotherNode));
    const result = await discover();
    expect(result.network).toBe('testnet');
    expect(result.nodePublicKey).toBe(nodePublicKey);
    expect(result.scannedThrough).toBe('100');
    expect(result.candidateCount).toBe(2);
    expect(result.accounts).toEqual([
      {
        publicKey: signer,
        address: address(signer).toString(),
        linkedHeight: '2',
        delegationMessages: [],
        balances: [{ mosaicId: '6BED913FA20223F8', amount: '9007199254740993' }],
      },
    ]);
    expect(Object.fromEntries(scans(calls)[0].searchParams)).toEqual({
      address: address(nodePublicKey).toString(),
      pageSize: '100',
      pageNumber: '1',
      order: 'asc',
      fromHeight: '1',
      toHeight: '100',
    });
    expect(calls.every((url) => url.origin === 'http://localhost:3000')).toBe(true);
    const cache = await readFile(cacheFile, 'utf8');
    expect(cache).not.toContain(Buffer.from(nodePrivateKey).toString('hex'));
    expect(cache).not.toContain('9007199254740993');
    expect((await stat(cacheFile)).mode & 0o777).toBe(0o600);
  });

  it.each([
    { network: Network.MAINNET, identifier: 104, name: 'mainnet' },
    { network: Network.TESTNET, identifier: 152, name: 'testnet' },
  ])('$name の識別子で探索・アドレス生成・キャッシュ復元ができる', async ({ network, identifier, name }) => {
    const nodeAddress = network.publicKeyToAddress(new PublicKey(nodePublicKey));
    const signerAddress = network.publicKeyToAddress(new PublicKey(signer));
    transactions[0].transaction.network = identifier;
    const message = transfer(2, await delegationMessage());
    message.transaction.network = identifier;
    message.transaction.recipientAddress = Buffer.from(nodeAddress.bytes).toString('hex');
    transfers = [message];
    intercept = (url) => {
      if (url.pathname === '/node/info')
        return Response.json({ networkIdentifier: identifier, networkGenerationHashSeed: generationHashSeed });
      if (url.pathname === `/accounts/${signerAddress.toString()}`)
        return Response.json({
          account: {
            publicKey: signer,
            address: Buffer.from(signerAddress.bytes).toString('hex'),
            supplementalPublicKeys: {
              node: { publicKey: nodePublicKey },
              linked: { publicKey: new KeyPair(new PrivateKey(new Uint8Array(32).fill(5))).publicKey.toString() },
              vrf: { publicKey: new KeyPair(new PrivateKey(new Uint8Array(32).fill(6))).publicKey.toString() },
            },
            mosaics: balances,
          },
        });
      return undefined;
    };
    const result = await discover();
    expect(result.network).toBe(name);
    expect(result.nodeAddress).toBe(nodeAddress.toString());
    expect(result.accounts[0].address).toBe(signerAddress.toString());
    expect(result.accounts[0].delegationMessages).toHaveLength(1);
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).networkIdentifier).toBe(identifier);
    calls = [];
    const restored = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    expect(calls).toEqual([]);
    expect(restored.skippedAccounts).toEqual([]);
    expect(restored.harvesters).toEqual([
      {
        signingPrivateKey: new Uint8Array(32).fill(5),
        vrfPrivateKey: new Uint8Array(32).fill(6),
      },
    ]);
  });

  it('誤った旧Mainnet判定値144は受け付けない', async () => {
    intercept = (url) =>
      url.pathname === '/node/info'
        ? Response.json({ networkIdentifier: 144, networkGenerationHashSeed: generationHashSeed })
        : undefined;
    await expect(discover()).rejects.toThrow('MainnetまたはTestnet');
  });

  it('単独の委任開始Transferから候補を拾い、リンク履歴を署名者で絞る', async () => {
    transfers = [transfer(10, await delegationMessage())];
    intercept = (url) =>
      url.pathname === '/transactions/confirmed' && url.searchParams.has('address')
        ? Response.json({ data: transfers, pagination: { pageNumber: 1, pageSize: 100 } })
        : undefined;
    const result = await discover();
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].linkedHeight).toBe('2');
    expect(result.accounts[0].delegationMessages).toHaveLength(1);
    expect(Object.fromEntries(scans(calls)[0].searchParams)).toMatchObject({
      address: address(nodePublicKey).toString(),
      order: 'asc',
    });
    expect(scans(calls)[0].searchParams.has('type')).toBe(false);
    expect(scans(calls)[0].searchParams.has('embedded')).toBe(false);
    const links = calls.filter((url) => url.searchParams.get('type') === '16972');
    expect(links).toHaveLength(1);
    expect(links[0].searchParams.get('signerPublicKey')).toBe(signer);
    expect((await restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).harvesters).toHaveLength(1);
  });

  it.each([16705, 16961])('address検索のAggregate（%i）を展開してリンクと内部Transferを復元する', async (type) => {
    const aggregateHash = 'C'.repeat(64);
    const message = await delegationMessage();
    const linked = transaction(1);
    linked.meta.index = 0;
    linked.meta.aggregateHash = aggregateHash;
    const delegated = transfer(2, message, '2', 1);
    delegated.meta.aggregateHash = aggregateHash;
    transactions = [linked];
    transfers = [delegated];
    const root = {
      id: '000000000000000000000003',
      meta: { height: '2', index: 7, hash: aggregateHash },
      transaction: { type, network: 152 },
    };
    intercept = (url) => {
      if (url.pathname === '/transactions/confirmed' && url.searchParams.has('address'))
        return Response.json({ data: [root], pagination: { pageNumber: 1, pageSize: 100 } });
      if (url.pathname.endsWith(aggregateHash))
        return Response.json({ ...root, transaction: { ...root.transaction, transactions: [linked, delegated] } });
      return undefined;
    };
    const onProgress = vi.fn();
    const result = await discoverLinkedAccounts({ nodePrivateKey, cacheFile, onProgress });
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'transactions', status: 'aggregate', aggregateNumber: 1, aggregateCount: 1 })
    );
    expect(result.candidateCount).toBe(1);
    expect(result.accounts[0].linkedHeight).toBe('2');
    expect(result.accounts[0].delegationMessages).toEqual([
      expect.objectContaining({ height: '2', blockIndex: 7, innerIndex: 1, message }),
    ]);
    expect(calls.filter((url) => url.pathname.endsWith(aggregateHash))).toHaveLength(1);
    expect((await restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).harvesters).toHaveLength(1);
  });

  it.each(['hash', 'height', 'index', 'network', 'inner-index', 'inner-hash', 'transactions'])(
    '不正なAggregateのページを保存しない（%s）',
    async (field) => {
      const aggregateHash = 'C'.repeat(64);
      const linked = transaction(1);
      linked.meta.index = field === 'inner-index' ? 3 : 0;
      linked.meta.aggregateHash = field === 'inner-hash' ? 'D'.repeat(64) : aggregateHash;
      const root = {
        id: '000000000000000000000003',
        meta: { height: '2', index: 7, hash: aggregateHash },
        transaction: { type: 16705, network: 152 },
      };
      const detail = {
        ...root,
        meta: {
          height: field === 'height' ? '3' : '2',
          index: field === 'index' ? 8 : 7,
          hash: field === 'hash' ? 'D'.repeat(64) : aggregateHash,
        },
        transaction: {
          type: 16705,
          network: field === 'network' ? 104 : 152,
          transactions: field === 'transactions' ? null : [linked],
        },
      };
      intercept = (url) => {
        if (url.pathname === '/transactions/confirmed' && url.searchParams.has('address'))
          return Response.json({ data: [root], pagination: { pageNumber: 1, pageSize: 100 } });
        if (url.pathname.endsWith(aggregateHash)) return Response.json(detail);
        return undefined;
      };
      await expect(discover()).rejects.toThrow('Aggregate');
      expect(JSON.parse(await readFile(cacheFile, 'utf8'))).toMatchObject({
        candidates: [],
        scannedThrough: '0',
        pending: { nextPage: 1 },
      });
    }
  );

  it('通常の受信Transferや復号できないメッセージから候補を作らない', async () => {
    transactions = [];
    const valid = await delegationMessage();
    const damaged = valid.slice(0, -2) + (valid.endsWith('00') ? '01' : '00');
    transfers = [transfer(1, '0068656C6C6F'), transfer(2, damaged)];
    expect((await discover()).candidateCount).toBe(0);
    expect(calls.some((url) => url.searchParams.has('signerPublicKey'))).toBe(false);
  });

  it('旧キャッシュのページ番号は引き継がずaddress検索を開始する', async () => {
    await discover();
    const old = JSON.parse(await readFile(cacheFile, 'utf8'));
    old.version = 1;
    old.pending = {
      toHeight: '200',
      hash: hash('200'),
      restUrl: 'http://localhost:3000/',
      nextPage: 99,
      lastId: 'F'.repeat(24),
    };
    delete old.candidates[0].links;
    await writeFile(cacheFile, JSON.stringify(old));
    calls = [];
    await discover();
    expect(scans(calls).map((url) => url.searchParams.get('pageNumber'))).toEqual(['1']);
    expect(scans(calls)[0].searchParams.get('fromHeight')).toBe('1');
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).version).toBe(2);
  });

  it('旧版の完了キャッシュはREST通信せず引き続き復元できる', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    const old = JSON.parse(await readFile(cacheFile, 'utf8'));
    old.version = 1;
    delete old.candidates[0].links;
    await writeFile(cacheFile, JSON.stringify(old));
    calls = [];
    expect((await restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).harvesters).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  it('候補のリンク履歴が途中なら同じ高さの古いsnapshotがあっても復元しない', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    cache.candidates[0].links = {
      scannedThrough: '0',
      pending: { toHeight: '100', hash: hash('100'), restUrl: 'http://localhost:3000/', nextPage: 1 },
    };
    await writeFile(cacheFile, JSON.stringify(cache));
    await expect(restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).rejects.toThrow('完了');
  });

  it('ページ取得前と保存後に検索範囲・取得件数・取得した高さを通知する', async () => {
    const onProgress = vi.fn();
    await discoverLinkedAccounts({ nodePrivateKey, cacheFile, onProgress });
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'transactions',
        status: 'request',
        pageNumber: 1,
        fromHeight: '1',
        toHeight: '100',
      })
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'transactions', status: 'saved', transactionCount: 1, lastHeight: '2' })
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'accounts', accountNumber: 1, accountCount: 1 })
    );
  });

  it('全ページを処理済みなら履歴を再取得せず、現在の解除状態を確認して結果から外す', async () => {
    await discover();
    linkedKeys.delete(signer);
    calls = [];
    const result = await discover();
    expect(scans(calls)).toHaveLength(0);
    expect(calls.some((url) => url.pathname.startsWith('/accounts/'))).toBe(true);
    expect(result.accounts).toEqual([]);
  });

  it('残高はキャッシュを再利用せず毎回取得する', async () => {
    await discover();
    balances = [{ id: '6BED913FA20223F8', amount: '42' }];
    expect((await discover()).accounts[0].balances[0].amount).toBe('42');
  });

  it('次の実行では未キャッシュの高さだけを探索する', async () => {
    await discover();
    finalizedHeight = '200';
    transactions.push(transaction(2, otherSigner, nodePublicKey, '150'));
    linkedKeys.set(otherSigner, nodePublicKey);
    calls = [];
    const result = await discover();
    expect(scans(calls)[0].searchParams.get('fromHeight')).toBe('101');
    expect(scans(calls)[0].searchParams.get('toHeight')).toBe('200');
    expect(result.accounts).toHaveLength(2);
  });

  it('2ページ目の失敗後は保存済みの1ページ目を飛ばして再開する', async () => {
    transactions = Array.from({ length: 101 }, (_, index) => transaction(index + 1));
    intercept = (url) => (url.searchParams.get('pageNumber') === '2' ? new Response('', { status: 503 }) : undefined);
    await expect(discover()).rejects.toThrow('503');
    expect(JSON.parse(await readFile(cacheFile, 'utf8'))).toMatchObject({
      scannedThrough: '0',
      pending: { nextPage: 2 },
      candidates: [expect.objectContaining({ publicKey: signer, height: '2' })],
    });
    intercept = undefined;
    calls = [];
    expect((await discover()).accounts).toHaveLength(1);
    expect(scans(calls).map((url) => url.searchParams.get('pageNumber'))).toEqual(['2']);
    await expect(stat(`${cacheFile}.lock`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('100件ちょうどの範囲では次の空ページも取得して完了を確定する', async () => {
    transactions = Array.from({ length: 100 }, (_, index) => transaction(index + 1));
    await discover();
    expect(scans(calls).map((url) => url.searchParams.get('pageNumber'))).toEqual(['1', '2']);
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).pending).toBeUndefined();
  });

  it('REST接続先の変更時は未完了範囲だけをページ1から探索し直す', async () => {
    transactions = Array.from({ length: 101 }, (_, index) => transaction(index + 1));
    intercept = (url) => (url.searchParams.get('pageNumber') === '2' ? new Response('', { status: 503 }) : undefined);
    await expect(discover('https://first.example')).rejects.toThrow();
    intercept = undefined;
    calls = [];
    await discover('https://second.example');
    expect(scans(calls).map((url) => url.searchParams.get('pageNumber'))).toEqual(['1', '2']);
    expect((await discover('https://second.example')).candidateCount).toBe(1);
  });

  it('ページ内に不正な取引がある場合はそのページの候補も進捗も保存しない', async () => {
    const invalid = transaction(2, otherSigner);
    invalid.transaction.network = 104;
    transactions.push(invalid);
    await expect(discover()).rejects.toThrow('取引');
    expect(JSON.parse(await readFile(cacheFile, 'utf8'))).toMatchObject({
      candidates: [],
      scannedThrough: '0',
      pending: { nextPage: 1 },
    });
  });

  it('ページ番号を無視して同じ100件を返すRESTでは進捗を進めない', async () => {
    transactions = Array.from({ length: 100 }, (_, index) => transaction(index + 1));
    intercept = (url) =>
      url.searchParams.get('pageNumber') === '2'
        ? Response.json({ data: transactions, pagination: { pageNumber: 2, pageSize: 100 } })
        : undefined;
    await expect(discover()).rejects.toThrow('並び順');
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).pending.nextPage).toBe(2);
  });

  it('ネットワークまたはノードキーが違うキャッシュを使わない', async () => {
    await discover();
    await expect(discoverLinkedAccounts({ nodePrivateKey: new Uint8Array(32).fill(7), cacheFile })).rejects.toThrow(
      '一致'
    );
    generationHashSeed = 'B'.repeat(64);
    await expect(discover()).rejects.toThrow('一致');
  });

  it('キャッシュ済みブロックのハッシュが一致しない場合は停止する', async () => {
    await discover();
    finalizedHeight = '200';
    intercept = (url) =>
      url.pathname === '/blocks/100'
        ? Response.json({ block: { height: '100' }, meta: { hash: 'F'.repeat(64) } })
        : undefined;
    await expect(discover()).rejects.toThrow('ハッシュ');
  });

  it('キャッシュより遅れているRESTでは探索済み高さを巻き戻さない', async () => {
    await discover();
    finalizedHeight = '99';
    await expect(discover()).rejects.toThrow('達していません');
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).scannedThrough).toBe('100');
  });

  it('壊れたキャッシュを上書きせず、同時実行も拒否する', async () => {
    await writeFile(cacheFile, '{壊れたJSON');
    await expect(discover()).rejects.toThrow('キャッシュ');
    expect(await readFile(cacheFile, 'utf8')).toBe('{壊れたJSON');
    await writeFile(`${cacheFile}.lock`, '');
    await expect(discover()).rejects.toThrow('ロック');
  });

  it('履歴がない場合も探索済み高さをキャッシュする', async () => {
    transactions = [];
    expect((await discover()).accounts).toEqual([]);
    expect(JSON.parse(await readFile(cacheFile, 'utf8')).scannedThrough).toBe('100');
  });

  it('アカウントが既に存在しない場合は無視するが、REST障害は失敗として扱う', async () => {
    intercept = (url) => (url.pathname.startsWith('/accounts/') ? new Response('', { status: 404 }) : undefined);
    expect((await discover()).accounts).toEqual([]);
    intercept = (url) => (url.pathname.startsWith('/accounts/') ? new Response('', { status: 503 }) : undefined);
    await expect(discover()).rejects.toThrow('503');
  });

  it('リンクしていない場合は残高が不正でも結果から除外する', async () => {
    linkedKeys.delete(signer);
    balances = [{ id: '不正', amount: '-1' }];
    expect((await discover()).accounts).toEqual([]);
  });

  it.each(['-1', '1.5', '18446744073709551616'])('リンク中の残高が不正な場合は拒否する（%#）', async (amount) => {
    balances[0].amount = amount;
    await expect(discover()).rejects.toThrow();
  });

  it('探索高さと残高が安全な数値範囲を超えても桁を維持する', async () => {
    finalizedHeight = '9007199254740993';
    transactions = [transaction(1, signer, nodePublicKey, '9007199254740992')];
    const result = await discover();
    expect(result.scannedThrough).toBe('9007199254740993');
    expect(result.accounts[0].balances[0].amount).toBe('9007199254740993');
  });

  it('フルRESTのURLを指定すると全リクエストに使用する', async () => {
    await discover('https://full-rest.example:3001');
    expect(calls.every((url) => url.origin === 'https://full-rest.example:3001')).toBe(true);
  });

  it('リンク後の委任開始メッセージを取得し、暗号文だけをキャッシュする', async () => {
    const message = await delegationMessage();
    transfers = [transfer(10, message)];
    const result = await discover();
    expect(result.accounts[0].linkedHeight).toBe('2');
    expect(result.accounts[0].delegationMessages).toEqual([
      { id: '00000000000000000000000A', height: '3', blockIndex: 1, innerIndex: -1, message },
    ]);
    expect(Object.fromEntries(messageScans()[0].searchParams)).toMatchObject({
      signerPublicKey: signer,
      recipientAddress: address(nodePublicKey).toString(),
      type: '16724',
      embedded: 'true',
      fromHeight: '2',
      toHeight: '100',
    });
    const cache = await readFile(cacheFile, 'utf8');
    expect(cache).toContain(message);
    expect(cache).not.toContain('05'.repeat(32));
    expect(cache).not.toContain('06'.repeat(32));
    calls = [];
    expect((await discover()).accounts[0].delegationMessages[0].message).toBe(message);
    expect(messageScans()).toHaveLength(0);
  });

  it('同じブロックではリンクより前のTransferを除外し、後のTransferを取得する', async () => {
    const message = await delegationMessage();
    transfers = [transfer(10, message, '2', 0), transfer(11, message, '2', 2)];
    const result = await discover();
    expect(result.accounts[0].delegationMessages.map((entry) => entry.blockIndex)).toEqual([2]);
  });

  it('同じAggregateの内部順序を比較し、親取引のブロック内位置を確認する', async () => {
    const message = await delegationMessage();
    const aggregateHash = 'C'.repeat(64);
    transactions[0].meta.aggregateHash = aggregateHash;
    transactions.push(transaction(2, signer, nodePublicKey, '1'));
    transfers = [transfer(10, message, '2', 0), transfer(11, message, '2', 2)];
    transfers.forEach((entry) => {
      entry.meta.aggregateHash = aggregateHash;
    });
    intercept = (url) =>
      url.pathname === `/transactions/confirmed/${aggregateHash}`
        ? Response.json({ meta: { height: '2', index: 7, hash: aggregateHash }, transaction: { type: 16705 } })
        : undefined;
    const result = await discover();
    expect(result.accounts[0].delegationMessages).toEqual([
      expect.objectContaining({ height: '2', blockIndex: 7, innerIndex: 2 }),
    ]);
    expect(calls.filter((url) => url.pathname.endsWith(aggregateHash))).toHaveLength(1);
  });

  it('通常メッセージ・改ざん・他の鍵宛てのメッセージは委任開始として返さない', async () => {
    const message = await delegationMessage();
    const tampered = message.slice(0, -2) + (message.endsWith('00') ? '01' : '00');
    transfers = [transfer(10, '0068656C6C6F'), transfer(11, tampered), transfer(12, message)];
    expect((await discover()).accounts[0].delegationMessages).toHaveLength(1);
  });

  it('別Aggregateでは内部indexではなく親取引のブロック内位置で前後を判定する', async () => {
    const message = await delegationMessage();
    transactions[0].meta.index = 10;
    const beforeHash = 'C'.repeat(64);
    const afterHash = 'D'.repeat(64);
    transfers = [transfer(10, message, '2', 99), transfer(11, message, '2', 0)];
    transfers[0].meta.aggregateHash = beforeHash;
    transfers[1].meta.aggregateHash = afterHash;
    intercept = (url) => {
      const hash = url.pathname.split('/').at(-1);
      return hash === beforeHash || hash === afterHash
        ? Response.json({
            meta: { height: '2', index: hash === beforeHash ? 9 : 11, hash },
            transaction: { type: 16705 },
          })
        : undefined;
    };
    const result = await discover();
    expect(result.accounts[0].delegationMessages).toEqual([expect.objectContaining({ blockIndex: 11, innerIndex: 0 })]);
  });

  it('現在は解除または別ノードへ移行しているアカウントのメッセージは探索しない', async () => {
    linkedKeys.set(signer, anotherNode);
    transfers = [transfer(10, await delegationMessage())];
    expect((await discover()).accounts).toEqual([]);
    expect(messageScans()).toHaveLength(0);
  });

  it('再リンクしたブロック高で更新し、それ以前の委任開始メッセージを除外する', async () => {
    const message = await delegationMessage();
    transfers = [transfer(10, message)];
    expect((await discover()).accounts[0].delegationMessages).toHaveLength(1);
    finalizedHeight = '200';
    transactions.push(transaction(2, signer, nodePublicKey, '150'));
    transfers.push(transfer(11, message, '151'));
    calls = [];
    const result = await discover();
    expect(result.accounts[0].linkedHeight).toBe('150');
    expect(result.accounts[0].delegationMessages.map((entry) => entry.height)).toEqual(['151']);
    expect(messageScans()[0].searchParams.get('fromHeight')).toBe('150');
  });

  it('解除取引でリンク設定ブロック高を更新しない', async () => {
    const unlink = transaction(2, signer, nodePublicKey, '3');
    unlink.transaction.linkAction = 0;
    transactions.push(unlink);
    expect((await discover()).accounts[0].linkedHeight).toBe('2');
  });

  it('委任開始メッセージの探索に失敗してもNodeKeyLink履歴を再取得しない', async () => {
    const message = await delegationMessage();
    transfers = Array.from({ length: 101 }, (_, index) => transfer(index + 10, message, '3', index + 1));
    intercept = (url) =>
      url.searchParams.get('type') === '16724' && url.searchParams.get('pageNumber') === '2'
        ? new Response('', { status: 503 })
        : undefined;
    await expect(discover()).rejects.toThrow('503');
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    expect(cache.scannedThrough).toBe('100');
    expect(cache.candidates[0].messages.pending.nextPage).toBe(2);
    intercept = undefined;
    calls = [];
    expect((await discover()).accounts[0].delegationMessages).toHaveLength(101);
    expect(scans(calls)).toHaveLength(0);
    expect(messageScans().map((url) => url.searchParams.get('pageNumber'))).toEqual(['2']);
  });

  it('キャッシュだけで平文の署名用鍵とVRF鍵を復元し、暗号化APIへ渡せる', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    const before = await readFile(cacheFile, 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('REST通信は禁止');
      })
    );
    const result = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    const expected = [{ signingPrivateKey: new Uint8Array(32).fill(5), vrfPrivateKey: new Uint8Array(32).fill(6) }];
    expect(result.harvesters).toEqual(expected);
    expect(result.skippedAccounts).toEqual([]);
    expect(await readFile(cacheFile, 'utf8')).toBe(before);
    const encrypted = await encryptHarvesters(result.harvesters, nodePublicKey);
    expect(await decryptHarvesters(encrypted, nodePrivateKey)).toEqual(expected);
  });

  it('最新メッセージが現在の署名用鍵と違う場合は一致する以前のメッセージを選ぶ', async () => {
    transfers = [transfer(10, await delegationMessage(), '3'), transfer(11, await delegationMessage(7), '4')];
    await discover();
    const result = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    expect(result.harvesters[0].signingPrivateKey).toEqual(new Uint8Array(32).fill(5));
  });

  it('最後の探索でリンク解除されていたアカウントをキャッシュから復元しない', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    linkedKeys.delete(signer);
    await discover();
    expect((await restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).harvesters).toEqual([]);
  });

  it('一致するメッセージがない場合は復元不可アカウントを報告する', async () => {
    await discover();
    const result = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    expect(result.harvesters).toEqual([]);
    expect(result.skippedAccounts).toEqual([{ publicKey: signer, reason: 'no-matching-message' }]);
  });

  it('VRF鍵のリンク情報がない場合は秘密鍵を復元せず理由を返す', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    delete cache.snapshot.activeAccounts[0].vrfPublicKey;
    await writeFile(cacheFile, JSON.stringify(cache));
    const result = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    expect(result.harvesters).toEqual([]);
    expect(result.skippedAccounts[0].reason).toBe('missing-harvesting-keys');
  });

  it('別ノードの秘密鍵ではキャッシュを復元できない', async () => {
    await discover();
    await expect(restoreHarvestersFromCache({ nodePrivateKey: new Uint8Array(32).fill(8), cacheFile })).rejects.toThrow(
      '一致'
    );
  });

  it('探索途中のキャッシュからは平文状態を作成しない', async () => {
    await discover();
    finalizedHeight = '200';
    intercept = (url) => (url.searchParams.get('type') === '16724' ? new Response('', { status: 503 }) : undefined);
    await expect(discover()).rejects.toThrow();
    await expect(restoreHarvestersFromCache({ nodePrivateKey, cacheFile })).rejects.toThrow('完了');
  });

  it('キャッシュの暗号文が改ざんされている場合は鍵を復元しない', async () => {
    transfers = [transfer(10, await delegationMessage())];
    await discover();
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    const message = cache.candidates[0].messages.entries[0].message as string;
    cache.candidates[0].messages.entries[0].message = message.slice(0, -2) + (message.endsWith('00') ? '01' : '00');
    await writeFile(cacheFile, JSON.stringify(cache));
    const result = await restoreHarvestersFromCache({ nodePrivateKey, cacheFile });
    expect(result.harvesters).toEqual([]);
    expect(result.skippedAccounts[0].reason).toBe('no-matching-message');
  });
});
