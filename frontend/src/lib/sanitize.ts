/**
 * @file sanitize.ts
 * @description Utilidades de sanitización de texto para prevenir XSS.
 *
 * React ya escapa HTML por defecto en JSX ({variable}), pero estas funciones
 * sirven como defensa adicional para:
 * - Validar y limpiar datos antes de enviarlos al backend
 * - Sanitizar datos que vienen del backend antes de mostrarlos
 * - Prevenir inyección HTML en caso de que se use dangerouslySetInnerHTML
 */

// ─── Constantes de escape ─────────────────────────────────────────────────

const AMP = '&' + 'amp;';
const LT = '&' + 'lt;';
const GT = '&' + 'gt;';
const QUOT = '&' + 'quot;';
const APOS = '&#' + 'x27;';
const GRAVE = '&#' + 'x60;';
const SLASH = '&#' + 'x2F;';

// ─── Sanitizadores básicos ────────────────────────────────────────────────

/**
 * Escapa caracteres HTML peligrosos en un string.
 * Convierte: & < > " ' ` / → entidades HTML
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS)
    .replace(/`/g, GRAVE)
    .replace(/\//g, SLASH);
}

/**
 * Elimina etiquetas HTML/XML completas de un string.
 * Útil para limpiar datos antes de enviarlos al backend.
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Normaliza espacios en blanco: elimina múltiples espacios, tabs, saltos de línea.
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitiza un string para uso seguro: elimina HTML, normaliza espacios, trimea.
 * Esta es la función principal para sanitizar datos de entrada.
 */
export function sanitizeText(str: string): string {
  return normalizeWhitespace(stripHtmlTags(str));
}

/**
 * Sanitiza un string para mostrar en pantalla (escape HTML).
 * Útil si por alguna razón se necesita renderizar texto plano como HTML.
 */
export function sanitizeForDisplay(str: string): string {
  return escapeHtml(str);
}

// ─── Validadores de campo ────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error: string | null;
  sanitized: string;
}

/**
 * Valida y sanitiza un campo de texto genérico.
 * - Elimina HTML
 * - Normaliza espacios
 * - Verifica longitud mínima/máxima
 * - Verifica que no contenga solo espacios
 */
export function validateTextField(
  value: string,
  options: {
    fieldName?: string;
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    allowEmpty?: boolean;
  } = {},
): ValidationResult {
  const {
    fieldName = 'Campo',
    minLength = 1,
    maxLength = 500,
    required = true,
    allowEmpty = false,
  } = options;

  const sanitized = sanitizeText(value);

  if (required && !allowEmpty && sanitized.length === 0) {
    return { valid: false, error: `${fieldName} es obligatorio`, sanitized };
  }

  if (sanitized.length > 0 && sanitized.length < minLength) {
    return { valid: false, error: `${fieldName} debe tener al menos ${minLength} caracteres`, sanitized };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `${fieldName} no puede exceder ${maxLength} caracteres`, sanitized };
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Valida un campo de email.
 */
export function validateEmailField(
  value: string,
  options: { required?: boolean } = {},
): ValidationResult {
  const { required = true } = options;
  const sanitized = sanitizeText(value);

  if (required && sanitized.length === 0) {
    return { valid: false, error: 'Email es obligatorio', sanitized };
  }

  if (sanitized.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      return { valid: false, error: 'Formato de email inválido', sanitized };
    }
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Valida un campo de nombre de usuario.
 * - Solo letras, números, espacios, guiones y puntos
 * - Longitud entre 2 y 100 caracteres
 */
export function validateNameField(
  value: string,
  options: { required?: boolean; fieldName?: string } = {},
): ValidationResult {
  const { required = true, fieldName = 'Nombre' } = options;
  const sanitized = sanitizeText(value);

  if (required && sanitized.length === 0) {
    return { valid: false, error: `${fieldName} es obligatorio`, sanitized };
  }

  if (sanitized.length > 0 && sanitized.length < 2) {
    return { valid: false, error: `${fieldName} debe tener al menos 2 caracteres`, sanitized };
  }

  if (sanitized.length > 100) {
    return { valid: false, error: `${fieldName} no puede exceder 100 caracteres`, sanitized };
  }

  // Solo caracteres permitidos: letras (incluyendo acentos y ñ), espacios, guiones, puntos, apóstrofes
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-'.]+$/;
  if (sanitized.length > 0 && !nameRegex.test(sanitized)) {
    return { valid: false, error: `${fieldName} contiene caracteres no permitidos`, sanitized };
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Valida un campo de notas/descripción (más permisivo).
 */
export function validateNotesField(
  value: string,
  options: { required?: boolean; maxLength?: number } = {},
): ValidationResult {
  const { required = false, maxLength = 1000 } = options;
  const sanitized = sanitizeText(value);

  if (required && sanitized.length === 0) {
    return { valid: false, error: 'La nota es obligatoria', sanitized };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `La nota no puede exceder ${maxLength} caracteres`, sanitized };
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Valida un campo de ubicación.
 */
export function validateLocationField(
  value: string,
  options: { required?: boolean } = {},
): ValidationResult {
  const { required = false } = options;
  const sanitized = sanitizeText(value);

  if (required && sanitized.length === 0) {
    return { valid: false, error: 'La ubicación es obligatoria', sanitized };
  }

  if (sanitized.length > 200) {
    return { valid: false, error: 'La ubicación no puede exceder 200 caracteres', sanitized };
  }

  return { valid: true, error: null, sanitized };
}

// ─── Validador de formularios (Fase 2: validación en submit) ─────────────

export interface FormFieldValidation {
  name: string;
  value: string;
  label?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  type?: 'text' | 'email' | 'name' | 'notes' | 'location';
}

/**
 * Valida múltiples campos de un formulario de una sola vez.
 * Retorna un mapa de { fieldName: ValidationResult }.
 */
export function validateFormFields(
  fields: FormFieldValidation[],
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  for (const field of fields) {
    const { name, value, label, required, minLength, maxLength, type = 'text' } = field;

    switch (type) {
      case 'email':
        results[name] = validateEmailField(value, { required });
        break;
      case 'name':
        results[name] = validateNameField(value, { required, fieldName: label || name });
        break;
      case 'notes':
        results[name] = validateNotesField(value, { required, maxLength });
        break;
      case 'location':
        results[name] = validateLocationField(value, { required });
        break;
      default:
        results[name] = validateTextField(value, {
          fieldName: label || name,
          minLength,
          maxLength,
          required,
        });
        break;
    }
  }

  return results;
}

/**
 * Verifica si todos los campos de un resultado de validación son válidos.
 */
export function isFormValid(results: Record<string, ValidationResult>): boolean {
  return Object.values(results).every((r) => r.valid);
}
