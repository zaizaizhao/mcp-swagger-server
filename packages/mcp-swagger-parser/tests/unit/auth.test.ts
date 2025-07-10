import { CustomHeadersManager } from '../../src/headers/CustomHeadersManager';
import { RequestContext } from '../../src/transformer/types';

describe('CustomHeadersManager', () => {
  let manager: CustomHeadersManager;
  let mockContext: RequestContext;

  beforeEach(() => {
    manager = new CustomHeadersManager();
    mockContext = {
      method: 'GET',
      path: '/test',
      args: { id: '123' },
      operation: {
        operationId: 'test',
        responses: {},
        tags: ['test'],
        summary: 'Test operation'
      }
    };
  });

  describe('getHeaders', () => {
    it('should handle static headers', async () => {
      const config = {
        static: {
          'X-Custom-Header': 'static-value'
        }
      };

      manager = new CustomHeadersManager(config);
      const result = await manager.getHeaders(mockContext);
      
      expect(result).toEqual({
        'X-Custom-Header': 'static-value'
      });
    });

    it('should handle environment variable headers', async () => {
      process.env.TEST_VAR = 'env-value';
      
      const config = {
        env: {
          'X-Env-Header': 'TEST_VAR'
        }
      };

      manager = new CustomHeadersManager(config);
      const result = await manager.getHeaders(mockContext);
      
      expect(result).toEqual({
        'X-Env-Header': 'env-value'
      });
      
      delete process.env.TEST_VAR;
    });

    it('should return empty object for no config', async () => {
      const result = await manager.getHeaders(mockContext);
      expect(result).toEqual({});
    });
  });
});