import { TextDecoder } from 'util';

export const CSV_HEADERS = ['employeeId', 'name', 'email', 'role', 'status', 'department', 'branchId', 'companyPhone', 'auxiliaryPhone'] as const;
const CSV_DELIMITERS = [',', ';', '\t', '|'] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];
export type UserCsvRow = Record<CsvHeader, string>;
type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export function decodeCsvBuffer(bytes: Buffer): string {
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

function extractFirstRow(text: string): string {
  let row = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        row += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      break;
    }

    row += char;
  }

  return row;
}

function scoreHeaderByDelimiter(headerRow: string, delimiter: CsvDelimiter): { matches: number; columns: number } {
  const columns = parseCsv(headerRow, delimiter)[0] ?? [];
  const normalizedHeaderSet = new Set(columns.map((column) => column.trim().toLowerCase()));
  const matches = CSV_HEADERS.filter((header) => normalizedHeaderSet.has(header.toLowerCase())).length;
  return { matches, columns: columns.length };
}

export function detectCsvDelimiter(text: string): CsvDelimiter {
  const headerRow = extractFirstRow(text.replace(/^\uFEFF/, '').trim());
  if (!headerRow) return ',';

  let bestDelimiter: CsvDelimiter = ',';
  let bestScore = { matches: -1, columns: -1 };

  for (const delimiter of CSV_DELIMITERS) {
    const score = scoreHeaderByDelimiter(headerRow, delimiter);
    if (score.matches > bestScore.matches || (score.matches === bestScore.matches && score.columns > bestScore.columns)) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

export function parseCsv(text: string, delimiter: CsvDelimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  const pushValue = () => {
    row.push(value);
    value = '';
  };

  const pushRow = () => {
    if (row.length > 0 || value.length > 0) {
      pushValue();
      rows.push(row);
      row = [];
    }
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      pushValue();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushRow();
      continue;
    }

    value += char;
  }

  pushRow();
  return rows;
}

export function parseUserCsv(text: string): UserCsvRow[] {
  const sanitizedText = text.replace(/^\uFEFF/, '').trim();
  if (!sanitizedText) {
    throw new Error('El CSV está vacío');
  }

  const delimiter = detectCsvDelimiter(sanitizedText);
  const matrix = parseCsv(sanitizedText, delimiter);
  if (!matrix.length) {
    throw new Error('No se encontraron datos en el CSV');
  }

  const headers = matrix[0].map((header) => header.trim());
  const missingHeaders = CSV_HEADERS.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Faltan columnas obligatorias en el CSV: ${missingHeaders.join(', ')}`);
  }

  return matrix
    .slice(1)
    .filter((row) => row.some((cell) => (cell ?? '').trim().length > 0))
    .map((row) => {
      const mapped = {} as UserCsvRow;
      CSV_HEADERS.forEach((header) => {
        const index = headers.indexOf(header);
        mapped[header] = (row[index] ?? '').trim();
      });
      return mapped;
    });
}
