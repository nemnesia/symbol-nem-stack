import 'server-only';

export type MongoConfigurationErrorCode = 'missing' | 'malformed' | 'same-connection' | 'same-credential';

export type MongoStoreConfiguration = Readonly<{
  uri: string;
  database: string;
  username: string;
}>;

export type MongoConfiguration = Readonly<{
  symbol: MongoStoreConfiguration;
  symtax: MongoStoreConfiguration;
}>;

export type MongoConfigurationResult =
  | { readonly ok: true; readonly value: MongoConfiguration }
  | { readonly ok: false; readonly error: { readonly code: MongoConfigurationErrorCode } };

type ParsedStoreConfiguration = MongoStoreConfiguration & { readonly normalizedUri: string };

const failure = (code: MongoConfigurationErrorCode): MongoConfigurationResult => ({
  ok: false,
  error: { code },
});

function parseStoreConfiguration(
  uriValue: string | undefined,
  databaseValue: string | undefined
): ParsedStoreConfiguration | undefined {
  if (!uriValue || !databaseValue) return undefined;
  if (databaseValue.trim() !== databaseValue || databaseValue.length === 0 || /[\\/.$\0]/.test(databaseValue)) {
    return undefined;
  }

  try {
    const uri = new URL(uriValue);
    if (
      (uri.protocol !== 'mongodb:' && uri.protocol !== 'mongodb+srv:') ||
      uri.hostname.length === 0 ||
      uri.username.length === 0 ||
      uri.password.length === 0
    ) {
      return undefined;
    }

    const uriDatabase = decodeURIComponent(uri.pathname.replace(/^\//, ''));
    if (uriDatabase.length > 0 && uriDatabase !== databaseValue) return undefined;

    const normalizedUri = new URL(uriValue);
    normalizedUri.password = 'redacted';
    return {
      uri: uriValue,
      database: databaseValue,
      username: decodeURIComponent(uri.username),
      normalizedUri: normalizedUri.toString(),
    };
  } catch {
    return undefined;
  }
}

export function parseMongoConfiguration(env: Readonly<Record<string, string | undefined>>): MongoConfigurationResult {
  if (env.SYMBOL_MONGO_URI && env.SYMBOL_MONGO_URI === env.SYMTAX_MONGO_URI) {
    return failure('same-connection');
  }

  const symbol = parseStoreConfiguration(env.SYMBOL_MONGO_URI, env.SYMBOL_MONGO_DATABASE);
  const symtax = parseStoreConfiguration(env.SYMTAX_MONGO_URI, env.SYMTAX_MONGO_DATABASE);

  if (!env.SYMBOL_MONGO_URI || !env.SYMBOL_MONGO_DATABASE || !env.SYMTAX_MONGO_URI || !env.SYMTAX_MONGO_DATABASE) {
    return failure('missing');
  }
  if (!symbol || !symtax) return failure('malformed');
  if (symbol.normalizedUri === symtax.normalizedUri) {
    return failure('same-connection');
  }
  if (symbol.username === symtax.username) return failure('same-credential');

  return {
    ok: true,
    value: {
      symbol: { uri: symbol.uri, database: symbol.database, username: symbol.username },
      symtax: { uri: symtax.uri, database: symtax.database, username: symtax.username },
    },
  };
}

export function getMongoConfiguration(): MongoConfigurationResult {
  return parseMongoConfiguration(process.env);
}
