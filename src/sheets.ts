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
  } catch {
    throw new Error(
      `Can't reach Google Sheets. Check your internet connection and try again. ` +
      `If the problem persists, the sheet URL might be incorrect.`
    );
  }

  if (res.status === 404) {
    throw new Error(
      `Google Sheet not found. Check that the URL is correct and the sheet hasn't been deleted.`
    );
  }

  if (res.status === 403 || res.status === 401) {
    throw new Error(
      `Google Sheet is not accessible. Make sure the sheet is shared — ` +
      `open the sheet, click Share, and set it to "Anyone with the link can view."`
    );
  }

  if (!res.ok) {
    throw new Error(
      `Something went wrong when loading your Google Sheet. ` +
      `Check that the URL is correct and the sheet is shared as "Anyone with the link can view," then try again.`
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
    throw new Error('Your sheet appears to be empty. Make sure it has a header row and at least one test case below it.');
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
    throw new Error(
      'No test cases found in your sheet. Make sure your columns are: ' +
      'Question, What to check, Context, Metric, Severity — and that data starts on row 3 (row 1 is the header, row 2 is the example).'
    );
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
