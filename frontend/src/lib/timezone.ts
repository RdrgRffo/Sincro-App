/**
 * Utilidades para manejo de zonas horarias.
 *
 * Estrategia: el backend almacena todo en UTC. El frontend convierte
 * a la zona horaria de la sucursal para mostrar, y convierte de
 * la zona horaria de la sucursal a UTC para enviar.
 *
 * Zonas soportadas: Europe/Madrid (UTC+1/+2) y Atlantic/Canary (UTC+0/+1)
 */

/**
 * Convierte una fecha UTC a un string formateado en la zona horaria indicada.
 * Si no se especifica timezone, usa la del navegador.
 */
export function formatInTimezone(
  date: string | Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    ...options,
  };
  return new Intl.DateTimeFormat('es-ES', defaultOptions).format(d);
}

/**
 * Formatea solo la hora (HH:mm) en la zona horaria indicada.
 */
export function formatTimeInTimezone(date: string | Date, timezone: string): string {
  return formatInTimezone(date, timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formatea fecha completa en la zona horaria indicada.
 */
export function formatDateInTimezone(date: string | Date, timezone: string): string {
  return formatInTimezone(date, timezone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Convierte una fecha UTC a un objeto Date que representa la misma
 * hora "local" en la timezone destino.
 *
 * Ejemplo: Si son las 08:00 UTC y la timezone es Europe/Madrid (UTC+2),
 * devuelve un Date que representa las 08:00 (no las 10:00).
 * Esto es útil para inputs de tipo time o date que trabajan con hora local.
 */
export function utcToTimezoneDate(date: string | Date, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * Convierte una fecha expresada en hora local de una timezone a UTC.
 *
 * Ejemplo: Si son las 08:00 en Europe/Madrid (UTC+2),
 * devuelve un Date que representa las 06:00 UTC.
 */
export function timezoneToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Construimos un string ISO "local" (sin Z) para que JS lo interprete como hora local
  const localStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  // Esto es la hora "local" tratada como UTC (punto de referencia)
  const utcDate = new Date(localStr + 'Z');

  // Obtenemos qué hora "local" representa en la timezone destino.
  // Al pasar localStr sin Z, JS lo interpreta como UTC (ISO string sin timezone = UTC).
  // Luego Intl.DateTimeFormat con timeZone calcula la hora local en esa timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  }).formatToParts(new Date(localStr + 'Z'));

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const tzLocal = new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offsetMs = tzLocal.getTime() - utcDate.getTime();

  return new Date(utcDate.getTime() - offsetMs);
}
