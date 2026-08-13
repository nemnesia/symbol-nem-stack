import { expect, expectTypeOf, it } from 'vitest';

import { SymbolEventStream } from '../src/SymbolEventStream.js';
import type { NodeProvider, SymbolEventStreamOptions } from '../src/SymbolEventStreamTypes.js';

function assertNotificationTypes(stream: SymbolEventStream): void {
  stream.on('block', (message) => {
    expectTypeOf(message.data.block.height).toEqualTypeOf<string>();
  });
  stream.on('cosignature', (message) => {
    expectTypeOf(message.data.parentHash).toEqualTypeOf<string>();
  });
  stream.on('confirmedAdded', 'TCHBDENCLKEBILBPWP3JPB2XNY64OE7PYHHE32I', (message) => {
    expectTypeOf(message.data.meta.hash).toEqualTypeOf<string>();
  });

  // @ts-expect-error block はアドレス指定を受け付けない。
  stream.on('block', 'TCHBDENCLKEBILBPWP3JPB2XNY64OE7PYHHE32I', () => undefined);
}

const endpointOptions: SymbolEventStreamOptions = {
  nodewatchUrls: ['https://node.example.com:3001'],
  connections: 1,
};

const optionsWithRemovedSsl: SymbolEventStreamOptions = {
  ...endpointOptions,
  // @ts-expect-error 接続方式はendpointのschemeから決まり、sslは受け付けない。
  ssl: true,
};

const nodeProvider: NodeProvider = async () => ['https://node.example.com:3001'];
const optionsWithNodeProvider: SymbolEventStreamOptions = {
  ...endpointOptions,
  nodeProvider,
};

void optionsWithNodeProvider;

it('チャネルごとの通知型とアドレス指定制約を公開する', () => {
  void assertNotificationTypes;
  void optionsWithRemovedSsl;
  expect(true).toBe(true);
});
