import { Alert, Box, Button, LinearProgress, MenuItem, TextField, Typography } from '@mui/material';
import type { Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';
import { useEffect, useState } from 'react';

import type { CurrencyState, FetchStatus, NodeFilter, ProofState, VotingNodeInfoData } from '../types/votingNode';
import { hexToBase32 } from '../utils/hexToBase32';
import { formatStringNumber } from '../utils/numberFormat';
import {
  findAccountByPublicKey,
  findChainInfo,
  findCurrencyMosaicId,
  findFinalizationProofAtEpoch,
  findVotingKeyExpiryReference,
} from '../utils/restClient';
import type { ExpiryState } from '../utils/votingKeyExpiry';
import { filterVotingNodes, isDisplayableProof, nodeAmount } from '../utils/votingNode';
import VotingNodeCard, { NODE_COLUMNS } from './VotingNodeCard';

interface VotingNodeListProps {
  votingNodes: Node[];
  urlFilter: string | null;
  networkName: NetworkName;
  discoveryStatus: FetchStatus;
  onRetry: () => void;
}

const nodeHost = (endpoint: string) => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return endpoint;
  }
};

function VotingNodeList({ votingNodes, urlFilter, networkName, discoveryStatus, onRetry }: VotingNodeListProps) {
  const [accounts, setAccounts] = useState<Record<string, VotingNodeInfoData>>({});
  const [proof, setProof] = useState<ProofState>({ status: 'loading' });
  const [currency, setCurrency] = useState<CurrencyState>({ status: 'loading' });
  const [expiry, setExpiry] = useState<ExpiryState>({ status: 'loading' });
  const [search, setSearch] = useState(urlFilter ?? '');
  const [filter, setFilter] = useState<NodeFilter>('all');
  const hasNodes = votingNodes.length > 0;

  useEffect(() => {
    if (!hasNodes) return;
    let active = true;
    void findVotingKeyExpiryReference(networkName).then(
      (reference) => {
        if (active) setExpiry({ status: 'ready', reference });
      },
      () => {
        if (active) setExpiry({ status: 'error' });
      }
    );
    void findCurrencyMosaicId(networkName).then(
      (mosaicId) => {
        if (active) setCurrency({ status: 'ready', mosaicId });
      },
      () => {
        if (active) setCurrency({ status: 'error' });
      }
    );
    void (async () => {
      try {
        const chain = await findChainInfo(networkName);
        const epoch = chain.latestFinalizedBlock.finalizationEpoch;
        if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('Invalid epoch');
        if (!active) return;
        setProof({ status: 'loading', epoch });
        const result = await findFinalizationProofAtEpoch(epoch, networkName);
        if (!isDisplayableProof(result, epoch)) throw new Error('Unexpected proof');
        if (active) setProof({ status: 'ready', epoch, proof: result });
      } catch {
        if (active) setProof((current) => ({ status: 'error', epoch: current.epoch }));
      }
    })();
    return () => {
      active = false;
    };
  }, [networkName, hasNodes]);

  useEffect(() => {
    let active = true;
    const initial = votingNodes
      .map<VotingNodeInfoData>((node) => ({
        host: nodeHost(node.endpoint),
        publicKey: node.mainPublicKey,
        accountStatus: 'loading',
        votingPublicKeys: [],
      }))
      .sort((a, b) => a.host.localeCompare(b.host));
    initial.forEach((node) => {
      void (async () => {
        let updated: VotingNodeInfoData;
        try {
          const { account } = await findAccountByPublicKey(node.publicKey, networkName);
          const votingKeys = account.supplementalPublicKeys?.voting?.publicKeys ?? [];
          if (
            !/^[0-9a-f]{48}$/i.test(account.address) ||
            !Array.isArray(account.mosaics) ||
            account.mosaics.some((mosaic) => !/^[0-9a-f]{16}$/i.test(mosaic.id) || !/^\d+$/.test(mosaic.amount)) ||
            votingKeys.some(
              (key) =>
                !/^[0-9a-f]{64}$/i.test(key.publicKey) ||
                !Number.isSafeInteger(key.startEpoch) ||
                key.startEpoch < 0 ||
                !Number.isSafeInteger(key.endEpoch) ||
                key.startEpoch > key.endEpoch
            )
          ) {
            throw new Error('Invalid account data');
          }
          updated = {
            ...node,
            accountStatus: 'ready',
            address: hexToBase32(account.address),
            mosaics: account.mosaics,
            votingPublicKeys: votingKeys.map((key) => ({
              votingPublicKey: key.publicKey,
              startEpoch: key.startEpoch,
              endEpoch: key.endEpoch,
            })),
          };
        } catch {
          updated = { ...node, accountStatus: 'error' };
        }
        if (active) setAccounts((current) => ({ ...current, [node.publicKey]: updated }));
      })();
    });
    return () => {
      active = false;
    };
  }, [votingNodes, networkName]);

  const nodes = votingNodes
    .map<VotingNodeInfoData>(
      (node) =>
        accounts[node.mainPublicKey] ?? {
          host: nodeHost(node.endpoint),
          publicKey: node.mainPublicKey,
          accountStatus: 'loading',
          votingPublicKeys: [],
        }
    )
    .sort((a, b) => {
      const amountA = nodeAmount(a, currency);
      const amountB = nodeAmount(b, currency);
      if (amountA !== null && amountB !== null) {
        const balanceA = BigInt(amountA);
        const balanceB = BigInt(amountB);
        if (balanceA !== balanceB) return balanceA > balanceB ? -1 : 1;
      } else if (amountA !== null) {
        return -1;
      } else if (amountB !== null) {
        return 1;
      }
      return a.host.localeCompare(b.host);
    });
  const visible = filterVotingNodes(nodes, search, filter, proof, currency, expiry);
  const completed = nodes.filter((node) => node.accountStatus !== 'loading').length;
  const errors = nodes.filter((node) => node.accountStatus === 'error').length;
  const loading =
    discoveryStatus === 'loading' ||
    (hasNodes &&
      (completed < nodes.length ||
        proof.status === 'loading' ||
        currency.status === 'loading' ||
        expiry.status === 'loading'));

  return (
    <Box component="section" aria-label="投票ノード一覧" aria-busy={loading}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          投票ノード
        </Typography>
        <Button size="small" variant="outlined" onClick={onRetry} disabled={discoveryStatus === 'loading'}>
          再取得
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          label="ノードを検索"
          placeholder="ホスト名・公開鍵・アドレス"
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1 }}
          type="search"
        />
        <TextField
          select
          label="表示する状態"
          size="small"
          value={filter}
          onChange={(event) => setFilter(event.target.value as NodeFilter)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">すべて</MenuItem>
          <MenuItem value="signed">署名あり（VoteまたはCommit）</MenuItem>
          <MenuItem value="unsigned">署名なし（VoteまたはCommit）</MenuItem>
          <MenuItem value="error">取得失敗あり</MenuItem>
        </TextField>
      </Box>
      <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 1 }}>
        {discoveryStatus === 'loading' ? 'ノード一覧を取得中…' : `${visible.length} / ${nodes.length} ノード表示`}
        {hasNodes && ` · アカウント取得 ${completed} / ${nodes.length}件`}
        {errors > 0 && `（失敗 ${errors}件）`}
        {proof.epoch !== undefined && ` · 対象Proof Epoch ${formatStringNumber(String(proof.epoch))}`}
      </Typography>
      {loading && <LinearProgress aria-label="ノード情報を取得中" sx={{ mb: 2 }} />}
      {discoveryStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ノード一覧を取得できませんでした。「再取得」でやり直せます。
        </Alert>
      )}
      {hasNodes && proof.status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          対象Proofを取得できませんでした。署名の有無は未確認です。
        </Alert>
      )}
      {hasNodes && currency.status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          通貨情報を取得できなかったため、XYM残高を表示できません。「再取得」でやり直せます。
        </Alert>
      )}
      {discoveryStatus === 'ready' && nodes.length === 0 && (
        <Alert severity="info">表示できる投票ノードがありません。</Alert>
      )}
      {nodes.length > 0 && visible.length === 0 && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              条件をクリア
            </Button>
          }
        >
          {loading ? '条件に一致するノードを確認中です。' : '条件に一致するノードがありません。'}
        </Alert>
      )}
      {visible.length > 0 && (
        <>
          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: NODE_COLUMNS,
              gap: 2,
              px: 2,
              py: 1,
              color: 'text.secondary',
            }}
          >
            {['ホスト', '残高（多い順）', 'Vote', 'Commit'].map((label) => (
              <Typography variant="caption" key={label}>
                {label}
              </Typography>
            ))}
          </Box>
          {visible.map((node) => (
            <VotingNodeCard
              key={node.publicKey}
              votingNodeInfo={node}
              proof={proof}
              currency={currency}
              expiry={expiry}
            />
          ))}
        </>
      )}
      {hasNodes && (
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
          期限の日付・残り日数は取得時点の推定です。目標ブロック生成間隔を使用しており、生成速度やファイナライズの進行により前後します。日付は端末のタイムゾーン（
          {Intl.DateTimeFormat().resolvedOptions().timeZone}）で表示します。
        </Typography>
      )}
      <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
        署名あり／なしは、対象Proofと登録済み投票キーの照合結果です。ノードの稼働状況や署名の暗号学的検証結果を表すものではありません。
      </Typography>
    </Box>
  );
}

export default VotingNodeList;
