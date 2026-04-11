import { generateToolName, extractPathParameters, parseContentType } from '../../src/utils';

describe('parser utils', () => {
  it('should sanitize operationId when generating tool names', () => {
    expect(generateToolName('get', '/users/{id}', 'user.get-by-id')).toBe(
      'user_get_by_id',
    );
  });

  it('should fall back to method and path when operationId is missing', () => {
    expect(generateToolName('post', '/api/users/{id}')).toBe('post_api_users');
  });

  it('should extract path parameters correctly', () => {
    expect(extractPathParameters('/users/{userId}/orders/{orderId}')).toEqual([
      'userId',
      'orderId',
    ]);
  });

  it('should parse content type into normalized format', () => {
    expect(parseContentType('application/json; charset=utf-8')).toBe('json');
    expect(parseContentType('application/yaml')).toBe('yaml');
  });
});
