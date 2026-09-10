import * as vscode from 'vscode';
import { getHoverInfo } from '../interpreter/hover';
import { isBrainfuckDocument } from '../webview/tapePanel';

export class BrainfuckHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (!isBrainfuckDocument(document)) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('brainfuck');
    const enabled = config.get<boolean>('hover.enable', true);
    if (!enabled) {
      return null;
    }

    const text = document.getText();
    const info = getHoverInfo(text, position.line, position.character);
    if (!info) {
      return null;
    }

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;

    md.appendMarkdown(`### ${info.title}\n\n`);
    md.appendMarkdown(`${info.description}\n\n`);

    if (info.codeSnippet) {
      md.appendCodeblock(info.codeSnippet, 'c');
    }

    if (info.details && info.details.length > 0) {
      md.appendMarkdown('\n---\n');
      for (const d of info.details) {
        md.appendMarkdown(`* ${d}\n`);
      }
    }

    const range = new vscode.Range(
      info.range.startLine,
      info.range.startCol,
      info.range.endLine,
      info.range.endCol
    );

    return new vscode.Hover(md, range);
  }
}
