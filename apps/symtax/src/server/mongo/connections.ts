import type {
  AggregateOptions,
  AggregationCursor,
  Document,
  Filter,
  FindCursor,
  FindOptions,
  InsertOneResult,
} from 'mongodb';
import { MongoClient } from 'mongodb';
import 'server-only';

import { type MongoConfiguration, type MongoStoreConfiguration, getMongoConfiguration } from './config';

export interface SymbolMongoReadCollection {
  find(filter?: Filter<Document>, options?: FindOptions): FindCursor<Document>;
}

export interface SymbolMongoReadDatabase {
  collection(name: string): SymbolMongoReadCollection;
}

export interface SymTaxMongoCollection {
  find(filter?: Filter<Document>, options?: FindOptions): FindCursor<Document>;
  aggregate<T extends Document = Document>(pipeline?: Document[], options?: AggregateOptions): AggregationCursor<T>;
  insertOne(document: Document): Promise<InsertOneResult<Document>>;
}

export interface SymTaxMongoDatabase {
  command(command: Document): Promise<Document>;
  collection(name: string): SymTaxMongoCollection;
}

export class MongoStoreConnectionError extends Error {
  constructor(readonly store: 'Symbol MongoDB' | 'SymTax MongoDB') {
    super(`${store} connection failed`);
    this.name = 'MongoStoreConnectionError';
  }
}

export class MongoStoreIsolationError extends Error {
  constructor() {
    super('Symbol MongoDB and SymTax MongoDB independence could not be verified');
    this.name = 'MongoStoreIsolationError';
  }
}

export interface MongoClientConnection {
  connect(): Promise<unknown>;
  db(databaseName: string): SymTaxMongoDatabase;
  close(): Promise<void>;
}

export interface MongoConnectionSet {
  readonly symbolMongo: SymbolMongoReadDatabase;
  readonly symtaxMongo: SymTaxMongoDatabase;
  close(): Promise<void>;
}

export type MongoClientFactory = (configuration: MongoStoreConfiguration) => MongoClientConnection;

function defaultClientFactory(configuration: MongoStoreConfiguration): MongoClientConnection {
  return new MongoClient(configuration.uri, { appName: `symtax-${configuration.database}` });
}

function getProcessId(hello: Document): string | undefined {
  const topologyVersion: unknown = hello.topologyVersion;
  if (typeof topologyVersion !== 'object' || topologyVersion === null || !('processId' in topologyVersion)) {
    return undefined;
  }

  const processId: unknown = topologyVersion.processId;
  if (typeof processId === 'string' && /^[0-9a-f]{24}$/i.test(processId)) return processId.toLowerCase();
  if (
    typeof processId === 'object' &&
    processId !== null &&
    'toHexString' in processId &&
    typeof processId.toHexString === 'function'
  ) {
    const value: unknown = processId.toHexString();
    return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value) ? value.toLowerCase() : undefined;
  }
  return undefined;
}

async function connectStore(
  configuration: MongoStoreConfiguration,
  store: 'Symbol MongoDB' | 'SymTax MongoDB',
  factory: MongoClientFactory
): Promise<{ readonly client: MongoClientConnection; readonly processId: string; readonly setName?: string }> {
  let client: MongoClientConnection | undefined;
  try {
    client = factory(configuration);
    await client.connect();
    const hello = await client.db(configuration.database).command({ hello: 1 });
    const processId = getProcessId(hello);
    if (!processId) throw new MongoStoreConnectionError(store);
    if (hello.msg === 'isdbgrid') throw new MongoStoreIsolationError();
    const setName = typeof hello.setName === 'string' ? hello.setName : undefined;
    return { client, processId, setName };
  } catch (error) {
    if (client) await client.close().catch(() => undefined);
    if (error instanceof MongoStoreIsolationError) throw error;
    throw new MongoStoreConnectionError(store);
  }
}

function createSymbolReadDatabase(database: {
  collection(name: string): SymbolMongoReadCollection;
}): SymbolMongoReadDatabase {
  return Object.freeze({
    collection(name: string): SymbolMongoReadCollection {
      const collection = database.collection(name);
      return Object.freeze({
        find: collection.find.bind(collection),
      });
    },
  });
}

async function closeClients(symbolClient: MongoClientConnection, symtaxClient: MongoClientConnection): Promise<void> {
  const results = await Promise.allSettled([symbolClient.close(), symtaxClient.close()]);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('One or more SymTax MongoDB connections could not be closed');
  }
}

export async function connectMongoStores(
  configuration: MongoConfiguration,
  factory: MongoClientFactory = defaultClientFactory
): Promise<MongoConnectionSet> {
  const symbol = await connectStore(configuration.symbol, 'Symbol MongoDB', factory);
  let symtax: Awaited<ReturnType<typeof connectStore>>;
  try {
    symtax = await connectStore(configuration.symtax, 'SymTax MongoDB', factory);
  } catch (error) {
    await symbol.client.close().catch(() => undefined);
    throw error;
  }

  if (symbol.processId === symtax.processId) {
    await closeClients(symbol.client, symtax.client).catch(() => undefined);
    throw new MongoStoreIsolationError();
  }
  if (symbol.setName && symbol.setName === symtax.setName) {
    await closeClients(symbol.client, symtax.client).catch(() => undefined);
    throw new MongoStoreIsolationError();
  }

  let closed = false;
  return Object.freeze({
    symbolMongo: createSymbolReadDatabase(symbol.client.db(configuration.symbol.database)),
    symtaxMongo: symtax.client.db(configuration.symtax.database),
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await closeClients(symbol.client, symtax.client);
    },
  });
}

export async function connectConfiguredMongoStores(): Promise<MongoConnectionSet> {
  const configuration = getMongoConfiguration();
  if (!configuration.ok) {
    throw new Error(`MongoDB configuration is ${configuration.error.code}`);
  }
  return connectMongoStores(configuration.value);
}
