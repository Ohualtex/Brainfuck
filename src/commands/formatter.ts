import * as vscode from 'vscode';
import { formatBrainfuckSource, minifyBrainfuckSource } from '../interpreter/formatter';

export { formatBrainfuckSource, minifyBrainfuckSource };

export class BrainfuckDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    const formatted = formatBrainfuckSource(document.getText(), options.tabSize, options.insertSpaces);
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}

async function getTargetEditor(uri?: vscode.Uri): Promise<vscode.TextEditor | undefined> {
  if (uri) {
    const uriStr = uri.toString();
    const visible = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uriStr);
    if (visible) {
      return visible;
    }
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      return await vscode.window.showTextDocument(doc);
    } catch {
      return undefined;
    }
  }
  return vscode.window.activeTextEditor;
}

export async function formatActiveDocument(uri?: vscode.Uri) {
  const editor = await getTargetEditor(uri);

  if (!editor || (!editor.document.fileName.endsWith('.bf') && !editor.document.fileName.endsWith('.b') && editor.document.languageId !== 'brainfuck')) {
    vscode.window.showInformationMessage('Please open an active Brainfuck (.bf) file.');
    return;
  }

  const config = vscode.workspace.getConfiguration('brainfuck');
  const indentSize = config.get<number>('format.indentSize', 2);
  const insertSpaces = config.get<boolean>('format.insertSpaces', true);

  const doc = editor.document;
  const formatted = formatBrainfuckSource(doc.getText(), indentSize, insertSpaces);
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, formatted);
  });

  vscode.window.showInformationMessage('Brainfuck code formatted successfully.');
}

export async function minifyActiveDocument(uri?: vscode.Uri) {
  const editor = await getTargetEditor(uri);

  if (!editor || (!editor.document.fileName.endsWith('.bf') && !editor.document.fileName.endsWith('.b') && editor.document.languageId !== 'brainfuck')) {
    vscode.window.showInformationMessage('Please open an active Brainfuck (.bf) file.');
    return;
  }

  const doc = editor.document;
  const minified = minifyBrainfuckSource(doc.getText());
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, minified);
  });

  vscode.window.showInformationMessage('Brainfuck code minified (comments and whitespace removed).');
}
