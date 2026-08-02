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
});
