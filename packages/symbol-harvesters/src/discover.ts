import { PrivateKey, PublicKey } from 'symbol-sdk';
import { KeyPair, MessageEncoder, Network } from 'symbol-sdk/symbol';

import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { DiagnosticError, fileErrorDetail } from './errors.js';

const NODE_KEY_LINK_TYPE = 16972;
const TRANSFER_TYPE = 16724;
const PAGE_SIZE = 100;
const DELEGATION_MARKER = 'FE2A8061577301E2';

class RestError extends DiagnosticError {
  constructor(readonly status: number) {
    super(`RESTの取得に失敗しました（HTTP ${status}）。`);
  }
}

/** ノードキーリンクの探索条件です。秘密鍵は通信・キャッシュに含めません。 */
export interface DiscoverLinkedAccountsOptions {
  nodePrivateKey: Uint8Array;
  restUrl?: string;
  cacheFile?: string;
  onProgress?: (progress: {
    phase: 'links' | 'messages';
    pageNumber: number;
    toHeight: string;
    candidateCount: number;
  }) => void;
}

/** ブロック内の取引順序です。innerIndexは単独取引の場合に-1となります。 */
interface Position {
  height: string;
  blockIndex: number;
  innerIndex: number;
}

/** リンク設定後に送られ、指定ノードの鍵で復号できた委任開始メッセージです。 */
export interface DelegationMessage extends Position {
  id: string;
  /** 委任開始マーカーを含む暗号化メッセージの16進文字列です。 */
  message: string;
}

/** 探索時点で指定ノードの公開鍵とリンクしているアカウントです。 */
export interface LinkedAccount {
  address: string;
  publicKey: string;
  linkedHeight: string;
  /** モザイクIDごとの残高です。amountは最小単位の10進整数文字列です。 */
  balances: { mosaicId: string; amount: string }[];
  delegationMessages: DelegationMessage[];
}

/** 履歴の探索範囲と、RESTで現在のリンクを確認できたアカウントを返します。 */
export interface LinkedAccountsResult {
  network: 'mainnet' | 'testnet';
  generationHashSeed: string;
  nodePublicKey: string;
  nodeAddress: string;
  scannedThrough: string;
  candidateCount: number;
  accounts: LinkedAccount[];
}

interface PendingScan {
  toHeight: string;
  hash: string;
  restUrl: string;
  nextPage: number;
  lastId?: string;
}

interface Scan {
  scannedThrough: string;
  scannedHash?: string;
  pending?: PendingScan;
}

interface Candidate extends Position {
  publicKey: string;
  messages: Scan & { entries: DelegationMessage[] };
}

interface ScanCache extends Scan {
  version: 1;
  networkIdentifier: number;
  generationHashSeed: string;
  nodePublicKey: string;
  candidates: Candidate[];
  snapshot?: {
    scannedThrough: string;
    checkedAt: string;
    activeAccounts: { publicKey: string; linkedPublicKey?: string; vrfPublicKey?: string }[];
  };
}

/** 未検証のJSONをオブジェクトとして扱う前に構造を確認します。 */
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new DiagnosticError('応答またはキャッシュの形式が不正です。');
  return value as Record<string, unknown>;
}

function hex(value: unknown, size = 64): string {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-fA-F]{${size}}$`).test(value))
    throw new DiagnosticError('応答またはキャッシュの公開情報が不正です。');
  return value.toUpperCase();
}

/** 高さと残高は丸めを避けるため、10進文字列とBigIntで扱います。 */
function uint64(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value) > 0xffffffffffffffffn)
    throw new DiagnosticError('応答またはキャッシュの整数が不正です。');
  return value;
}

function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
    throw new DiagnosticError('応答またはキャッシュの位置が不正です。');
  return value;
}

function position(value: unknown): Position {
  const data = object(value);
  return {
    height: uint64(data.height),
    blockIndex: integer(data.blockIndex),
    innerIndex: integer(data.innerIndex, -1),
  };
}

function compare(lhs: Position, rhs: Position): number {
  if (BigInt(lhs.height) !== BigInt(rhs.height)) return BigInt(lhs.height) > BigInt(rhs.height) ? 1 : -1;
  return lhs.blockIndex - rhs.blockIndex || lhs.innerIndex - rhs.innerIndex;
}

function parseScan(data: Record<string, unknown>): Scan {
  const state: Scan = { scannedThrough: uint64(data.scannedThrough) };
  if (data.scannedHash !== undefined) state.scannedHash = hex(data.scannedHash);
  if (data.pending !== undefined) {
    const pending = object(data.pending);
    if (typeof pending.restUrl !== 'string' || BigInt(uint64(pending.toHeight)) <= BigInt(state.scannedThrough))
      throw new DiagnosticError('キャッシュの再開範囲が不正です。');
    state.pending = {
      toHeight: uint64(pending.toHeight),
      hash: hex(pending.hash),
      restUrl: pending.restUrl,
      nextPage: integer(pending.nextPage, 1),
    };
    if (pending.lastId !== undefined) state.pending.lastId = hex(pending.lastId, 24);
    if ((state.pending.nextPage === 1) !== (state.pending.lastId === undefined))
      throw new DiagnosticError('キャッシュの再開位置が不正です。');
  }
  return state;
}

/** キャッシュの識別情報・再開位置・公開データを検証します。 */
function parseCache(value: unknown, identity: ScanCache): ScanCache {
  const data = object(value);
  if (
    data.version !== 1 ||
    data.networkIdentifier !== identity.networkIdentifier ||
    hex(data.generationHashSeed) !== identity.generationHashSeed ||
    hex(data.nodePublicKey) !== identity.nodePublicKey ||
    !Array.isArray(data.candidates)
  )
    throw new DiagnosticError('キャッシュの対象が一致しません。');
  const cache: ScanCache = { ...identity, ...parseScan(data), candidates: [] };
  if (cache.scannedThrough !== '0' && !cache.scannedHash)
    throw new DiagnosticError('キャッシュのブロックハッシュがありません。');
  const keys = new Set<string>();
  for (const raw of data.candidates) {
    const candidate = object(raw);
    const publicKey = hex(candidate.publicKey);
    if (keys.has(publicKey)) throw new DiagnosticError('キャッシュの候補が重複しています。');
    keys.add(publicKey);
    const messages = object(candidate.messages);
    if (!Array.isArray(messages.entries)) throw new DiagnosticError('キャッシュのメッセージが不正です。');
    const entry: Candidate = { ...position(candidate), publicKey, messages: { ...parseScan(messages), entries: [] } };
    if (entry.height === '0' || BigInt(entry.messages.scannedThrough) < BigInt(entry.height) - 1n)
      throw new DiagnosticError('キャッシュのリンク高さが不正です。');
    for (const rawMessage of messages.entries) {
      const message = object(rawMessage);
      const stored = { ...position(message), id: hex(message.id, 24), message: hex(message.message, 264) };
      if (!stored.message.startsWith(DELEGATION_MARKER) || compare(stored, entry) <= 0)
        throw new DiagnosticError('キャッシュの委任開始メッセージが不正です。');
      entry.messages.entries.push(stored);
    }
    cache.candidates.push(entry);
  }
  if (data.snapshot !== undefined) {
    const snapshot = object(data.snapshot);
    if (
      typeof snapshot.checkedAt !== 'string' ||
      !Number.isFinite(Date.parse(snapshot.checkedAt)) ||
      !Array.isArray(snapshot.activeAccounts)
    )
      throw new DiagnosticError('キャッシュのリンク状態が不正です。');
    cache.snapshot = {
      scannedThrough: uint64(snapshot.scannedThrough),
      checkedAt: snapshot.checkedAt,
      activeAccounts: snapshot.activeAccounts.map((value: unknown) => {
        const account = object(value);
        return {
          publicKey: hex(account.publicKey),
          linkedPublicKey: account.linkedPublicKey === undefined ? undefined : hex(account.linkedPublicKey),
          vrfPublicKey: account.vrfPublicKey === undefined ? undefined : hex(account.vrfPublicKey),
        };
      }),
    };
  }
  return cache;
}

/** 書き込み途中のデータを正式キャッシュとして扱わないよう、同じディレクトリ内で置換します。 */
async function saveCache(path: string, cache: ScanCache): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(cache) + '\n');
    await file.sync();
  } catch (error) {
    await file.close();
    await unlink(temporary);
    throw error;
  }
  await file.close();
  try {
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary);
    throw error;
  }
}

/** NodeKeyLinkの署名者を高さ1から探索し、現在のリンク・残高・リンク後の委任開始メッセージを取得します。
 * 最終確定高さに上限を固定し、リンク履歴とアカウント別のメッセージ履歴をページごとにキャッシュします。
 */
export async function discoverLinkedAccounts(options: DiscoverLinkedAccountsOptions): Promise<LinkedAccountsResult> {
  if (!(options.nodePrivateKey instanceof Uint8Array) || options.nodePrivateKey.length !== 32)
    throw new TypeError('nodePrivateKeyには32バイトの秘密鍵を指定してください。');
  const keyPair = new KeyPair(new PrivateKey(new Uint8Array(options.nodePrivateKey)));
  const nodePublicKey = keyPair.publicKey;
  const encoder = new MessageEncoder(keyPair);
  let base: URL;
  try {
    base = new URL(options.restUrl ?? 'http://localhost:3000');
  } catch {
    throw new DiagnosticError('REST URLの形式が不正です。HTTP(S) URLを指定してください。');
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new DiagnosticError('REST URLには認証情報やクエリのないHTTP(S) URLを指定してください。');
  base.pathname = base.pathname.replace(/\/$/, '') + '/';
  const restUrl = base.toString();

  async function request(path: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000), redirect: 'error' });
    } catch {
      throw new DiagnosticError('RESTへの接続に失敗しました。');
    }
    if (!response.ok) throw new RestError(response.status);
    try {
      return object(await response.json());
    } catch {
      throw new DiagnosticError('RESTのJSON応答が不正です。');
    }
  }
  async function blockHash(blockHeight: string): Promise<string> {
    const block = await request(`blocks/${blockHeight}`);
    if (uint64(object(block.block).height) !== blockHeight)
      throw new DiagnosticError('RESTのブロック高さが一致しません。');
    return hex(object(block.meta).hash);
  }

  const info = await request('node/info');
  const network =
    info.networkIdentifier === 144 ? Network.MAINNET : info.networkIdentifier === 152 ? Network.TESTNET : undefined;
  if (!network) throw new DiagnosticError('MainnetまたはTestnetのRESTを指定してください。');
  const networkIdentifier = network.identifier;
  const generationHashSeed = hex(info.networkGenerationHashSeed);
  const nodeAddress = network.publicKeyToAddress(nodePublicKey);
  const identity: ScanCache = {
    version: 1,
    networkIdentifier: network.identifier,
    generationHashSeed,
    nodePublicKey: nodePublicKey.toString(),
    scannedThrough: '0',
    candidates: [],
  };
  const cacheFile =
    options.cacheFile ?? join('.symbol-harvesters-cache', `${generationHashSeed}-${identity.nodePublicKey}.json`);
  await mkdir(dirname(cacheFile), { recursive: true, mode: 0o700 });
  // 同時実行による進捗の巻き戻りや候補の消失を防ぎます。
  const lockFile = `${cacheFile}.lock`;
  let lock;
  try {
    lock = await open(lockFile, 'wx', 0o600);
  } catch (error) {
    const detail =
      error instanceof Error && 'code' in error && error.code === 'EEXIST'
        ? 'ロックファイルが既に存在します。実行中の探索がないか確認してください。'
        : (fileErrorDetail(error) ?? '保存先とアクセス権を確認してください。');
    throw new DiagnosticError(`探索キャッシュをロックできません。${detail}`);
  }
  try {
    let cache = identity;
    let cached: string | undefined;
    try {
      cached = await readFile(cacheFile, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (cached !== undefined) {
      try {
        cache = parseCache(JSON.parse(cached), identity);
      } catch {
        throw new DiagnosticError('キャッシュが不正、または対象ネットワーク・ノードキーと一致しません。');
      }
    }
    const chain = await request('chain/info');
    const finalized = object(chain.latestFinalizedBlock);
    const finalizedHeight = uint64(finalized.height);
    const finalizedHash = hex(finalized.hash);
    if (finalizedHeight === '0' || BigInt(uint64(chain.height)) < BigInt(finalizedHeight))
      throw new DiagnosticError('RESTの最終確定高さが不正です。');
    if ((await blockHash(finalizedHeight)) !== finalizedHash)
      throw new DiagnosticError('最終確定ブロックをRESTで確認できません。');
    if (cache.scannedThrough === '0') await blockHash('1');
    const aggregatePositions = new Map<string, Position>();

    /** Aggregate内のindexを、親取引のブロック内indexと組み合わせて比較可能にします。 */
    async function transactionPosition(entry: Record<string, unknown>): Promise<Position> {
      const meta = object(entry.meta);
      const atHeight = uint64(meta.height);
      const index = integer(meta.index);
      if (meta.aggregateHash === undefined) return { height: atHeight, blockIndex: index, innerIndex: -1 };
      const aggregateHash = hex(meta.aggregateHash);
      let parent = aggregatePositions.get(aggregateHash);
      if (!parent) {
        const aggregate = await request(`transactions/confirmed/${aggregateHash}`);
        const parentMeta = object(aggregate.meta);
        if (
          ![16705, 16961].includes(object(aggregate.transaction).type as number) ||
          hex(parentMeta.hash) !== aggregateHash ||
          parentMeta.aggregateHash !== undefined
        )
          throw new DiagnosticError('RESTの親Aggregateが不正です。');
        parent = { height: uint64(parentMeta.height), blockIndex: integer(parentMeta.index), innerIndex: -1 };
        aggregatePositions.set(aggregateHash, parent);
      }
      if (parent.height !== atHeight) throw new DiagnosticError('RESTの親Aggregateの高さが一致しません。');
      return { height: atHeight, blockIndex: parent.blockIndex, innerIndex: index };
    }

    /** 範囲を固定して安定したページを取得し、全件検証できたページのみ進捗を保存します。 */
    async function scan(
      state: Scan,
      type: number,
      extra: Record<string, string>,
      phase: 'links' | 'messages',
      prepare: (entries: Record<string, unknown>[]) => Promise<() => void>
    ): Promise<void> {
      if (BigInt(finalizedHeight) < BigInt(state.pending?.toHeight ?? state.scannedThrough))
        throw new DiagnosticError('RESTがキャッシュ済みの高さに達していません。');
      if (state.scannedHash && (await blockHash(state.scannedThrough)) !== state.scannedHash)
        throw new DiagnosticError('キャッシュ済みブロックのハッシュが一致しません。');
      if (state.pending && (await blockHash(state.pending.toHeight)) !== state.pending.hash)
        throw new DiagnosticError('再開対象のブロックハッシュが一致しません。');
      if (state.pending && state.pending.restUrl !== restUrl) {
        // ページ順序はRESTのDBに依存するため、接続先変更時は未完了範囲だけを先頭からやり直します。
        state.pending = { ...state.pending, restUrl, nextPage: 1, lastId: undefined };
        await saveCache(cacheFile, cache);
      }
      while (state.pending || BigInt(state.scannedThrough) < BigInt(finalizedHeight)) {
        if (!state.pending) {
          state.pending = { toHeight: finalizedHeight, hash: finalizedHash, restUrl, nextPage: 1 };
          await saveCache(cacheFile, cache);
        }
        const pending = state.pending;
        const fromHeight = (BigInt(state.scannedThrough) + 1n).toString();
        const query = new URLSearchParams({
          ...extra,
          type: String(type),
          embedded: 'true',
          pageSize: String(PAGE_SIZE),
          pageNumber: String(pending.nextPage),
          order: 'asc',
          fromHeight,
          toHeight: pending.toHeight,
        });
        const page = await request(`transactions/confirmed?${query}`);
        const pagination = object(page.pagination);
        if (
          pagination.pageNumber !== pending.nextPage ||
          pagination.pageSize !== PAGE_SIZE ||
          !Array.isArray(page.data) ||
          page.data.length > PAGE_SIZE
        )
          throw new DiagnosticError('RESTのページ情報が不正です。');
        let lastId = pending.lastId;
        const entries: Record<string, unknown>[] = [];
        for (const raw of page.data) {
          const entry = object(raw);
          const id = hex(entry.id, 24);
          const transaction = object(entry.transaction);
          const atHeight = BigInt(uint64(object(entry.meta).height));
          if (
            (lastId && id <= lastId) ||
            atHeight < BigInt(fromHeight) ||
            atHeight > BigInt(pending.toHeight) ||
            transaction.type !== type ||
            transaction.network !== networkIdentifier
          )
            throw new DiagnosticError('RESTの取引または並び順が不正です。');
          lastId = id;
          entries.push(entry);
        }
        const commit = await prepare(entries);
        if (page.data.length < PAGE_SIZE && (await blockHash(pending.toHeight)) !== pending.hash)
          throw new DiagnosticError('探索中に対象ブロックが変わりました。');
        commit();
        const completedPage = pending.nextPage;
        if (page.data.length < PAGE_SIZE) {
          state.scannedThrough = pending.toHeight;
          state.scannedHash = pending.hash;
          delete state.pending;
        } else {
          pending.nextPage = integer(pending.nextPage + 1, 1);
          pending.lastId = lastId;
        }
        await saveCache(cacheFile, cache);
        options.onProgress?.({
          phase,
          pageNumber: completedPage,
          toHeight: pending.toHeight,
          candidateCount: cache.candidates.length,
        });
      }
    }

    await scan(cache, NODE_KEY_LINK_TYPE, {}, 'links', async (entries) => {
      const found: { publicKey: string; at: Position }[] = [];
      for (const entry of entries) {
        const transaction = object(entry.transaction);
        const linkedPublicKey = hex(transaction.linkedPublicKey);
        const publicKey = hex(transaction.signerPublicKey);
        if (![0, 1].includes(transaction.linkAction as number))
          throw new DiagnosticError('RESTのリンク操作が不正です。');
        if (linkedPublicKey === identity.nodePublicKey && transaction.linkAction === 1)
          found.push({ publicKey, at: await transactionPosition(entry) });
      }
      return () => {
        for (const { publicKey, at } of found) {
          const previous = cache.candidates.find((candidate) => candidate.publicKey === publicKey);
          if (previous && compare(previous, at) >= 0) continue;
          const candidate: Candidate = {
            ...at,
            publicKey,
            messages: { scannedThrough: (BigInt(at.height) - 1n).toString(), entries: [] },
          };
          if (previous) cache.candidates[cache.candidates.indexOf(previous)] = candidate;
          else cache.candidates.push(candidate);
        }
        cache.candidates.sort((lhs, rhs) => lhs.publicKey.localeCompare(rhs.publicKey));
      };
    });

    const accounts: LinkedAccount[] = [];
    const activeAccounts: NonNullable<ScanCache['snapshot']>['activeAccounts'] = [];
    for (const candidate of cache.candidates) {
      const publicKey = candidate.publicKey;
      const address = network.publicKeyToAddress(new PublicKey(publicKey));
      let data: Record<string, unknown>;
      try {
        data = await request(`accounts/${address.toString()}`);
      } catch (error) {
        if (error instanceof RestError && error.status === 404) continue;
        throw error;
      }
      const account = object(data.account);
      if (
        hex(account.publicKey) !== publicKey ||
        hex(account.address, 48) !== Buffer.from(address.bytes).toString('hex').toUpperCase()
      )
        throw new DiagnosticError('RESTのアカウントが探索候補と一致しません。');
      const supplemental = object(account.supplementalPublicKeys);
      if (supplemental.node === undefined || hex(object(supplemental.node).publicKey) !== identity.nodePublicKey)
        continue;
      if (!Array.isArray(account.mosaics)) throw new DiagnosticError('RESTの残高情報が不正です。');
      const seen = new Set<string>();
      const balances = account.mosaics.map((value: unknown) => {
        const mosaic = object(value);
        const mosaicId = hex(mosaic.id, 16);
        if (seen.has(mosaicId)) throw new DiagnosticError('RESTの残高情報が重複しています。');
        seen.add(mosaicId);
        return { mosaicId, amount: uint64(mosaic.amount) };
      });
      await scan(
        candidate.messages,
        TRANSFER_TYPE,
        { signerPublicKey: publicKey, recipientAddress: nodeAddress.toString() },
        'messages',
        async (entries) => {
          const messages: DelegationMessage[] = [];
          for (const entry of entries) {
            const transaction = object(entry.transaction);
            if (
              hex(transaction.signerPublicKey) !== publicKey ||
              hex(transaction.recipientAddress, 48) !== Buffer.from(nodeAddress.bytes).toString('hex').toUpperCase()
            )
              throw new DiagnosticError('RESTの委任先または署名者が一致しません。');
            if (transaction.message === undefined) continue;
            if (typeof transaction.message !== 'string' || !/^(?:[0-9a-fA-F]{2})*$/.test(transaction.message))
              throw new DiagnosticError('RESTのメッセージが不正です。');
            const message = transaction.message.toUpperCase();
            if (message.length !== 264 || !message.startsWith(DELEGATION_MARKER)) continue;
            const at = await transactionPosition(entry);
            if (compare(at, candidate) <= 0) continue;
            // 復号は委任開始メッセージの認証にだけ使い、平文の秘密鍵を保存・出力しません。
            try {
              const decoded = await encoder.tryDecode(nodePublicKey, new Uint8Array(Buffer.from(message, 'hex')));
              try {
                if (decoded.isDecoded && decoded.message.length === 64)
                  messages.push({ ...at, id: hex(entry.id, 24), message });
              } finally {
                if (decoded.isDecoded) decoded.message.fill(0);
              }
            } catch {
              /* 他の鍵宛てや改ざんされたメッセージは無視します。 */
            }
          }
          return () => {
            const location = (entry: Position) => `${entry.height}:${entry.blockIndex}:${entry.innerIndex}`;
            const positions = new Set(candidate.messages.entries.map(location));
            for (const message of messages)
              if (!positions.has(location(message))) {
                candidate.messages.entries.push(message);
                positions.add(location(message));
              }
            candidate.messages.entries.sort(compare);
          };
        }
      );
      accounts.push({
        address: address.toString(),
        publicKey,
        linkedHeight: candidate.height,
        balances,
        delegationMessages: candidate.messages.entries.map((message) => ({ ...message })),
      });
      activeAccounts.push({
        publicKey,
        linkedPublicKey: supplemental.linked === undefined ? undefined : hex(object(supplemental.linked).publicKey),
        vrfPublicKey: supplemental.vrf === undefined ? undefined : hex(object(supplemental.vrf).publicKey),
      });
    }
    cache.snapshot = { scannedThrough: cache.scannedThrough, checkedAt: new Date().toISOString(), activeAccounts };
    await saveCache(cacheFile, cache);
    return {
      network: network.identifier === 144 ? 'mainnet' : 'testnet',
      generationHashSeed,
      nodePublicKey: identity.nodePublicKey,
      nodeAddress: nodeAddress.toString(),
      scannedThrough: cache.scannedThrough,
      candidateCount: cache.candidates.length,
      accounts,
    };
  } finally {
    await lock.close();
    await unlink(lockFile);
  }
}

/** キャッシュから復元した平文のハーベスター鍵と、復元できなかった公開アカウントの情報です。 */
export interface RestoreHarvestersResult {
  harvesters: { signingPrivateKey: Uint8Array; vrfPrivateKey: Uint8Array }[];
  skippedAccounts: { publicKey: string; reason: 'missing-harvesting-keys' | 'no-matching-message' }[];
  checkedAt: string;
}

/** 最後に探索を完了したキャッシュだけを使い、秘密鍵を復元します。REST通信は行いません。
 * リンク解除済みの候補を除外し、署名用・VRF用公開鍵がキャッシュのリンク状態と一致するメッセージだけを採用します。
 */
export async function restoreHarvestersFromCache(options: {
  nodePrivateKey: Uint8Array;
  cacheFile: string;
}): Promise<RestoreHarvestersResult> {
  if (!(options.nodePrivateKey instanceof Uint8Array) || options.nodePrivateKey.length !== 32)
    throw new TypeError('nodePrivateKeyには32バイトの秘密鍵を指定してください。');
  const keyPair = new KeyPair(new PrivateKey(new Uint8Array(options.nodePrivateKey)));
  let cached: string;
  try {
    cached = await readFile(options.cacheFile, 'utf8');
  } catch (error) {
    throw new DiagnosticError(
      `復元キャッシュを読み込めません。${fileErrorDetail(error) ?? '保存先とアクセス権を確認してください。'}`
    );
  }
  let cache: ScanCache;
  try {
    const data = object(JSON.parse(cached));
    if (![144, 152].includes(data.networkIdentifier as number)) throw new DiagnosticError();
    cache = parseCache(data, {
      version: 1,
      networkIdentifier: data.networkIdentifier as number,
      generationHashSeed: hex(data.generationHashSeed),
      nodePublicKey: keyPair.publicKey.toString(),
      scannedThrough: '0',
      candidates: [],
    });
  } catch {
    throw new DiagnosticError('復元キャッシュが不正、またはノード秘密鍵と一致しません。');
  }
  if (!cache.snapshot || cache.pending || cache.snapshot.scannedThrough !== cache.scannedThrough)
    throw new DiagnosticError('探索が完了したキャッシュを指定してください。');
  const encoder = new MessageEncoder(keyPair);
  const result: RestoreHarvestersResult = { harvesters: [], skippedAccounts: [], checkedAt: cache.snapshot.checkedAt };
  const restored = new Set<string>();
  try {
    for (const account of cache.snapshot.activeAccounts) {
      const candidate = cache.candidates.find((entry) => entry.publicKey === account.publicKey);
      if (!candidate || candidate.messages.pending || candidate.messages.scannedThrough !== cache.scannedThrough)
        throw new DiagnosticError('委任開始メッセージの探索が完了していません。');
      if (!account.linkedPublicKey || !account.vrfPublicKey) {
        result.skippedAccounts.push({ publicKey: account.publicKey, reason: 'missing-harvesting-keys' });
        continue;
      }
      let matched = false;
      for (const message of [...candidate.messages.entries].reverse()) {
        let plaintext: Uint8Array | undefined;
        try {
          const decoded = await encoder.tryDecode(
            keyPair.publicKey,
            new Uint8Array(Buffer.from(message.message, 'hex'))
          );
          if (!decoded.isDecoded) continue;
          plaintext = decoded.message;
          if (plaintext.length !== 64) continue;
          const signingKey = new KeyPair(new PrivateKey(plaintext.slice(0, 32))).publicKey.toString();
          const vrfKey = new KeyPair(new PrivateKey(plaintext.slice(32))).publicKey.toString();
          if (signingKey !== account.linkedPublicKey || vrfKey !== account.vrfPublicKey) continue;
          const identifier = `${signingKey}:${vrfKey}`;
          if (!restored.has(identifier)) {
            result.harvesters.push({ signingPrivateKey: plaintext.slice(0, 32), vrfPrivateKey: plaintext.slice(32) });
            restored.add(identifier);
          }
          matched = true;
          break;
        } catch {
          /* 認証に失敗したキャッシュのメッセージは採用しません。 */
        } finally {
          plaintext?.fill(0);
        }
      }
      if (!matched) result.skippedAccounts.push({ publicKey: account.publicKey, reason: 'no-matching-message' });
    }
    return result;
  } catch (error) {
    for (const entry of result.harvesters) {
      entry.signingPrivateKey.fill(0);
      entry.vrfPrivateKey.fill(0);
    }
    throw error;
  }
}
