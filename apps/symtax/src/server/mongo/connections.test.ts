import { type Document, type InsertOneResult, ObjectId } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

import type { MongoConfiguration, MongoStoreConfiguration } from './config';
import {
  type MongoClientConnection,
  type MongoClientFactory,
  MongoStoreConnectionError,
  MongoStoreIsolationError,
  type SymTaxMongoDatabase,
  connectMongoStores,
} from './connections';

const configuration: MongoConfiguration = {
  symbol: { uri: 'mongodb://reader:secret@node-db/catapult', database: 'catapult', username: 'reader' },
  symtax: { uri: 'mongodb://writer:secret@tax-db/symtax', database: 'symtax', username: 'writer' },
};

function makeClient(
  processId: string,
  close: () => Promise<void>,
  command?: () => Promise<Document>
): MongoClientConnection {
  const database: SymTaxMongoDatabase = {
    command: command ?? (async () => ({ topologyVersion: { processId: ObjectId.createFromHexString(processId) } })),
    collection: () => ({
      find: () => {
        throw new Error('not used in this test');
      },
      aggregate: () => {
        throw new Error('not used in this test');
      },
      insertOne: async (): Promise<InsertOneResult<Document>> => ({
        acknowledged: true,
        insertedId: new ObjectId(),
      }),
    }),
  };
  return {
    connect: vi.fn(async () => undefined),
    db: vi.fn(() => database),
    close: vi.fn(close),
  };
}

describe('separate MongoDB connection boundary', () => {
  it('exposes a read-only Symbol handle and a writable SymTax handle, and closes both', async () => {
    const symbolClient = makeClient('000000000000000000000001', async () => undefined);
    const symtaxClient = makeClient('000000000000000000000002', async () => undefined);
    const factory: MongoClientFactory = (store: MongoStoreConfiguration) =>
      store === configuration.symbol ? symbolClient : symtaxClient;

    const stores = await connectMongoStores(configuration, factory);
    expect(Object.keys(stores.symbolMongo.collection('transactions')).sort()).toEqual(['find']);
    expect(Object.keys(stores.symtaxMongo.collection('price-observations')).sort()).toEqual([
      'aggregate',
      'find',
      'insertOne',
    ]);
    await stores.symtaxMongo.collection('price-observations').insertOne({ kind: 'fixture-only' });
    await stores.close();

    expect(symbolClient.close).toHaveBeenCalledOnce();
    expect(symtaxClient.close).toHaveBeenCalledOnce();
  });

  it('rejects two URIs that resolve to the same mongod process and closes both clients', async () => {
    const symbolClient = makeClient('000000000000000000000001', async () => undefined);
    const symtaxClient = makeClient('000000000000000000000001', async () => undefined);
    const factory: MongoClientFactory = (store: MongoStoreConfiguration) =>
      store === configuration.symbol ? symbolClient : symtaxClient;

    await expect(connectMongoStores(configuration, factory)).rejects.toBeInstanceOf(MongoStoreIsolationError);
    expect(symbolClient.close).toHaveBeenCalledOnce();
    expect(symtaxClient.close).toHaveBeenCalledOnce();
  });

  it('rejects endpoints that expose the same replica set', async () => {
    const symbolClient = makeClient(
      '000000000000000000000001',
      async () => undefined,
      async () => ({
        topologyVersion: { processId: ObjectId.createFromHexString('000000000000000000000001') },
        setName: 'shared-cluster',
      })
    );
    const symtaxClient = makeClient(
      '000000000000000000000002',
      async () => undefined,
      async () => ({
        topologyVersion: { processId: ObjectId.createFromHexString('000000000000000000000002') },
        setName: 'shared-cluster',
      })
    );
    const factory: MongoClientFactory = (store: MongoStoreConfiguration) =>
      store === configuration.symbol ? symbolClient : symtaxClient;

    await expect(connectMongoStores(configuration, factory)).rejects.toBeInstanceOf(MongoStoreIsolationError);
    expect(symbolClient.close).toHaveBeenCalledOnce();
    expect(symtaxClient.close).toHaveBeenCalledOnce();
  });

  it('fails closed with a store-specific message and closes the other client when one store is unavailable', async () => {
    const symbolClient = makeClient('000000000000000000000001', async () => undefined);
    const symtaxClient = makeClient(
      '000000000000000000000002',
      async () => undefined,
      async () => {
        throw new Error('connection details must not escape');
      }
    );
    const factory: MongoClientFactory = (store: MongoStoreConfiguration) =>
      store === configuration.symbol ? symbolClient : symtaxClient;

    await expect(connectMongoStores(configuration, factory)).rejects.toMatchObject({
      name: MongoStoreConnectionError.name,
      message: 'SymTax MongoDB connection failed',
    });
    expect(symbolClient.close).toHaveBeenCalledOnce();
    expect(symtaxClient.close).toHaveBeenCalledOnce();
  });

  it('identifies Symbol MongoDB connection failure and does not continue to the SymTax store', async () => {
    const symbolClient = makeClient('000000000000000000000001', async () => undefined);
    symbolClient.connect = vi.fn(async () => {
      throw new Error('credentials must not escape');
    });
    const symtaxClient = makeClient('000000000000000000000002', async () => undefined);
    const factory: MongoClientFactory = (store: MongoStoreConfiguration) =>
      store === configuration.symbol ? symbolClient : symtaxClient;

    await expect(connectMongoStores(configuration, factory)).rejects.toMatchObject({
      name: MongoStoreConnectionError.name,
      message: 'Symbol MongoDB connection failed',
    });
    expect(symbolClient.close).toHaveBeenCalledOnce();
    expect(symtaxClient.connect).not.toHaveBeenCalled();
  });
});
