import request from 'supertest';
import app from '../../src/app';

describe('OpenAPI documentation', () => {
  it('serves the OpenAPI document without authentication', async () => {
    const response = await request(app).get('/api/docs/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.info.title).toBe('Sincro API');
    expect(response.body.paths['/schedules']).toBeDefined();
    expect(response.body.components.securitySchemes.bearerAuth).toBeDefined();
  });
});
