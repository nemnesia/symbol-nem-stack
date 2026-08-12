import { Configuration } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FailoverApi, createNemNodeWatchApi, createSymbolNodeWatchApi } from '../src/FailoverApi.js';

// Mock API class for testing
class MockApi {
  protected config: Configuration;

  constructor(config: Configuration) {
    this.config = config;
  }

  async testMethod(param: string): Promise<string> {
    return `Response from ${this.config.basePath}: ${param}`;
  }

  async failingMethod(): Promise<string> {
    throw new Error(`Error from ${this.config.basePath}`);
  }
}

describe('FailoverApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should throw error if no base URLs provided', () => {
      expect(() => new FailoverApi(MockApi, [], true)).toThrow('At least one base URL is required');
    });

    it('should create API instances for each base URL', () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true);

      expect(failoverApi).toBeDefined();
    });

    it('should set maxRetries to baseUrls length by default', () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com', 'https://api3.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true);

      expect(failoverApi).toBeDefined();
    });

    it('should accept custom maxRetries', () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true, 5);

      expect(failoverApi).toBeDefined();
    });
  });

  describe('API method proxying', () => {
    it('should successfully call API method on first endpoint', async () => {
      const baseUrls = ['https://api1.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true) as any;

      const result = await failoverApi.testMethod('test-param');
      expect(result).toBe('Response from https://api1.example.com: test-param');
    });

    it('should retry on second endpoint when first fails', async () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com'];

      // Create a custom class where first call fails, second succeeds
      class TestApi extends MockApi {
        static callCount = 0;

        async testMethod(param: string): Promise<string> {
          TestApi.callCount++;
          if (TestApi.callCount === 1) {
            throw new Error('First endpoint failed');
          }
          return super.testMethod(param);
        }
      }

      TestApi.callCount = 0;
      const failoverApi = new FailoverApi(TestApi, baseUrls, true) as any;

      const result = await failoverApi.testMethod('test-param');
      expect(result).toBe('Response from https://api2.example.com: test-param');
      expect(TestApi.callCount).toBe(2);
    });

    it('should throw error when all endpoints fail', async () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true) as any;

      await expect(failoverApi.failingMethod()).rejects.toThrow(/All endpoints failed after/);
    });

    it('should not retry when retryOnError is false', async () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com'];

      class TestApi extends MockApi {
        static callCount = 0;

        async failingMethod(): Promise<string> {
          TestApi.callCount++;
          throw new Error('Error on call ' + TestApi.callCount);
        }
      }

      TestApi.callCount = 0;
      const failoverApi = new FailoverApi(TestApi, baseUrls, false) as any;

      await expect(failoverApi.failingMethod()).rejects.toThrow(/All endpoints failed/);
      expect(TestApi.callCount).toBe(1);
    });

    it('should not fail over after an abort signal is cancelled', async () => {
      const controller = new AbortController();
      const calls: string[] = [];

      class AbortApi extends MockApi {
        async signalMethod(): Promise<string> {
          calls.push(this.config.basePath);
          controller.abort();
          throw new Error('request cancelled');
        }
      }

      const failoverApi = new FailoverApi(
        AbortApi,
        ['https://api1.example.com', 'https://api2.example.com'],
        true
      ) as any;

      await expect(failoverApi.signalMethod({ signal: controller.signal })).rejects.toBe(controller.signal.reason);
      expect(calls).toEqual(['https://api1.example.com']);
    });

    it('should keep failover endpoint selection local to concurrent requests', async () => {
      const calls: string[] = [];

      class ConcurrentApi extends MockApi {
        async concurrentMethod(requestId: string): Promise<string> {
          calls.push(`${requestId}:${this.config.basePath}`);
          if (this.config.basePath === 'https://api1.example.com') {
            await new Promise((resolve) => setTimeout(resolve, requestId === 'first' ? 10 : 0));
            throw new Error(`${requestId} failed`);
          }
          if (this.config.basePath === 'https://api2.example.com') return this.config.basePath;
          throw new Error(`${requestId} reached unexpected endpoint`);
        }
      }

      const failoverApi = new FailoverApi(
        ConcurrentApi,
        ['https://api1.example.com', 'https://api2.example.com', 'https://api3.example.com'],
        true
      ) as any;

      await expect(
        Promise.all([failoverApi.concurrentMethod('first'), failoverApi.concurrentMethod('second')])
      ).resolves.toEqual(['https://api2.example.com', 'https://api2.example.com']);
      expect(calls).toEqual(
        expect.arrayContaining(['first:https://api1.example.com', 'second:https://api1.example.com'])
      );
      expect(calls).toEqual(
        expect.arrayContaining(['first:https://api2.example.com', 'second:https://api2.example.com'])
      );
    });

    it('should respect maxRetries limit', async () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com', 'https://api3.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true, 2) as any;

      await expect(failoverApi.failingMethod()).rejects.toThrow(/All endpoints failed after 2 attempts/);
    });
  });

  describe('createSymbolNodesApi', () => {
    it('should create SymbolNodesApi with the supplied URLs', () => {
      const api = createSymbolNodeWatchApi(['https://mainnet.example.com']);
      expect(api).toBeDefined();
    });

    it('should use custom base URLs', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ height: 10, finalizedHeight: 9 }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      await createSymbolNodeWatchApi(['https://custom.example.com']).getSymbolHeight();

      expect(fetchMock).toHaveBeenCalledWith('https://custom.example.com/api/symbol/height', expect.anything());
    });

    it('should exclude nodes with empty endpoints from node list responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([{ endpoint: '' }, { endpoint: '  ' }, { endpoint: 'https://valid.example.com' }]),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const nodes = await createSymbolNodeWatchApi(['https://custom.example.com']).getSymbolPeerNodes({});

      expect(nodes).toEqual([{ endpoint: 'https://valid.example.com' }]);
    });

    it('should reject an empty custom URL list', () => {
      expect(() => createSymbolNodeWatchApi([])).toThrow('At least one base URL is required');
    });

    it('should reject a missing URL list at runtime', () => {
      expect(() => createSymbolNodeWatchApi(undefined as never)).toThrow('At least one base URL is required');
    });
  });

  describe('createNEMNodesApi', () => {
    it('should create NEMNodesApi with the supplied URLs', () => {
      const api = createNemNodeWatchApi(['https://testnet.example.com']);
      expect(api).toBeDefined();
    });
  });
});
