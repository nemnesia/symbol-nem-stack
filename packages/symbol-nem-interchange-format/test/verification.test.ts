import { Hash256, PrivateKey } from '@nemnesia/symbol-sdk';
import { Network, SymbolFacade, SymbolTransactionFactory, descriptors, models } from '@nemnesia/symbol-sdk/symbol';
import { describe, expect, it } from 'vitest';

import { type RequestDocument, type ResponseDocument, verifyRequest, verifyResponse } from '../src/index.js';

const requestId = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
const request: RequestDocument = {
  type: 'message-sign-request',
  chain: 'nem',
  network: { id: 0x68 },
  payload: {
    message: new Uint8Array(),
    purpose: 'authentication',
    context: { requestId, createdAt: 100, expiresAt: 200, audience: 'https://example.com' },
  },
};

const symbolGenerationHashSeed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const createSymbolAggregatePair = (kind: 'complete' | 'bonded') => {
  const facade = new SymbolFacade(new Network('snif', 0x98, new Date(0), new Hash256(symbolGenerationHashSeed)));
  const signer = facade.createAccount(new PrivateKey(new Uint8Array(32).fill(1)));
  const cosigner = facade.createAccount(new PrivateKey(new Uint8Array(32).fill(2)));
  const embedded = facade.createEmbeddedTransactionFromTypedDescriptor(
    {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: cosigner.address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    },
    signer.publicKey
  );
  const cosignature = new models.Cosignature();
  cosignature.signerPublicKey = new models.PublicKey(cosigner.publicKey.bytes);
  cosignature.signature = new models.Signature(new Uint8Array(64).fill(3));
  const Descriptor =
    'complete' === kind
      ? descriptors.AggregateCompleteTransactionV3Descriptor
      : descriptors.AggregateBondedTransactionV3Descriptor;
  const original = facade.createTransactionFromTypedDescriptor(
    new Descriptor(SymbolFacade.hashEmbeddedTransactions([embedded]), [embedded], [cosignature]),
    signer.publicKey,
    100,
    60
  );
  const signed = SymbolTransactionFactory.deserialize(original.serialize());
  signed.signature = new models.Signature(signer.signTransaction(signed).bytes);
  return { original, signed };
};

describe('verification boundary', () => {
  it('marks a matching trusted audience as verified', async () => {
    const result = await verifyRequest(request, { now: 150, trustedAudience: 'https://example.com' });
    expect(result.requestHash).toHaveLength(32);
    expect(result.audience).toEqual({ status: 'verified', evidence: 'trusted-audience' });
  });

  it('marks a self-asserted audience as unverified', async () => {
    const result = await verifyRequest(request, { now: 150 });
    expect(result.audience).toEqual({ status: 'unverified', evidence: 'self-asserted' });
  });

  it('rejects expired requests', async () => {
    await expect(verifyRequest(request, { now: 200 })).rejects.toMatchObject({
      code: 'expired-request',
    });
  });

  it('accepts a rejection only over an authenticated transport', async () => {
    const response: ResponseDocument = {
      type: 'signature',
      chain: 'nem',
      network: { id: 0x68 },
      payload: { signatureType: 'rejected', requestId },
    };
    await expect(verifyResponse(response, request, { now: 150 })).rejects.toMatchObject({
      code: 'unauthenticated-rejection',
    });
    await expect(verifyResponse(response, request, { now: 150, authenticatedRejection: true })).resolves.toMatchObject({
      audience: { status: 'not-applicable', evidence: 'no-audience' },
    });
  });

  it.each([
    {
      name: 'transaction signing',
      request: {
        type: 'sign-request',
        chain: 'nem',
        network: { id: 0x68 },
        payload: {
          transactionPayload: Uint8Array.of(1),
          signingType: 'transaction',
          context: { requestId, createdAt: 100, expiresAt: 200, audience: 'https://example.com' },
        },
      } as RequestDocument,
      response: {
        type: 'signature',
        chain: 'nem',
        network: { id: 0x68 },
        payload: { signatureType: 'rejected', requestId },
      } as ResponseDocument,
    },
    {
      name: 'message signing',
      request,
      response: {
        type: 'signature',
        chain: 'nem',
        network: { id: 0x68 },
        payload: { signatureType: 'rejected', requestId },
      } as ResponseDocument,
    },
    {
      name: 'connection approval',
      request: {
        type: 'connection-request',
        chain: 'nem',
        network: { id: 0x68 },
        payload: {
          application: { name: 'Example', origin: 'https://example.com' },
          permissions: ['account'],
          challenge: new Uint8Array(32).fill(1),
          context: { requestId, createdAt: 100, expiresAt: 200, audience: 'https://example.com' },
          requesterPublicKey: new Uint8Array(32).fill(1),
          signature: new Uint8Array(64).fill(1),
        },
      } as RequestDocument,
      response: {
        type: 'connection-response',
        chain: 'nem',
        network: { id: 0x68 },
        payload: { approved: false, requestId },
      } as ResponseDocument,
    },
  ])('rejects expired $name responses', async ({ request: original, response }) => {
    await expect(verifyResponse(response, original, { now: 200, authenticatedRejection: true })).rejects.toMatchObject({
      code: 'expired-request',
    });
    await expect(verifyResponse(response, original, { now: 201, authenticatedRejection: true })).rejects.toMatchObject({
      code: 'expired-request',
    });
  });

  it.each([Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid response verification time: %s',
    async (now) => {
      const response: ResponseDocument = {
        type: 'signature',
        chain: 'nem',
        network: { id: 0x68 },
        payload: { signatureType: 'rejected', requestId },
      };
      await expect(verifyResponse(response, request, { now, authenticatedRejection: true })).rejects.toMatchObject({
        code: 'invalid-context',
      });
    }
  );

  it.each(['complete', 'bonded'] as const)(
    'accepts a Symbol aggregate %s response when only its main signature changes',
    async (kind) => {
      const { original, signed } = createSymbolAggregatePair(kind);
      const originalRequest: RequestDocument = {
        type: 'sign-request',
        chain: 'symbol',
        network: { id: 0x98, generationHashSeed: symbolGenerationHashSeed },
        payload: {
          transactionPayload: original.serialize(),
          signingType: 'transaction',
          context: { requestId, createdAt: 100, expiresAt: 200, audience: 'https://example.com' },
        },
      };
      const response: ResponseDocument = {
        type: 'signed-transaction',
        chain: 'symbol',
        network: originalRequest.network,
        payload: { transactionPayload: signed.serialize(), requestId },
      };
      await expect(verifyResponse(response, originalRequest, { now: 150 })).resolves.toMatchObject({
        document: response,
      });
    }
  );

  it.each(['complete', 'bonded'] as const)(
    'rejects a Symbol aggregate %s response with changed existing cosignatures',
    async (kind) => {
      const { original, signed } = createSymbolAggregatePair(kind);
      (signed as models.AggregateCompleteTransactionV3 | models.AggregateBondedTransactionV3).cosignatures = [];
      const originalRequest: RequestDocument = {
        type: 'sign-request',
        chain: 'symbol',
        network: { id: 0x98, generationHashSeed: symbolGenerationHashSeed },
        payload: {
          transactionPayload: original.serialize(),
          signingType: 'transaction',
          context: { requestId, createdAt: 100, expiresAt: 200, audience: 'https://example.com' },
        },
      };
      const response: ResponseDocument = {
        type: 'signed-transaction',
        chain: 'symbol',
        network: originalRequest.network,
        payload: { transactionPayload: signed.serialize(), requestId },
      };
      await expect(verifyResponse(response, originalRequest, { now: 150 })).rejects.toMatchObject({
        code: 'verification-failed',
      });
    }
  );
});
