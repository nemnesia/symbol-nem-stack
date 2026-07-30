import { Box } from '@mui/material';
import { Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import { type NetworkName, fetchSymbolPeerNodesFromNodeWatch } from 'nem-symbol-node-picker';
import { useEffect, useState } from 'react';

import '../App.css';
import ChainInfoCard from './ChainInfoCard';
import VotingNodeList from './VotingNodeList';

const PASOMI_NODE_HOSTS = ['seattle.pasomi.net', 'pasomi.net', 'shoestring.pasomi.net', 'mumbai.pasomi.net'];
const PASOMI_NODE_INFO_PATH = '/node/info';
const PASOMI_NODE_INFO_PORT = 3001;
const PASOMI_NODE_INFO_TIMEOUT_MS = 5000;

const parseEndpointHostname = (endpoint: string): string | null => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    try {
      return new URL(`http://${endpoint}`).hostname;
    } catch {
      return null;
    }
  }
};

const fetchPasomiCandidateNode = async (host: string): Promise<Node> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PASOMI_NODE_INFO_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}:${PASOMI_NODE_INFO_PORT}${PASOMI_NODE_INFO_PATH}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const nodeInfo = (await response.json()) as {
      publicKey?: string;
      nodePublicKey?: string;
      host?: string;
      port?: number;
      friendlyName?: string;
      version?: number;
      roles?: number;
    };

    if (!nodeInfo.publicKey || !nodeInfo.host || !nodeInfo.port || ((nodeInfo.roles ?? 0) & 4) === 0) {
      throw new Error('Node does not satisfy roles & 4 or required fields are missing');
    }

    return {
      mainPublicKey: nodeInfo.publicKey,
      nodePublicKey: nodeInfo.nodePublicKey,
      endpoint: `http://${nodeInfo.host}:${nodeInfo.port}`,
      name: nodeInfo.friendlyName ?? nodeInfo.host,
      version: String(nodeInfo.version ?? ''),
      height: 0,
      finalizedHeight: 0,
      balance: 0,
      roles: nodeInfo.roles,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchPasomiMainnetNode = async (): Promise<Node | null> => {
  try {
    return await Promise.any(
      PASOMI_NODE_HOSTS.map(async (host) => {
        try {
          return await fetchPasomiCandidateNode(host);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn(`Timed out while fetching ${host} node info (${PASOMI_NODE_INFO_TIMEOUT_MS}ms)`);
          } else {
            console.warn(`Failed to fetch ${host} node info:`, error);
          }
          throw error;
        }
      })
    );
  } catch (error) {
    console.warn('No pasomi candidate node satisfied roles & 4. Continue with NodeWatch results only.', error);
    return null;
  }
};

function FinalizationProofViewer({ networkName }: { networkName: 'mainnet' | 'testnet' }) {
  const [, setHeight] = useState('0');
  const [votingNodes, setVotingNodes] = useState<Node[]>([]);
  const [votingNodesNetwork, setVotingNodesNetwork] = useState<NetworkName | null>(null);

  // URLからフィルターパラメータを取得
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get('filter');

  // urlFilterはホスト名に使用される文字のみを許可
  if (urlFilter && !/^[a-zA-Z0-9.-]*$/.test(urlFilter)) {
    return (
      <Box sx={{ margin: '0 auto', maxWidth: 1024, width: '100%' }}>
        <Box sx={{ m: 1, color: 'red' }}>
          Error: Invalid filter parameter. Only alphanumeric characters, dots, and hyphens are allowed.
        </Box>
      </Box>
    );
  }

  /**
   * Voting Nodes情報取得
   */
  useEffect(() => {
    let isActive = true;

    const fetchVotingNodes = async () => {
      try {
        const isMainNet = networkName === 'mainnet';
        const nodes = await fetchSymbolPeerNodesFromNodeWatch(networkName);
        const votingNodes: Node[] = nodes.filter((node) => (node.roles ?? 0) & 4);

        if (!isActive) return;

        // Pasomiノードの補完は一覧表示を待たせず、取得できた時点で追加する。
        setVotingNodes(votingNodes);

        if (isMainNet) {
          const hasPasomi = votingNodes.some((node) => {
            const hostname = parseEndpointHostname(node.endpoint);
            return hostname ? PASOMI_NODE_HOSTS.includes(hostname) : false;
          });

          if (!hasPasomi) {
            void fetchPasomiMainnetNode().then((pasomiNode) => {
              if (!isActive || !pasomiNode) return;
              setVotingNodes((currentNodes) => {
                const alreadyAdded = currentNodes.some((node) => node.mainPublicKey === pasomiNode.mainPublicKey);
                return alreadyAdded ? currentNodes : [...currentNodes, pasomiNode];
              });
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch voting nodes:', error);
        if (isActive) setVotingNodes([]);
      }
    };

    setVotingNodesNetwork(networkName);
    setVotingNodes([]);
    fetchVotingNodes();

    return () => {
      isActive = false;
    };
  }, [networkName]);

  return (
    <Box sx={{ margin: '0 auto', maxWidth: 1024, width: '100%' }}>
      <Box sx={{ m: 1 }}>
        <ChainInfoCard networkName={networkName} onHeightChange={setHeight} />
      </Box>

      <Box sx={{ m: 1 }}>
        <VotingNodeList
          key={networkName}
          votingNodes={votingNodesNetwork === networkName ? votingNodes : []}
          urlFilter={urlFilter}
          networkName={networkName}
        />
      </Box>
    </Box>
  );
}

export default FinalizationProofViewer;
