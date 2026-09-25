import { getRuntimeNetworkConfiguration } from '@/server/network/runtime-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function HomePage() {
  const configuration = getRuntimeNetworkConfiguration();
  const networkLabel = configuration.ok
    ? configuration.value.network === 'mainnet'
      ? 'Symbol Mainnet'
      : 'Symbol Testnet'
    : 'Network configuration unavailable';

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <p className="eyebrow">SYMBOL HISTORY</p>
        <h1 id="page-title">SymTax</h1>
        <p className="intro">Symbol アカウントの履歴を参照・整理し、Cryptact 向けデータの作成を支援するツールです。</p>
        <div className="network-card">
          <span className={`status-dot ${configuration.ok ? 'is-ready' : ''}`} aria-hidden="true" />
          <div>
            <span className="network-caption">現在の対象ネットワーク</span>
            <strong>{networkLabel}</strong>
          </div>
        </div>
        <p className="phase-note">履歴参照機能は準備中です。</p>
      </section>
    </main>
  );
}
