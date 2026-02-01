/**
 * @file sanitize.ts
 * Helper de sanitización para campos de texto.
 * Elimina etiquetas HTML para prevenir XSS almacenado.
 */

/**
 * Elimina cualquier etiqueta HTML del string.
 * Ejemplo: "<script>alert('xss')</script>Hola" → "Hola"
 */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Sanitiza un string opcional, eliminando etiquetas HTML.
 */
export function stripHtmlOptional(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return value;
  return stripHtml(value);
}
