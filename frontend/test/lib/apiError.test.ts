/**
 * @file apiError.test.ts
 * Extracción de mensaje, código y detalles de errores Axios en respuestas API.
 */
import { describe, it, expect } from 'vitest';
import { getApiErrorMessage, getApiErrorCode, getApiErrorDetails } from '@/lib/apiError';

function axiosLikeResponse(data: { error?: string; code?: string; errors?: unknown }) {
  return {
    isAxiosError: true,
    response: { data },
  };
}

describe('getApiErrorMessage', () => {
  it('usa error del body de la API si existe y no es vacío', () => {
    const err = axiosLikeResponse({ error: '  Email en uso  ' });
    expect(getApiErrorMessage(err, 'fallback')).toBe('  Email en uso  ');
  });

  it('usa el message de Error nativo si no hay mensaje en el body', () => {
    const err = new Error('Red');
    expect(getApiErrorMessage(err, 'fallback')).toBe('Red');
  });

  it('ignora error del body vacío o solo espacios y pasa a Error o fallback', () => {
    const e1 = axiosLikeResponse({ error: '  ' });
    expect(getApiErrorMessage(e1, 'f')).toBe('f');
    const e2 = { isAxiosError: true, response: { data: { error: '' } } };
    expect(getApiErrorMessage(e2, 'f2')).toBe('f2');
  });

  it('devuelve fallback si el valor no es Axios ni Error con texto', () => {
    expect(getApiErrorMessage('string raro', 'f')).toBe('f');
    expect(getApiErrorMessage(null, 'f')).toBe('f');
  });
});

describe('getApiErrorCode y getApiErrorDetails', () => {
  it('devuelve code del body', () => {
    expect(getApiErrorCode(axiosLikeResponse({ code: 'VALIDATION' }))).toBe('VALIDATION');
  });

  it('devuelve undefined si no es Axios', () => {
    expect(getApiErrorCode(new Error('x'))).toBeUndefined();
  });

  it('devuelve el objeto errors tipado', () => {
    const details = { field: 'email' };
    const d = getApiErrorDetails<typeof details>(axiosLikeResponse({ errors: details }));
    expect(d).toEqual(details);
  });
});
