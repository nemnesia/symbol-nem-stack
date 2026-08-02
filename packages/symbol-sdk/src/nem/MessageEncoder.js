// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { KeyPair } from './KeyPair.js';
import { deriveSharedKey, deriveSharedKeyDeprecated } from './SharedKey.js';
import { Message, MessageType } from './models.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PublicKey } from '../CryptoTypes.js';
import {
	concatArrays, decodeAesCbc, decodeAesGcm, encodeAesCbc, encodeAesGcm
} from '../impl/CipherHelpers.js';

const filterExceptions = async (statement, exceptions) => {
	try {
		const message = await statement();
		return [true, message];
	} catch (exception) {
		if (!exceptions.some(exceptionMessage => exception.message.includes(exceptionMessage)))
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
	 * @param {PublicKey} recipientPublicKey Recipient public key.
	 * @param {Message} encodedMessage Encoded message.
	 * @returns {Promise<TryDecodeResult>} Tuple containing decoded status and message.
	 */
	async tryDecode(recipientPublicKey, encodedMessage) {
		// if (MessageType.ENCRYPTED !== encodedMessage.messageType)
		if (MessageType.ENCRYPTED.value !== encodedMessage.messageType.value)
		// models.Messageのデシリアライズを使ってる場合、`.value`がないと不一致になるので`.value`を追記
			throw new Error('invalid message format');

		let [result, message] = await filterExceptions(
			async () => await decodeAesGcm(deriveSharedKey, this._keyPair, recipientPublicKey, encodedMessage.message),
			['Unsupported state or unable to authenticate data']
		);
		if (result)
			return { isDecoded: true, message };

		[result, message] = await filterExceptions(
			async () => await decodeAesCbc(deriveSharedKeyDeprecated, this._keyPair, recipientPublicKey, encodedMessage.message),
			[
				'bad decrypt',
				'wrong final block length',
				'Invalid initialization vector'
			]
		);
		if (result)
			return { isDecoded: true, message };

		return { isDecoded: false, message: encodedMessage };
	}

	/**
	 * Encodes message to recipient using recommended format.
	 * @param {PublicKey} recipientPublicKey Recipient public key.
	 * @param {Uint8Array} message Message to encode.
	 * @returns {Promise<Message>} Encrypted and encoded message.
	 */
	async encode(recipientPublicKey, message) {
		const { tag, initializationVector, cipherText } = await encodeAesGcm(deriveSharedKey, this._keyPair, recipientPublicKey, message);

		const encodedMessage = new Message();
		encodedMessage.messageType = MessageType.ENCRYPTED;
		encodedMessage.message = concatArrays(tag, initializationVector, cipherText);
		return encodedMessage;
	}

	/**
	 * Encodes message to recipient using recommended format.
	 * @deprecated This function is only provided for compatability with older NEM messages.
	 *             Please use `encode` in any new code.
	 * @param {PublicKey} recipientPublicKey Recipient public key.
	 * @param {Uint8Array} message Message to encode.
	 * @returns {Promise<Message>} Encrypted and encoded message.
	 */
	async encodeDeprecated(recipientPublicKey, message) {
		const encoded = await encodeAesCbc(deriveSharedKeyDeprecated, this._keyPair, recipientPublicKey, message);

		const encodedMessage = new Message();
		encodedMessage.messageType = MessageType.ENCRYPTED;
		encodedMessage.message = concatArrays(encoded.salt, encoded.initializationVector, encoded.cipherText);
		return encodedMessage;
	}
}

// region type declarations

/**
 * Result of a try decode operation.
 * @class
 * @typedef {object} TryDecodeResult
 * @property {boolean} isDecoded \c true if message has been decoded and decrypted; \c false otherwise.
 * @property {Uint8Array|Message} message Decoded message when `isDecoded` is \c true; encoded message otherwise.
 */

// endregion
