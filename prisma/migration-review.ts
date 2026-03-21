export type SqlDanger = {
  line: number;
  content: string;
  pattern: string;
};

const DANGEROUS_PATTERNS: Array<{ pattern: string; regex: RegExp }> = [
  { pattern: "DROP TABLE", regex: /\bDROP\s+TABLE\b/i },
  { pattern: "DROP COLUMN", regex: /\bDROP\s+COLUMN\b/i },
  { pattern: "ALTER COLUMN TYPE", regex: /\bALTER\s+COLUMN\b.*\bTYPE\b/i },
  { pattern: "SET NOT NULL", regex: /\bSET\s+NOT\s+NULL\b/i },
  { pattern: "DROP INDEX", regex: /\bDROP\s+INDEX\b/i },
  { pattern: "DROP CONSTRAINT", regex: /\bDROP\s+CONSTRAINT\b/i },
  { pattern: "TRUNCATE", regex: /\bTRUNCATE\b/i },
  { pattern: "DELETE FROM", regex: /\bDELETE\s+FROM\b/i },
  {
    pattern: "ALTER TYPE RENAME VALUE",
    regex: /\bALTER\s+TYPE\b.*\bRENAME\s+VALUE\b/i,
  },
];

/**
 * Strips SQL comments from a string, returning an array that maps
 * each original line number to its comment-stripped content.
 * Line numbers are 1-based.
 */
function stripComments(sql: string): Map<number, string> {
  const lines = sql.split("\n");
  const result = new Map<number, string>();
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNum = i + 1;

    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx === -1) {
        result.set(lineNum, "");
        continue;
      }
      line = line.substring(endIdx + 2);
      inBlockComment = false;
    }

    // Remove block comments that start and end on the same line
    line = line.replace(/\/\*.*?\*\//g, "");

    // Check for block comment that starts but doesn't end on this line
    const blockStart = line.indexOf("/*");
    if (blockStart !== -1) {
      line = line.substring(0, blockStart);
      inBlockComment = true;
    }

    // Remove line comments
    const lineCommentIdx = line.indexOf("--");
    if (lineCommentIdx !== -1) {
      line = line.substring(0, lineCommentIdx);
    }

    result.set(lineNum, line);
  }

  return result;
}

/**
 * Scans SQL for dangerous patterns that could cause data loss or breakage.
 * Returns an array of detected dangers with line numbers, content, and pattern names.
 */
export function scanSqlForDangers(sql: string): SqlDanger[] {
  const strippedLines = stripComments(sql);
  const originalLines = sql.split("\n");
  const dangers: SqlDanger[] = [];

  // Check if SET DEFAULT exists in the migration (makes SET NOT NULL safe)
  const hasSetDefault = Array.from(strippedLines.values()).some((line) =>
    /\bSET\s+DEFAULT\b/i.test(line)
  );

  for (const [lineNum, strippedLine] of strippedLines) {
    if (!strippedLine.trim()) continue;

    for (const { pattern, regex } of DANGEROUS_PATTERNS) {
      if (!regex.test(strippedLine)) continue;

      // SET NOT NULL is safe if SET DEFAULT exists in the same migration
      if (pattern === "SET NOT NULL" && hasSetDefault) continue;

      dangers.push({
        line: lineNum,
        content: originalLines[lineNum - 1],
        pattern,
      });
    }
  }

  return dangers;
}

/**
 * Checks whether a migration has been approved in the reviewed allowlist.
 * Returns approved: true only if the migration name exists AND has a
 * non-empty justification string.
 */
export function checkReviewedAllowlist(
  migrationName: string,
  reviewed: Record<string, string>
): { approved: boolean; justification?: string } {
  const justification = reviewed[migrationName];
  if (justification && justification.trim().length > 0) {
    return { approved: true, justification };
  }
  return { approved: false };
}
