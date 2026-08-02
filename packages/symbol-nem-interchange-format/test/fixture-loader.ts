import { Ajv2020, type AnySchema, type ValidateFunction } from 'ajv/dist/2020.js';

import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

interface ManifestEntry {
  id: string;
  category:
    | 'mnemonic-derivation'
    | 'cbor-envelope'
    | 'codec-structural'
    | 'codec-component-matrix'
    | 'password-v1'
    | 'secret-backup'
    | 'zlib'
    | 'transaction-primitives'
    | 'mnemonic-unicode';
  path: string;
}

interface Manifest {
  protocol: 'snif';
  wireVersion: 1;
  normativeSymbolSdk: '3.3.2-pure.2';
  fixtures: ManifestEntry[];
}

const readJson = async (filename: string): Promise<unknown> => JSON.parse(await readFile(filename, 'utf8')) as unknown;

export const loadFixtures = async (
  fixturesDirectory: string
): Promise<Array<{ entry: ManifestEntry; data: unknown }>> => {
  const root = await realpath(fixturesDirectory);
  const schemas = path.join(root, 'schema');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const manifestValidator = ajv.compile((await readJson(path.join(schemas, 'manifest.schema.json'))) as AnySchema);
  const additionalSchemas = new Map([
    ['codec-structural', 'codec-structural.schema.json'],
    ['codec-component-matrix', 'codec-component-matrix.schema.json'],
    ['password-v1', 'password-v1.schema.json'],
    ['secret-backup', 'secret-backup.schema.json'],
    ['zlib', 'zlib.schema.json'],
    ['transaction-primitives', 'transaction-verification.schema.json'],
    ['mnemonic-unicode', 'mnemonic-unicode.schema.json'],
  ] as const);
  const additionalValidators = await Promise.all(
    [...additionalSchemas].map(async ([category, schema]): Promise<[string, ValidateFunction]> => [
      category,
      ajv.compile((await readJson(path.join(schemas, schema))) as AnySchema),
    ])
  );
  const categoryValidators = new Map<string, ValidateFunction>([
    [
      'mnemonic-derivation',
      ajv.compile((await readJson(path.join(schemas, 'mnemonic-derivation.schema.json'))) as AnySchema),
    ],
    ['cbor-envelope', ajv.compile((await readJson(path.join(schemas, 'cbor-envelope.schema.json'))) as AnySchema)],
    ...additionalValidators,
  ]);
  const manifestValue = await readJson(path.join(root, 'manifest.json'));
  if (!manifestValidator(manifestValue)) throw new Error(ajv.errorsText(manifestValidator.errors));
  const manifest = manifestValue as Manifest;
  const ids = new Set<string>();
  const loaded: Array<{ entry: ManifestEntry; data: unknown }> = [];
  for (const entry of manifest.fixtures) {
    if (ids.has(entry.id)) throw new Error(`duplicate fixture id: ${entry.id}`);
    ids.add(entry.id);
    const filename = await realpath(path.resolve(root, entry.path));
    if (filename === root || !filename.startsWith(`${root}${path.sep}`))
      throw new Error(`fixture path escapes root: ${entry.path}`);
    const validator = categoryValidators.get(entry.category);
    if (!validator) throw new Error(`unsupported fixture category: ${entry.category}`);
    const data = await readJson(filename);
    if (!validator(data)) throw new Error(ajv.errorsText(validator.errors));
    if (!data || 'object' !== typeof data || (data as { id?: unknown }).id !== entry.id)
      throw new Error(`fixture id mismatch: ${entry.id}`);
    loaded.push({ entry, data });
  }
  return loaded;
};
