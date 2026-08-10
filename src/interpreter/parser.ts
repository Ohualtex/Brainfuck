export interface Instruction {
  char: string;
  index: number;
  sourceOffset: number;
  line: number;
  col: number;
  jumpTarget?: number;
}
export interface ParseResult {
  instructions: Instruction[];
  errors: any[];
  bracketPairs: Map<number, number>;
}
const VALID_CHARS = new Set(['>', '<', '+', '-', '.', ',', '[', ']', '#']);
export function parseBrainfuck(source: string): ParseResult {
  const instructions: Instruction[] = [];
  const bracketStack: Instruction[] = [];
  const bracketPairs = new Map<number, number>();
  let line = 0, col = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\n') { line++; col = 0; continue; }
    if (VALID_CHARS.has(ch)) {
      const instr = { char: ch, index: instructions.length, sourceOffset: i, line, col };
      instructions.push(instr);
      if (ch === '[') bracketStack.push(instr);
      else if (ch === ']' && bracketStack.length > 0) {
        const open = bracketStack.pop()!;
        bracketPairs.set(open.index, instr.index);
        bracketPairs.set(instr.index, open.index);
      }
    }
    col++;
  }
  return { instructions, errors: [], bracketPairs };
}
