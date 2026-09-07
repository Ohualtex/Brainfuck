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
    vscode.commands.registerCommand('brainfuck.openVisualTape', async (uri?: vscode.Uri) => {
      await TapePanel.createOrShow(context.extensionUri, uri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.run', async (uri?: vscode.Uri) => {
      await runBrainfuckCode(uri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.format', async (uri?: vscode.Uri) => {
      await formatActiveDocument(uri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.minify', async (uri?: vscode.Uri) => {
      await minifyActiveDocument(uri);
    })
  );

  // 4. Sync open visual tape when switching Brainfuck files (only if already opened manually by user)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'brainfuck') {
        if (TapePanel.currentPanel) {
          TapePanel.currentPanel.syncWithActiveEditor();
        }
      }
    })
  );

  // 6. Webview Serializer (re-hydrate panel on session restore)
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('brainfuckTapeVisualizer', {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: any) {
        TapePanel.revive(webviewPanel, context.extensionUri);
      }
    })
  );
}

export function deactivate() {
  if (TapePanel.currentPanel) {
    TapePanel.currentPanel.dispose();
  }
}
