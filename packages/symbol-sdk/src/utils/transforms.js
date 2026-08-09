import { keccak_256 } from '@noble/hashes/sha3.js';
// import Ripemd160 from 'ripemd160';
import { ripemd160 } from '@noble/hashes/legacy.js';

/**
 * Hashes payload with keccak 256 and then hashes the result with ripemd160.
 * @param {Uint8Array} payload Input buffer to hash.
 * @returns {Uint8Array} Hash result.
 */
const ripemdKeccak256 = payload => {
	const partOneHash = keccak_256.create().update(payload).digest();
	// return new Uint8Array(new Ripemd160().update(Buffer.from(partOneHash)).digest());
	return new Uint8Array(ripemd160(partOneHash));
};

export { ripemdKeccak256 }; 