import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtmlTags,
  normalizeWhitespace,
  sanitizeText,
  sanitizeForDisplay,
  validateTextField,
  validateEmailField,
  validateNameField,
  validateNotesField,
  validateLocationField,
  validateFormFields,
  isFormValid,
} from '@/lib/sanitize';

// Construimos las entidades esperadas sin que el formateador las modifique
const LT_ENT = '&' + 'lt;';
const GT_ENT = '&' + 'gt;';
const AMP_ENT = '&' + 'amp;';
const QUOT_ENT = '&' + 'quot;';
const APOS_ENT = '&#' + 'x27;';
const GRAVE_ENT = '&#' + 'x60;';
const SLASH_ENT = '&#' + 'x2F;';

describe('sanitize.ts', () => {
  // ─── escapeHtml ─────────────────────────────────────────────────────────
  describe('escapeHtml', () => {
    it('escapa & < > "', () => {
      expect(escapeHtml('&<>"')).toBe(AMP_ENT + LT_ENT + GT_ENT + QUOT_ENT);
    });

    it('escapa apóstrofe y backtick', () => {
      expect(escapeHtml("'`")).toBe(APOS_ENT + GRAVE_ENT);
    });

    it('escapa slash', () => {
      expect(escapeHtml('/')).toBe(SLASH_ENT);
    });

    it('no modifica texto sin caracteres especiales', () => {
      expect(escapeHtml('Hola mundo')).toBe('Hola mundo');
    });

    it('escapa string vacío', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  // ─── stripHtmlTags ──────────────────────────────────────────────────────
  describe('stripHtmlTags', () => {
    it('elimina etiquetas HTML simples', () => {
      expect(stripHtmlTags('<p>Hola</p>')).toBe('Hola');
    });

    it('elimina etiquetas con atributos', () => {
      expect(stripHtmlTags('<a href="http://evil.com">click</a>')).toBe('click');
    });

    it('elimina scripts maliciosos', () => {
      expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('elimina etiquetas de evento onerror', () => {
      expect(stripHtmlTags('<img src=x onerror=alert(1)>')).toBe('');
    });

    it('retorna string sin HTML intacto', () => {
      expect(stripHtmlTags('Hola mundo')).toBe('Hola mundo');
    });
  });

  // ─── normalizeWhitespace ────────────────────────────────────────────────
  describe('normalizeWhitespace', () => {
    it('normaliza múltiples espacios', () => {
      expect(normalizeWhitespace('Hola    mundo')).toBe('Hola mundo');
    });

    it('elimina tabs y saltos de línea', () => {
      expect(normalizeWhitespace('Hola\tmundo\ncruel')).toBe('Hola mundo cruel');
    });

    it('trimea espacios al inicio y final', () => {
      expect(normalizeWhitespace('  Hola mundo  ')).toBe('Hola mundo');
    });
  });

  // ─── sanitizeText ───────────────────────────────────────────────────────
  describe('sanitizeText', () => {
    it('elimina HTML y normaliza espacios', () => {
      expect(sanitizeText('  <b>Hola</b>   mundo  ')).toBe('Hola mundo');
    });

    it('elimina script tags', () => {
      expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('retorna string limpio sin cambios', () => {
      expect(sanitizeText('Hola mundo')).toBe('Hola mundo');
    });
  });

  // ─── sanitizeForDisplay ─────────────────────────────────────────────────
  describe('sanitizeForDisplay', () => {
    it('escapa HTML para mostrar', () => {
      expect(sanitizeForDisplay('<script>alert(1)</script>')).toBe(
        LT_ENT + 'script' + GT_ENT + 'alert(1)' + LT_ENT + SLASH_ENT + 'script' + GT_ENT,
      );
    });
  });

  // ─── validateTextField ──────────────────────────────────────────────────
  describe('validateTextField', () => {
    it('rechaza campo vacío requerido', () => {
      const result = validateTextField('', { fieldName: 'Título', required: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Título es obligatorio');
    });

    it('rechaza texto muy corto', () => {
      const result = validateTextField('a', { fieldName: 'Título', minLength: 2 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('al menos 2');
    });

    it('rechaza texto muy largo', () => {
      const result = validateTextField('a'.repeat(600), { fieldName: 'Título', maxLength: 500 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500');
    });

    it('acepta texto válido', () => {
      const result = validateTextField('Hola mundo', { fieldName: 'Título' });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.sanitized).toBe('Hola mundo');
    });

    it('sanitiza el texto eliminando HTML', () => {
      const result = validateTextField('<b>Hola</b> mundo');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Hola mundo');
    });

    it('permite campo vacío si no es requerido', () => {
      const result = validateTextField('', { required: false, allowEmpty: true });
      expect(result.valid).toBe(true);
    });
  });

  // ─── validateEmailField ─────────────────────────────────────────────────
  describe('validateEmailField', () => {
    it('rechaza email vacío requerido', () => {
      const result = validateEmailField('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email es obligatorio');
    });

    it('rechaza email sin @', () => {
      const result = validateEmailField('usuario');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Formato de email inválido');
    });

    it('rechaza email sin dominio', () => {
      const result = validateEmailField('usuario@');
      expect(result.valid).toBe(false);
    });

    it('acepta email válido', () => {
      const result = validateEmailField('usuario@empresa.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('sanitiza el email', () => {
      const result = validateEmailField('  <b>user@empresa.com</b>  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('user@empresa.com');
    });
  });

  // ─── validateNameField ──────────────────────────────────────────────────
  describe('validateNameField', () => {
    it('rechaza nombre vacío', () => {
      const result = validateNameField('');
      expect(result.valid).toBe(false);
    });

    it('rechaza nombre con un solo carácter', () => {
      const result = validateNameField('A');
      expect(result.valid).toBe(false);
    });

    it('rechaza nombre con caracteres especiales como <', () => {
      const result = validateNameField('<script>');
      expect(result.valid).toBe(false);
    });

    it('acepta nombre con acentos y ñ', () => {
      const result = validateNameField('María José Hernández');
      expect(result.valid).toBe(true);
    });

    it('acepta nombre con guiones y apóstrofes', () => {
      const result = validateNameField("Jean-Pierre D'Artagnan");
      expect(result.valid).toBe(true);
    });

    it('rechaza nombre con números', () => {
      const result = validateNameField('Usuario123');
      expect(result.valid).toBe(false);
    });
  });

  // ─── validateNotesField ─────────────────────────────────────────────────
  describe('validateNotesField', () => {
    it('acepta notas vacías (opcional)', () => {
      const result = validateNotesField('');
      expect(result.valid).toBe(true);
    });

    it('rechaza notas muy largas', () => {
      const result = validateNotesField('a'.repeat(1001), { maxLength: 1000 });
      expect(result.valid).toBe(false);
    });

    it('acepta notas válidas', () => {
      const result = validateNotesField('Nota de prueba');
      expect(result.valid).toBe(true);
    });

    it('sanitiza notas con HTML', () => {
      const result = validateNotesField('<script>alert(1)</script>Nota');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('alert(1)Nota');
    });
  });

  // ─── validateLocationField ──────────────────────────────────────────────
  describe('validateLocationField', () => {
    it('acepta ubicación vacía (opcional)', () => {
      const result = validateLocationField('');
      expect(result.valid).toBe(true);
    });

    it('rechaza ubicación muy larga', () => {
      const result = validateLocationField('a'.repeat(201));
      expect(result.valid).toBe(false);
    });

    it('acepta ubicación válida', () => {
      const result = validateLocationField('Puesto Norte');
      expect(result.valid).toBe(true);
    });
  });

  // ─── validateFormFields ─────────────────────────────────────────────────
  describe('validateFormFields', () => {
    it('valida múltiples campos correctamente', () => {
      const results = validateFormFields([
        { name: 'title', value: 'Mi turno', label: 'Título', required: true, type: 'text' },
        { name: 'email', value: 'user@empresa.com', label: 'Email', type: 'email' },
        { name: 'notes', value: 'Nota de prueba', label: 'Notas', type: 'notes' },
      ]);

      expect(isFormValid(results)).toBe(true);
      expect(results.title.valid).toBe(true);
      expect(results.email.valid).toBe(true);
      expect(results.notes.valid).toBe(true);
    });

    it('detecta campos inválidos', () => {
      const results = validateFormFields([
        { name: 'title', value: '', label: 'Título', required: true },
        { name: 'email', value: 'invalido', label: 'Email', type: 'email' },
      ]);

      expect(isFormValid(results)).toBe(false);
      expect(results.title.valid).toBe(false);
      expect(results.email.valid).toBe(false);
    });

    it('retorna valores sanitizados', () => {
      const results = validateFormFields([
        { name: 'title', value: '  <b>Turno</b>  ', label: 'Título', type: 'text' },
      ]);

      expect(results.title.sanitized).toBe('Turno');
    });
  });
});
