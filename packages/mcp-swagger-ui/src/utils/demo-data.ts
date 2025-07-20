// Demo data for development and testing

export const demoApiInfo = {
  title: 'Demo API',
  version: '1.0.0',
  description: 'Demo API for testing MCP conversion'
}

export const demoEndpoints = [
  {
    method: 'GET',
    path: '/users',
    summary: 'Get all users',
    description: 'Retrieve a list of all users',
    operationId: 'getUsers',
    tags: ['users'],
    deprecated: false
  },
  {
    method: 'POST',
    path: '/users',
    summary: 'Create user',
    description: 'Create a new user',
    operationId: 'createUser',
    tags: ['users'],
    deprecated: false
  }
]

export const demoConvertResult = {
  success: true,
  data: {
    tools: [
      {
        id: 'get_users',
        name: 'getUsers',
        description: 'Retrieve a list of all users',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        serverId: 'demo',
        endpoint: {
          method: 'GET',
          path: '/users',
          summary: 'Get all users',
          description: 'Retrieve a list of all users',
          operationId: 'getUsers',
          tags: ['users'],
          deprecated: false
        }
      }
    ]
  }
}
