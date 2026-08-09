import { KeyPair } from './KeyPair.js';
import { deriveSharedKey } from './SharedKey.js';
import { PrivateKey, PublicKey } from '../CryptoTypes.js';
import { concatArrays, decodeAesGcm, encodeAesGcm } from '../impl/CipherHelpers.js';
import { deepCompare } from '../utils/arrayHelpers.js';
import { hexToUint8, isHexString, uint8ToHex } from '../utils/converter.js';

// const DELEGATION_MARKER = Uint8Array.from(Buffer.from('FE2A8061577301E2', 'hex'));
const DELEGATION_MARKER = Uint8Array.from(hexToUint8('FE2A8061577301E2'));

const filterExceptions = async (statement, exceptions) => {
	try {
		const message = await statement();
		return [true, message];
	} catch (exception) {
		// if (!exceptions.some(exceptionMessage => exception.message.includes(exceptionMessage)))
		const exceptionMessage = exception.message || exception.toString();
		if (!exceptions.some(msg => exceptionMessage.includes(msg)))
			throw exception;
	}

	return [false, undefined];
};

/**
 * Encrypts and encodes messages between two parties.
 */
export default class MessageEncoder {
	/**
	 * Creates message encoder around key pair.
	 * @param {KeyPair} keyPair Key pair.
	 */
	constructor(keyPair) {
		/**
		 * @private
		 */
		this._keyPair = keyPair;
	}

	/**
	 * Public key used for message encoding.
	 * @returns {PublicKey} Public key used for message encoding.
	 */
	get publicKey() {
		return this._keyPair.publicKey;
	}

	/**
	 * Tries to decode encoded message.
	 * @param {PublicKey} recipientPublicKey Recipient's public key.
	 * @param {Uint8Array} encodedMessage Encoded message.
	 * @returns {Promise<TryDecodeResult>} Tuple containing decoded status and message.
	 */
	async tryDecode(recipientPublicKey, encodedMessage) {
		if (1 === encodedMessage[0]) {
			const [result, message] = await filterExceptions(
				() => decodeAesGcm(deriveSharedKey, this._keyPair, recipientPublicKey, encodedMessage.subarray(1)),
				['Unsupported state or unable to authenticate data', 'The provided data is too small', 'operation failed']
			);
			if (result)
				return { isDecoded: true, message };
		}

		if (0xFE === encodedMessage[0] && 0 === deepCompare(DELEGATION_MARKER, encodedMessage.slice(0, 8))) {
			const ephemeralPublicKeyStart = DELEGATION_MARKER.length;
			const ephemeralPublicKeyEnd = ephemeralPublicKeyStart + PublicKey.SIZE;
			const ephemeralPublicKey = new PublicKey(encodedMessage.subarray(ephemeralPublicKeyStart, ephemeralPublicKeyEnd));

			const [result, message] = await filterExceptions(
				() => decodeAesGcm(deriveSharedKey, this._keyPair, ephemeralPublicKey, encodedMessage.subarray(ephemeralPublicKeyEnd)),
				[
					'Unsupported state or unable to authenticate data',
					'invalid point',
					'The provided data is too small',
					'operation failed'
				]
			);
			if (result)
				return { isDecoded: true, message };
		}

		return { isDecoded: false, message: encodedMessage };
	}

	/**
	 * Encodes message to recipient using recommended format.
	 * @param {PublicKey} recipientPublicKey Recipient public key.
	 * @param {Uint8Array} message Message to encode.
	 * @returns {Promise<Uint8Array>} Encrypted and encoded message.
	 */
	async encode(recipientPublicKey, message) {
		const { tag, initializationVector, cipherText } = await encodeAesGcm(deriveSharedKey, this._keyPair, recipientPublicKey, message);

		return concatArrays(new Uint8Array([1]), tag, initializationVector, cipherText);
	}

	/**
	 * Encodes persistent harvesting delegation to node.
	 * @param {PublicKey} nodePublicKey Node public key.
	 * @param {KeyPair} remoteKeyPair Remote key pair.
	 * @param {KeyPair} vrfKeyPair Vrf key pair.
	 * @returns {Promise<Uint8Array>} Encrypted and encoded harvesting delegation request.
	 */
	 
	async encodePersistentHarvestingDelegation(nodePublicKey, remoteKeyPair, vrfKeyPair) {
		const ephemeralKeyPair = new KeyPair(PrivateKey.random());
		const message = concatArrays(remoteKeyPair.privateKey.bytes, vrfKeyPair.privateKey.bytes);
		const { tag, initializationVector, cipherText } = await encodeAesGcm(deriveSharedKey, ephemeralKeyPair, nodePublicKey, message);

		return concatArrays(DELEGATION_MARKER, ephemeralKeyPair.publicKey.bytes, tag, initializationVector, cipherText);
	}

	/**
	 * Tries to decode encoded message.
	 * @deprecated This function is only provided for compatability with the original Symbol wallets.
	 *             Please use `tryDecode` in any new code.
	 * @param {PublicKey} recipientPublicKey Recipient's public key.
	 * @param {Uint8Array} encodedMessage Encoded message
	 * @returns {Promise<TryDecodeResult>} Tuple containing decoded status and message.
	 */
	async tryDecodeDeprecated(recipientPublicKey, encodedMessage) {
		const encodedHexString = new TextDecoder().decode(encodedMessage.subarray(1));
		if (1 === encodedMessage[0] && isHexString(encodedHexString)) {
			// wallet additionally hex encodes
			return this.tryDecode(recipientPublicKey, new Uint8Array([1, ...hexToUint8(encodedHexString)]));
		}

		return this.tryDecode(recipientPublicKey, encodedMessage);
	}

	/**
	 * Encodes message to recipient using (deprecated) wallet format.
	 * @deprecated This function is only provided for compatability with the original Symbol wallets.
	 *             Please use `encode` in any new code.
	 * @param {PublicKey} recipientPublicKey Recipient public key.
	 * @param {Uint8Array} message Message to encode.
	 * @returns {Promise<Uint8Array>} Encrypted and encoded message.
	 */
	async encodeDeprecated(recipientPublicKey, message) {
		// wallet additionally hex encodes
		const encodedHexString = uint8ToHex((await this.encode(recipientPublicKey, message)).subarray(1));
		const encodedHexStringBytes = new TextEncoder().encode(encodedHexString);
		return new Uint8Array([1, ...encodedHexStringBytes]);
	}
}

// region type declarations

/**
 * Result of a try decode operation.
 * @class
 * @typedef {object} TryDecodeResult
 * @property {boolean} isDecoded \c true if message has been decoded and decrypted; \c false otherwise.
 * @property {Uint8Array} message Decoded message when `isDecoded` is \c true; encoded message otherwise.
 */

// endregion
