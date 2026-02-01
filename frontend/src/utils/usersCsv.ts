const CSV_HEADERS = ['employeeId', 'name', 'email', 'role', 'status', 'department', 'branchId', 'companyPhone', 'auxiliaryPhone'] as const;
const CSV_DELIMITERS = [',', ';', '\t', '|'] as const;

export type UsersCsvHeader = (typeof CSV_HEADERS)[number];
export type UsersCsvRow = Record<UsersCsvHeader, string>;
export type UsersCsvDelimiter = (typeof CSV_DELIMITERS)[number];

export const USERS_CSV_HEADERS = CSV_HEADERS;

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: Array<Record<string, string>>, headers: string[]) {
  const lines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? '')).join(','));
  return [headers.join(','), ...lines].join('\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function decodeCsvFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return '';

  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function parseCsvLine(line: string, delimiter: UsersCsvDelimiter): string[] {
  const cells: string[] = [];
  let value = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { value += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (char === delimiter && !inQuotes) { cells.push(value); value = ''; continue; }
    value += char;
  }
  cells.push(value);
  return cells;
}

export function detectCsvDelimiter(headerLine: string): UsersCsvDelimiter {
  const normalizedHeaderLine = headerLine.replace(/^\uFEFF/, '').trim();
  if (!normalizedHeaderLine) return ',';
  let bestDelimiter: UsersCsvDelimiter = ',';
  let bestMatches = -1;
  let bestColumns = -1;
  for (const delimiter of CSV_DELIMITERS) {
    const headers = parseCsvLine(normalizedHeaderLine, delimiter).map((column) => column.trim().toLowerCase());
    const headerSet = new Set(headers);
    const matches = CSV_HEADERS.filter((header) => headerSet.has(header.toLowerCase())).length;
    if (matches > bestMatches || (matches === bestMatches && headers.length > bestColumns)) {
      bestDelimiter = delimiter;
      bestMatches = matches;
      bestColumns = headers.length;
    }
  }
  return bestDelimiter;
}