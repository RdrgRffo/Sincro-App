import request from 'supertest';
import app from '../../src/app';

describe('app health endpoints', () => {
  it('serves GET /health without authentication', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });

  it('keeps GET /api/health for existing clients', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });
});
