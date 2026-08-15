import { Instruction, ParseResult, parseBrainfuck } from './parser';

export enum ExecutionState { READY = 'READY', RUNNING = 'RUNNING', PAUSED = 'PAUSED', WAITING_INPUT = 'WAITING_INPUT', TERMINATED = 'TERMINATED', ERROR = 'ERROR' }
export interface EngineConfig { tapeSize?: number; cellWrapping?: boolean; }

export class BrainfuckEngine {
  public memory: Uint8Array;
  public ptr: number = 0;
  public ip: number = 0;
  public output: string = '';
  public state: ExecutionState = ExecutionState.READY;
  public stepCount: number = 0;
  public readonly tapeSize: number;
  public readonly cellWrapping: boolean;
  protected instructions: Instruction[] = [];

  public step(): boolean {
    if (this.ip >= this.instructions.length) { this.state = ExecutionState.TERMINATED; return false; }
    const instr = this.instructions[this.ip];
    switch (instr.char) {
      case '>': this.ptr++; if (this.ptr >= this.tapeSize) this.ptr = 0; this.ip++; break;
      case '<': this.ptr--; if (this.ptr < 0) this.ptr = this.tapeSize - 1; this.ip++; break;
      case '+': this.memory[this.ptr] = this.cellWrapping ? (this.memory[this.ptr] + 1) & 0xff : Math.min(255, this.memory[this.ptr] + 1); this.ip++; break;
      case '-': this.memory[this.ptr] = this.cellWrapping ? (this.memory[this.ptr] - 1) & 0xff : Math.max(0, this.memory[this.ptr] - 1); this.ip++; break;
      case '[':
        if (this.memory[this.ptr] === 0 && instr.jumpTarget !== undefined) this.ip = instr.jumpTarget + 1;
        else this.ip++;
        break;
      case ']':
        if (this.memory[this.ptr] !== 0 && instr.jumpTarget !== undefined) this.ip = instr.jumpTarget + 1;
        else this.ip++;
        break;
      case '.':
        this.output += String.fromCharCode(this.memory[this.ptr]);
        this.ip++;
        break;
      default: this.ip++; break;
    }
    this.stepCount++;
    return true;
  }
  constructor(sourceOrParseResult: string | ParseResult, config?: EngineConfig) {
    this.tapeSize = config?.tapeSize ?? 30000;
    this.cellWrapping = config?.cellWrapping ?? true;
    this.memory = new Uint8Array(this.tapeSize);
    const pr = typeof sourceOrParseResult === 'string' ? parseBrainfuck(sourceOrParseResult) : sourceOrParseResult;
    this.instructions = pr.instructions;
  }
}

  public runBatch(maxSteps = 100000): { stepsExecuted: number; state: ExecutionState } {
    let steps = 0;
    while (steps < maxSteps && this.state !== ExecutionState.TERMINATED && this.state !== ExecutionState.ERROR) {
      const ok = this.step();
      steps++;
      if (!ok) break;
    }
    return { stepsExecuted: steps, state: this.state };
  }
