import { Cancel, Check, CheckCircle, ContentCopy, InfoOutlined } from '@mui/icons-material';
import { Box, Card, CardContent, Chip, IconButton, LinearProgress, LinearProgressProps, Popover, Tooltip, Typography } from '@mui/material';
import React, { useState } from 'react';

import { VotingNodeInfoData } from '../types/votingNode';
import { formatStringNumber } from '../utils/numberFormat';

interface VotingNodeCardProps {
  votingNodeInfo: VotingNodeInfoData;
  finalizationEpoch: string;
  stage0Height: string;
  stage1Height: string;
}

const VOTING_THRESHOLD = 3_000_000;

const parseAmountXym = (amount: string): number => {
  return parseFloat(amount.replace(/,/g, '').replace(' XYM', '')) || 0;
};

const LinearProgressExt = (props: LinearProgressProps & { value: number }) => {
  let color: 'success' | 'warning' | 'error' = 'success';
  if (props.value < 85) {
    color = 'success';
  } else if (props.value <= 99) {
    color = 'warning';
  } else {
    color = 'error';
  }
  return <LinearProgress variant="determinate" color={color} value={props.value} />;
};

const judgmentVotingKey = (currentEpoch: number, startEpoch: number, endEpoch: number) => {
  if (currentEpoch < startEpoch) {
    return 'Next';
  } else if (currentEpoch > endEpoch) {
    return 'Expired';
  }
  return 'Current';
};

function VotingNodeCard({ votingNodeInfo, finalizationEpoch, stage0Height, stage1Height }: VotingNodeCardProps) {
  const currentEpoch = parseInt(finalizationEpoch.replace(/,/g, ''));
  const hasEnoughAmount = parseAmountXym(votingNodeInfo.amount) >= VOTING_THRESHOLD;
  const firstKey = votingNodeInfo.votingPublicKeys?.[0];

  const [infoAnchorEl, setInfoAnchorEl] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleInfoOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setInfoAnchorEl(event.currentTarget);
  };
  const handleInfoClose = () => setInfoAnchorEl(null);
  const infoOpen = Boolean(infoAnchorEl);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
        {/* トップ行: Host ⓘ | 残高アイコン | [Current] ✓ [Prev] ✓ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Host — クリックでコピー、ⓘ でPopoverを開く */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
            <Tooltip enterTouchDelay={0} title="Node info">
              <IconButton aria-label="Node info" size="small" onClick={handleInfoOpen}>
                <InfoOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip enterTouchDelay={0} title="Click to copy">
              <Typography
                variant="body1"
                sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => copyToClipboard(votingNodeInfo.host, 'host')}
              >
                {votingNodeInfo.host}
              </Typography>
            </Tooltip>
            {copied === 'host' && (
              <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                Copied!
              </Typography>
            )}
          </Box>
          <Popover
            open={infoOpen}
            anchorEl={infoAnchorEl}
            onClose={handleInfoClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 1.5, maxWidth: 420 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                PublicKey
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', flexGrow: 1 }}>
                  {votingNodeInfo.publicKey}
                </Typography>
                <IconButton aria-label="Copy public key" size="small" onClick={() => copyToClipboard(votingNodeInfo.publicKey, 'publicKey')}>
                  {copied === 'publicKey' ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', mt: 0.5 }}>
                Address
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                  {votingNodeInfo.address}
                </Typography>
                <IconButton aria-label="Copy address" size="small" onClick={() => copyToClipboard(votingNodeInfo.address, 'address')}>
                  {copied === 'address' ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
                </IconButton>
              </Box>
            </Box>
          </Popover>

          {/* 残高・署名グループ — 幅が狭いとまとめて2行目に折り返す */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {/* 残高チェックアイコン — ホバー/タップで Amount を表示 */}
            <Tooltip enterTouchDelay={0} title={votingNodeInfo.amount}>
              <Chip label="Amount" size="small" variant="outlined" sx={{ cursor: 'help' }} />
            </Tooltip>
            {hasEnoughAmount ? (
              <CheckCircle color="success" fontSize="small" />
            ) : (
              <Cancel color="error" fontSize="small" />
            )}

            {/* ファイナライゼーション署名 — 最初の投票キーのみ表示 */}
            {firstKey && (
              <>
                {/* Commit round (Stage1) */}
                <Tooltip enterTouchDelay={0} title={`Height: ${stage1Height}`}>
                  <Chip label="Commit" size="small" variant="outlined" sx={{ cursor: 'help' }} />
                </Tooltip>
                <Tooltip
                  enterTouchDelay={0}
                  title={
                    firstKey.stage1Signature && firstKey.stage1Signature !== '-'
                      ? `Signature: ${firstKey.stage1Signature}`
                      : 'No signature'
                  }
                >
                  <span>
                    {firstKey.stage1Signature && firstKey.stage1Signature !== '-' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : (
                      <Cancel color="error" fontSize="small" />
                    )}
                  </span>
                </Tooltip>

                {/* Vote round (Stage0) */}
                <Tooltip enterTouchDelay={0} title={`Height: ${stage0Height}`}>
                  <Chip label="Vote" size="small" variant="outlined" sx={{ cursor: 'help' }} />
                </Tooltip>
                <Tooltip
                  enterTouchDelay={0}
                  title={
                    firstKey.stage0Signature && firstKey.stage0Signature !== '-'
                      ? `Signature: ${firstKey.stage0Signature}`
                      : 'No signature'
                  }
                >
                  <span>
                    {firstKey.stage0Signature && firstKey.stage0Signature !== '-' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : (
                      <Cancel color="error" fontSize="small" />
                    )}
                  </span>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>

        {/* 投票キー期間 — 縦積み、Expired はグレーアウト */}
        {votingNodeInfo.votingPublicKeys && votingNodeInfo.votingPublicKeys.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {votingNodeInfo.votingPublicKeys.map((val, index) => {
              const status = judgmentVotingKey(currentEpoch, val.startEpoch!, val.endEpoch!);
              const isExpired = status === 'Expired';
              return (
                <Box key={index} sx={{ opacity: isExpired ? 0.45 : 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip enterTouchDelay={0} title={`PublicKey: ${val.votingPublicKey!}`}>
                      <Chip
                        label={status}
                        size="small"
                        color={status === 'Current' ? 'primary' : 'default'}
                        variant={isExpired ? 'outlined' : 'filled'}
                        sx={{ cursor: 'help', minWidth: 70 }}
                      />
                    </Tooltip>
                    <Typography variant="caption" sx={{ minWidth: 55, textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatStringNumber(val.startEpoch!.toString())}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgressExt value={val.progress!} />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 55, fontFamily: 'monospace' }}>
                      {formatStringNumber(val.endEpoch!.toString())}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default VotingNodeCard;
