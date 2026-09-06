import { Instruction, ParseResult, parseBrainfuck } from './parser';

export enum ExecutionState {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  WAITING_INPUT = 'WAITING_INPUT',
  TERMINATED = 'TERMINATED',
  ERROR = 'ERROR'
}

export interface EngineConfig {
  tapeSize?: number;
  cellWrapping?: boolean;
}

export interface ExecutionSnapshot {
  ip: number;
  ptr: number;
  cellIndex: number;
  prevCellValue: number;
  outputSnapshotLen: number;
  inputPtr: number;
}

export class BrainfuckEngine {
  public memory: Uint8Array;
  public ptr: number = 0;
  public ip: number = 0;
  public output: string = '';
  public state: ExecutionState = ExecutionState.READY;
  public errorMessage?: string;
  public stepCount: number = 0;

  private instructions: Instruction[] = [];
  private inputBuffer: number[] = [];
  private inputIndex: number = 0;
  private history: ExecutionSnapshot[] = [];
  private readonly maxHistoryLength = 50000;

  public readonly tapeSize: number;
  public readonly cellWrapping: boolean;
  public breakpoints = new Set<number>(); // instruction indices or source offsets

  constructor(sourceOrParseResult: string | ParseResult, config?: EngineConfig) {
    this.tapeSize = config?.tapeSize ?? 30000;
    this.cellWrapping = config?.cellWrapping ?? true;
    this.memory = new Uint8Array(this.tapeSize);

    const parseResult = typeof sourceOrParseResult === 'string'
      ? parseBrainfuck(sourceOrParseResult)
      : sourceOrParseResult;

    this.instructions = parseResult.instructions;

    // Detect breakpoints defined by '#'
    for (const instr of this.instructions) {
      if (instr.char === '#') {
        this.breakpoints.add(instr.index);
      }
    }
  }

  public getInstructions(): readonly Instruction[] {
    return this.instructions;
  }

  public currentInstruction(): Instruction | undefined {
    return this.instructions[this.ip];
  }

  public setInput(input: string) {
    this.inputBuffer = Array.from(input).map(c => c.charCodeAt(0) & 0xff);
    this.inputIndex = 0;
  }

  public provideInput(charCode: number) {
    if (this.state === ExecutionState.WAITING_INPUT) {
      const instr = this.instructions[this.ip];
      if (instr && instr.char === ',') {
        this.recordHistory(this.ptr, this.memory[this.ptr]);
        this.memory[this.ptr] = charCode & 0xff;
        this.ip++;
        this.stepCount++;
        this.state = this.ip >= this.instructions.length ? ExecutionState.TERMINATED : ExecutionState.PAUSED;
      }
    }
  }

  private recordHistory(changedCell: number, prevVal: number) {
    if (this.history.length >= this.maxHistoryLength) {
      this.history.shift();
    }
    this.history.push({
      ip: this.ip,
      ptr: this.ptr,
      cellIndex: changedCell,
      prevCellValue: prevVal,
      outputSnapshotLen: this.output.length,
      inputPtr: this.inputIndex
    });
  }

  public step(): boolean {
    if (this.state === ExecutionState.TERMINATED || this.state === ExecutionState.ERROR) {
      return false;
    }

    if (this.ip >= this.instructions.length) {
      this.state = ExecutionState.TERMINATED;
      return false;
    }

    const instr = this.instructions[this.ip];
    const prevCellIndex = this.ptr;
    const prevCellValue = this.memory[this.ptr];

    switch (instr.char) {
      case '>':
        this.recordHistory(prevCellIndex, prevCellValue);
        this.ptr++;
        if (this.ptr >= this.tapeSize) {
          this.ptr = 0; // wrap pointer
        }
        this.ip++;
        break;

      case '<':
        this.recordHistory(prevCellIndex, prevCellValue);
        this.ptr--;
        if (this.ptr < 0) {
          this.ptr = this.tapeSize - 1; // wrap pointer
        }
        this.ip++;
        break;

      case '+':
        this.recordHistory(prevCellIndex, prevCellValue);
        if (this.cellWrapping) {
          this.memory[this.ptr] = (this.memory[this.ptr] + 1) & 0xff;
        } else {
          this.memory[this.ptr] = Math.min(255, this.memory[this.ptr] + 1);
        }
        this.ip++;
        break;

      case '-':
        this.recordHistory(prevCellIndex, prevCellValue);
        if (this.cellWrapping) {
          this.memory[this.ptr] = (this.memory[this.ptr] - 1) & 0xff;
        } else {
          this.memory[this.ptr] = Math.max(0, this.memory[this.ptr] - 1);
        }
        this.ip++;
        break;

      case '.':
        this.recordHistory(prevCellIndex, prevCellValue);
        this.output += String.fromCharCode(this.memory[this.ptr]);
        this.ip++;
        break;

      case ',':
        if (this.inputIndex < this.inputBuffer.length) {
          this.recordHistory(prevCellIndex, prevCellValue);
          this.memory[this.ptr] = this.inputBuffer[this.inputIndex++];
          this.ip++;
        } else {
          this.state = ExecutionState.WAITING_INPUT;
          return false;
        }
        break;

      case '[':
        this.recordHistory(prevCellIndex, prevCellValue);
        if (this.memory[this.ptr] === 0) {
          if (instr.jumpTarget !== undefined) {
            this.ip = instr.jumpTarget + 1;
          } else {
            this.state = ExecutionState.ERROR;
            this.errorMessage = 'No matching closing bracket found.';
            return false;
          }
        } else {
          this.ip++;
        }
        break;

      case ']':
        this.recordHistory(prevCellIndex, prevCellValue);
        if (this.memory[this.ptr] !== 0) {
          if (instr.jumpTarget !== undefined) {
            this.ip = instr.jumpTarget + 1;
          } else {
            this.state = ExecutionState.ERROR;
            this.errorMessage = 'No matching opening bracket found.';
            return false;
          }
        } else {
          this.ip++;
        }
        break;

      case '#':
        // Debugger breakpoint
        this.recordHistory(prevCellIndex, prevCellValue);
        this.ip++;
        this.state = ExecutionState.PAUSED;
        this.stepCount++;
        return true;

      default:
        // Ignore comment characters
        this.ip++;
        break;
    }

    this.stepCount++;

    if (this.ip >= this.instructions.length) {
      this.state = ExecutionState.TERMINATED;
      return false;
    }

    if (this.breakpoints.has(this.ip)) {
      this.state = ExecutionState.PAUSED;
    }

    return true;
  }

  public stepBackward(): boolean {
    if (this.history.length === 0) {
      return false;
    }

    const snapshot = this.history.pop()!;
    this.memory[snapshot.cellIndex] = snapshot.prevCellValue;
    this.ptr = snapshot.ptr;
    this.ip = snapshot.ip;
    this.output = this.output.substring(0, snapshot.outputSnapshotLen);
    this.inputIndex = snapshot.inputPtr;
    this.stepCount = Math.max(0, this.stepCount - 1);
    this.state = ExecutionState.PAUSED;
    this.errorMessage = undefined;

    return true;
  }

  public canStepBackward(): boolean {
    return this.history.length > 0;
  }

  public reset() {
    this.memory.fill(0);
    this.ptr = 0;
    this.ip = 0;
    this.output = '';
    this.inputIndex = 0;
    this.history = [];
    this.stepCount = 0;
    this.state = ExecutionState.READY;
    this.errorMessage = undefined;
  }

  public runBatch(maxSteps = 100000): { stepsExecuted: number; state: ExecutionState } {
    let steps = 0;
    while (steps < maxSteps && this.state !== ExecutionState.TERMINATED && this.state !== ExecutionState.ERROR && this.state !== ExecutionState.WAITING_INPUT) {
      const continued = this.step();
      steps++;
      if (!continued || this.state === ExecutionState.PAUSED) {
        break;
      }
    }
    return { stepsExecuted: steps, state: this.state };
  }
}
