import { Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import type { NetworkName } from 'nem-symbol-node-picker';
import { useEffect, useState } from 'react';

import { VotingNodeInfoData } from '../types/votingNode';
import { hexToBase32 } from '../utils/hexToBase32';
import { formatStringNumber, formatXymString } from '../utils/numberFormat';
import { findAccountByPublicKey, findChainInfo, findFinalizationProofAtEpoch } from '../utils/restClient';
import VotingNodeCard from './VotingNodeCard';

interface VotingNodeListProps {
  votingNodes: Node[];
  urlFilter: string | null;
  networkName: NetworkName;
  onHeightChange?: (height: string) => void;
  onFinalizationEpochChange?: (epoch: string) => void;
  onStage0HeightChange?: (height: string) => void;
  onStage1HeightChange?: (height: string) => void;
}

function VotingNodeList({
  votingNodes,
  urlFilter,
  networkName,
  onHeightChange,
  onFinalizationEpochChange,
  onStage0HeightChange,
  onStage1HeightChange,
}: VotingNodeListProps) {
  const [votingNodeInfos, setVotingNodeInfos] = useState<VotingNodeInfoData[]>([]);
  const [finalizationEpoch, setFinalizationEpoch] = useState('0');
  const [stage0Height, setStage0Height] = useState('0');
  const [stage1Height, setStage1Height] = useState('0');

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      // フィルタ(エンドポイント or メイン公開鍵)に一致するノードのみ抽出
      let filteredVotingNodes = votingNodes;
      if (urlFilter) {
        filteredVotingNodes = votingNodes.filter((val) => {
          return val.endpoint.includes(urlFilter) || val.mainPublicKey.includes(urlFilter);
        });
      }

      // 初期化
      setVotingNodeInfos([]);

      // 初回（Voting Nodes取得中）やフィルタ不一致時は、チェーン・アカウント情報を取得しない。
      if (filteredVotingNodes.length === 0) return;

      // ブロック高情報取得
      const chainInfo = await findChainInfo(networkName);
      if (!isActive) return;
      const epoch = chainInfo.latestFinalizedBlock.finalizationEpoch;

      // Stateにセット & 親に通知
      const height = formatStringNumber(chainInfo.height);
      const epochStr = formatStringNumber(chainInfo.latestFinalizedBlock.finalizationEpoch.toString());

      onHeightChange?.(height);
      setFinalizationEpoch(epochStr);
      onFinalizationEpochChange?.(epochStr);

      // プルーフ取得中にアカウント情報も取得しておき、カード表示までの待ち時間を短縮する。
      const accountInfoPromises = new Map(
        filteredVotingNodes.map((votingNode) => [
          votingNode.mainPublicKey,
          findAccountByPublicKey(votingNode.mainPublicKey, networkName).catch((error) => {
            console.warn(`Failed to fetch account info for ${votingNode.mainPublicKey}:`, error);
            return null;
          }),
        ])
      );

      // ファイナライゼーションプルーフは1回だけ取得
      const finalizationProof = await findFinalizationProofAtEpoch(epoch, networkName);
      if (!isActive) return;

      const s0Height = formatStringNumber(finalizationProof.messageGroups[1].height);
      const s1Height = formatStringNumber(finalizationProof.messageGroups[0].height);
      setStage0Height(s0Height);
      setStage1Height(s1Height);
      onStage0HeightChange?.(s0Height);
      onStage1HeightChange?.(s1Height);

      // ソート関数
      const sortNodeInfos = (infos: VotingNodeInfoData[]) => {
        return infos.sort((a, b) => {
          // 投票キーを持たないノードは常に最下段にする
          const aHasVotingKeys = (a.votingPublicKeys?.length ?? 0) > 0;
          const bHasVotingKeys = (b.votingPublicKeys?.length ?? 0) > 0;
          if (aHasVotingKeys && !bHasVotingKeys) {
            return -1;
          } else if (!aHasVotingKeys && bHasVotingKeys) {
            return 1;
          }

          // 投票中のノードを先頭にする
          if (a.isVoting && !b.isVoting) {
            return -1;
          } else if (!a.isVoting && b.isVoting) {
            return 1;
          }

          // 同順位はホスト名で昇順
          return a.host.localeCompare(b.host);
        });
      };

      // 各ノードの情報を並列取得し、取得次第画面に反映
      filteredVotingNodes.forEach(async (votingNode) => {
        const votingNodeInfoData: VotingNodeInfoData = {
          host: new URL(votingNode.endpoint).hostname,
          publicKey: votingNode.mainPublicKey,
          address: '-',
          amount: '0 XYM',
          isVoting: false,
          votingPublicKeys: [],
        };

        // アカウント情報検索
        const accountInfo = await accountInfoPromises.get(votingNode.mainPublicKey)!;
        if (!isActive) return;
        if (!accountInfo) {
          setVotingNodeInfos((prev) => sortNodeInfos([...prev, votingNodeInfoData]));
          return;
        }

        // アドレスBase32変換
        votingNodeInfoData.address = hexToBase32(accountInfo.account.address);

        // アカウント残高取得
        if (accountInfo.account.mosaics!.length !== 0) {
          const amount = formatXymString(accountInfo.account.mosaics![0].amount) + ' XYM';
          votingNodeInfoData.amount = amount;
        }

        // ファイナライゼーションプルーフの署名取得
        const votingPublicKeys = accountInfo.account.supplementalPublicKeys?.voting?.publicKeys;
        if (!votingPublicKeys || votingPublicKeys.length === 0) {
          setVotingNodeInfos((prev) => sortNodeInfos([...prev, votingNodeInfoData]));
          return;
        }

        votingNodeInfoData.votingPublicKeys = votingPublicKeys.map((votingPublicKey) => {
          let progress = 0;
          if (epoch < votingPublicKey.startEpoch) {
            // 未開始
          } else if (epoch >= votingPublicKey.endEpoch) {
            // 終了
            progress = 100;
          } else {
            // 進行中
            progress =
              ((epoch - votingPublicKey.startEpoch) / (votingPublicKey.endEpoch - votingPublicKey.startEpoch)) * 100;
          }

          // 投票してるか確認
          const signatureMap = new Map<string, string>();
          signatureMap.set('stage0', '-');
          signatureMap.set('stage1', '-');
          for (const messageGroup of finalizationProof.messageGroups) {
            const signature = messageGroup.signatures.find((val) => {
              return val.root.parentPublicKey === votingPublicKey.publicKey;
            });
            if (signature) {
              signatureMap.set(`stage${messageGroup.stage}`, signature.bottom.signature);
            }
          }

          return {
            votingPublicKey: votingPublicKey.publicKey,
            startEpoch: votingPublicKey.startEpoch,
            endEpoch: votingPublicKey.endEpoch,
            progress: progress,
            stage0Signature: signatureMap.get('stage0'),
            stage1Signature: signatureMap.get('stage1'),
          };
        });

        votingNodeInfoData.isVoting = votingNodeInfoData.votingPublicKeys.some(
          (key) => key.stage0Signature !== '-' || key.stage1Signature !== '-'
        );

        // ソート
        votingNodeInfoData.votingPublicKeys.sort((a, b) => {
          const isAInRange = epoch >= a.startEpoch! && epoch <= a.endEpoch!;
          const isBInRange = epoch >= b.startEpoch! && epoch <= b.endEpoch!;

          if (isAInRange && !isBInRange) {
            return -1; // aを先に
          } else if (!isAInRange && isBInRange) {
            return 1; // bを先に
          } else {
            return b.startEpoch! - a.startEpoch!; // startEpochの降順
          }
        });

        // 取得完了次第、stateに追加して描画
        setVotingNodeInfos((prev) => sortNodeInfos([...prev, votingNodeInfoData]));
      });
    };

    void fetchData().catch((error) => {
      if (isActive) console.error('Failed to fetch voting node data:', error);
    });

    return () => {
      isActive = false;
    };
  }, [
    votingNodes,
    urlFilter,
    networkName,
    onHeightChange,
    onFinalizationEpochChange,
    onStage0HeightChange,
    onStage1HeightChange,
  ]);

  return (
    <>
      {votingNodeInfos.map((votingNodeInfo, index) => (
        <VotingNodeCard
          key={index}
          votingNodeInfo={votingNodeInfo}
          finalizationEpoch={finalizationEpoch}
          stage0Height={stage0Height}
          stage1Height={stage1Height}
        />
      ))}
    </>
  );
}

export default VotingNodeList;
