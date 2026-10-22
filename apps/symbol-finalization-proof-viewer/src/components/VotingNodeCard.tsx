import { Check, CheckCircle, ContentCopy, ExpandMore, InfoOutlined } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { CurrencyState, ProofState, VotingNodeInfoData, VotingPublicKeyInfo } from '../types/votingNode';
import { formatStringNumber, formatXymString } from '../utils/numberFormat';
import { type ExpiryState, estimateKeyExpiry } from '../utils/votingKeyExpiry';
import { keyStatus, nodeAmount, stageSignatures } from '../utils/votingNode';

export const NODE_COLUMNS = 'minmax(0, 1.6fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr)';

interface VotingNodeCardProps {
  votingNodeInfo: VotingNodeInfoData;
  proof: ProofState;
  currency: CurrencyState;
  expiry: ExpiryState;
}

function KeyExpiry({ endEpoch, epoch, expiry }: { endEpoch: number; epoch?: number; expiry: ExpiryState }) {
  if (epoch !== undefined && epoch > endEpoch)
    return (
      <Typography variant="caption" color="text.secondary">
        期限切れ（対象Proof基準）
      </Typography>
    );
  if (expiry.status === 'loading')
    return (
      <Typography variant="caption" color="text.secondary">
        期限の目安：計算中…
      </Typography>
    );
  if (expiry.status !== 'ready' || !expiry.reference)
    return (
      <Typography variant="caption" color="text.secondary">
        期限の目安：推定できません（情報取得失敗）
      </Typography>
    );
  const estimate = estimateKeyExpiry(endEpoch, expiry.reference, epoch);
  if (estimate.kind !== 'estimated')
    return (
      <Typography variant="caption" color="text.secondary">
        {estimate.kind === 'awaiting-finalization'
          ? '期限の目安：対象ブロック高に到達（Epoch移行待ち）'
          : estimate.kind === 'expired'
            ? '期限切れ（対象Proof基準）'
            : '期限の目安：推定できません'}
      </Typography>
    );
  const date = new Date(estimate.timestampMs);
  const dateLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    date
  );
  return (
    <Typography variant="caption" color="text.secondary">
      期限の目安：<time dateTime={date.toISOString()}>{dateLabel}</time>ごろ（
      {estimate.lessThanOneDay ? '1日未満' : `約${estimate.remainingDays}日後`}）
    </Typography>
  );
}

function KeyPeriod({
  votingKey,
  epoch,
  expiry,
}: {
  votingKey: VotingPublicKeyInfo;
  epoch?: number;
  expiry: ExpiryState;
}) {
  const status = keyStatus(epoch, votingKey);
  const progress =
    epoch === undefined || epoch < votingKey.startEpoch
      ? 0
      : epoch >= votingKey.endEpoch
        ? 100
        : ((epoch - votingKey.startEpoch) / (votingKey.endEpoch - votingKey.startEpoch)) * 100;
  return (
    <Box sx={{ py: 0.5, opacity: status === 'Expired' ? 0.65 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={status === 'Unknown' ? '期間未確認' : status}
          size="small"
          color={status === 'Current' ? 'primary' : 'default'}
          variant="outlined"
        />
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          Epoch {formatStringNumber(String(votingKey.startEpoch))} → {formatStringNumber(String(votingKey.endEpoch))}
        </Typography>
        <KeyExpiry endEpoch={votingKey.endEpoch} epoch={epoch} expiry={expiry} />
      </Box>
      {epoch !== undefined && (
        <LinearProgress
          aria-label={`投票キー期間の経過 ${votingKey.startEpoch}–${votingKey.endEpoch}`}
          variant="determinate"
          value={progress}
          sx={{ mt: 1, height: 5, borderRadius: 1 }}
        />
      )}
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all', color: 'text.secondary', fontFamily: 'monospace' }}
      >
        {votingKey.votingPublicKey}
      </Typography>
    </Box>
  );
}

function SignatureStatus({ node, proof, stage }: { node: VotingNodeInfoData; proof: ProofState; stage: 0 | 1 }) {
  const signatures = stageSignatures(node, proof, stage);
  const failed = node.accountStatus === 'error' || proof.status === 'error';
  const heights = [
    ...new Set(
      proof.proof?.messageGroups
        .filter((group) => group.stage === stage)
        .map((group) => formatStringNumber(group.height)) ?? []
    ),
  ];
  return (
    <Box role="group" aria-label={stage === 0 ? 'Vote' : 'Commit'} sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary', mb: 0.5 }}>
        {stage === 0 ? 'Vote' : 'Commit'}
      </Typography>
      <Tooltip
        enterTouchDelay={0}
        title={
          signatures === null
            ? failed
              ? 'データを取得できませんでした'
              : 'アカウントとProofを確認しています'
            : signatures.length
              ? `対象Proof内に署名あり（${signatures.length}件）。署名の暗号学的検証は行っていません。`
              : '対象Proof内に、このアカウントの登録済み投票キーの署名がありません'
        }
      >
        <Chip
          size="small"
          variant="outlined"
          color={signatures?.length ? 'success' : failed ? 'error' : 'default'}
          label={signatures === null ? (failed ? '取得失敗' : '確認中') : signatures.length ? '✓ 署名あり' : '署名なし'}
        />
      </Tooltip>
      {heights.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            overflowWrap: 'anywhere',
            color: 'text.secondary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Height {heights.join(', ')}
        </Typography>
      )}
    </Box>
  );
}

function VotingNodeCard({ votingNodeInfo: node, proof, currency, expiry }: VotingNodeCardProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const amount = nodeAmount(node, currency);
  const voteSignatures = stageSignatures(node, proof, 0);
  const commitSignatures = stageSignatures(node, proof, 1);
  const hasSignatures = Boolean(voteSignatures?.length || commitSignatures?.length);
  const amountFailed =
    node.accountStatus === 'error' ||
    currency.status === 'error' ||
    (node.accountStatus === 'ready' && currency.status === 'ready' && amount === null);
  const currentKeys = node.votingPublicKeys.filter((key) => keyStatus(proof.epoch, key) === 'Current');
  const otherKeys = node.votingPublicKeys
    .filter((key) => keyStatus(proof.epoch, key) !== 'Current')
    .sort((a, b) => b.startEpoch - a.startEpoch);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <Card component="article" variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: NODE_COLUMNS },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="h3" variant="subtitle2" sx={{ overflowWrap: 'anywhere', flex: 1 }}>
                {node.host}
              </Typography>
              <Tooltip title="ノードの詳細" enterTouchDelay={0}>
                <IconButton
                  size="small"
                  aria-label={`${node.host}の詳細`}
                  onClick={(event) => setAnchor(event.currentTarget)}
                >
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {node.accountStatus === 'error' && (
              <Typography variant="caption" color="error">
                アカウント情報の取得失敗
              </Typography>
            )}
          </Box>
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary' }}>
              残高
            </Typography>
            <Typography
              variant="body2"
              color={amountFailed ? 'error' : 'text.primary'}
              sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
            >
              {amount === null ? (amountFailed ? '取得失敗' : '取得中…') : `${formatXymString(amount)} XYM`}
            </Typography>
            {amount !== null && (
              <Tooltip enterTouchDelay={0} title="残高の表示基準：3,000,000 XYM（残高のみの比較です）">
                <Typography
                  component="span"
                  variant="caption"
                  color={BigInt(amount) >= 3_000_000_000_000n ? 'success.main' : 'warning.main'}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                >
                  {BigInt(amount) >= 3_000_000_000_000n ? (
                    <CheckCircle fontSize="inherit" />
                  ) : (
                    <InfoOutlined fontSize="inherit" />
                  )}
                  {BigInt(amount) >= 3_000_000_000_000n ? '残高基準以上' : '残高基準未満'}
                </Typography>
              </Tooltip>
            )}
          </Box>
          <SignatureStatus node={node} proof={proof} stage={0} />
          <SignatureStatus node={node} proof={proof} stage={1} />
        </Box>

        {hasSignatures && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{ mt: 1, bgcolor: 'transparent', '&:before': { display: 'none' } }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore fontSize="small" />}
              sx={{ px: 0, minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <Typography variant="caption">Vote / Commit の証明詳細</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pb: 0 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {(
                  [
                    ['Vote', voteSignatures],
                    ['Commit', commitSignatures],
                  ] as const
                ).map(([label, signatures]) => (
                  <Box key={label}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {label}
                    </Typography>
                    {signatures?.length ? (
                      signatures.map((signature, index) => (
                        <Typography
                          key={index}
                          variant="caption"
                          sx={{ display: 'block', mb: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}
                        >
                          {signature}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        署名なし
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            投票キー期間
          </Typography>
          {node.accountStatus !== 'ready' ? (
            <Typography variant="body2" color={node.accountStatus === 'error' ? 'error' : 'text.secondary'}>
              {node.accountStatus === 'error' ? '取得失敗' : '取得中…'}
            </Typography>
          ) : node.votingPublicKeys.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              登録済みの投票キーなし
            </Typography>
          ) : (
            <>
              {currentKeys.map((key) => (
                <KeyPeriod key={key.votingPublicKey} votingKey={key} epoch={proof.epoch} expiry={expiry} />
              ))}
              {currentKeys.length === 0 && (
                <Typography variant="body2" sx={{ my: 0.5 }} color="text.secondary">
                  {proof.epoch === undefined ? '対象Epochを確認できていません' : '対象Epochで有効な投票キーなし'}
                </Typography>
              )}
              {otherKeys.length > 0 && (
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    sx={{ px: 0, minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                  >
                    <Typography variant="caption">
                      {proof.epoch === undefined ? '登録済みのキー' : '過去・次回のキー'}（{otherKeys.length}件）
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 0 }}>
                    {otherKeys.map((key) => (
                      <KeyPeriod key={key.votingPublicKey} votingKey={key} epoch={proof.epoch} expiry={expiry} />
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
            </>
          )}
        </Box>
        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={() => {
            setAnchor(null);
            setCopied(null);
            setCopyError(false);
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 64px)' }}>
            {(
              [
                ['ホスト', node.host],
                ['公開鍵', node.publicKey],
                ['アドレス', node.address],
              ] as const
            ).map(([label, value]) => (
              <Box key={label} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', flex: 1 }}>
                    {value ?? (node.accountStatus === 'error' ? '取得失敗' : '取得中…')}
                  </Typography>
                  {value && (
                    <IconButton size="small" aria-label={`${label}をコピー`} onClick={() => copy(value, label)}>
                      {copied === label ? <Check color="success" fontSize="small" /> : <ContentCopy fontSize="small" />}
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))}
            <Typography role="status" variant="caption" color={copyError ? 'error' : 'success.main'}>
              {copyError ? 'コピーできませんでした' : copied ? `${copied}をコピーしました` : ''}
            </Typography>
          </Box>
        </Popover>
      </CardContent>
    </Card>
  );
}

export default VotingNodeCard;
