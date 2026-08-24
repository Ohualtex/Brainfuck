import * as vscode from 'vscode';
import { subscribeToDocumentChanges } from './interpreter/diagnostics';
import {
  BrainfuckDocumentFormattingEditProvider,
  formatActiveDocument,
  minifyActiveDocument
} from './commands/formatter';
import { runBrainfuckCode } from './commands/runCode';
import { TapePanel } from './webview/tapePanel';

export function activate(context: vscode.ExtensionContext) {
  // 1. Diagnostics Provider (Real-time syntax checking & bracket matching)
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('brainfuck');
  context.subscriptions.push(diagnosticCollection);
  subscribeToDocumentChanges(context, diagnosticCollection);

  // 2. Document Formatting Provider (Shift+Alt+F / Format Document)
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      'brainfuck',
      new BrainfuckDocumentFormattingEditProvider()
    )
  );

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.openVisualTape', () => {
      TapePanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.run', () => {
      runBrainfuckCode();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.format', () => {
      formatActiveDocument();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.minify', () => {
      minifyActiveDocument();
    })
  );
}

export function deactivate() {
  if (TapePanel.currentPanel) {
    TapePanel.currentPanel.dispose();
  }
}
