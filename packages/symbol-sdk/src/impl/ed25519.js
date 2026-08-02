// this file contains implementation details and is not intended to be used directly

import ed25519_js from './ed25519_js.js';
// import ed25519_wasm from './ed25519_wasm.js';

let ed25519;
export default {
	get: () => {
		if (!ed25519)
			// ed25519 = globalThis.WebAssembly && !process.env.SYMBOL_SDK_NO_WASM ? ed25519_wasm : ed25519_js;		
			ed25519 = ed25519_js;

		return ed25519;
	},
	unload: () => {
		ed25519 = undefined;
	}
};
