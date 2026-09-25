import type { NetworkName } from './network';
import type { NativeAmount } from './quantity';

export type RecordIdentity = string;
export type AddressRole = 'signer' | 'sender' | 'recipient' | 'target' | 'source' | 'participant' | 'cosigner';

export interface BlockReference {
  readonly height: string;
  readonly hash: string;
}

export interface SourceReference {
  readonly blockHeight: string;
  readonly blockHash?: string;
  readonly transactionHash?: string;
  readonly embeddedIndex?: number;
  readonly statementKind?: string;
  readonly sourcePrimaryId?: number;
  readonly sourceSecondaryId?: number;
  readonly receiptOrdinal?: number;
}

export type Applicability<T> =
  | { readonly applicability: 'applicable'; readonly value: T }
  | { readonly applicability: 'not-applicable'; readonly value?: never };

export interface MosaicAmount {
  readonly mosaicId: string;
  readonly amount: NativeAmount;
}

interface TransactionBase {
  readonly category: 'transactions';
  readonly network: NetworkName;
  readonly identity: RecordIdentity;
  readonly blockReference: BlockReference;
  readonly blockTimestamp: string | null;
  readonly timestampState: 'resolved' | 'unavailable';
  readonly signer: string;
  readonly addressRoles: Readonly<Partial<Record<AddressRole, readonly string[]>>>;
  readonly fee: Applicability<NativeAmount>;
  readonly sourceReference: SourceReference;
}

interface TransactionDetailMap {
  0x414c: { linkedPublicKey: string; linkAction: string };
  0x424c: { linkedPublicKey: string; linkAction: string };
  0x4243: { linkedPublicKey: string; linkAction: string };
  0x4143: { linkedPublicKey: string; startEpoch: number; endEpoch: number; linkAction: string };
  0x4141: {
    transactionsHash: string;
    embeddedTransactions: readonly EmbeddedTransaction[];
    cosignaturePublicKeys: readonly string[];
  };
  0x4241: {
    transactionsHash: string;
    embeddedTransactions: readonly EmbeddedTransaction[];
    cosignaturePublicKeys: readonly string[];
  };
  0x414d: { nonce: number; flags: number; divisibility: number; duration: Applicability<string> };
  0x424d: { mosaicId: string; amountDelta: NativeAmount; supplyAction: 'increase' | 'decrease' };
  0x434d: { sourceAddress: string; mosaicId: string; amount: NativeAmount };
  0x414e: {
    registrationType: 'root' | 'sub';
    namespaceId: string;
    name: string;
    parentId: Applicability<string>;
    duration: Applicability<string>;
  };
  0x424e: { namespaceId: string; targetAddress: string; aliasAction: string };
  0x434e: { namespaceId: string; targetMosaicId: string; aliasAction: string };
  0x4144: { targetAddress: string; scopedMetadataKey: string; valueSizeDelta: number; value: string };
  0x4244: {
    targetAddress: string;
    targetMosaicId: string;
    scopedMetadataKey: string;
    valueSizeDelta: number;
    value: string;
  };
  0x4344: {
    targetAddress: string;
    targetNamespaceId: string;
    scopedMetadataKey: string;
    valueSizeDelta: number;
    value: string;
  };
  0x4155: {
    minRemovalDelta: number;
    minApprovalDelta: number;
    addressAdditions: readonly string[];
    addressDeletions: readonly string[];
  };
  0x4148: { mosaicId: string; amount: NativeAmount; duration: string; aggregateHash: string };
  0x4152: {
    recipientAddress: string;
    secret: string;
    hashAlgorithm: number;
    mosaicId: string;
    amount: NativeAmount;
    duration: string;
  };
  0x4252: { recipientAddress: string; secret: string; hashAlgorithm: number; proof: string };
  0x4150: { restrictionFlags: number; addressAdditions: readonly string[]; addressDeletions: readonly string[] };
  0x4250: { restrictionFlags: number; mosaicAdditions: readonly string[]; mosaicDeletions: readonly string[] };
  0x4350: {
    restrictionFlags: number;
    transactionTypeAdditions: readonly number[];
    transactionTypeDeletions: readonly number[];
  };
  0x4151: {
    mosaicId: string;
    referenceMosaicId: string;
    restrictionKey: string;
    previousValue: string;
    newValue: string;
    previousType: number;
    newType: number;
  };
  0x4251: { mosaicId: string; restrictionKey: string; previousValue: string; newValue: string; targetAddress: string };
  0x4154: { recipientAddress: string; mosaics: readonly MosaicAmount[]; message: Applicability<string> };
}

export type EmbeddedTransaction = {
  [Code in RecognizedTransactionCode]: {
    readonly identity: string;
    readonly typeCode: Code;
    readonly typeName: (typeof TRANSACTION_NAMES)[Code];
    readonly signer: string;
    readonly details: TransactionDetailMap[Code];
    readonly completeness: 'complete' | 'partial';
  };
}[RecognizedTransactionCode];

const TRANSACTION_NAMES = {
  0x414c: 'AccountKeyLink',
  0x424c: 'NodeKeyLink',
  0x4243: 'VrfKeyLink',
  0x4143: 'VotingKeyLink',
  0x4141: 'AggregateComplete',
  0x4241: 'AggregateBonded',
  0x414d: 'MosaicDefinition',
  0x424d: 'MosaicSupplyChange',
  0x434d: 'MosaicSupplyRevocation',
  0x414e: 'NamespaceRegistration',
  0x424e: 'AddressAlias',
  0x434e: 'MosaicAlias',
  0x4144: 'AccountMetadata',
  0x4244: 'MosaicMetadata',
  0x4344: 'NamespaceMetadata',
  0x4155: 'MultisigAccountModification',
  0x4148: 'HashLock',
  0x4152: 'SecretLock',
  0x4252: 'SecretProof',
  0x4150: 'AccountAddressRestriction',
  0x4250: 'AccountMosaicRestriction',
  0x4350: 'AccountOperationRestriction',
  0x4151: 'MosaicGlobalRestriction',
  0x4251: 'MosaicAddressRestriction',
  0x4154: 'Transfer',
} as const;

export type RecognizedTransactionCode = keyof TransactionDetailMap;
export const RECOGNIZED_TRANSACTION_CODES = Object.keys(TRANSACTION_NAMES)
  .map((code) => Number(code))
  .sort((left, right) => left - right) as readonly number[];
export type RecognizedTransaction = {
  [Code in RecognizedTransactionCode]: TransactionBase & {
    readonly classification: 'recognized';
    readonly typeCode: Code;
    readonly typeName: (typeof TRANSACTION_NAMES)[Code];
    readonly details: TransactionDetailMap[Code];
    readonly completeness: 'complete' | 'partial';
  };
}[RecognizedTransactionCode];

export interface UnknownTransaction extends TransactionBase {
  readonly classification: 'unknown' | 'unsupported';
  readonly typeCode: number;
  readonly typeName: null;
  readonly details: null;
  readonly completeness: 'unsupported' | 'incomplete';
}

export type TransactionRecord = RecognizedTransaction | UnknownTransaction;

export type HarvestClassification =
  | { readonly state: 'harvest'; readonly reason: 'verified-harvest-fee' }
  | { readonly state: 'not-harvest'; readonly reason: 'known-non-harvest-type' }
  | { readonly state: 'unknown'; readonly reason: 'insufficient-or-conflicting-evidence' };

interface ReceiptBase {
  readonly category: 'receipts';
  readonly network: NetworkName;
  readonly identity: RecordIdentity;
  readonly typeCode: number;
  readonly typeName: string | null;
  readonly statementSource: {
    readonly kind: string;
    readonly height: string;
    readonly primaryId: number;
    readonly secondaryId: number;
    readonly receiptOrdinal: number;
  } | null;
  readonly blockReference: BlockReference | null;
  readonly blockTimestamp: string | null;
  readonly timestampState: 'resolved' | 'unavailable';
  readonly sourceReference: SourceReference;
  readonly harvestClassification: HarvestClassification;
}

interface ReceiptSemanticMap {
  0x124d: { semantic: 'balance-transfer'; mosaic: MosaicAmount; sender: string; recipient: string };
  0x134e: { semantic: 'balance-transfer'; mosaic: MosaicAmount; sender: string; recipient: string };
  0x2143: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x2248: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x2348: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x3148: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x2252: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x2352: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x3152: { semantic: 'balance-change'; mosaic: MosaicAmount; target: string };
  0x414d: { semantic: 'artifact'; artifactId: string };
  0x414e: { semantic: 'artifact'; artifactId: string };
  0x424e: { semantic: 'artifact'; artifactId: string };
  0x5143: { semantic: 'inflation'; createdMosaicId: string };
  0xe143: { semantic: 'transaction-group' };
  0xf143: { semantic: 'address-resolution'; unresolved: string; resolved: string };
  0xf243: { semantic: 'mosaic-resolution'; unresolved: string; resolved: string };
}

const RECEIPT_NAMES = {
  0x124d: 'MOSAIC_RENTAL_FEE',
  0x134e: 'NAMESPACE_RENTAL_FEE',
  0x2143: 'HARVEST_FEE',
  0x2248: 'LOCK_HASH_COMPLETED',
  0x2348: 'LOCK_HASH_EXPIRED',
  0x3148: 'LOCK_HASH_CREATED',
  0x2252: 'LOCK_SECRET_COMPLETED',
  0x2352: 'LOCK_SECRET_EXPIRED',
  0x3152: 'LOCK_SECRET_CREATED',
  0x414d: 'MOSAIC_EXPIRED',
  0x414e: 'NAMESPACE_EXPIRED',
  0x424e: 'NAMESPACE_DELETED',
  0x5143: 'INFLATION',
  0xe143: 'TRANSACTION_GROUP',
  0xf143: 'ADDRESS_ALIAS_RESOLUTION',
  0xf243: 'MOSAIC_ALIAS_RESOLUTION',
} as const;

export type RecognizedReceiptCode = keyof ReceiptSemanticMap;
export const RECOGNIZED_RECEIPT_CODES = Object.keys(RECEIPT_NAMES)
  .map((code) => Number(code))
  .sort((left, right) => left - right) as readonly number[];
export type RecognizedReceipt = {
  [Code in RecognizedReceiptCode]: ReceiptBase & {
    readonly classification: 'recognized';
    readonly typeCode: Code;
    readonly typeName: (typeof RECEIPT_NAMES)[Code];
    readonly details: ReceiptSemanticMap[Code];
    readonly completeness: 'complete' | 'partial';
  };
}[RecognizedReceiptCode];

export interface UnknownReceipt extends ReceiptBase {
  readonly classification: 'unknown' | 'unsupported';
  readonly typeName: null;
  readonly details: null;
  readonly completeness: 'unsupported' | 'incomplete';
  readonly harvestClassification: Extract<HarvestClassification, { state: 'unknown' }>;
}

export type ReceiptRecord = RecognizedReceipt | UnknownReceipt;

export function classifyTransactionType(
  typeCode: number
):
  | { readonly classification: 'recognized'; readonly typeName: string }
  | { readonly classification: 'unknown' | 'unsupported'; readonly typeName: null } {
  const typeName = TRANSACTION_NAMES[typeCode as RecognizedTransactionCode];
  return typeName ? { classification: 'recognized', typeName } : { classification: 'unknown', typeName: null };
}

export function classifyReceiptType(
  typeCode: number
):
  | { readonly classification: 'recognized'; readonly typeName: string }
  | { readonly classification: 'unknown' | 'unsupported'; readonly typeName: null } {
  const typeName = RECEIPT_NAMES[typeCode as RecognizedReceiptCode];
  return typeName ? { classification: 'recognized', typeName } : { classification: 'unknown', typeName: null };
}

export function classifyHarvestReceipt(evidence: {
  readonly typeCode: number;
  readonly requestAddress: string;
  readonly targetAddress?: string;
  readonly nativeXymMosaic: boolean;
  readonly amountKnown: boolean;
  readonly sourceResolved: boolean;
  readonly blockHeightResolved: boolean;
  readonly blockTimestampResolved: boolean;
}): HarvestClassification {
  if (evidence.typeCode !== 0x2143) {
    return classifyReceiptType(evidence.typeCode).classification === 'recognized'
      ? { state: 'not-harvest', reason: 'known-non-harvest-type' }
      : { state: 'unknown', reason: 'insufficient-or-conflicting-evidence' };
  }
  if (
    !evidence.targetAddress ||
    evidence.targetAddress !== evidence.requestAddress ||
    !evidence.nativeXymMosaic ||
    !evidence.amountKnown ||
    !evidence.sourceResolved ||
    !evidence.blockHeightResolved ||
    !evidence.blockTimestampResolved
  ) {
    return { state: 'unknown', reason: 'insufficient-or-conflicting-evidence' };
  }
  return { state: 'harvest', reason: 'verified-harvest-fee' };
}
