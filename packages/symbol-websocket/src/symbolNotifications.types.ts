import type { SymbolChannel } from './symbolChannelPaths.js';

/**
 * 16進文字列型のエイリアス。
 */
export type HexString = string;

/**
 * 符号なし64ビット整数文字列型のエイリアス。
 */
export type UInt64String = string;

/**
 * Symbol Gateway から届く、パース済み通知メッセージのエンベロープ型。
 */
export interface SymbolNotificationEnvelope<TTopic extends string, TData> {
  /** 購読パスと一致する通知トピック。 */
  topic: TTopic;
  /** トピック固有の通知データ。 */
  data: TData;
}

/**
 * ブロック情報通知データの型。
 */
export interface BlockInfoNotificationData {
  block: {
    signature: HexString;
    signerPublicKey: HexString;
    version: number;
    network: number;
    type: number;
    height: UInt64String;
    timestamp: UInt64String;
    difficulty: UInt64String;
    previousBlockHash: HexString;
    transactionsHash: HexString;
    receiptsHash: HexString;
    stateHash: HexString;
    beneficiaryAddress: HexString;
    feeMultiplier: number;
    proofGamma: HexString;
    proofVerificationHash: HexString;
    proofScalar: HexString;
  };
  meta: {
    hash: HexString;
    generationHash: HexString;
  };
}

/**
 * 確定ブロック通知データの型。
 */
export interface FinalizedBlockNotificationData {
  finalizationEpoch: number;
  finalizationPoint: number;
  height: UInt64String;
  hash: HexString;
}

/**
 * トランザクション通知データの型。
 */
export interface TransactionNotificationData {
  transaction: unknown;
  meta: {
    hash: HexString;
    merkleComponentHash: HexString;
    height: UInt64String;
  };
}

/**
 * 確定追加トランザクション通知データの型。
 */
export interface ConfirmedAddedData extends TransactionNotificationData {}

/**
 * 未確定追加トランザクション通知データの型。
 */
export interface UnconfirmedAddedData extends TransactionNotificationData {}

/**
 * 削除トランザクション通知データの型。
 */
export interface RemovedData {
  meta: {
    hash: HexString;
  };
}

/**
 * 部分追加トランザクション通知データの型。
 */
export interface PartialAddedData {
  transaction: unknown;
  meta: {
    hash: HexString;
    merkleComponentHash: HexString;
    height: UInt64String;
  };
}

/**
 * コサインデータ通知データの型。
 */
export interface CosignatureData {
  version: UInt64String;
  signerPublicKey: HexString;
  signature: HexString;
  parentHash: HexString;
}

/**
 * ステータス通知データの型。
 */
export interface StatusData {
  hash: HexString;
  code: string;
  deadline: UInt64String;
}

/**
 * 通知チャネルとそのデータ型の対応表。
 */
export type SymbolNotificationDataMap = {
  block: BlockInfoNotificationData;
  finalizedBlock: FinalizedBlockNotificationData;
  confirmedAdded: ConfirmedAddedData;
  unconfirmedAdded: UnconfirmedAddedData;
  unconfirmedRemoved: RemovedData;
  partialAdded: PartialAddedData;
  partialRemoved: RemovedData;
  cosignature: CosignatureData;
  status: StatusData;
};

type AddressableSymbolChannel = Exclude<SymbolChannel, 'block' | 'finalizedBlock'>;

/**
 * チャネルで受け取る通知 topic の型。
 * アドレス指定可能なチャネルは、アドレス付き購読の topic も表します。
 */
type SymbolNotificationTopic<K extends SymbolChannel> = K extends AddressableSymbolChannel ? K | `${K}/${string}` : K;

/**
 * 通知チャネルと、そのチャネルで受け取る通知エンベロープ型の対応表。
 */
export type SymbolNotificationMap = {
  [K in SymbolChannel]: SymbolNotificationEnvelope<SymbolNotificationTopic<K>, SymbolNotificationDataMap[K]>;
};
