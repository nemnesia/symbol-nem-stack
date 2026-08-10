import { describe, expect, it } from 'vitest';

import { Parser } from '../node_modules/@stomp/stompjs/esm6/parser.js';
import { StompFrameSizeGuard } from '../src/stompFrameSizeGuard.js';

describe('StompFrameSizeGuard', () => {
  it('分割されたcontent-lengthフレームを許可する', () => {
    const guard = new StompFrameSizeGuard(64);

    expect(guard.acceptChunk('MESSAGE\ncontent-length:3\n')).toBe(true);
    expect(guard.acceptChunk('\nab')).toBe(true);
    expect(guard.acceptChunk('c\0')).toBe(true);
  });

  it('巨大なcontent-lengthをbodyを受信する前に拒否する', () => {
    const guard = new StompFrameSizeGuard(64);

    expect(guard.acceptChunk('MESSAGE\ncontent-length:999999999999\n\n')).toBe(false);
  });

  it.each(['-1', '1.5', 'not-a-number'])('不正なcontent-lengthを拒否する: %s', (contentLength) => {
    const guard = new StompFrameSizeGuard(64);

    expect(guard.acceptChunk(`MESSAGE\ncontent-length:${contentLength}\n\n`)).toBe(false);
  });

  it('NULL終端なしの分割フレームが上限を超えたら拒否する', () => {
    const guard = new StompFrameSizeGuard(32);

    expect(guard.acceptChunk('MESSAGE\n\n')).toBe(true);
    expect(guard.acceptChunk('a'.repeat(12))).toBe(true);
    expect(guard.acceptChunk('b'.repeat(12))).toBe(false);
  });

  it('content-length bodyのNULL終端欠落を拒否する', () => {
    const guard = new StompFrameSizeGuard(64);

    expect(guard.acceptChunk('MESSAGE\ncontent-length:3\n\nabc')).toBe(true);
    expect(guard.acceptChunk('N')).toBe(false);
  });

  it('重複content-lengthを拒否し、実StompJS Parserへ渡さない', () => {
    const guard = new StompFrameSizeGuard(64);
    const frames: unknown[] = [];
    const parser = new Parser(
      (frame) => frames.push(frame),
      () => {}
    );
    const firstChunk = 'MESSAGE\ncontent-length:999999999999\ncontent-length:0\n\n';

    if (guard.acceptChunk(firstChunk)) parser.parseChunk(firstChunk);
    if (guard.acceptChunk('x'.repeat(128))) parser.parseChunk('x'.repeat(128));

    expect(frames).toHaveLength(0);
  });
});
