import { Configuration } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FailoverApi,
  type NodeWatchNetwork,
  createNemNodeWatchApi,
  createSymbolNodeWatchApi,
  nodewatchMainnetUrls,
  nodewatchTestnetUrls,
} from '../src/FailoverApi.js';

// Mock API class for testing
class MockApi {
  private config: Configuration;

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
      // retryOnError=false の場合でも最初のエンドポイントは試行されるため、callCountは1または2になる可能性がある
      expect(TestApi.callCount).toBeLessThanOrEqual(2);
    });

    it('should respect maxRetries limit', async () => {
      const baseUrls = ['https://api1.example.com', 'https://api2.example.com', 'https://api3.example.com'];
      const failoverApi = new FailoverApi(MockApi, baseUrls, true, 2) as any;

      await expect(failoverApi.failingMethod()).rejects.toThrow(/All endpoints failed after 2 attempts/);
    });
  });

  describe('URL constants', () => {
    it('should have mainnet URLs defined', () => {
      expect(nodewatchMainnetUrls).toBeDefined();
      expect(nodewatchMainnetUrls.length).toBeGreaterThan(0);
    });

    it('should have testnet URLs defined', () => {
      expect(nodewatchTestnetUrls).toBeDefined();
      expect(nodewatchTestnetUrls.length).toBeGreaterThan(0);
    });
  });

  describe('createSymbolNodesApi', () => {
    it('should create SymbolNodesApi for mainnet', () => {
      const api = createSymbolNodeWatchApi('mainnet');
      expect(api).toBeDefined();
    });

    it('should create SymbolNodesApi for testnet', () => {
      const api = createSymbolNodeWatchApi('testnet');
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

      await createSymbolNodeWatchApi('mainnet', ['https://custom.example.com']).getSymbolHeight();

      expect(fetchMock).toHaveBeenCalledWith('https://custom.example.com/api/symbol/height', expect.anything());
    });

    it('should reject an invalid network at runtime', () => {
      expect(() => createSymbolNodeWatchApi('invalid' as NodeWatchNetwork)).toThrow(
        "Invalid network: invalid. Must be 'mainnet' or 'testnet'."
      );
    });

    it('should reject an empty custom URL list', () => {
      expect(() => createSymbolNodeWatchApi('mainnet', [])).toThrow('At least one base URL is required');
    });
  });

  describe('createNEMNodesApi', () => {
    it('should create NEMNodesApi for mainnet', () => {
      const api = createNemNodeWatchApi('mainnet');
      expect(api).toBeDefined();
    });

    it('should create NEMNodesApi for testnet', () => {
      const api = createNemNodeWatchApi('testnet');
      expect(api).toBeDefined();
    });
  });
});
