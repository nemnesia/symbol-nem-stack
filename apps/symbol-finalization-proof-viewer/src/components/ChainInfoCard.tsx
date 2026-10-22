import { Alert, Box, Button, Card, CardContent, Skeleton, Typography } from '@mui/material';
import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';
import type { ChainInfoDTO } from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { useEffect, useState } from 'react';

import { formatStringNumber } from '../utils/numberFormat';
import { findChainInfo } from '../utils/restClient';

function ChainInfoCard({ networkName }: { networkName: NetworkName }) {
  const [chain, setChain] = useState<ChainInfoDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void findChainInfo(networkName).then(
      (result) => {
        if (active) setChain(result);
      },
      () => {
        if (active) setFailed(true);
      }
    );
    return () => {
      active = false;
    };
  }, [networkName, attempt]);

  const values = [
    ['最新ブロック高', chain?.height],
    ['確定済みブロック高', chain?.latestFinalizedBlock.height],
    ['確定済みEpoch', chain?.latestFinalizedBlock.finalizationEpoch],
    ['Finalization Point', chain?.latestFinalizedBlock.finalizationPoint],
  ] as const;

  return (
    <Card component="section" aria-label="チェーン情報" variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6" component="h2">
            チェーン情報
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {networkName === 'mainnet' ? 'Mainnet' : 'Testnet'} · 取得時点
          </Typography>
        </Box>
        {failed ? (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setFailed(false);
                  setChain(null);
                  setAttempt((value) => value + 1);
                }}
              >
                再取得
              </Button>
            }
          >
            チェーン情報を取得できませんでした。
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {values.map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                {value === undefined ? (
                  <Skeleton aria-label={`${label}を取得中`} width="80%" height={32} />
                ) : (
                  <Typography
                    variant="h6"
                    component="p"
                    sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
                  >
                    {formatStringNumber(String(value))}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default ChainInfoCard;
