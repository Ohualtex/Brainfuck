export interface Instruction {
  char: string;
  index: number;
  sourceOffset: number;
  line: number;
  col: number;
  jumpTarget?: number;
}

export interface ParseError {
  message: string;
  line: number;
  col: number;
  offset: number;
  length: number;
}

export interface ParseResult {
  instructions: Instruction[];
  errors: ParseError[];
  bracketPairs: Map<number, number>; // Maps instruction index to matching instruction index
}

const VALID_CHARS = new Set(['>', '<', '+', '-', '.', ',', '[', ']', '#']);

export function parseBrainfuck(source: string): ParseResult {
  const instructions: Instruction[] = [];
  const errors: ParseError[] = [];
  const bracketStack: Instruction[] = [];
  const bracketPairs = new Map<number, number>();

  let line = 0;
  let col = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === '\n' || ch === '\r') {
      if (ch === '\n') line++;
      col = 0;
      continue;
    }

    // Ignore punctuation attached to words in comments (e.g. console., Hello,)
    if ((ch === '.' || ch === ',' || ch === '+' || ch === '-') && i > 0 && /[a-zA-Z]/.test(source[i - 1])) {
      col++;
      continue;
    }

    // Skip line comments starting with // or ;
    if ((ch === '/' && source[i + 1] === '/') || ch === ';') {
      while (i < source.length && source[i] !== '\n') i++;
      line++;
      col = 0;
      continue;
    }

    // Skip [ ... ] header comment blocks where [ is followed by letters (e.g. [ Brainfuck Echo Program ... ])
    if (ch === '[' && (instructions.length === 0 || i < 10)) {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j++;
      if (j < source.length && /[a-zA-Z]/.test(source[j])) {
        while (j < source.length && source[j] !== ']') j++;
        if (j < source.length && source[j] === ']') {
          i = j;
          continue;
        }
      }
    }

    if (VALID_CHARS.has(ch)) {
      const instr: Instruction = {
        char: ch,
        index: instructions.length,
        sourceOffset: i,
        line,
        col
      };
      instructions.push(instr);

      if (ch === '[') {
        bracketStack.push(instr);
      } else if (ch === ']') {
        if (bracketStack.length === 0) {
          errors.push({
            message: 'Unmatched closing bracket: No matching "[" found.',
            line,
            col,
            offset: i,
            length: 1
          });
        } else {
          const openInstr = bracketStack.pop()!;
          openInstr.jumpTarget = instr.index;
          instr.jumpTarget = openInstr.index;
          bracketPairs.set(openInstr.index, instr.index);
          bracketPairs.set(instr.index, openInstr.index);

          // Check for empty loop warning: []
          if (instr.index === openInstr.index + 1) {
            errors.push({
              message: 'Empty loop "[]": May cause an infinite loop if cell value is non-zero.',
              line: openInstr.line,
              col: openInstr.col,
              offset: openInstr.sourceOffset,
              length: 2
            });
          }
        }
      }
    }

    col++;
  }

  // Any leftover unclosed brackets?
  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop()!;
    errors.push({
      message: 'Unclosed loop bracket: No matching "]" found.',
      line: unclosed.line,
      col: unclosed.col,
      offset: unclosed.sourceOffset,
      length: 1
    });
  }

  return {
    instructions,
    errors,
    bracketPairs
  };
}
