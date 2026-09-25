import { describe, expect, it } from 'vitest';

import { parseMongoConfiguration } from './config';

const testEnvironment = {
  SYMBOL_MONGO_URI: 'mongodb://symbol_reader:node-secret@node-db.internal:27017/catapult?authSource=admin',
  SYMBOL_MONGO_DATABASE: 'catapult',
  SYMTAX_MONGO_URI: 'mongodb://symtax_app:store-secret@127.0.0.1:27018/symtax?authSource=symtax',
  SYMTAX_MONGO_DATABASE: 'symtax',
};

describe('MongoDB role configuration', () => {
  it('requires separate connection settings and credentials', () => {
    expect(parseMongoConfiguration(testEnvironment)).toMatchObject({
      ok: true,
      value: {
        symbol: { database: 'catapult', username: 'symbol_reader' },
        symtax: { database: 'symtax', username: 'symtax_app' },
      },
    });
    expect(parseMongoConfiguration({})).toMatchObject({ ok: false, error: { code: 'missing' } });
    expect(parseMongoConfiguration({ MONGO_URI: 'mongodb://legacy:secret@localhost:27017/old' })).toMatchObject({
      ok: false,
      error: { code: 'missing' },
    });
  });

  it('rejects malformed URIs and mismatched URI/database names', () => {
    expect(parseMongoConfiguration({ ...testEnvironment, SYMBOL_MONGO_URI: 'not-a-uri' })).toMatchObject({
      ok: false,
      error: { code: 'malformed' },
    });
    expect(parseMongoConfiguration({ ...testEnvironment, SYMTAX_MONGO_DATABASE: 'other' })).toMatchObject({
      ok: false,
      error: { code: 'malformed' },
    });
  });

  it('rejects a shared connection URI or MongoDB user', () => {
    expect(
      parseMongoConfiguration({ ...testEnvironment, SYMTAX_MONGO_URI: testEnvironment.SYMBOL_MONGO_URI })
    ).toMatchObject({ ok: false, error: { code: 'same-connection' } });
    expect(
      parseMongoConfiguration({
        ...testEnvironment,
        SYMTAX_MONGO_URI: 'mongodb://symbol_reader:other-secret@another-host:27017/symtax',
      })
    ).toMatchObject({ ok: false, error: { code: 'same-credential' } });
  });
});
