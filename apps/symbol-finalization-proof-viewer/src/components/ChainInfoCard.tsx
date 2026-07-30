import { Card, CardContent, Grid, Typography } from '@mui/material';
import { ChainRoutesApi, Configuration } from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { type NetworkName, nemSymbolNodePicker } from 'nem-symbol-node-picker';
import { useEffect, useState } from 'react';

import { formatStringNumber } from '../utils/numberFormat';

type ChainInfoCardProps = {
  networkName: NetworkName;
  onHeightChange?: (height: string) => void; // ブロック高が更新されたときに親へ通知
};

const ChainInfoCard: React.FC<ChainInfoCardProps> = ({ networkName, onHeightChange }) => {
  // チェーン情報の状態管理
  const [height, setHeight] = useState('0'); // 最新ブロック高
  const [finalizedHeight, setFinalizedHeight] = useState('0'); // ファイナライズされたブロック高
  const [finalizationPoint, setFinalizationPoint] = useState('0'); // ファイナライゼーションポイント
  const [finalizationEpoch, setFinalizationEpoch] = useState('0'); // ファイナライゼーションエポック

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      // 利用可能なSymbolノードを取得
      const symbolNodes = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: networkName,
        count: 1,
        isSsl: true,
      });

      // REST APIを使用してチェーン情報を取得
      const chainRoutesApi = new ChainRoutesApi(new Configuration({ basePath: symbolNodes[0] }));
      const chainInfo = await chainRoutesApi.getChainInfo();

      if (!isActive) return;

      // 取得したチェーン情報を状態に設定
      const initialHeight = formatStringNumber(chainInfo.height.toString());
      setHeight(initialHeight);
      // 親コンポーネントへ初期ブロック高を通知
      onHeightChange?.(initialHeight);
      setFinalizedHeight(formatStringNumber(chainInfo.latestFinalizedBlock.height.toString()));
      setFinalizationEpoch(formatStringNumber(chainInfo.latestFinalizedBlock.finalizationEpoch.toString()));
      setFinalizationPoint(formatStringNumber(chainInfo.latestFinalizedBlock.finalizationPoint.toString()));
    };
    void fetchData().catch((error) => {
      if (isActive) console.error('Failed to fetch chain info:', error);
    });

    return () => {
      isActive = false;
    };
  }, [networkName]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">Chain Info</Typography>

        <Grid container spacing={0.5}>
          {/* ブロック高 */}
          <Grid size={{ xs: 6, sm: 3, md: 3 }} sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Block Height
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>
              {height}
            </Typography>
          </Grid>

          {/* ファイナライズブロック高 */}
          <Grid size={{ xs: 6, sm: 3, md: 3 }} sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Finalized Height
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>
              {finalizedHeight}
            </Typography>
          </Grid>

          {/* ファイナライズエポック */}
          <Grid size={{ xs: 6, sm: 3, md: 3 }} sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Finalized Epoch
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>
              {finalizationEpoch}
            </Typography>
          </Grid>

          {/* ファイナライズポイント */}
          <Grid size={{ xs: 6, sm: 3, md: 3 }} sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Finalization Point
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>
              {finalizationPoint}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ChainInfoCard;
