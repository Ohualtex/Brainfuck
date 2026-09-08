import * as vscode from 'vscode';
import { parseBrainfuck } from './parser';

export function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  if (document.languageId !== 'brainfuck') {
    return;
  }

  const config = vscode.workspace.getConfiguration('brainfuck');
  const enable = config.get<boolean>('diagnostics.enable', true);
  if (!enable) {
    collection.delete(document.uri);
    return;
  }

  const warnOnEmptyLoops = config.get<boolean>('diagnostics.warnOnEmptyLoops', true);
  const text = document.getText();
  const parseResult = parseBrainfuck(text);
  const diagnostics: vscode.Diagnostic[] = [];

  for (const err of parseResult.errors) {
    const isEmptyLoop = err.message.includes('Empty loop');
    if (isEmptyLoop && !warnOnEmptyLoops) {
      continue;
    }

    const startPos = document.positionAt(err.offset);
    const endPos = document.positionAt(err.offset + (err.length || 1));
    const range = new vscode.Range(startPos, endPos);

    const severity = isEmptyLoop
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Error;

    const diagnostic = new vscode.Diagnostic(range, err.message, severity);
    diagnostic.source = 'Brainfuck';
    diagnostics.push(diagnostic);
  }

  collection.set(document.uri, diagnostics);
}

export function subscribeToDocumentChanges(
  context: vscode.ExtensionContext,
  collection: vscode.DiagnosticCollection
): void {
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document, collection);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        updateDiagnostics(editor.document, collection);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document, collection))
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('brainfuck.diagnostics')) {
        for (const doc of vscode.workspace.textDocuments) {
          updateDiagnostics(doc, collection);
        }
      }
    })
  );
}
