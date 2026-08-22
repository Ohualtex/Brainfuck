import * as vscode from 'vscode';
export class TapePanel {
  public static currentPanel: TapePanel | undefined;
  protected readonly _panel: vscode.WebviewPanel;
  protected readonly _extensionUri: vscode.Uri;
  protected _disposables: vscode.Disposable[] = [];
  public static createOrShow(extensionUri: vscode.Uri) {
    const col = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
    if (TapePanel.currentPanel) { TapePanel.currentPanel._panel.reveal(col); return; }
    const p = vscode.window.createWebviewPanel('brainfuckTapeVisualizer', 'Brainfuck Visual Tape', col, { enableScripts: true });
    TapePanel.currentPanel = new TapePanel(p, extensionUri);
  }
  constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri) {
    this._panel = panel; this._extensionUri = extUri;
    this._panel.webview.html = '<html><body><h1>Brainfuck Tape Debugger</h1></body></html>';
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }
  public dispose() { TapePanel.currentPanel = undefined; this._panel.dispose(); }
}
