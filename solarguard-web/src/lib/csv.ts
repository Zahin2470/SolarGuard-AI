/** Minimal RFC 4180 CSV writer with spreadsheet formula-injection protection. */

export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : String(value);
  // Cells starting with = + - @ (or tab / CR) are executed as formulas by spreadsheets. Numbers are exempt.
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
