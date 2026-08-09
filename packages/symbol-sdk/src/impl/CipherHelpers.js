// this file contains implementation details and is not intended to be used directly

import { AesCbcCipher, AesGcmCipher } from '../Cipher.js';
// import crypto from 'crypto';
import { randomBytes } from '@noble/hashes/utils.js';

const GCM_IV_SIZE = 12;
const CBC_IV_SIZE = 16;
const SALT_SIZE = 32;

const concatArrays = (...arrays) => {
	const totalLength = arrays.map(buffer => buffer.length).reduce((accumulator, currentValue) => accumulator + currentValue);
	const result = new Uint8Array(totalLength);
	let targetOffset = 0;
	arrays.forEach(buffer => {
		result.set(buffer, targetOffset);
		targetOffset += buffer.length;
	});
	return result;
};

const decode = (tagSize, ivSize, encodedMessage) => ({
	tag: encodedMessage.subarray(0, tagSize),
	initializationVector: encodedMessage.subarray(tagSize, tagSize + ivSize),
	encodedMessageData: encodedMessage.subarray(tagSize + ivSize)
});

const decodeAesGcm = async (deriveSharedKey, keyPair, recipientPublicKey, encodedMessage) => {
	const { tag, initializationVector, encodedMessageData } = decode(AesGcmCipher.TAG_SIZE, GCM_IV_SIZE, encodedMessage);

	const sharedKey = deriveSharedKey(keyPair, recipientPublicKey);
	const cipher = new AesGcmCipher(sharedKey);

	return new Uint8Array(await cipher.decrypt(concatArrays(encodedMessageData, tag), initializationVector));
};

const decodeAesCbc = async (deriveSharedKey, keyPair, recipientPublicKey, encodedMessage) => {
	const { tag, initializationVector, encodedMessageData } = decode(SALT_SIZE, CBC_IV_SIZE, encodedMessage);

	const sharedKey = deriveSharedKey(keyPair, recipientPublicKey, tag);
	const cipher = new AesCbcCipher(sharedKey);

	return new Uint8Array(await cipher.decrypt(encodedMessageData, initializationVector));
};

const encodeAesGcm = async (deriveSharedKey, keyPair, recipientPublicKey, message) => {
	const sharedKey = deriveSharedKey(keyPair, recipientPublicKey);
	const cipher = new AesGcmCipher(sharedKey);

	const initializationVector = new Uint8Array(randomBytes(GCM_IV_SIZE));
	const cipherText = await cipher.encrypt(message, initializationVector);
	const tagStartOffset = cipherText.length - AesGcmCipher.TAG_SIZE;
	const tag = cipherText.subarray(tagStartOffset);

	return { tag, initializationVector, cipherText: cipherText.subarray(0, tagStartOffset) };
};

const encodeAesCbc = async (deriveSharedKey, keyPair, recipientPublicKey, message) => {
	// const salt = new Uint8Array(crypto.randomBytes(SALT_SIZE));
	const salt = new Uint8Array(randomBytes(SALT_SIZE));
	const sharedKey = deriveSharedKey(keyPair, recipientPublicKey, salt);
	const cipher = new AesCbcCipher(sharedKey);

	// const initializationVector = new Uint8Array(crypto.randomBytes(CBC_IV_SIZE));
	const initializationVector = new Uint8Array(randomBytes(CBC_IV_SIZE));
	const cipherText = await cipher.encrypt(message, initializationVector);

	return { salt, initializationVector, cipherText };
};

export {
	concatArrays,
	decodeAesGcm,
	decodeAesCbc,
	encodeAesGcm,
	encodeAesCbc
};
