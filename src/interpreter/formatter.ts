import { parseBrainfuck } from './parser';

export function formatBrainfuckSource(source: string, tabSize = 2, insertSpaces = true): string {
  const indentStr = insertSpaces ? ' '.repeat(tabSize) : '\t';

  let indentLevel = 0;
  let formatted = '';
  let currentLine = '';

  const flushLine = () => {
    const trimmed = currentLine.trim();
    if (trimmed.length > 0) {
      formatted += indentStr.repeat(Math.max(0, indentLevel)) + trimmed + '\n';
      currentLine = '';
    }
  };

  const lines = source.split(/\r?\n/);

  for (let l = 0; l < lines.length; l++) {
    const rawLine = lines[l];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushLine();
      // Retain single empty line between blocks if output doesn't already end with double newline
      if (formatted.length > 0 && !formatted.endsWith('\n\n')) {
        formatted += '\n';
      }
      continue;
    }

    // Check if entire line is a comment
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith(';') ||
      trimmed.startsWith('# ') ||
      trimmed === '#'
    ) {
      flushLine();
      formatted += indentStr.repeat(Math.max(0, indentLevel)) + trimmed + '\n';
      continue;
    }

    // Check for inline trailing comments (//, ;, or # with leading whitespace)
    let codePart = rawLine;
    let commentPart = '';
    const commentMatch = /(?:\/\/|;|\s#\s).*/.exec(rawLine);
    if (commentMatch && commentMatch.index !== undefined) {
      codePart = rawLine.slice(0, commentMatch.index);
      commentPart = commentMatch[0].trim();
    }

    // Format the code portion
    for (let i = 0; i < codePart.length; i++) {
      const ch = codePart[i];

      if (ch === '[') {
        currentLine += '[';
        flushLine();
        indentLevel++;
      } else if (ch === ']') {
        flushLine();
        indentLevel = Math.max(0, indentLevel - 1);
        currentLine = ']';
        flushLine();
      } else {
        currentLine += ch;
      }
    }

    if (commentPart) {
      if (currentLine.trim().length > 0) {
        currentLine += ' ' + commentPart;
        flushLine();
      } else {
        formatted += indentStr.repeat(Math.max(0, indentLevel)) + commentPart + '\n';
      }
    } else {
      flushLine();
    }
  }

  flushLine();
  return formatted.trimEnd() + '\n';
}

export function minifyBrainfuckSource(source: string): string {
  const parseResult = parseBrainfuck(source);
  return parseResult.instructions.map(i => i.char).join('');
}
