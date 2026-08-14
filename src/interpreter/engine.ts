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

  constructor(sourceOrParseResult: string | ParseResult, config?: EngineConfig) {
    this.tapeSize = config?.tapeSize ?? 30000;
    this.cellWrapping = config?.cellWrapping ?? true;
    this.memory = new Uint8Array(this.tapeSize);
    const pr = typeof sourceOrParseResult === 'string' ? parseBrainfuck(sourceOrParseResult) : sourceOrParseResult;
    this.instructions = pr.instructions;
  }
}
