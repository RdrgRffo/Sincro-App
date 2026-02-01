/**
 * @file useFieldValidation.ts
 * @description Hook de validación de formularios en dos fases.
 *
 * Fase 1: Validación por campo individual (onBlur/onChange)
 * Fase 2: Validación global en submit
 *
 * Basado en el sistema de validación HTML5 con setCustomValidity().
 * Adaptado para React con useRef y useState.
 *
 * Uso:
 * ```tsx
 * const { register, errors, validateAll, isValid } = useFieldValidation({
 *   fields: {
 *     title: { required: true, minLength: 2, maxLength: 100, label: 'Título' },
 *     email: { required: true, type: 'email' },
 *   }
 * });
 *
 * <input {...register('title')} />
 * {errors.title && <p className="input-error">{errors.title}</p>}
 * ```
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  validateTextField,
  validateEmailField,
  validateNameField,
  validateNotesField,
  validateLocationField,
  type ValidationResult,
} from '@/lib/sanitize';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'email' | 'name' | 'notes' | 'location';

export interface FieldConfig {
  /** Etiqueta del campo para mensajes de error */
  label?: string;
  /** Si el campo es obligatorio */
  required?: boolean;
  /** Longitud mínima */
  minLength?: number;
  /** Longitud máxima */
  maxLength?: number;
  /** Tipo de validación */
  type?: FieldType;
  /** Validación custom adicional: retorna mensaje de error o null si es válido */
  custom?: (value: string) => string | null;
}

export interface FieldConfigMap {
  [fieldName: string]: FieldConfig;
}

export interface FieldErrors {
  [fieldName: string]: string | null;
}

export interface FieldValues {
  [fieldName: string]: string;
}

export interface UseFieldValidationOptions {
  /** Mapa de configuración de campos */
  fields: FieldConfigMap;
  /** Valores iniciales del formulario */
  initialValues?: FieldValues;
}

export interface UseFieldValidationReturn {
  /** Valores actuales del formulario */
  values: FieldValues;
  /** Errores actuales por campo */
  errors: FieldErrors;
  /** Si el formulario es válido (sin errores) */
  isValid: boolean;
  /** Número de campos con error */
  errorCount: number;
  /** Registra un campo: retorna props para el input + onChange/onBlur */
  register: (name: string) => {
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    ref: React.RefCallback<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
  };
  /** Valida un campo específico y retorna el resultado */
  validateField: (name: string) => ValidationResult;
  /** Valida todos los campos. Retorna true si todo es válido */
  validateAll: () => boolean;
  /** Resetea el formulario a valores iniciales */
  reset: (newValues?: FieldValues) => void;
  /** Establece un valor específico y lo valida */
  setValue: (name: string, value: string) => void;
  /** Establece múltiples valores y los valida */
  setValues: (newValues: FieldValues) => void;
  /** Obtiene el valor sanitizado de un campo */
  getSanitizedValue: (name: string) => string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useFieldValidation(options: UseFieldValidationOptions): UseFieldValidationReturn {
  const { fields, initialValues = {} } = options;

  // Estado
  const [values, setValuesState] = useState<FieldValues>(() => {
    const initial: FieldValues = {};
    for (const fieldName of Object.keys(fields)) {
      initial[fieldName] = initialValues[fieldName] ?? '';
    }
    return initial;
  });

  const [errors, setErrors] = useState<FieldErrors>(() => {
    const initial: FieldErrors = {};
    for (const fieldName of Object.keys(fields)) {
      initial[fieldName] = null;
    }
    return initial;
  });

  // Ref para almacenar referencias a elementos DOM (para setCustomValidity)
  const elementRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>(new Map());

  // ─── Función de validación individual (Fase 1) ──────────────────────────

  const validateField = useCallback(
    (name: string): ValidationResult => {
      const config = fields[name];
      if (!config) {
        return { valid: true, error: null, sanitized: values[name] ?? '' };
      }

      const value = values[name] ?? '';
      const { type = 'text', required, minLength, maxLength, label, custom } = config;

      let result: ValidationResult;

      switch (type) {
        case 'email':
          result = validateEmailField(value, { required });
          break;
        case 'name':
          result = validateNameField(value, { required, fieldName: label || name });
          break;
        case 'notes':
          result = validateNotesField(value, { required, maxLength });
          break;
        case 'location':
          result = validateLocationField(value, { required });
          break;
        default:
          result = validateTextField(value, {
            fieldName: label || name,
            minLength,
            maxLength,
            required,
          });
          break;
      }

      // Validación custom
      if (result.valid && custom) {
        const customError = custom(value);
        if (customError) {
          result = { valid: false, error: customError, sanitized: result.sanitized };
        }
      }

      // Actualizar setCustomValidity en el elemento DOM (Fase 1)
      const element = elementRefs.current.get(name);
      if (element) {
        if (result.valid) {
          element.setCustomValidity(''); // ← CRÍTICO: resetear cuando es válido
        } else {
          element.setCustomValidity(result.error ?? '');
        }
      }

      // Actualizar estado de error
      setErrors((prev) => ({ ...prev, [name]: result.error }));

      return result;
    },
    [fields, values],
  );

  // ─── Validación global (Fase 2) ─────────────────────────────────────────

  const validateAll = useCallback((): boolean => {
    let allValid = true;

    for (const fieldName of Object.keys(fields)) {
      const result = validateField(fieldName);
      if (!result.valid) {
        allValid = false;
      }
    }

    return allValid;
  }, [fields, validateField]);

  // ─── Handlers de input ─────────────────────────────────────────────────

  const handleChange = useCallback(
    (name: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const newValue = e.target.value;
      setValuesState((prev) => ({ ...prev, [name]: newValue }));
      // Limpiar error en tiempo real mientras el usuario escribe
      setErrors((prev) => ({ ...prev, [name]: null }));
    },
    [],
  );

  const handleBlur = useCallback(
    (name: string) => {
      validateField(name);
    },
    [validateField],
  );

  // ─── Register: retorna props para vincular al input ─────────────────────

  const register = useCallback(
    (name: string) => {
      const errorId = `${name}-error`;

      return {
        name,
        value: values[name] ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
          handleChange(name, e),
        onBlur: () =>
          handleBlur(name),
        ref: (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
          if (el) {
            elementRefs.current.set(name, el);
          } else {
            elementRefs.current.delete(name);
          }
        },
        'aria-invalid': errors[name] != null ? true : undefined,
        'aria-describedby': errors[name] != null ? errorId : undefined,
      } as const;
    },
    [values, errors, handleChange, handleBlur],
  );

  // ─── Helpers ────────────────────────────────────────────────────────────

  const reset = useCallback(
    (newValues?: FieldValues) => {
      const resetValues: FieldValues = {};
      for (const fieldName of Object.keys(fields)) {
        resetValues[fieldName] = newValues?.[fieldName] ?? initialValues[fieldName] ?? '';
      }
      setValuesState(resetValues);

      const resetErrors: FieldErrors = {};
      for (const fieldName of Object.keys(fields)) {
        resetErrors[fieldName] = null;
      }
      setErrors(resetErrors);

      // Resetear setCustomValidity en todos los elementos
      elementRefs.current.forEach((el) => el.setCustomValidity(''));
    },
    [fields, initialValues],
  );

  const setValue = useCallback(
    (name: string, value: string) => {
      setValuesState((prev) => ({ ...prev, [name]: value }));
      // Validar después de actualizar el valor
      // (usamos setTimeout para asegurar que el estado se actualice antes de validar)
      setTimeout(() => validateField(name), 0);
    },
    [validateField],
  );

  const setValues = useCallback(
    (newValues: FieldValues) => {
      setValuesState((prev) => ({ ...prev, ...newValues }));
      setTimeout(() => {
        for (const name of Object.keys(newValues)) {
          validateField(name);
        }
      }, 0);
    },
    [validateField],
  );

  const getSanitizedValue = useCallback(
    (name: string): string => {
      const config = fields[name];
      if (!config) return values[name] ?? '';

      const value = values[name] ?? '';
      const { type = 'text' } = config;

      switch (type) {
        case 'email':
          return validateEmailField(value).sanitized;
        case 'name':
          return validateNameField(value).sanitized;
        case 'notes':
          return validateNotesField(value).sanitized;
        case 'location':
          return validateLocationField(value).sanitized;
        default:
          return validateTextField(value).sanitized;
      }
    },
    [fields, values],
  );

  // ─── Memoized computed values ───────────────────────────────────────────

  const isValid = useMemo(() => {
    return Object.values(errors).every((error) => error === null);
  }, [errors]);

  const errorCount = useMemo(() => {
    return Object.values(errors).filter((error) => error !== null).length;
  }, [errors]);

  return {
    values,
    errors,
    isValid,
    errorCount,
    register,
    validateField,
    validateAll,
    reset,
    setValue,
    setValues,
    getSanitizedValue,
  };
}
