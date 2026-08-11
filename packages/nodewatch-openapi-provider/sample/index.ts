import { createSymbolNodeWatchApi } from '../src/index.js';

const symbolNodeWatchApi = createSymbolNodeWatchApi('mainnet');
symbolNodeWatchApi.getSymbolPeerNodes().then((response) => {
  console.log(response);
});
