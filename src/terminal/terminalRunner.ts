import * as vscode from 'vscode';
import { BrainfuckEngine, ExecutionState } from '../interpreter/engine';
import { FastBrainfuckEngine } from '../interpreter/ir';
import { parseBrainfuck } from '../interpreter/parser';

let activeTerminal: vscode.Terminal | undefined;
let activePty: BrainfuckPseudoterminal | undefined;

export class BrainfuckPseudoterminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  public readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<number>();
  public readonly onDidClose: vscode.Event<number> = this.closeEmitter.event;

  private inputQueue: number[] = [];
  private currentLine: string = '';
  private waitingInputResolver: ((byte: number) => void) | null = null;
  private isRunning: boolean = false;
  private isAborted: boolean = false;

  constructor(
    private document: vscode.TextDocument,
    private config: vscode.WorkspaceConfiguration
  ) {}

  public open(): void {
    this.startExecution();
  }

  public close(): void {
    this.isAborted = true;
    if (this.waitingInputResolver) {
      const resolver = this.waitingInputResolver;
      this.waitingInputResolver = null;
      resolver(-1);
    }
  }

  public handleInput(data: string): void {
    // Check for Ctrl+C (ASCII 3)
    if (data === '\x03') {
      this.writeEmitter.fire('^C\r\n\x1b[33m[Execution interrupted by user]\x1b[0m\r\n');
      this.isAborted = true;
      if (this.waitingInputResolver) {
        const resolver = this.waitingInputResolver;
        this.waitingInputResolver = null;
        resolver(-1);
      }
      return;
    }

    // Process character by character
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];

      if (ch === '\r' || ch === '\n') {
        // User pressed Enter
        this.writeEmitter.fire('\r\n');
        // Push line characters into the input queue followed by newline
        for (let j = 0; j < this.currentLine.length; j++) {
          this.inputQueue.push(this.currentLine.charCodeAt(j) & 0xff);
        }
        this.inputQueue.push(10); // LF '\n'
        this.currentLine = '';

        // If engine is currently waiting for input, resolve it immediately
        this.flushWaitingInput();
      } else if (ch === '\x7f' || ch === '\x08') {
        // Backspace
        if (this.currentLine.length > 0) {
          this.currentLine = this.currentLine.slice(0, -1);
          this.writeEmitter.fire('\b \b');
        }
      } else if (ch >= ' ' || ch === '\t') {
        // Printable character or tab
        this.currentLine += ch;
        this.writeEmitter.fire(ch); // Local terminal echo
      }
    }
  }

  private flushWaitingInput(): void {
    if (this.waitingInputResolver && this.inputQueue.length > 0) {
      const nextByte = this.inputQueue.shift()!;
      const resolver = this.waitingInputResolver;
      this.waitingInputResolver = null;
      resolver(nextByte);
    }
  }

  private waitForNextByte(): Promise<number> {
    if (this.inputQueue.length > 0) {
      return Promise.resolve(this.inputQueue.shift()!);
    }
    return new Promise<number>(resolve => {
      this.waitingInputResolver = resolve;
    });
  }

  private async startExecution(): Promise<void> {
    this.isRunning = true;
    this.isAborted = false;

    const fileName = this.document.fileName.split(/[/\\]/).pop() || 'script.bf';
    const source = this.document.getText();
    const parseResult = parseBrainfuck(source);

    // Header Banner
    this.writeEmitter.fire('\r\n\x1b[1;36m[Brainfuck Terminal]\x1b[0m Running \x1b[1;33m' + fileName + '\x1b[0m\r\n');
    this.writeEmitter.fire('\x1b[90m----------------------------------------------------\x1b[0m\r\n');

    const errors = parseResult.errors.filter(e => !e.message.includes('Empty loop'));
    if (errors.length > 0) {
      this.writeEmitter.fire(
        `\x1b[31m✖ [SYNTAX ERROR]\x1b[0m ${errors[0].message} (Line ${errors[0].line + 1})\r\n`
      );
      this.writeEmitter.fire('\x1b[90m----------------------------------------------------\x1b[0m\r\n');
      this.isRunning = false;
      return;
    }

    const tapeSize = this.config.get<number>('tapeSize', 30000);
    const cellWrapping = this.config.get<boolean>('cellWrapping', true);
    const optLevel = this.config.get<string>('execution.optimizationLevel', 'aggressive');
    const useFastEngine = optLevel !== 'none';
    const maxSteps = this.config.get<number>('execution.maxSteps', 5000000);

    const onOutput = (char: string) => {
      if (char === '\n') {
        this.writeEmitter.fire('\r\n');
      } else {
        this.writeEmitter.fire(char);
      }
    };

    const startTime = Date.now();
    let finalState: ExecutionState;
    let totalOps = 0;
    let finalPtr = 0;
    let finalVal = 0;
    let errorMessage: string | undefined;

    if (useFastEngine) {
      const engine = new FastBrainfuckEngine(parseResult, {
        tapeSize,
        cellWrapping,
        eofBehavior: 'waiting',
        onOutput
      });

      while (!this.isAborted && totalOps < maxSteps) {
        const batch = engine.runBatch(5000);
        totalOps += batch.opsExecuted;

        if (batch.state === ExecutionState.WAITING_INPUT) {
          const nextByte = await this.waitForNextByte();
          if (nextByte === -1 || this.isAborted) {
            break;
          }
          engine.appendInput([nextByte]);
        } else if (batch.state === ExecutionState.TERMINATED || batch.state === ExecutionState.ERROR) {
          break;
        } else {
          // Yield execution to allow I/O and UI responsiveness
          await new Promise(r => setTimeout(r, 0));
        }
      }

      finalState = this.isAborted ? ExecutionState.PAUSED : engine.state;
      finalPtr = engine.ptr;
      finalVal = engine.memory[finalPtr];
    } else {
      const engine = new BrainfuckEngine(parseResult, {
        tapeSize,
        cellWrapping,
        eofBehavior: 'waiting',
        recordHistory: false,
        onOutput
      });

      while (!this.isAborted && totalOps < maxSteps) {
        const batch = engine.runBatch(5000);
        totalOps += batch.stepsExecuted;

        if (batch.state === ExecutionState.WAITING_INPUT) {
          const nextByte = await this.waitForNextByte();
          if (nextByte === -1 || this.isAborted) {
            break;
          }
          engine.appendInput([nextByte]);
        } else if (batch.state === ExecutionState.TERMINATED || batch.state === ExecutionState.ERROR) {
          break;
        } else {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      finalState = this.isAborted ? ExecutionState.PAUSED : engine.state;
      finalPtr = engine.ptr;
      finalVal = engine.memory[finalPtr];
      errorMessage = engine.errorMessage;
    }

    const durationMs = Date.now() - startTime;
    this.writeEmitter.fire('\r\n\x1b[90m----------------------------------------------------\x1b[0m\r\n');

    const showSummary = this.config.get<boolean>('execution.showSummary', true);
    if (showSummary) {
      const optBadge = useFastEngine ? ' (IR Optimized)' : '';
      if (this.isAborted) {
        this.writeEmitter.fire('\x1b[33m⚠ [INTERRUPTED]\x1b[0m Execution stopped.\r\n');
      } else if (finalState === ExecutionState.TERMINATED) {
        this.writeEmitter.fire(
          `\x1b[32m✔ [SUCCESS]\x1b[0m Completed in ${durationMs} ms (${totalOps.toLocaleString()} ops${optBadge}) | Cell: ${finalPtr} = ${finalVal}\r\n`
        );
      } else if (finalState === ExecutionState.ERROR) {
        this.writeEmitter.fire(`\x1b[31m✖ [ERROR]\x1b[0m ${errorMessage || 'Execution error'}\r\n`);
      } else if (totalOps >= maxSteps) {
        this.writeEmitter.fire(
          `\x1b[33m⚠ [TIMEOUT]\x1b[0m Reached execution limit of ${maxSteps.toLocaleString()} steps.\r\n`
        );
      }
    }

    this.writeEmitter.fire('\x1b[90m[Session idle. Press Run again or close this terminal.]\x1b[0m\r\n');
    this.isRunning = false;
  }
}

/**
 * Runs active Brainfuck document in an interactive VS Code Terminal.
 */
export async function runBrainfuckInTerminal(doc: vscode.TextDocument): Promise<void> {
  const config = vscode.workspace.getConfiguration('brainfuck');

  // If a terminal is already running, dispose previous session
  if (activeTerminal) {
    try {
      activeTerminal.dispose();
    } catch {
      // ignore
    }
  }

  activePty = new BrainfuckPseudoterminal(doc, config);
  activeTerminal = vscode.window.createTerminal({
    name: 'Brainfuck Console',
    pty: activePty
  });

  activeTerminal.show(false);
}
