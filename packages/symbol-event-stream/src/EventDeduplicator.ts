interface CachedId {
  /** IDをキャッシュへ登録した時刻（エポックミリ秒）。 */
  timestamp: number;
}

/**
 * 通知IDの抽出とTTL/cache sizeに基づく重複排除を担当します。
 *
 * @remarks
 * キャッシュキーには購読キーも含めるため、同じIDでもチャネルやアドレスが異なる通知は
 * 独立して配信されます。インスタンス生成後に {@link start} を1回呼び出してください。
 */
export class EventDeduplicator {
  private readonly seenIds = new Map<string, CachedId>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * @param maxCacheSize 保持する重複排除エントリの最大数。
   * @param cacheTtl 同じ通知IDを重複とみなす期間（ミリ秒）。
   */
  public constructor(
    private readonly maxCacheSize: number,
    private readonly cacheTtl: number
  ) {}

  /** TTL切れエントリの定期削除を開始します。複数回呼び出してもタイマーは増えません。 */
  public start(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), Math.min(this.cacheTtl / 2, 60_000));
  }

  /**
   * 通知を配信してよいか判定します。
   * IDを持たない通知は重複排除せず、常に配信します。
   *
   * @param key チャネルまたはチャネル・アドレス購読を表す内部キー。
   * @param message Gatewayから受信した通知エンベロープ。
   * @returns 配信すべき新規通知なら `true`、TTL内の重複なら `false`。
   */
  public shouldDispatch(key: string, message: unknown): boolean {
    const id = this.extractId(message, key.split(':', 1)[0]);

    if (!id) return true;

    const cacheKey = `${key}\u0000${id}`;
    const now = Date.now();
    const cached = this.seenIds.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheTtl) {
      return false;
    }

    this.seenIds.set(cacheKey, { timestamp: now });
    if (this.seenIds.size > this.maxCacheSize) {
      this.trimCache();
    }

    return true;
  }

  /** タイマーとキャッシュを破棄します。 */
  public close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.seenIds.clear();
  }

  private extractId(message: unknown, channel: string): string | undefined {
    if (typeof message !== 'object' || message === null) return undefined;
    const msg = message as Record<string, unknown>;
    const payload = 'data' in msg ? msg.data : msg;
    if (typeof payload !== 'object' || payload === null) return undefined;
    const data = payload as Record<string, unknown>;

    // cosignature は単独の hash を持たないため、3フィールドの組み合わせをIDにします。
    if (
      channel === 'cosignature' &&
      typeof data.parentHash === 'string' &&
      typeof data.signerPublicKey === 'string' &&
      typeof data.signature === 'string'
    ) {
      return JSON.stringify([data.parentHash, data.signerPublicKey, data.signature]);
    }

    const meta = data.meta;
    if (typeof meta === 'object' && meta !== null && typeof (meta as Record<string, unknown>).hash === 'string') {
      return (meta as Record<string, string>).hash;
    }
    if (typeof data.hash === 'string') return data.hash;
    if (typeof data.uid === 'string') return data.uid;
    return undefined;
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [id, cached] of this.seenIds.entries()) {
      if (now - cached.timestamp > this.cacheTtl) {
        this.seenIds.delete(id);
      }
    }
  }

  private trimCache(): void {
    const entries = Array.from(this.seenIds.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [id] of entries.slice(0, entries.length - this.maxCacheSize)) {
      this.seenIds.delete(id);
    }
  }
}
