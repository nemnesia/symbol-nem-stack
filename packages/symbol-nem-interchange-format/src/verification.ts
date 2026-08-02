import { Signature } from '@nemnesia/symbol-sdk';
import { NemFacade, TransactionFactory as NemTransactionFactory } from '@nemnesia/symbol-sdk/nem';
import { SymbolFacade, SymbolTransactionFactory } from '@nemnesia/symbol-sdk/symbol';
import { sha3_256 } from '@noble/hashes/sha3.js';

import { SnifError } from './errors.js';
import { equalBytes } from './internal/bytes.js';
import { encodeCanonical } from './internal/cbor.js';
import { facadeFor, validateChainSemantics, verifyRawSignature } from './internal/chain.js';
import { isRecord, validateDocument } from './internal/validation.js';
import type {
  AudienceVerification,
  RequestDocument,
  RequestVerificationResult,
  ResponseDocument,
  ResponseVerificationResult,
  SignedTransactionDocument,
  StandaloneTransactionVerificationResult,
  VerifyRequestOptions,
  VerifyResponseOptions,
} from './types.js';

const hashDocument = (document: { type: string; chain: string; network: unknown; payload: unknown }): Uint8Array =>
  sha3_256(
    encodeCanonical(
      { type: document.type, chain: document.chain, network: document.network, payload: document.payload },
      'verification-failed'
    )
  );

const validatedDocument = <T extends RequestDocument | ResponseDocument | SignedTransactionDocument>(input: T): T => {
  const document = validateDocument(input) as T;
  validateChainSemantics(document);
  return document;
};

const requestContext = (request: RequestDocument): Record<string, unknown> => {
  const context = request.payload.context;
  if (!isRecord(context)) throw new SnifError('invalid-context');
  return context;
};

const verifyTime = (context: Record<string, unknown>, now: number): void => {
  if (!Number.isSafeInteger(now)) throw new SnifError('invalid-context');
  if ((context.createdAt as number) > now + 300) throw new SnifError('invalid-context');
  if ((context.expiresAt as number) <= now) throw new SnifError('expired-request');
};

const audienceResult = (request: RequestDocument, options: VerifyRequestOptions): AudienceVerification => {
  const context = requestContext(request);
  const audience = context.audience as string;
  const proof = request.payload.connection;
  if (proof !== undefined) {
    const record = options.connection;
    if (!record || 'active' !== record.state || record.sessionExpiresAt <= options.now)
      throw new SnifError('authorization-failed');
    if (
      record.chain !== request.chain ||
      !equalBytes(
        encodeCanonical(record.network, 'authorization-failed'),
        encodeCanonical(request.network, 'authorization-failed')
      ) ||
      record.application.origin !== audience
    )
      throw new SnifError('authorization-failed');
    if (options.trustedAudience !== undefined && options.trustedAudience !== audience)
      throw new SnifError('invalid-context');
    if (!isRecord(proof)) throw new SnifError('authorization-failed');
    if (
      !equalBytes(proof.sessionId as Uint8Array, record.sessionId) ||
      !equalBytes(proof.requesterPublicKey as Uint8Array, record.requesterPublicKey)
    )
      throw new SnifError('authorization-failed');
    const requiredPermission = 'sign-request' === request.type ? 'sign-transaction' : 'sign-message';
    if (!record.permissions.includes(requiredPermission)) throw new SnifError('authorization-failed');
    const unsignedConnection = { ...proof };
    delete unsignedConnection.signature;
    const authorizationHash = hashDocument({
      ...request,
      payload: { ...request.payload, connection: unsignedConnection },
    });
    const frame = encodeCanonical(
      {
        domain: 'SNIF-CONNECTED-REQUEST-V1',
        type: request.type,
        chain: request.chain,
        network: request.network,
        sessionId: record.sessionId,
        authorizationHash,
      },
      'authorization-failed'
    );
    if (!verifyRawSignature(request, record.requesterPublicKey, frame, proof.signature as Uint8Array))
      throw new SnifError('authorization-failed');
    return options.trustedAudience
      ? { status: 'verified', evidence: 'trusted-audience-and-connection' }
      : { status: 'verified', evidence: 'connection' };
  }
  if (options.connection) throw new SnifError('authorization-failed');
  if (options.trustedAudience !== undefined) {
    try {
      new URL(options.trustedAudience);
    } catch {
      throw new SnifError('invalid-context');
    }
    if (options.trustedAudience !== audience) throw new SnifError('invalid-context');
    return { status: 'verified', evidence: 'trusted-audience' };
  }
  return { status: 'unverified', evidence: 'self-asserted' };
};

export const verifyRequest = async <T extends RequestDocument>(
  input: T,
  options: VerifyRequestOptions
): Promise<RequestVerificationResult<T>> => {
  const request = validatedDocument(input);
  if (!['sign-request', 'message-sign-request', 'connection-request'].includes(request.type))
    throw new SnifError('verification-failed');
  verifyTime(requestContext(request), options.now);
  if ('connection-request' === request.type) {
    const frame = encodeCanonical(
      {
        domain: 'SNIF-CONNECTION-REQUEST-V1',
        chain: request.chain,
        network: request.network,
        application: request.payload.application,
        permissions: request.payload.permissions,
        challenge: request.payload.challenge,
        context: request.payload.context,
        requesterPublicKey: request.payload.requesterPublicKey,
      },
      'verification-failed'
    );
    if (
      !verifyRawSignature(
        request,
        request.payload.requesterPublicKey as Uint8Array,
        frame,
        request.payload.signature as Uint8Array
      )
    )
      throw new SnifError('verification-failed');
  }
  return { document: request, requestHash: hashDocument(request), audience: audienceResult(request, options) };
};

const bytesAt = (payload: Record<string, unknown>, name: string): Uint8Array => payload[name] as Uint8Array;
const isRejected = (response: ResponseDocument): boolean =>
  ('signature' === response.type && 'rejected' === response.payload.signatureType) ||
  ('connection-response' === response.type && false === response.payload.approved);

const compatible = (response: ResponseDocument, request: RequestDocument): boolean => {
  if ('connection-request' === request.type) return 'connection-response' === response.type;
  if ('message-sign-request' === request.type)
    return 'signature' === response.type && ['message', 'rejected'].includes(response.payload.signatureType as string);
  if ('signed-transaction' === response.type) return response.payload.requestId !== undefined;
  if ('signature' !== response.type) return false;
  if ('rejected' === response.payload.signatureType) return true;
  if ('transaction' === request.payload.signingType) return 'transaction' === response.payload.signatureType;
  return 'cosignature' === response.payload.signatureType;
};

const verifyMessageResponse = (response: ResponseDocument, request: RequestDocument): void => {
  const frame = encodeCanonical(
    {
      domain: 'SNIF-MESSAGE-V1',
      chain: request.chain,
      network: request.network,
      context: request.payload.context,
      purpose: request.payload.purpose,
      message: request.payload.message,
      ...(request.payload.connection === undefined ? {} : { connection: request.payload.connection }),
    },
    'verification-failed'
  );
  const targetHash = sha3_256(frame);
  const signer = response.payload.signerPublicKey as Uint8Array;
  if (!equalBytes(targetHash, response.payload.targetHash as Uint8Array)) throw new SnifError('verification-failed');
  if (
    request.payload.expectedSignerPublicKey instanceof Uint8Array &&
    !equalBytes(request.payload.expectedSignerPublicKey, signer)
  )
    throw new SnifError('verification-failed');
  if (!verifyRawSignature(request, signer, frame, response.payload.signature as Uint8Array))
    throw new SnifError('verification-failed');
};

const verifyConnectionResponse = (response: ResponseDocument, request: RequestDocument, now: number): void => {
  if (true !== response.payload.approved) return;
  const created = response.payload.sessionCreatedAt as number;
  const expires = response.payload.sessionExpiresAt as number;
  if (created > now + 300 || expires <= now) throw new SnifError('verification-failed');
  const requested = request.payload.permissions as string[];
  const granted = response.payload.permissions as string[];
  if (granted.some((permission) => !requested.includes(permission))) throw new SnifError('verification-failed');
  const account = response.payload.account as Record<string, unknown>;
  const frame = encodeCanonical(
    {
      domain: 'SNIF-CONNECTION-RESPONSE-V1',
      chain: request.chain,
      network: request.network,
      requestHash: hashDocument(request),
      challenge: request.payload.challenge,
      sessionId: response.payload.sessionId,
      sessionCreatedAt: created,
      sessionExpiresAt: expires,
      account,
      permissions: granted,
    },
    'verification-failed'
  );
  if (!verifyRawSignature(response, account.publicKey as Uint8Array, frame, response.payload.signature as Uint8Array))
    throw new SnifError('verification-failed');
};

const verifyExpectedSigner = (request: RequestDocument, signer: Uint8Array): void => {
  if (
    request.payload.expectedSignerPublicKey instanceof Uint8Array &&
    !equalBytes(request.payload.expectedSignerPublicKey, signer)
  )
    throw new SnifError('verification-failed');
};

const verifyTransactionResponse = (response: ResponseDocument, request: RequestDocument): void => {
  try {
    if ('symbol' === request.chain) {
      const facade = facadeFor(request) as SymbolFacade;
      const original = SymbolTransactionFactory.deserialize(request.payload.transactionPayload as Uint8Array);
      const signingPayload = facade.extractSigningPayload(original);
      if ('signature' === response.type) {
        const signer = response.payload.signerPublicKey as Uint8Array;
        verifyExpectedSigner(request, signer);
        if (
          !equalBytes(sha3_256(signingPayload), response.payload.targetHash as Uint8Array) ||
          !verifyRawSignature(request, signer, signingPayload, response.payload.signature as Uint8Array)
        )
          throw new SnifError('verification-failed');
      } else {
        const signed = SymbolTransactionFactory.deserialize(response.payload.transactionPayload as Uint8Array);
        if (!equalBytes(signingPayload, facade.extractSigningPayload(signed)))
          throw new SnifError('verification-failed');
        verifyExpectedSigner(request, signed.signerPublicKey.bytes);
        if (!facade.verifyTransaction(signed, new Signature(signed.signature.bytes)))
          throw new SnifError('verification-failed');
      }
      return;
    }
    const facade = facadeFor(request) as NemFacade;
    const original = NemTransactionFactory.deserialize(request.payload.transactionPayload as Uint8Array);
    const signingPayload = facade.extractSigningPayload(original);
    if ('signature' === response.type) {
      const signer = response.payload.signerPublicKey as Uint8Array;
      verifyExpectedSigner(request, signer);
      if (
        !equalBytes(sha3_256(signingPayload), response.payload.targetHash as Uint8Array) ||
        !verifyRawSignature(request, signer, signingPayload, response.payload.signature as Uint8Array)
      )
        throw new SnifError('verification-failed');
    } else {
      const signed = NemTransactionFactory.deserialize(response.payload.transactionPayload as Uint8Array);
      if (!equalBytes(signingPayload, facade.extractSigningPayload(signed))) throw new SnifError('verification-failed');
      verifyExpectedSigner(request, signed.signerPublicKey.bytes);
      if (!facade.verifyTransaction(signed, new Signature(signed.signature.bytes)))
        throw new SnifError('verification-failed');
    }
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('verification-failed');
  }
};

const verifyCosignatureResponse = (response: ResponseDocument, request: RequestDocument): void => {
  try {
    if ('symbol' === request.chain) {
      if ('signature' !== response.type) throw new SnifError('verification-failed');
      const transaction = SymbolTransactionFactory.deserialize(request.payload.transactionPayload as Uint8Array);
      const parentHash = (facadeFor(request) as SymbolFacade).hashTransaction(transaction).bytes;
      const signer = response.payload.signerPublicKey as Uint8Array;
      verifyExpectedSigner(request, signer);
      if (
        !equalBytes(parentHash, response.payload.parentHash as Uint8Array) ||
        !verifyRawSignature(request, signer, parentHash, response.payload.signature as Uint8Array)
      )
        throw new SnifError('verification-failed');
      return;
    }
    if ('signature' !== response.type) throw new SnifError('verification-failed');
    const facade = facadeFor(request) as NemFacade;
    const original = NemTransactionFactory.deserialize(request.payload.transactionPayload as Uint8Array);
    const signed = NemTransactionFactory.deserialize(response.payload.transactionPayload as Uint8Array);
    if (!equalBytes(facade.extractSigningPayload(original), facade.extractSigningPayload(signed)))
      throw new SnifError('verification-failed');
    verifyExpectedSigner(request, signed.signerPublicKey.bytes);
    if (!facade.verifyTransaction(signed, new Signature(signed.signature.bytes)))
      throw new SnifError('verification-failed');
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('verification-failed');
  }
};

export const verifyResponse = async <T extends ResponseDocument>(
  input: T,
  originalInput: RequestDocument,
  options: VerifyResponseOptions
): Promise<ResponseVerificationResult<T>> => {
  const response = validatedDocument(input);
  const request = validatedDocument(originalInput);
  if (
    response.chain !== request.chain ||
    !equalBytes(
      encodeCanonical(response.network, 'verification-failed'),
      encodeCanonical(request.network, 'verification-failed')
    ) ||
    !compatible(response, request)
  )
    throw new SnifError('verification-failed');
  const requestId = bytesAt(requestContext(request), 'requestId');
  const responseRequestId = bytesAt(response.payload, 'requestId');
  if (!responseRequestId || !equalBytes(requestId, responseRequestId)) throw new SnifError('verification-failed');
  if (isRejected(response) && !options.authenticatedRejection) throw new SnifError('unauthenticated-rejection');
  if (!isRejected(response)) {
    if ('message-sign-request' === request.type) verifyMessageResponse(response, request);
    else if ('connection-request' === request.type) verifyConnectionResponse(response, request, options.now);
    else if ('transaction' === request.payload.signingType) verifyTransactionResponse(response, request);
    else verifyCosignatureResponse(response, request);
  }
  return {
    document: response,
    responseHash: hashDocument(response),
    audience: { status: 'not-applicable', evidence: 'no-audience' },
  };
};

const verifySerializedTransaction = (document: SignedTransactionDocument): void => {
  const payload = document.payload.transactionPayload as Uint8Array;
  try {
    if ('symbol' === document.chain) {
      const transaction = SymbolTransactionFactory.deserialize(payload);
      if (
        !equalBytes(transaction.serialize(), payload) ||
        !(facadeFor(document) as SymbolFacade).verifyTransaction(
          transaction,
          new Signature(transaction.signature.bytes)
        )
      )
        throw new SnifError('verification-failed');
    } else {
      const transaction = NemTransactionFactory.deserialize(payload);
      if (
        !equalBytes(transaction.serialize(), payload) ||
        !(facadeFor(document) as NemFacade).verifyTransaction(transaction, new Signature(transaction.signature.bytes))
      )
        throw new SnifError('verification-failed');
    }
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('verification-failed');
  }
};

export const verifySignedTransaction = async (
  input: SignedTransactionDocument
): Promise<StandaloneTransactionVerificationResult> => {
  const document = validatedDocument(input);
  if ('signed-transaction' !== document.type || document.payload.requestId !== undefined)
    throw new SnifError('verification-failed');
  verifySerializedTransaction(document);
  return {
    document,
    documentHash: hashDocument(document),
    audience: { status: 'not-applicable', evidence: 'no-audience' },
  };
};
