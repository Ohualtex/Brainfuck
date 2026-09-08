import * as vscode from 'vscode';
import { BrainfuckEngine, ExecutionState } from '../interpreter/engine';
import { parseBrainfuck } from '../interpreter/parser';
import { isBrainfuckDocument } from '../webview/tapePanel';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Brainfuck Output');
  }
  return outputChannel;
}

export async function runBrainfuckCode(uri?: vscode.Uri) {
  let doc: vscode.TextDocument | undefined;
  if (uri) {
    const uriStr = uri.toString();
    const visible = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uriStr);
    doc = visible?.document || vscode.workspace.textDocuments.find(d => d.uri.toString() === uriStr);
    if (!doc) {
      try {
        doc = await vscode.workspace.openTextDocument(uri);
      } catch {
        // ignore
      }
    }
  }

  if (!doc) {
    const editor = vscode.window.activeTextEditor;
    if (editor && isBrainfuckDocument(editor.document)) {
      doc = editor.document;
    }
  }

  if (!doc) {
    vscode.window.showInformationMessage('Please open an active Brainfuck (.bf) file to run.');
    return;
  }

  const source = doc.getText();
  const parseResult = parseBrainfuck(source);

  const errors = parseResult.errors.filter(e => !e.message.includes('Empty loop'));
  if (errors.length > 0) {
    vscode.window.showErrorMessage(
      `Execution failed! ${errors.length} syntax error(s) found: ${errors[0].message} (Line ${errors[0].line + 1})`
    );
    return;
  }

  // Check if code contains comma (input)
  const hasInput = parseResult.instructions.some(i => i.char === ',');
  let userInput = '';
  if (hasInput) {
    const input = await vscode.window.showInputBox({
      prompt: 'Program expects input (","). Enter input text:',
      placeHolder: 'Input (can be left blank)...'
    });
    if (input === undefined) {
      // User cancelled
      return;
    }
    userInput = input;
  }

  const config = vscode.workspace.getConfiguration('brainfuck');
  const clearPrevious = config.get<boolean>('execution.clearPreviousOutput', false);
  const showSummary = config.get<boolean>('execution.showSummary', true);

  const channel = getOutputChannel();
  if (clearPrevious) {
    channel.clear();
  }
  channel.show(true);
  channel.appendLine(`\n[${new Date().toLocaleTimeString()}] Starting Brainfuck execution...`);
  channel.appendLine('----------------------------------------------------');

  const tapeSize = config.get<number>('tapeSize', 30000);
  const cellWrapping = config.get<boolean>('cellWrapping', true);

  const engine = new BrainfuckEngine(parseResult, {
    tapeSize,
    cellWrapping,
    eofBehavior: 'zero',
    recordHistory: false
  });
  if (hasInput) {
    engine.setInput(userInput);
  }

  const startTime = Date.now();
  const maxSteps = config.get<number>('execution.maxSteps', 5000000);
  let steps = 0;

  while (
    engine.state !== ExecutionState.TERMINATED &&
    engine.state !== ExecutionState.ERROR &&
    engine.state !== ExecutionState.WAITING_INPUT &&
    steps < maxSteps
  ) {
    const batchSteps = Math.min(10000, maxSteps - steps);
    const batch = engine.runBatch(batchSteps);
    steps += batch.stepsExecuted;
  }

  const durationMs = Date.now() - startTime;

  if (engine.output.length > 0) {
    channel.appendLine(engine.output);
  } else {
    channel.appendLine('(Program produced no output)');
  }

  if (showSummary) {
    channel.appendLine('----------------------------------------------------');
    if (engine.state === ExecutionState.TERMINATED) {
      channel.appendLine(
        `[SUCCESS] Completed: ${steps} steps | ${durationMs} ms | Active Cell: ${engine.ptr} | Cell Value: ${engine.memory[engine.ptr]}`
      );
    } else if (engine.state === ExecutionState.ERROR) {
      channel.appendLine(`[ERROR] ${engine.errorMessage}`);
    } else if (engine.state === ExecutionState.WAITING_INPUT) {
      channel.appendLine(`[WAITING] Program paused: waiting for additional input.`);
    } else if (steps >= maxSteps) {
      channel.appendLine(`[WARNING] Program reached the limit of ${maxSteps} steps and was terminated (possible infinite loop).`);
    } else {
      channel.appendLine(
        `[STOPPED] Execution stopped at step ${steps} | Active Cell: ${engine.ptr} | Cell Value: ${engine.memory[engine.ptr]}`
      );
    }
  }
}
