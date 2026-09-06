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

  // 4. Auto-open Visual Tape if enabled
  const autoOpen = vscode.workspace.getConfiguration('brainfuck').get<boolean>('autoOpenVisualTape', true);
  if (autoOpen) {
    const checkAndOpen = async () => {
      let doc = vscode.workspace.textDocuments.find(d => d.languageId === 'brainfuck')
        || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'brainfuck' ? vscode.window.activeTextEditor.document : undefined);
      if (!doc) {
        const files = await vscode.workspace.findFiles('**/*.bf', undefined, 1);
        if (files.length > 0) {
          doc = await vscode.workspace.openTextDocument(files[0]);
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        }
      }
      if (doc) {
        TapePanel.createOrShow(context.extensionUri);
      }
    };
    checkAndOpen();
    setTimeout(checkAndOpen, 500);

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'brainfuck') {
          if (!TapePanel.currentPanel) {
            TapePanel.createOrShow(context.extensionUri);
          } else {
            TapePanel.currentPanel.syncWithActiveEditor();
          }
        }
      })
    );
  }

  // 5. Webview Serializer (re-hydrate panel on session restore)
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
