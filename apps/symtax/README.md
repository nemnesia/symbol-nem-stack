# SymTax

SymTax is a Symbol transaction and receipt history viewer with Cryptact export support. The app reads Symbol node data on the server and owns a separate MongoDB instance for SymTax-managed data such as shared market price observations.

## MongoDB boundaries

| Store               | Purpose                                              | Connection setting                          | Access                                                |
| ------------------- | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| Symbol Node MongoDB | Symbol blocks, transactions, statements and receipts | `SYMBOL_MONGO_URI`, `SYMBOL_MONGO_DATABASE` | Server-side read only; use a dedicated read-only user |
| SymTax MongoDB      | SymTax-managed persistent data                       | `SYMTAX_MONGO_URI`, `SYMTAX_MONGO_DATABASE` | Server-side read/write                                |

These settings are required independently. There is no `MONGO_URI` fallback. At connection time, SymTax compares MongoDB `hello` process identities and replica-set names, and refuses to expose either database if both URIs reach the same `mongod` process or replica set. Sharded endpoints that do not provide a verifiable independent process identity are rejected. Different database names on one process do not satisfy the isolation requirement. The Symbol connection exposes only `find` reads; it does not expose aggregation, write operations, or arbitrary database commands.

Both instances may run on one host, but must have separate processes, URIs, users/credentials, storage paths/volumes, lifecycle operations, and major resource settings. This repository's local Compose file starts only the SymTax-owned store. The Symbol Node MongoDB remains an independently operated dependency and is not recreated, migrated, or reset by SymTax commands.

## Local development

1. Copy `.env.example` to `.env` and replace all example credentials. Configure `SYMBOL_MONGO_URI` to the independently operated Symbol Testnet node MongoDB and use its read-only account. Do not point both URIs at one MongoDB process.
2. Start the SymTax MongoDB instance:

   ```sh
   docker compose --env-file .env up -d symtax-mongo
   ```

   Compose creates a dedicated `symtax-mongo` container and `symtax-mongo-data` volume, enables authentication, binds its development port to loopback, and applies separate memory, CPU, and WiredTiger cache settings. It does not define or manage a Symbol node database.

3. Install workspace dependencies and run SymTax:

   ```sh
   pnpm install
   pnpm --filter @symbol-tools/symtax dev
   ```

   When the app runs on the host, the example SymTax URI uses `127.0.0.1:27018`. From a container, use the `symtax-mongo` service name on the Compose network and keep the two connection URIs/users distinct.

Do not commit `.env` or use the example credentials outside a local development environment.

## Verification

```sh
pnpm --filter @symbol-tools/symtax lint
pnpm --filter @symbol-tools/symtax format:check
pnpm --filter @symbol-tools/symtax typecheck
pnpm --filter @symbol-tools/symtax test
pnpm --filter @symbol-tools/symtax build
```

The MongoDB isolation tests use independent simulated process identities. A deployment acceptance check must additionally verify independent storage, credentials, lifecycle and resource settings, and that the Symbol MongoDB account cannot write.
