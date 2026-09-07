import { parseBrainfuck } from './parser';

export function formatBrainfuckSource(source: string, tabSize = 2, insertSpaces = true): string {
  const indentStr = insertSpaces ? ' '.repeat(tabSize) : '\t';

  let indentLevel = 0;
  let formatted = '';
  let currentLine = '';

  const flushLine = () => {
    if (currentLine.trim().length > 0) {
      formatted += indentStr.repeat(Math.max(0, indentLevel)) + currentLine.trim() + '\n';
      currentLine = '';
    }
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === '[') {
      currentLine += '[';
      flushLine();
      indentLevel++;
    } else if (ch === ']') {
      flushLine();
      indentLevel = Math.max(0, indentLevel - 1);
      currentLine = ']';
      flushLine();
    } else if (ch === '\n') {
      flushLine();
    } else {
      currentLine += ch;
    }
  }
  flushLine();

  return formatted.trimEnd() + '\n';
}

export function minifyBrainfuckSource(source: string): string {
  const parseResult = parseBrainfuck(source);
  return parseResult.instructions.map(i => i.char).join('');
}
