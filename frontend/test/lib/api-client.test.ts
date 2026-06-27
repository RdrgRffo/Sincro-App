/**
 * @file api-client.test.ts
 * Tests del cliente API (api-client.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('realiza petición GET correctamente', async () => {
    getMock.mockResolvedValue({ data: { id: '1', name: 'Test' } });

    const result = await apiClient.get('/test');
    expect(result.data).toEqual({ id: '1', name: 'Test' });
    expect(getMock).toHaveBeenCalledWith('/test');
  });

  it('realiza petición POST con body', async () => {
    postMock.mockResolvedValue({ data: { id: '2' } });

    const body = { name: 'Nuevo' };
    const result = await apiClient.post('/test', body);
    expect(result.data).toEqual({ id: '2' });
    expect(postMock).toHaveBeenCalledWith('/test', body);
  });

  it('realiza petición PUT con body', async () => {
    putMock.mockResolvedValue({ data: { id: '1', name: 'Actualizado' } });

    const body = { name: 'Actualizado' };
    const result = await apiClient.put('/test/1', body);
    expect(result.data.name).toBe('Actualizado');
    expect(putMock).toHaveBeenCalledWith('/test/1', body);
  });

  it('realiza petición PATCH con body', async () => {
    patchMock.mockResolvedValue({ data: { success: true } });

    const result = await apiClient.patch('/test/1', { field: 'value' });
    expect(result.data.success).toBe(true);
    expect(patchMock).toHaveBeenCalledWith('/test/1', { field: 'value' });
  });

  it('realiza petición DELETE', async () => {
    deleteMock.mockResolvedValue({ data: { success: true } });

    const result = await apiClient.delete('/test/1');
    expect(result.data.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith('/test/1');
  });

  it('lanza error en respuesta no ok', async () => {
    getMock.mockRejectedValue(new Error('Not found'));

    await expect(apiClient.get('/test/404')).rejects.toThrow('Not found');
  });
});
