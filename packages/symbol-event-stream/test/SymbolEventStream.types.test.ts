import { expect, expectTypeOf, it } from 'vitest';

import { SymbolEventStream } from '../src/SymbolEventStream.js';

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

it('チャネルごとの通知型とアドレス指定制約を公開する', () => {
  void assertNotificationTypes;
  expect(true).toBe(true);
});
