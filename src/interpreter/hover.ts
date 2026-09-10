import { parseBrainfuck, Instruction } from './parser';

export interface HoverRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface HoverResult {
  title: string;
  description: string;
  details?: string[];
  codeSnippet?: string;
  range: HoverRange;
}

/**
 * Returns formatted printable ASCII representation for a byte value (0-255).
 */
export function getAsciiRepresentation(val: number): string | null {
  const byte = ((val % 256) + 256) % 256;
  if (byte >= 32 && byte <= 126) {
    return `'${String.fromCharCode(byte)}'`;
  }
  switch (byte) {
    case 0: return "'\\0' (Null byte)";
    case 7: return "'\\a' (Bell / Alert)";
    case 8: return "'\\b' (Backspace)";
    case 9: return "'\\t' (Horizontal Tab)";
    case 10: return "'\\n' (Newline / Line Feed)";
    case 11: return "'\\v' (Vertical Tab)";
    case 12: return "'\\f' (Form Feed)";
    case 13: return "'\\r' (Carriage Return)";
    case 27: return "'\\e' (Escape)";
    default: return null;
  }
}

/**
 * Detects common Brainfuck idioms starting at a given instruction index.
 */
function checkIdiom(instructions: Instruction[], startIndex: number): { name: string; desc: string; cEquiv: string; count: number } | null {
  const remaining = instructions.slice(startIndex);
  if (remaining.length < 3) return null;

  // 1. Clear Cell: [-] or [+]
  if (
    remaining[0].char === '[' &&
    (remaining[1].char === '-' || remaining[1].char === '+') &&
    remaining[2].char === ']' &&
    remaining[0].jumpTarget === remaining[2].index
  ) {
    return {
      name: 'Clear Cell',
      desc: 'Sets current cell to 0 by decrementing/incrementing until zero.',
      cEquiv: '*ptr = 0;',
      count: 3
    };
  }

  // 2. Scan to Zero: [>] or [<]
  if (
    remaining[0].char === '[' &&
    (remaining[1].char === '>' || remaining[1].char === '<') &&
    remaining[2].char === ']' &&
    remaining[0].jumpTarget === remaining[2].index
  ) {
    const dir = remaining[1].char === '>' ? 'right' : 'left';
    return {
      name: `Scan to Zero (${dir})`,
      desc: `Moves the pointer to the ${dir} until a cell with value 0 is found.`,
      cEquiv: `while (*ptr) ptr ${remaining[1].char === '>' ? '++' : '--'};`,
      count: 3
    };
  }

  // 3. Move Cell: [->+<] or [-<+>] or [>+<-] or [<+>-]
  if (remaining.length >= 6 && remaining[0].char === '[' && remaining[0].jumpTarget === remaining[5].index) {
    const chars = remaining.slice(0, 6).map(i => i.char).join('');
    if (chars === '[->+<]' || chars === '[-<+>]' || chars === '[>+<-]' || chars === '[<+>-]') {
      const targetOffset = (chars.includes('>') && chars.indexOf('>') < chars.indexOf('+')) ? 1 : -1;
      return {
        name: 'Move / Add Cell',
        desc: 'Adds the value of the current cell to adjacent cell and clears current cell.',
        cEquiv: `*(ptr + ${targetOffset}) += *ptr; *ptr = 0;`,
        count: 6
      };
    }
  }

  // 4. Copy Cell: [->+>+<<]
  if (remaining.length >= 9 && remaining[0].char === '[' && remaining[0].jumpTarget === remaining[8].index) {
    const chars = remaining.slice(0, 9).map(i => i.char).join('');
    if (chars === '[->+>+<<]' || chars === '[-<+<+>>]') {
      return {
        name: 'Copy Cell (with temporary)',
        desc: 'Copies current cell value to two destination cells and zeroes original cell.',
        cEquiv: 'ptr[1] += *ptr; ptr[2] += *ptr; *ptr = 0;',
        count: 9
      };
    }
  }

  return null;
}

/**
 * Calculates loop nesting depth for a given instruction index.
 */
function calculateLoopDepth(instructions: Instruction[], targetIdx: number): number {
  let depth = 0;
  for (let i = 0; i <= targetIdx; i++) {
    const instr = instructions[i];
    if (instr.char === '[') {
      if (instr.jumpTarget !== undefined && instr.jumpTarget >= targetIdx) {
        depth++;
      }
    }
  }
  return Math.max(1, depth);
}

/**
 * Core function to calculate hover information for a position in Brainfuck source code.
 */
export function getHoverInfo(source: string, line: number, col: number): HoverResult | null {
  const lines = source.split(/\r?\n/);
  if (line < 0 || line >= lines.length) return null;
  const currentLine = lines[line];
  if (col < 0 || col >= currentLine.length) return null;

  // 1. Check for Line Comments starting with // or ;
  const lineCommentMatch = /(?:\/\/|;).*/.exec(currentLine);
  if (lineCommentMatch && lineCommentMatch.index !== undefined && col >= lineCommentMatch.index) {
    const startCol = lineCommentMatch.index;
    const commentBody = currentLine.slice(startCol).trim();
    return {
      title: 'Line Comment',
      description: 'Ignored by the Brainfuck interpreter during execution.',
      codeSnippet: commentBody,
      range: {
        startLine: line,
        startCol,
        endLine: line,
        endCol: currentLine.length
      }
    };
  }

  // 2. Check for Multi-line Block Comments /* ... */
  let inBlockComment = false;
  let bStartLine = 0;
  let bStartCol = 0;
  let currLine = 0;
  let currCol = 0;

  for (let i = 0; i < source.length - 1; i++) {
    if (source[i] === '\n') {
      currLine++;
      currCol = 0;
      continue;
    } else if (source[i] === '\r') {
      continue;
    }

    if (!inBlockComment && source[i] === '/' && source[i + 1] === '*') {
      inBlockComment = true;
      bStartLine = currLine;
      bStartCol = currCol;
      i++;
      currCol += 2;
      continue;
    }

    if (inBlockComment && source[i] === '*' && source[i + 1] === '/') {
      const bEndLine = currLine;
      const bEndCol = currCol + 2;
      if (
        (line > bStartLine || (line === bStartLine && col >= bStartCol)) &&
        (line < bEndLine || (line === bEndLine && col <= bEndCol))
      ) {
        return {
          title: 'Block Comment',
          description: 'Multi-line block comment. All characters inside are ignored.',
          range: {
            startLine: bStartLine,
            startCol: bStartCol,
            endLine: bEndLine,
            endCol: bEndCol
          }
        };
      }
      inBlockComment = false;
      i++;
      currCol += 2;
      continue;
    }

    currCol++;
  }

  if (inBlockComment) {
    if (line > bStartLine || (line === bStartLine && col >= bStartCol)) {
      return {
        title: 'Block Comment (Unterminated)',
        description: 'Multi-line block comment reaching end of source.',
        range: {
          startLine: bStartLine,
          startCol: bStartCol,
          endLine: line,
          endCol: currentLine.length
        }
      };
    }
  }

  // 3. Parse Brainfuck to analyze instructions and bracket pairs
  const parseResult = parseBrainfuck(source);
  const instructions = parseResult.instructions;

  // Find instruction matching current (line, col)
  const instrIdx = instructions.findIndex(i => i.line === line && i.col === col);
  const targetChar = currentLine[col];

  // 4. Check for Loop Brackets [ and ] first when hovering directly on [ or ]
  if ((targetChar === '[' || targetChar === ']') && instrIdx !== -1) {
    const instr = instructions[instrIdx];
    const isOpening = targetChar === '[';
    const depth = calculateLoopDepth(instructions, instrIdx);
    const details: string[] = [`Loop Depth: **${depth}**`];

    // Check if this bracket is part of a recognized idiom
    let idiomInfo: { name: string; desc: string; cEquiv: string; count: number } | null = null;
    const checkStart = isOpening ? instrIdx : (instr.jumpTarget !== undefined ? instr.jumpTarget : -1);
    if (checkStart >= 0) {
      idiomInfo = checkIdiom(instructions, checkStart);
    }

    if (isOpening) {
      details.push('Condition: `while (*ptr != 0)`');
      if (instr.jumpTarget !== undefined) {
        const match = instructions[instr.jumpTarget];
        details.unshift(`Matches **\`]\`** at **Line ${match.line + 1}, Col ${match.col + 1}**`);
        const innerCount = match.index - instr.index - 1;
        details.push(`Inner Instructions: **${innerCount}** op(s)`);
      } else {
        details.unshift('⚠️ **Syntax Error:** Unclosed loop bracket (no matching `]` found).');
      }

      if (idiomInfo) {
        details.push(`✨ Idiom Pattern: **${idiomInfo.name}** (\`${idiomInfo.cEquiv}\`)`);
      }

      return {
        title: idiomInfo ? `Loop Start \`[\` (${idiomInfo.name})` : 'Loop Start `[`',
        description: 'Tests current cell value. If zero, jumps forward to matching `]`. If non-zero, executes loop body.',
        codeSnippet: idiomInfo ? idiomInfo.cEquiv : 'while (*ptr != 0) {',
        details,
        range: {
          startLine: line,
          startCol: col,
          endLine: line,
          endCol: col + 1
        }
      };
    } else {
      details.push('Jump Condition: `if (*ptr != 0) repeat`');
      if (instr.jumpTarget !== undefined) {
        const match = instructions[instr.jumpTarget];
        details.unshift(`Matches **\`[\`** at **Line ${match.line + 1}, Col ${match.col + 1}**`);
      } else {
        details.unshift('⚠️ **Syntax Error:** Unmatched closing bracket (no matching `[` found).');
      }

      if (idiomInfo) {
        details.push(`✨ Idiom Pattern: **${idiomInfo.name}** (\`${idiomInfo.cEquiv}\`)`);
      }

      return {
        title: idiomInfo ? `Loop End \`]\` (${idiomInfo.name})` : 'Loop End `]`',
        description: 'Tests current cell value. If non-zero, jumps back to loop start `[`. If zero, continues forward.',
        codeSnippet: '}',
        details,
        range: {
          startLine: line,
          startCol: col,
          endLine: line,
          endCol: col + 1
        }
      };
    }
  }

  // 5. Check for Idioms on internal operators (e.g. hovering on '-' in [-] or '+' in [->+<])
  if (instrIdx !== -1) {
    for (let checkStart = Math.max(0, instrIdx - 8); checkStart <= instrIdx; checkStart++) {
      const idiom = checkIdiom(instructions, checkStart);
      if (idiom) {
        const idiomEndIdx = checkStart + idiom.count - 1;
        if (instrIdx >= checkStart && instrIdx <= idiomEndIdx) {
          const firstInstr = instructions[checkStart];
          const lastInstr = instructions[idiomEndIdx];
          return {
            title: `Idiom: ${idiom.name}`,
            description: idiom.desc,
            codeSnippet: idiom.cEquiv,
            details: [
              `Pattern: \`${instructions.slice(checkStart, checkStart + idiom.count).map(i => i.char).join('')}\``,
              `Optimized equivalent: \`${idiom.cEquiv}\``
            ],
            range: {
              startLine: firstInstr.line,
              startCol: firstInstr.col,
              endLine: lastInstr.line,
              endCol: lastInstr.col + 1
            }
          };
        }
      }
    }
  }


  // 6. Check for Value Adjustment Run (+ / -)
  if (targetChar === '+' || targetChar === '-') {
    let startCol = col;
    while (startCol > 0 && (currentLine[startCol - 1] === '+' || currentLine[startCol - 1] === '-')) {
      startCol--;
    }
    let endCol = col;
    while (endCol < currentLine.length && (currentLine[endCol] === '+' || currentLine[endCol] === '-')) {
      endCol++;
    }

    const run = currentLine.slice(startCol, endCol);
    let net = 0;
    for (let c of run) {
      net += c === '+' ? 1 : -1;
    }

    const netSign = net > 0 ? `+${net}` : `${net}`;
    const hex = '0x' + (((net % 256) + 256) % 256).toString(16).toUpperCase().padStart(2, '0');
    const ascii = getAsciiRepresentation(net);

    const details = [
      `Net Change: **${netSign}** (${run.length} total operation${run.length > 1 ? 's' : ''})`,
      `Hex Equivalent (mod 256): \`${hex}\``
    ];
    if (ascii) {
      details.push(`ASCII Character: **${ascii}**`);
    }

    return {
      title: `Cell Value Adjustment: \`${netSign}\``,
      description: `${net >= 0 ? 'Increments' : 'Decrements'} current cell value by **${Math.abs(net)}**.`,
      codeSnippet: `*ptr += ${netSign};`,
      details,
      range: {
        startLine: line,
        startCol,
        endLine: line,
        endCol
      }
    };
  }

  // 7. Check for Pointer Movement Run (> / <)
  if (targetChar === '>' || targetChar === '<') {
    let startCol = col;
    while (startCol > 0 && (currentLine[startCol - 1] === '>' || currentLine[startCol - 1] === '<')) {
      startCol--;
    }
    let endCol = col;
    while (endCol < currentLine.length && (currentLine[endCol] === '>' || currentLine[endCol] === '<')) {
      endCol++;
    }

    const run = currentLine.slice(startCol, endCol);
    let net = 0;
    for (let c of run) {
      net += c === '>' ? 1 : -1;
    }

    const dir = net >= 0 ? 'right (>)' : 'left (<)';
    const netSign = net > 0 ? `+${net}` : `${net}`;

    return {
      title: `Pointer Shift: \`${netSign}\``,
      description: `Moves the memory pointer **${Math.abs(net)}** cell(s) to the ${dir}.`,
      codeSnippet: `ptr += ${netSign};`,
      details: [
        `Net Offset: **${netSign}** (${run.length} shift${run.length > 1 ? 's' : ''})`,
        `Direction: **${net >= 0 ? 'Right' : 'Left'}**`
      ],
      range: {
        startLine: line,
        startCol,
        endLine: line,
        endCol
      }
    };
  }

  // 8. Output (.) Instruction
  if (targetChar === '.') {
    return {
      title: 'Output Byte `.`',
      description: 'Outputs the byte at the memory pointer to STDOUT as an ASCII character.',
      codeSnippet: 'putchar(*ptr);',
      details: ['Target: **Standard Output Console**'],
      range: {
        startLine: line,
        startCol: col,
        endLine: line,
        endCol: col + 1
      }
    };
  }

  // 9. Input (,) Instruction
  if (targetChar === ',') {
    return {
      title: 'Input Byte `,`',
      description: 'Reads a single byte from input stream and stores it in current cell.',
      codeSnippet: '*ptr = getchar();',
      details: ['Source: **Standard Input Buffer**'],
      range: {
        startLine: line,
        startCol: col,
        endLine: line,
        endCol: col + 1
      }
    };
  }

  // 10. Breakpoint (#) Instruction
  if (targetChar === '#') {
    return {
      title: 'Debugger Breakpoint `#`',
      description: 'Pauses execution when running inside the Visual Memory Tape Debugger.',
      codeSnippet: '// Breakpoint: Pause debugger',
      details: [
        'Enables inspecting tape cells, memory array, pointer index, and time-travel steps.',
        'Ignored by standard headless runners or treated as pause.'
      ],
      range: {
        startLine: line,
        startCol: col,
        endLine: line,
        endCol: col + 1
      }
    };
  }

  return null;
}
