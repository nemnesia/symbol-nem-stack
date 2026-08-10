const NULL = 0;
const LF = 10;
const CR = 13;
const COLON = 58;

/**
 * STOMP フレームの受信サイズを、StompJS の Parser へ渡す前に制限する。
 *
 * StompJS は WebSocket メッセージをまたいで未完成フレームを保持するため、
 * WebSocket メッセージ単位の上限だけではフレーム全体の上限にならない。
 * このガードは StompJS の受信パーサと同じバイト単位の境界を追跡する。
 */
export class StompFrameSizeGuard {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private frameSize = 0;
  private state: 'frame' | 'command' | 'headers' | 'header-key' | 'header-value' | 'body-null' | 'body-fixed' = 'frame';
  private headerLine: number[] = [];
  private headerValue: number[] = [];
  private currentHeaderName = '';
  private bodyBytesRemaining: number | undefined;

  public constructor(private readonly maxFrameSize: number) {
    if (!Number.isSafeInteger(maxFrameSize) || maxFrameSize <= 0) {
      throw new RangeError('maxFrameSize must be a positive safe integer');
    }
  }

  /**
   * チャンク全体が許容範囲内なら true を返す。
   * false の場合、呼び出し側はチャンクを STOMP パーサへ渡さず切断する。
   */
  public acceptChunk(segment: unknown): boolean {
    const chunk = this.toBytes(segment);
    if (!chunk) return false;

    for (const byte of chunk) {
      if (!this.acceptByte(byte)) return false;
    }
    return true;
  }

  private toBytes(segment: unknown): Uint8Array | undefined {
    if (typeof segment === 'string') return this.encoder.encode(segment);
    if (segment instanceof ArrayBuffer) return new Uint8Array(segment);
    if (ArrayBuffer.isView(segment)) {
      return new Uint8Array(segment.buffer, segment.byteOffset, segment.byteLength);
    }
    return undefined;
  }

  private acceptByte(byte: number): boolean {
    switch (this.state) {
      case 'frame':
        if (byte === NULL || byte === CR) return true;
        if (byte === LF) return true;
        this.state = 'command';
        return this.addToFrame(byte);

      case 'command':
        if (byte === CR) return this.addToFrame(byte);
        if (byte === LF) {
          this.state = 'headers';
          return this.addToFrame(byte);
        }
        return this.addToFrame(byte);

      case 'headers':
        if (byte === CR) return this.addToFrame(byte);
        if (byte === LF) {
          if (this.headerLine.length === 0) {
            return this.addToFrame(byte) && this.startBody();
          }
          this.state = 'header-key';
          return this.addToFrame(byte);
        }
        this.state = 'header-key';
        this.headerLine = [byte];
        return this.addToFrame(byte);

      case 'header-key':
        if (byte === COLON) {
          this.currentHeaderName = this.decoder.decode(Uint8Array.from(this.headerLine));
          this.headerValue = [];
          this.state = 'header-value';
          return this.addToFrame(byte);
        }
        if (byte === CR) return this.addToFrame(byte);
        if (byte === LF) {
          // A header without a colon is not a valid STOMP header.
          return false;
        }
        this.headerLine.push(byte);
        return this.addToFrame(byte);

      case 'header-value':
        if (byte === CR) return this.addToFrame(byte);
        if (byte === LF) {
          if (this.currentHeaderName === 'content-length') {
            const value = this.decoder.decode(Uint8Array.from(this.headerValue));
            if (!/^\d+$/.test(value)) return false;
            const contentLength = Number(value);
            if (!Number.isSafeInteger(contentLength)) return false;
            this.bodyBytesRemaining = contentLength;
          }
          this.headerLine = [];
          this.headerValue = [];
          this.currentHeaderName = '';
          this.state = 'headers';
          return this.addToFrame(byte);
        }
        this.headerValue.push(byte);
        return this.addToFrame(byte);

      case 'body-null':
        if (byte === NULL) {
          const accepted = this.addToFrame(byte);
          this.resetFrame();
          return accepted;
        }
        return this.addToFrame(byte);

      case 'body-fixed':
        if (this.bodyBytesRemaining === 0) {
          if (byte !== NULL) return false;
          const accepted = this.addToFrame(byte);
          this.resetFrame();
          return accepted;
        }
        this.bodyBytesRemaining = (this.bodyBytesRemaining ?? 0) - 1;
        return this.addToFrame(byte);
    }
  }

  private startBody(): boolean {
    if (this.bodyBytesRemaining !== undefined) {
      if (this.bodyBytesRemaining > this.maxFrameSize - this.frameSize - 1) return false;
      this.state = 'body-fixed';
    } else {
      this.state = 'body-null';
    }
    return true;
  }

  private addToFrame(byte: number): boolean {
    this.frameSize++;
    return this.frameSize <= this.maxFrameSize;
  }

  private resetFrame(): void {
    this.frameSize = 0;
    this.state = 'frame';
    this.headerLine = [];
    this.headerValue = [];
    this.currentHeaderName = '';
    this.bodyBytesRemaining = undefined;
  }
}
