import { describe, expect, it } from 'vitest';

import * as index from '../src/index.js';
import { symbolChannelPaths } from '../src/symbolChannelPaths.js';

describe('Channel path definitions', () => {
  describe('Symbol', () => {
    it('symbolChannelPaths: 条件付きsubscribeはアドレスを正しく処理する', () => {
      expect(symbolChannelPaths.confirmedAdded.subscribe('XYZ')).toBe('confirmedAdded/XYZ');
      expect(symbolChannelPaths.confirmedAdded.subscribe()).toBe('confirmedAdded');
      expect(symbolChannelPaths.unconfirmedAdded.subscribe('A')).toBe('unconfirmedAdded/A');
      expect(symbolChannelPaths.unconfirmedAdded.subscribe()).toBe('unconfirmedAdded');
      expect(symbolChannelPaths.unconfirmedRemoved.subscribe('B')).toBe('unconfirmedRemoved/B');
      expect(symbolChannelPaths.unconfirmedRemoved.subscribe()).toBe('unconfirmedRemoved');
      expect(symbolChannelPaths.partialAdded.subscribe('C')).toBe('partialAdded/C');
      expect(symbolChannelPaths.partialAdded.subscribe()).toBe('partialAdded');
      expect(symbolChannelPaths.partialRemoved.subscribe('D')).toBe('partialRemoved/D');
      expect(symbolChannelPaths.partialRemoved.subscribe()).toBe('partialRemoved');
      expect(symbolChannelPaths.cosignature.subscribe('E')).toBe('cosignature/E');
      expect(symbolChannelPaths.cosignature.subscribe()).toBe('cosignature');
      expect(symbolChannelPaths.status.subscribe('F')).toBe('status/F');
      expect(symbolChannelPaths.status.subscribe()).toBe('status');
      expect(symbolChannelPaths.block.subscribe()).toBe('block');
      expect(symbolChannelPaths.finalizedBlock.subscribe()).toBe('finalizedBlock');
    });

    it('アドレスを受け付けないchannelへのアドレス指定を拒否する', () => {
      expect(() => symbolChannelPaths.block.subscribe('A'.repeat(39))).toThrow(
        'address is not supported for channel: block'
      );
      expect(() => symbolChannelPaths.finalizedBlock.subscribe('A'.repeat(39))).toThrow(
        'address is not supported for channel: finalizedBlock'
      );
      expect(symbolChannelPaths.block.subscribe('')).toBe('block');
      expect(symbolChannelPaths.finalizedBlock.subscribe('')).toBe('finalizedBlock');
    });

    it('indexはモニターと型をエクスポートする', () => {
      expect(index.SymbolWebSocket).toBeDefined();
    });
  });
});
