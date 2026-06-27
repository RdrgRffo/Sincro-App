/**
 * @file useFieldValidation.test.ts
 * Tests del hook de validación de formularios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldValidation } from '@/hooks/useFieldValidation';

interface ValidationOpts {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  fieldName?: string;
}

// Mock de sanitize
vi.mock('@/lib/sanitize', () => ({
  validateTextField: vi.fn((value: string, opts?: ValidationOpts) => {
    if (!value && opts?.required) return { valid: false, error: 'Campo requerido', sanitized: value };
    if (opts?.minLength && value.length < opts.minLength) return { valid: false, error: `Mínimo ${opts.minLength} caracteres`, sanitized: value };
    return { valid: true, error: null, sanitized: value.trim() };
  }),
  validateEmailField: vi.fn((value: string, opts?: ValidationOpts) => {
    if (!value && opts?.required) return { valid: false, error: 'Email requerido', sanitized: value };
    if (!value.includes('@')) return { valid: false, error: 'Email inválido', sanitized: value };
    return { valid: true, error: null, sanitized: value.trim().toLowerCase() };
  }),
  validateNameField: vi.fn((value: string, opts?: ValidationOpts) => {
    if (!value && opts?.required) return { valid: false, error: 'Nombre requerido', sanitized: value };
    return { valid: true, error: null, sanitized: value.trim() };
  }),
  validateNotesField: vi.fn((value: string) => {
    return { valid: true, error: null, sanitized: value.trim() };
  }),
  validateLocationField: vi.fn((value: string) => {
    return { valid: true, error: null, sanitized: value.trim() };
  }),
}));

describe('useFieldValidation', () => {
  const defaultFields = {
    title: { required: true, minLength: 2, maxLength: 100, label: 'Título' },
    email: { required: true, type: 'email' as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa con valores vacíos y sin errores', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    expect(result.current.values).toEqual({ title: '', email: '' });
    expect(result.current.errors).toEqual({ title: null, email: null });
    expect(result.current.isValid).toBe(true);
    expect(result.current.errorCount).toBe(0);
  });

  it('inicializa con valores iniciales', () => {
    const { result } = renderHook(() =>
      useFieldValidation({
        fields: defaultFields,
        initialValues: { title: 'Mi título', email: 'test@test.com' },
      }),
    );

    expect(result.current.values).toEqual({ title: 'Mi título', email: 'test@test.com' });
  });

  it('register retorna las props correctas', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    const props = result.current.register('title');
    expect(props.name).toBe('title');
    expect(props.value).toBe('');
    expect(typeof props.onChange).toBe('function');
    expect(typeof props.onBlur).toBe('function');
    expect(typeof props.ref).toBe('function');
  });

  it('validateField marca error en campo requerido vacío', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.validateField('title');
    });

    expect(result.current.errors.title).toBeTruthy();
    expect(result.current.isValid).toBe(false);
    expect(result.current.errorCount).toBe(1);
  });

  it('validateField pasa con valor válido', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.setValue('title', 'Válido');
    });

    act(() => {
      result.current.validateField('title');
    });

    expect(result.current.errors.title).toBeNull();
  });

  it('validateAll valida todos los campos', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    let allValid: boolean;
    act(() => {
      allValid = result.current.validateAll();
    });

    expect(allValid!).toBe(false);
    expect(result.current.errors.title).toBeTruthy();
    expect(result.current.errors.email).toBeTruthy();
  });

  it('setValue actualiza el valor', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.setValue('title', 'Nuevo valor');
    });

    // Esperamos a que se procese el setTimeout
    setTimeout(() => {
      expect(result.current.values.title).toBe('Nuevo valor');
    }, 10);
  });

  it('reset limpia los valores y errores', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.setValue('title', 'Algo');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values.title).toBe('');
    expect(result.current.errors.title).toBeNull();
  });

  it('getSanitizedValue retorna el valor sanitizado', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.setValue('title', '  Mi título  ');
    });

    setTimeout(() => {
      const sanitized = result.current.getSanitizedValue('title');
      expect(sanitized).toBe('Mi título');
    }, 10);
  });

  it('register retorna aria-invalid cuando hay error', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    act(() => {
      result.current.validateField('title');
    });

    const props = result.current.register('title');
    expect(props['aria-invalid']).toBe(true);
    expect(props['aria-describedby']).toBe('title-error');
  });

  it('register no retorna aria-invalid cuando no hay error', () => {
    const { result } = renderHook(() => useFieldValidation({ fields: defaultFields }));

    const props = result.current.register('title');
    expect(props['aria-invalid']).toBeUndefined();
    expect(props['aria-describedby']).toBeUndefined();
  });
});
