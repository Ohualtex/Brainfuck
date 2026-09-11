import * as vscode from 'vscode';
import { BrainfuckEngine, ExecutionState } from '../interpreter/engine';
import { parseBrainfuck } from '../interpreter/parser';
import { FastBrainfuckEngine } from '../interpreter/ir';
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
  const optLevel = config.get<string>('execution.optimizationLevel', 'aggressive');
  const useFastEngine = optLevel !== 'none';

  const startTime = Date.now();
  const maxSteps = config.get<number>('execution.maxSteps', 5000000);

  let outputText = '';
  let finalState: ExecutionState;
  let finalSteps = 0;
  let finalPtr = 0;
  let finalVal = 0;
  let errorMessage: string | undefined;

  if (useFastEngine) {
    const fastEngine = new FastBrainfuckEngine(parseResult, {
      tapeSize,
      cellWrapping,
      eofBehavior: 'zero',
      input: hasInput ? userInput : undefined
    });
    const execRes = fastEngine.execute(maxSteps);
    outputText = fastEngine.output;
    finalState = execRes.state;
    finalSteps = execRes.ops;
    finalPtr = fastEngine.ptr;
    finalVal = fastEngine.memory[fastEngine.ptr];
  } else {
    const engine = new BrainfuckEngine(parseResult, {
      tapeSize,
      cellWrapping,
      eofBehavior: 'zero',
      recordHistory: false
    });
    if (hasInput) {
      engine.setInput(userInput);
    }
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
    outputText = engine.output;
    finalState = engine.state;
    finalSteps = steps;
    finalPtr = engine.ptr;
    finalVal = engine.memory[engine.ptr];
    errorMessage = engine.errorMessage;
  }

  const durationMs = Date.now() - startTime;

  if (outputText.length > 0) {
    channel.appendLine(outputText);
  } else {
    channel.appendLine('(Program produced no output)');
  }

  if (showSummary) {
    channel.appendLine('----------------------------------------------------');
    const optBadge = useFastEngine ? ' (IR Optimized)' : '';
    if (finalState === ExecutionState.TERMINATED) {
      channel.appendLine(
        `[SUCCESS] Completed: ${finalSteps.toLocaleString()} operations${optBadge} | ${durationMs} ms | Active Cell: ${finalPtr} | Cell Value: ${finalVal}`
      );
    } else if (finalState === ExecutionState.ERROR) {
      channel.appendLine(`[ERROR] ${errorMessage || 'Unknown execution error'}`);
    } else if (finalState === ExecutionState.WAITING_INPUT) {
      channel.appendLine(`[WAITING] Program paused: waiting for additional input.`);
    } else if (finalSteps >= maxSteps) {
      channel.appendLine(`[WARNING] Program reached the limit of ${maxSteps.toLocaleString()} steps and was terminated (possible infinite loop).`);
    } else {
      channel.appendLine(
        `[STOPPED] Execution stopped at step ${finalSteps.toLocaleString()}${optBadge} | Active Cell: ${finalPtr} | Cell Value: ${finalVal}`
      );
    }
  }
}
