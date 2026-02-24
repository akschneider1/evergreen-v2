/**
 * Google Sheets connector.
 *
 * Fetches a published Google Sheet as CSV and parses it into typed SheetRows.
 * Requires the sheet to be shared as "Anyone with the link can view."
 * No API key or OAuth needed — just the sheet ID.
 */

import { SheetRow, EvalMetric, Severity } from './types';

/** Maps display names (as they appear in the Google Sheet) to EvalMetric values */
const METRIC_DISPLAY_MAP: Record<string, EvalMetric> = {
  'safety':        'safety',
  'accuracy':      'accuracy',
  'ease of use':   'ease-of-use',
  'ease-of-use':   'ease-of-use',
  'effectiveness': 'effectiveness',
  'emotion':       'emotion',
};

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

/**
 * Extract a bare Google Sheet ID from either a full Sheets URL or a bare ID.
 *
 * Handles URLs like:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 * and passes bare IDs through unchanged.
 */
export function extractSheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

/**
 * Fetch a Google Sheet as CSV and parse into SheetRows.
 *
 * @param sheetId  The Google Sheet ID (from the URL)
 * @param gid      The sheet tab GID (default "0" = first tab)
 */
export async function fetchSheet(sheetId: string, gid = '0'): Promise<SheetRow[]> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not connect to Google Sheets. Check your internet connection.\n` +
      `  Sheet ID: ${sheetId}\n` +
      `  Details: ${detail}`
    );
  }

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Google Sheet (HTTP ${res.status}). ` +
      `Make sure the sheet is shared as "Anyone with the link can view." ` +
      `Sheet ID: ${sheetId}`
    );
  }

  const csv = await res.text();
  return parseCsv(csv);
}

/**
 * Parse CSV text into SheetRows.
 * Expected columns: Question, What to check, Context, Metric, Severity
 * First row is treated as a header and skipped.
 */
export function parseCsv(csv: string): SheetRow[] {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) {
    throw new Error('Sheet appears empty — expected a header row plus at least one test case.');
  }

  const rows: SheetRow[] = [];
  // Skip header (line 0) and example/instruction row (line 1 = spreadsheet row 2)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 5) {
      console.warn(`Row ${i + 1}: expected 5 columns, got ${cols.length} — skipping.`);
      continue;
    }

    const [question, expectedAnswer, context, rawMetric, rawSeverity] = cols;

    if (!question.trim()) {
      continue; // Skip blank questions
    }

    const metric = normalizeMetric(rawMetric.trim().toLowerCase(), i + 1);
    const severity = normalizeSeverity(rawSeverity.trim().toLowerCase(), i + 1);

    rows.push({
      question: question.trim(),
      expectedAnswer: expectedAnswer.trim(),
      context: context.trim(),
      metric,
      severity,
    });
  }

  if (rows.length === 0) {
    throw new Error('No valid test cases found in the sheet. Check that columns are: Question, What to check, Context, Metric, Severity');
  }

  return rows;
}

/** Parse a single CSV line, handling quoted fields with commas inside. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function normalizeMetric(raw: string, row: number): EvalMetric {
  const mapped = METRIC_DISPLAY_MAP[raw];
  if (mapped) return mapped;

  console.warn(`Row ${row}: unknown metric "${raw}", defaulting to "accuracy". Valid values: Safety, Accuracy, Ease of Use, Effectiveness, Emotion.`);
  return 'accuracy';
}

function normalizeSeverity(raw: string, row: number): Severity {
  if (VALID_SEVERITIES.includes(raw as Severity)) {
    return raw as Severity;
  }
  console.warn(`Row ${row}: unknown severity "${raw}", defaulting to "medium".`);
  return 'medium';
}
