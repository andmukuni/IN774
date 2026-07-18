const POSTMAN_COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function normalizeBaseUrl(baseUrl = '') {
  return String(baseUrl || '').trim().replace(/\/$/, '') || '/api/v1';
}

function bearerAuth() {
  return {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
  };
}

function listQueryParams(extra = []) {
  return [
    { key: 'limit', value: '50', description: 'Page size (max 200)' },
    { key: 'offset', value: '0', description: 'Pagination offset' },
    { key: 'search', value: '', description: 'Free-text search' },
    ...extra,
  ];
}

function getItem(name, rawUrl, { description = '', query = [], auth = bearerAuth() } = {}) {
  const pathPart = rawUrl.replace(/^\{\{baseUrl\}\}/, '');
  const [pathOnly, queryString = ''] = pathPart.split('?');
  const pathSegments = pathOnly.split('/').filter(Boolean);

  const url = {
    raw: rawUrl,
    host: ['{{baseUrl}}'],
    path: pathSegments,
  };

  if (query.length) {
    url.query = query;
  } else if (queryString) {
    url.query = queryString.split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return { key, value };
    });
  }

  return {
    name,
    request: {
      method: 'GET',
      header: [],
      url,
      description,
      auth,
    },
  };
}

export function buildExternalApiPostmanCollection(baseUrl = '/api/v1') {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    info: {
      name: 'GFL Inventory External API',
      description: 'Read-only external API for assets, employees, and asset-to-employee assignments. Authenticate with a GFL API key using Bearer auth or the X-Api-Key header. Server IP whitelisting applies per key.',
      schema: POSTMAN_COLLECTION_SCHEMA,
      _postman_id: 'gfl-inventory-external-api',
    },
    auth: bearerAuth(),
    variable: [
      { key: 'baseUrl', value: normalizedBaseUrl },
      { key: 'apiKey', value: '' },
      { key: 'assetId', value: '' },
      { key: 'employeeId', value: '' },
    ],
    item: [
      {
        name: 'Health',
        item: [
          getItem('Health check', '{{baseUrl}}/health', {
            description: 'Public health check. No API key required.',
            auth: { type: 'noauth' },
          }),
        ],
      },
      {
        name: 'Assets',
        item: [
          getItem('List assets', '{{baseUrl}}/assets?limit=50&offset=0', {
            description: 'Requires assets.read scope.',
            query: listQueryParams([
              { key: 'branchId', value: '', description: 'Filter by branch ID' },
              { key: 'employeeId', value: '', description: 'Filter by assigned employee ID' },
              { key: 'status', value: '', description: 'Filter by product status' },
            ]),
          }),
          getItem('Get asset by ID', '{{baseUrl}}/assets/{{assetId}}', {
            description: 'Requires assets.read scope. Set the assetId collection variable first.',
          }),
        ],
      },
      {
        name: 'Employees',
        item: [
          getItem('List employees', '{{baseUrl}}/employees?limit=50&offset=0', {
            description: 'Requires employees.read scope.',
            query: listQueryParams([
              { key: 'branchId', value: '', description: 'Filter by branch ID' },
              { key: 'status', value: '', description: 'Filter by employee status' },
            ]),
          }),
          getItem('Get employee by ID', '{{baseUrl}}/employees/{{employeeId}}', {
            description: 'Requires employees.read scope. Set the employeeId collection variable first.',
          }),
          getItem('List employee assets', '{{baseUrl}}/employees/{{employeeId}}/assets?limit=50&offset=0', {
            description: 'Requires employees.read scope. Returns assets assigned to one employee.',
            query: listQueryParams(),
          }),
        ],
      },
      {
        name: 'Assignments',
        item: [
          getItem('List assignments', '{{baseUrl}}/assignments?limit=50&offset=0', {
            description: 'Requires assignments.read scope. Flat asset-to-employee assignment list.',
            query: listQueryParams([
              { key: 'branchId', value: '', description: 'Filter by branch ID' },
              { key: 'employeeId', value: '', description: 'Filter by employee ID' },
            ]),
          }),
        ],
      },
    ],
  };
}

export function buildExternalApiPostmanEnvironment(baseUrl = '/api/v1') {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    id: 'gfl-inventory-external-api-env',
    name: 'GFL Inventory External API',
    values: [
      {
        key: 'baseUrl',
        value: normalizedBaseUrl,
        type: 'default',
        enabled: true,
      },
      {
        key: 'apiKey',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'assetId',
        value: '',
        type: 'default',
        enabled: true,
      },
      {
        key: 'employeeId',
        value: '',
        type: 'default',
        enabled: true,
      },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'GFL Inventory Developer Portal',
  };
}
