import ByteArray from './ByteArray.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PublicKey, SharedKey256 } from './CryptoTypes.js';

// import crypto from 'crypto';

// ReactNative Buffer polyfill only allows Buffers to be passed to Buffer.concat
// in order to support ReactNative, all Uint8Arrays must be wrapped in Buffer when calling crypto cipher APIs
const toBufferView = input => {
	const typedByteArray = input instanceof ByteArray ? input.bytes : input;
	return new Uint8Array(typedByteArray.buffer, typedByteArray.byteOffset, typedByteArray.length);
};

// const concatArrays = (lhs, rhs) => {
// 	const result = new Uint8Array(lhs.length + rhs.length);
// 	result.set(lhs);
// 	result.set(rhs, lhs.length);
// 	return result;
// };

// region AesCbcCipher

/**
 * Performs AES CBC encryption and decryption with a given key.
 */
export class AesCbcCipher {
	/**
	 * Creates a cipher around an aes shared key.
	 * @param {SharedKey256} aesKey AES shared key.
	 */
	constructor(aesKey) {
		/**
		 * @private
		 */
		this._key = aesKey;
	}

	/**
	 * Encrypts clear text.
	 * @param {Uint8Array} clearText Clear text to encrypt.
	 * @param {Uint8Array} iv IV bytes.
	 * @returns {Promise<Uint8Array>} Cipher text.
	 */
	async encrypt(clearText, iv) {
		// const cipher = crypto.createCipheriv('aes-256-cbc', toBufferView(this._key), toBufferView(iv));

		// const cipherText = cipher.update(toBufferView(clearText));
		// const padding = cipher.final();

		// return concatArrays(cipherText, padding);

		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			toBufferView(this._key),
			{ name: 'AES-CBC' },
			false,
			['encrypt']
		);

		const cipherBuffer = await crypto.subtle.encrypt(
			{ name: 'AES-CBC', iv: toBufferView(iv) },
			cryptoKey,
			toBufferView(clearText)
		);

		return new Uint8Array(cipherBuffer);
	}

	/**
	 * Decrypts cipher text.
	 * @param {Uint8Array} cipherText Cipher text to decrypt.
	 * @param {Uint8Array} iv IV bytes.
	 * @returns {Promise<Uint8Array>} Clear text.
	 */
	async decrypt(cipherText, iv) {
		// const decipher = crypto.createDecipheriv('aes-256-cbc', toBufferView(this._key), toBufferView(iv));

		// const clearText = decipher.update(toBufferView(cipherText));
		// const padding = decipher.final();

		// return concatArrays(clearText, padding);

		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			toBufferView(this._key),
			{ name: 'AES-CBC' },
			false,
			['decrypt']
		);

		const clearBuffer = await crypto.subtle.decrypt(
			{ name: 'AES-CBC', iv: toBufferView(iv) },
			cryptoKey,
			toBufferView(cipherText)
		);

		return new Uint8Array(clearBuffer);
	}
}

// endregion

// region AesGcmCipher

/**
 * Performs AES GCM encryption and decryption with a given key.
 */
export class AesGcmCipher {
	/**
	 * Byte size of GCM tag.
	 * @type {number}
	 */
	static TAG_SIZE = 16;

	/**
	 * Creates a cipher around an aes shared key.
	 * @param {SharedKey256} aesKey AES shared key.
	 */
	constructor(aesKey) {
		/**
		 * @private
		 */
		this._key = aesKey;
	}

	/**
	 * Encrypts clear text and appends tag to encrypted payload.
	 * @param {Uint8Array} clearText Clear text to encrypt.
	 * @param {Uint8Array} iv IV bytes.
	 * @returns {Promise<Uint8Array>} Cipher text with appended tag.
	 */
	async encrypt(clearText, iv) {
		// const cipher = crypto.createCipheriv('aes-256-gcm', toBufferView(this._key), toBufferView(iv));

		// const cipherText = cipher.update(toBufferView(clearText));
		// cipher.final(); // no padding for GCM

		// const tag = cipher.getAuthTag();

		// return concatArrays(cipherText, tag);

		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			toBufferView(this._key),
			{ name: 'AES-GCM' },
			false,
			['encrypt']
		);

		const cipherBuffer = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: toBufferView(iv), tagLength: 128 },
			cryptoKey,
			toBufferView(clearText)
		);

		return new Uint8Array(cipherBuffer);
	}

	/**
	 * Decrypts cipher text with appended tag.
	 * @param {Uint8Array} cipherText Cipher text with appended tag to decrypt.
	 * @param {Uint8Array} iv IV bytes.
	 * @returns {Promise<Uint8Array>} Clear text.
	 */
	async decrypt(cipherText, iv) {
		// const decipher = crypto.createDecipheriv('aes-256-gcm', toBufferView(this._key), toBufferView(iv));

		// const tagStartOffset = cipherText.length - AesGcmCipher.TAG_SIZE;
		// decipher.setAuthTag(Buffer.from(cipherText.buffer, tagStartOffset));

		// const clearText = decipher.update(Buffer.from(cipherText.buffer, 0, tagStartOffset));
		// decipher.final(); // no padding for GCM
		// return clearText;

		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			toBufferView(this._key),
			{ name: 'AES-GCM' },
			false,
			['decrypt']
		);

		const clearBuffer = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: toBufferView(iv), tagLength: 128 },
			cryptoKey,
			toBufferView(cipherText)
		);

		return new Uint8Array(clearBuffer);
	}
}

// endregion
