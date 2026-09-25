import { describe, expect, it } from 'vitest';

import { parseNativeAmount } from './quantity';
import {
  RECOGNIZED_RECEIPT_CODES,
  RECOGNIZED_TRANSACTION_CODES,
  classifyHarvestReceipt,
  classifyReceiptType,
  classifyTransactionType,
} from './records';
import type { ReceiptRecord, TransactionRecord } from './records';

describe('normalized record contract', () => {
  it('recognizes the specification transaction and receipt type sets', () => {
    expect(RECOGNIZED_TRANSACTION_CODES).toEqual([
      0x4141, 0x4143, 0x4144, 0x4148, 0x414c, 0x414d, 0x414e, 0x4150, 0x4151, 0x4152, 0x4154, 0x4155, 0x4241, 0x4243,
      0x4244, 0x424c, 0x424d, 0x424e, 0x4250, 0x4251, 0x4252, 0x4344, 0x434d, 0x434e, 0x4350,
    ]);
    expect(RECOGNIZED_RECEIPT_CODES).toEqual([
      0x124d, 0x134e, 0x2143, 0x2248, 0x2252, 0x2348, 0x2352, 0x3148, 0x3152, 0x414d, 0x414e, 0x424e, 0x5143, 0xe143,
      0xf143, 0xf243,
    ]);
    expect(classifyTransactionType(0x4154)).toEqual({ classification: 'recognized', typeName: 'Transfer' });
    expect(classifyTransactionType(0xffff)).toEqual({ classification: 'unknown', typeName: null });
    expect(classifyReceiptType(0x2143)).toEqual({ classification: 'recognized', typeName: 'HARVEST_FEE' });
    expect(classifyReceiptType(0xffff)).toEqual({ classification: 'unknown', typeName: null });
  });

  it('keeps Harvest classification protocol-based and unknown-safe', () => {
    const evidence = {
      typeCode: 0x2143,
      requestAddress: 'NADDRESS',
      targetAddress: 'NADDRESS',
      nativeXymMosaic: true,
      amountKnown: true,
      sourceResolved: true,
      blockHeightResolved: true,
      blockTimestampResolved: true,
    };
    expect(classifyHarvestReceipt(evidence)).toMatchObject({ state: 'harvest' });
    expect(classifyHarvestReceipt({ ...evidence, targetAddress: 'OTHER' })).toMatchObject({ state: 'unknown' });
    expect(classifyHarvestReceipt({ ...evidence, typeCode: 0x5143 })).toMatchObject({ state: 'not-harvest' });
    expect(classifyHarvestReceipt({ ...evidence, typeCode: 0xffff })).toMatchObject({ state: 'unknown' });
  });

  it('provides distinct typed known Transaction, Harvest Receipt, partial and unknown records', () => {
    const parsedAmount = parseNativeAmount('1200000');
    if (!parsedAmount.ok) throw new Error('fixed fixture amount must be valid');
    const amount = parsedAmount.value;
    const address = 'ND6JFGH64RIDEQC3HQUEW2CIO7PGWRJD4KMTARQ';
    const transaction: TransactionRecord = {
      category: 'transactions',
      network: 'mainnet',
      identity: 'tx-hash:embedded:0',
      blockReference: { height: '10', hash: 'AB'.repeat(32) },
      blockTimestamp: '2021-03-16T00:06:25.000Z',
      timestampState: 'resolved',
      signer: address,
      addressRoles: { signer: [address] },
      fee: { applicability: 'not-applicable' },
      sourceReference: { blockHeight: '10', embeddedIndex: 0 },
      classification: 'recognized',
      typeCode: 0x4154,
      typeName: 'Transfer',
      details: {
        recipientAddress: address,
        mosaics: [{ mosaicId: '0x6BED913FA20223F8', amount }],
        message: { applicability: 'not-applicable' },
      },
      completeness: 'complete',
    };
    const harvest: ReceiptRecord = {
      category: 'receipts',
      network: 'mainnet',
      identity: 'receipt:10:0:0:0',
      typeCode: 0x2143,
      typeName: 'HARVEST_FEE',
      statementSource: { kind: 'confirmed', height: '10', primaryId: 0, secondaryId: 0, receiptOrdinal: 0 },
      blockReference: { height: '10', hash: 'AB'.repeat(32) },
      blockTimestamp: transaction.blockTimestamp,
      timestampState: 'resolved',
      sourceReference: {
        blockHeight: '10',
        statementKind: 'confirmed',
        sourcePrimaryId: 0,
        sourceSecondaryId: 0,
        receiptOrdinal: 0,
      },
      harvestClassification: { state: 'harvest', reason: 'verified-harvest-fee' },
      classification: 'recognized',
      details: {
        semantic: 'balance-change',
        mosaic: { mosaicId: '0x6BED913FA20223F8', amount },
        target: address,
      },
      completeness: 'complete',
    };
    const partial: TransactionRecord = { ...transaction, completeness: 'partial' };
    const unknown: ReceiptRecord = {
      category: 'receipts',
      network: 'mainnet',
      identity: 'receipt:10:unknown',
      typeCode: 0xffff,
      typeName: null,
      statementSource: null,
      blockReference: null,
      blockTimestamp: null,
      timestampState: 'unavailable',
      sourceReference: { blockHeight: '10' },
      harvestClassification: { state: 'unknown', reason: 'insufficient-or-conflicting-evidence' },
      classification: 'unknown',
      details: null,
      completeness: 'unsupported',
    };
    expect(transaction.typeName).toBe('Transfer');
    expect(harvest.harvestClassification.state).toBe('harvest');
    expect(partial.completeness).toBe('partial');
    expect(unknown.completeness).toBe('unsupported');
  });
});
