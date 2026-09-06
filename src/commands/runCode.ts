import * as vscode from 'vscode';
import { BrainfuckEngine, ExecutionState } from '../interpreter/engine';
import { parseBrainfuck } from '../interpreter/parser';

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
    if (editor && (editor.document.languageId === 'brainfuck' || editor.document.fileName.endsWith('.bf') || editor.document.fileName.endsWith('.b'))) {
      doc = editor.document;
    }
  }

  if (!doc) {
    vscode.window.showInformationMessage('Please open an active Brainfuck (.bf) file to run.');
    return;
  }

  const source = editor.document.getText();
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

  const channel = getOutputChannel();
  channel.show(true);
  channel.appendLine(`\n[${new Date().toLocaleTimeString()}] Starting Brainfuck execution...`);
  channel.appendLine('----------------------------------------------------');

  const config = vscode.workspace.getConfiguration('brainfuck');
  const tapeSize = config.get<number>('tapeSize', 30000);
  const cellWrapping = config.get<boolean>('cellWrapping', true);

  const engine = new BrainfuckEngine(parseResult, { tapeSize, cellWrapping });
  if (userInput) {
    engine.setInput(userInput);
  }

  const startTime = Date.now();
  const maxSteps = 5000000; // 5 million steps max safeguard
  let steps = 0;

  while (
    engine.state !== ExecutionState.TERMINATED &&
    engine.state !== ExecutionState.ERROR &&
    engine.state !== ExecutionState.WAITING_INPUT &&
    steps < maxSteps
  ) {
    const batch = engine.runBatch(10000);
    steps += batch.stepsExecuted;
  }

  const durationMs = Date.now() - startTime;

  if (engine.output.length > 0) {
    channel.appendLine(engine.output);
  } else {
    channel.appendLine('(Program produced no output)');
  }

  channel.appendLine('----------------------------------------------------');
  if (steps >= maxSteps) {
    channel.appendLine(`[WARNING] Program reached the limit of ${maxSteps} steps and was terminated (possible infinite loop).`);
  } else if (engine.state === ExecutionState.ERROR) {
    channel.appendLine(`[ERROR] ${engine.errorMessage}`);
  } else {
    channel.appendLine(
      `[SUCCESS] Completed: ${steps} steps | ${durationMs} ms | Active Cell: ${engine.ptr} | Cell Value: ${engine.memory[engine.ptr]}`
    );
  }
}
