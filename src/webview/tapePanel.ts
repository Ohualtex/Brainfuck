import * as vscode from 'vscode';

export function isBrainfuckDocument(doc?: vscode.TextDocument): boolean {
  if (!doc) {
    return false;
  }
  if (doc.languageId === 'brainfuck') {
    return true;
  }
  const name = doc.fileName.toLowerCase();
  return name.endsWith('.bf') || name.endsWith('.b');
}

export async function resolveBrainfuckDocument(uri?: vscode.Uri): Promise<{
  doc?: vscode.TextDocument;
  editor?: vscode.TextEditor;
}> {
  if (uri) {
    const uriStr = uri.toString();
    const visibleEditor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.toString() === uriStr
    );
    if (visibleEditor) {
      return { doc: visibleEditor.document, editor: visibleEditor };
    }

    const openDoc = vscode.workspace.textDocuments.find(
      d => d.uri.toString() === uriStr
    );
    if (openDoc) {
      return { doc: openDoc };
    }

    try {
      const loadedDoc = await vscode.workspace.openTextDocument(uri);
      return { doc: loadedDoc };
    } catch {
      // ignore
    }
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isBrainfuckDocument(activeEditor.document)) {
    return { doc: activeEditor.document, editor: activeEditor };
  }

  const visibleEditor = vscode.window.visibleTextEditors.find(e =>
    isBrainfuckDocument(e.document)
  );
  if (visibleEditor) {
    return { doc: visibleEditor.document, editor: visibleEditor };
  }

  const openDoc = vscode.workspace.textDocuments.find(d =>
    isBrainfuckDocument(d)
  );
  if (openDoc) {
    return { doc: openDoc };
  }

  if (activeEditor) {
    return { doc: activeEditor.document, editor: activeEditor };
  }

  return {};
}

export class TapePanel {
  public static currentPanel: TapePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  public readonly extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentDoc: vscode.TextDocument | undefined;
  private _currentEditor: vscode.TextEditor | undefined;
  private _activeDecorationType: vscode.TextEditorDecorationType;

  public static async createOrShow(extensionUri: vscode.Uri, fileUri?: vscode.Uri) {
    const { doc, editor } = await resolveBrainfuckDocument(fileUri);

    if (TapePanel.currentPanel) {
      TapePanel.currentPanel._panel.reveal(TapePanel.currentPanel._panel.viewColumn, true);
      if (doc) {
        TapePanel.currentPanel.loadDocument(doc, editor);
      } else {
        await TapePanel.currentPanel.syncWithActiveEditor(fileUri);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'brainfuckTapeVisualizer',
      'Brainfuck: Visual Memory Tape',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    TapePanel.currentPanel = new TapePanel(panel, extensionUri, doc, editor);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    TapePanel.currentPanel = new TapePanel(panel, extensionUri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialDoc?: vscode.TextDocument,
    initialEditor?: vscode.TextEditor
  ) {
    this._panel = panel;
    this.extensionUri = extensionUri;
    this._currentDoc = initialDoc;
    this._currentEditor = initialEditor;

    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    };

    this._activeDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 215, 0, 0.35)',
      border: '1px solid #ffd700',
      borderRadius: '2px'
    });

    this._update(initialDoc);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen to messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'ready':
            if (this._currentDoc) {
              this.loadDocument(this._currentDoc, this._currentEditor);
            } else {
              this.syncWithActiveEditor();
            }
            break;
          case 'highlightInstruction':
            this.highlightInstruction(message.sourceOffset);
            break;
          case 'clearHighlight':
            this.clearHighlight();
            break;
          case 'info':
            vscode.window.showInformationMessage(message.text);
            break;
          case 'error':
            vscode.window.showErrorMessage(message.text);
            break;
        }
      },
      null,
      this._disposables
    );

    // Track active editor changes
    vscode.window.onDidChangeActiveTextEditor(
      editor => {
        if (editor && isBrainfuckDocument(editor.document)) {
          this.loadDocument(editor.document, editor);
        }
      },
      null,
      this._disposables
    );

    // Track document edits
    vscode.workspace.onDidChangeTextDocument(
      e => {
        if (this._currentDoc && e.document.uri.toString() === this._currentDoc.uri.toString()) {
          this.loadDocument(e.document, this._currentEditor);
        }
      },
      null,
      this._disposables
    );

    if (initialDoc) {
      this.loadDocument(initialDoc, initialEditor);
    } else {
      this.syncWithActiveEditor();
    }
  }

  public loadDocument(doc: vscode.TextDocument, editor?: vscode.TextEditor) {
    this._currentDoc = doc;
    if (editor) {
      this._currentEditor = editor;
    } else {
      this._currentEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === doc.uri.toString()
      );
    }

    const text = doc.getText();
    const fileName = doc.fileName.split(/[\\/]/).pop() || 'Untitled.bf';
    const autoStep = 0;
    this._panel.webview.postMessage({
      type: 'loadCode',
      code: text,
      fileName,
      autoStep
    });
  }

  public async syncWithActiveEditor(fileUri?: vscode.Uri) {
    const { doc, editor } = await resolveBrainfuckDocument(fileUri);
    if (doc) {
      this.loadDocument(doc, editor);
    }
  }

  private highlightInstruction(sourceOffset: number) {
    let editor = this._currentEditor;
    if (!editor || editor.document.isClosed) {
      const targetUriStr = this._currentDoc?.uri.toString();
      editor = vscode.window.visibleTextEditors.find(e =>
        targetUriStr ? e.document.uri.toString() === targetUriStr : isBrainfuckDocument(e.document)
      ) || vscode.window.activeTextEditor;
      if (editor && isBrainfuckDocument(editor.document)) {
        this._currentEditor = editor;
      }
    }
    if (!editor || sourceOffset === undefined || sourceOffset < 0) {
      return;
    }
    const doc = editor.document;
    if (sourceOffset >= doc.getText().length) {
      return;
    }
    const startPos = doc.positionAt(sourceOffset);
    const endPos = doc.positionAt(sourceOffset + 1);
    const range = new vscode.Range(startPos, endPos);
    editor.setDecorations(this._activeDecorationType, [range]);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  public clearHighlight() {
    if (this._currentEditor && !this._currentEditor.document.isClosed) {
      this._currentEditor.setDecorations(this._activeDecorationType, []);
    }
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this._activeDecorationType, []);
    }
  }

  public dispose() {
    TapePanel.currentPanel = undefined;
    this.clearHighlight();
    this._activeDecorationType.dispose();
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(targetDoc?: vscode.TextDocument) {
    const doc = targetDoc || this._currentDoc || vscode.window.activeTextEditor?.document || vscode.workspace.textDocuments.find(isBrainfuckDocument);
    const defaultCode = `[
  Brainfuck Hello World
  Prints "Hello World!" to the output console.
]

++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.
>---.
+++++++..
+++.
>>.
<-.
<.
+++.
------.
--------.
>>+.
>++.
`;
    const code = doc ? doc.getText() : defaultCode;
    const fileName = doc ? (doc.fileName.split(/[\\/]/).pop() || 'hello_world.bf') : 'hello_world.bf';
    this._panel.webview.html = this._getHtmlForWebview(code, fileName);
  }

  private _getHtmlForWebview(initialCode: string = '', initialFileName: string = 'hello_world.bf'): string {
    const defaultCode = `[
  Brainfuck Hello World
  Prints "Hello World!" to the output console.
]

++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.
>---.
+++++++..
+++.
>>.
<-.
<.
+++.
------.
--------.
>>+.
>++.
`;
    const finalCode = initialCode || defaultCode;
    const finalFileName = initialFileName || 'hello_world.bf';
    const initialJson = JSON.stringify({ code: finalCode, fileName: finalFileName }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brainfuck Visual Tape Debugger</title>
  <style>
    :root {
      --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', 'Droid Sans', sans-serif;
      --vscode-editor-font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace;
      --bg-primary: var(--vscode-editor-background, #1e1e1e);
      --bg-secondary: var(--vscode-sideBar-background, #252526);
      --bg-tertiary: var(--vscode-editorWidget-background, #2d2d2d);
      --bg-input: var(--vscode-input-background, #3c3c3c);
      --border-color: var(--vscode-panel-border, #333333);
      --border-subtle: rgba(255, 255, 255, 0.08);

      /* VS Code Native Colors */
      --accent-primary: var(--vscode-button-background, #0078d4);
      --accent-hover: var(--vscode-button-hoverBackground, #026ec1);
      --accent-selection: var(--vscode-editor-selectionBackground, #264f78);
      --accent-focus: var(--vscode-focusBorder, #0078d4);

      /* Status Colors */
      --status-blue: #3794ff;
      --status-green: #89d185;
      --status-yellow: #cca700;
      --status-red: #f14c4c;
      --status-orange: #d16969;

      --text-primary: var(--vscode-foreground, #cccccc);
      --text-secondary: var(--vscode-descriptionForeground, #9d9d9d);
      --text-muted: #6e7681;

      --font-mono: var(--vscode-editor-font-family, 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace);
      --font-ui: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, sans-serif);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-ui);
      font-size: 13px;
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 14px;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    ::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #4f4f4f;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      background: var(--accent-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 13px;
      color: #ffffff;
    }

    .title-group h1 {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: var(--text-primary);
    }

    .file-badge {
      font-size: 11px;
      font-family: var(--font-mono);
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
    }

    .stats-bar {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-pill {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .stat-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
    }

    .stat-val {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .status-badge {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-READY { color: var(--status-blue); background: rgba(55, 148, 255, 0.15); border: 1px solid rgba(55, 148, 255, 0.3); }
    .status-RUNNING { color: var(--status-green); background: rgba(137, 209, 133, 0.15); border: 1px solid rgba(137, 209, 133, 0.3); }
    .status-PAUSED { color: var(--status-yellow); background: rgba(204, 167, 0, 0.15); border: 1px solid rgba(204, 167, 0, 0.3); }
    .status-WAITING_INPUT { color: var(--status-orange); background: rgba(209, 105, 105, 0.15); border: 1px solid rgba(209, 105, 105, 0.3); }
    .status-TERMINATED { color: var(--text-muted); background: var(--bg-tertiary); border: 1px solid var(--border-color); }
    .status-ERROR { color: var(--status-red); background: rgba(241, 76, 76, 0.15); border: 1px solid rgba(241, 76, 76, 0.3); }

    /* CONTROLS */
    .controls-panel {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 14px;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    button:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    button:active:not(:disabled) {
      background: #333639;
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    button.btn-primary {
      background: var(--accent-primary);
      color: #ffffff;
      border: 1px solid transparent;
    }

    button.btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .slider-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-secondary);
      user-select: none;
    }

    .slider-group input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 220px;
      min-width: 140px;
      height: 24px;
      background: transparent;
      cursor: pointer;
      outline: none;
      margin: 0;
      padding: 0;
    }

    .slider-group input[type="range"]::-webkit-slider-runnable-track {
      width: 100%;
      height: 6px;
      background: #3c3c3c;
      border-radius: 3px;
      border: none;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-primary, #0078d4);
      margin-top: -4px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb:hover {
      background: var(--accent-hover, #026ec1);
      transform: scale(1.15);
    }

    .slider-group input[type="range"]::-webkit-slider-thumb:active {
      transform: scale(1.25);
    }

    .speed-label {
      font-family: var(--font-mono);
      min-width: 44px;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      transition: all 0.15s ease;
    }

    .speed-label:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
      border-color: var(--accent-primary, #0078d4);
      color: #ffffff;
    }

    .speed-input-edit {
      width: 58px;
      height: 22px;
      padding: 0 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      background: var(--bg-input, #3c3c3c);
      color: var(--text-primary, #cccccc);
      border: 1px solid var(--accent-primary, #0078d4);
      border-radius: 4px;
      outline: none;
      box-sizing: border-box;
    }

    /* INSTRUCTION STREAM */
    .stream-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stream-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .stream-wrapper {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      padding: 4px 0;
      scrollbar-width: thin;
    }

    .instr-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 26px;
      padding: 0 4px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.1s ease;
      cursor: pointer;
      flex-shrink: 0;
    }

    .instr-chip.current {
      background: var(--accent-primary);
      border-color: #0098ff;
      color: #ffffff;
      font-weight: 700;
      z-index: 2;
    }

    .instr-chip.ptr-move { color: #9cdcfe; }
    .instr-chip.val-mut { color: #b5cea8; }
    .instr-chip.io { color: #ce9178; }
    .instr-chip.loop { color: #ffd700; }
    .instr-chip.bp { color: #c586c0; }

    /* MEMORY TAPE SECTION */
    .tape-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tape-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tape-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cell-jump-group {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-secondary);
      user-select: none;
    }

    .cell-label {
      font-family: var(--font-mono);
      min-width: 44px;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      color: var(--text-primary);
      transition: all 0.15s ease;
    }

    .cell-label:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
      border-color: var(--accent-primary, #0078d4);
      color: #ffffff;
    }

    .cell-input-edit {
      width: 65px;
      height: 22px;
      padding: 0 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      background: var(--bg-input, #3c3c3c);
      color: var(--text-primary, #cccccc);
      border: 1px solid var(--accent-primary, #0078d4);
      border-radius: 4px;
      outline: none;
      box-sizing: border-box;
    }

    .tape-conveyor {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px 4px 18px 4px;
      scroll-behavior: smooth;
    }

    .cell-card {
      position: relative;
      flex: 0 0 82px;
      height: 104px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 8px 6px;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .cell-card:hover {
      border-color: #555555;
    }

    .cell-card.active {
      background: var(--accent-selection);
      border: 2px solid var(--accent-primary);
      z-index: 5;
    }

    .cell-card.editing {
      border: 2px solid var(--accent-focus);
      background: var(--bg-tertiary);
      box-shadow: 0 0 10px rgba(0, 120, 212, 0.4);
    }

    .cell-edit-input {
      width: 58px;
      height: 30px;
      margin: 0 auto;
      background: var(--bg-input);
      color: #ffffff;
      border: 1px solid var(--accent-focus);
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      outline: none;
      box-shadow: 0 0 6px rgba(0, 120, 212, 0.5);
    }
    .cell-edit-input::-webkit-inner-spin-button,
    .cell-edit-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .cell-card.active::after {
      content: '▲ PTR';
      position: absolute;
      bottom: -16px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
      color: var(--status-blue);
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .cell-index {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-muted);
      text-align: center;
    }

    .cell-value-dec {
      font-family: var(--font-mono);
      font-size: 22px;
      font-weight: 600;
      text-align: center;
      color: #ffffff;
    }
    .cell-card.non-zero .cell-value-dec {
      color: #9cdcfe;
    }

    .cell-bottom-info {
      display: flex;
      justify-content: space-around;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-subtle);
      padding-top: 4px;
    }

    .cell-fill-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--accent-primary);
      border-radius: 0 0 4px 4px;
      transition: width 0.15s ease;
    }

  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <div class="brand-logo">&gt;+</div>
      <div class="title-group">
        <h1>BRAINFUCK TAPE DEBUGGER</h1>
      </div>
      <div class="file-badge" id="fileNameBadge">No file</div>
    </div>
    <div class="stats-bar">
      <div class="stat-pill">
        <span class="stat-label">Pointer</span>
        <span class="stat-val" id="statPtr">#0</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">Value (Hex/Ascii)</span>
        <span class="stat-val" id="statVal">0 (0x00) '.'</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">Output</span>
        <span class="stat-val" id="statOutput" style="color: #4ade80; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Program output string">-</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">Steps</span>
        <span class="stat-val" id="statSteps">0</span>
      </div>
      <div class="status-badge status-READY" id="statusBadge">READY</div>
    </div>
  </div>

  <!-- CONTROLS -->
  <div class="controls-panel">
    <div class="btn-group">
      <button class="btn-primary" id="btnPlayPause">▶ Run</button>
      <button id="btnStepPrev" title="Step Backward (Time Travel) [Left Arrow]">◀ Step Prev</button>
      <button id="btnStepNext" title="Step Next [Right Arrow]">Step Next ▶</button>
      <button id="btnReset" title="Reset [R]">↺ Reset</button>
    </div>

    <div class="slider-group">
      <span>Delay:</span>
      <input type="range" id="speedSlider" min="1" max="1000" value="30" title="Execution delay per step (1 - 1000ms)">
      <span id="speedLabel" class="speed-label" title="Click to manually edit delay (1 - 1000ms)">30ms</span>
      <input type="number" id="speedInput" class="speed-input-edit" min="1" max="1000" style="display: none;" title="Enter delay in ms">
    </div>
  </div>

  <!-- INSTRUCTION STREAM -->
  <div class="stream-container">
    <div class="stream-header">
      <span>Instruction Stream</span>
      <span id="streamCounter">0 / 0</span>
    </div>
    <div class="stream-wrapper" id="streamWrapper">
      <span style="color: var(--text-muted); padding: 4px;">Loading Brainfuck program...</span>
    </div>
  </div>

  <!-- MEMORY TAPE -->
  <div class="tape-section">
    <div class="tape-header">
      <div class="tape-title">
        <span>Memory Tape</span>
      </div>
      <div class="cell-jump-group">
        <span>Cell:</span>
        <span id="cellLabel" class="cell-label" title="Click to jump to cell (0 - 29999)">#0</span>
        <input type="number" id="cellInput" class="cell-input-edit" min="0" max="29999" style="display: none;" title="Enter cell index (0 - 29999)">
      </div>
    </div>
    <div class="tape-conveyor" id="tapeConveyor"></div>
  </div>

  <script id="bf-initial-data" type="application/json">${initialJson}</script>
  <script>
    const vscode = acquireVsCodeApi();

    // Engine State
    const TAPE_SIZE = 30000;
    const memory = new Uint8Array(TAPE_SIZE);
    let ptr = 0;
    let ip = 0;
    let instructions = [];
    let state = 'READY';
    let output = '';
    let stepCount = 0;
    let history = [];
    let isRunning = false;
    let runTimer = null;
    let stepDelay = 30;

    // View Window: Number of cells visible around pointer
    const VISIBLE_CELL_WINDOW = 50;
    let currentWindowStart = 0;
    let editingCell = null;

    // Elements
    const statusBadge = document.getElementById('statusBadge');
    const statPtr = document.getElementById('statPtr');
    const statVal = document.getElementById('statVal');
    const statSteps = document.getElementById('statSteps');
    const fileNameBadge = document.getElementById('fileNameBadge');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const btnStepPrev = document.getElementById('btnStepPrev');
    const btnStepNext = document.getElementById('btnStepNext');
    const btnReset = document.getElementById('btnReset');
    const speedSlider = document.getElementById('speedSlider');
    const speedLabel = document.getElementById('speedLabel');
    const speedInput = document.getElementById('speedInput');
    const streamWrapper = document.getElementById('streamWrapper');
    const streamCounter = document.getElementById('streamCounter');
    const tapeConveyor = document.getElementById('tapeConveyor');
    const statOutput = document.getElementById('statOutput');
    const cellLabel = document.getElementById('cellLabel');
    const cellInput = document.getElementById('cellInput');
    let isEditingCellJump = false;

    // Parse Brainfuck locally for high performance
    function parseCode(src) {
      const valid = new Set(['>', '<', '+', '-', '.', ',', '[', ']', '#']);
      const list = [];
      const stack = [];
      let line = 0;
      let col = 0;

      for (let i = 0; i < src.length; i++) {
        const code = src.charCodeAt(i);
        if (code === 10 || code === 13) {
          if (code === 10) line++;
          col = 0;
          continue;
        }

        const ch = src[i];

        // Ignore punctuation attached to words in comments (e.g. console., Hello,)
        if ((ch === '.' || ch === ',' || ch === '+' || ch === '-') && i > 0 && /[a-zA-Z]/.test(src[i - 1])) {
          col++;
          continue;
        }

        // Skip line comments starting with // or ;
        if ((ch === '/' && src[i + 1] === '/') || ch === ';') {
          while (i < src.length && src.charCodeAt(i) !== 10) i++;
          line++;
          col = 0;
          continue;
        }

        // Skip [ ... ] header comment blocks where [ is followed by letters (e.g. [ Brainfuck Echo Program ... ])
        if (ch === '[' && (list.length === 0 || i < 10)) {
          let j = i + 1;
          while (j < src.length && src.charCodeAt(j) <= 32) j++;
          if (j < src.length && /[a-zA-Z]/.test(src[j])) {
            while (j < src.length && src[j] !== ']') j++;
            if (j < src.length && src[j] === ']') {
              i = j;
              continue;
            }
          }
        }

        if (valid.has(ch)) {
          const item = { char: ch, index: list.length, offset: i, line, col, jumpTarget: -1 };
          list.push(item);
          if (ch === '[') {
            stack.push(item);
          } else if (ch === ']') {
            if (stack.length > 0) {
              const open = stack.pop();
              open.jumpTarget = item.index;
              item.jumpTarget = open.index;
            }
          }
        }
        col++;
      }
      return list;
    }

    function getCharCategoryClass(ch) {
      switch (ch) {
        case '>': case '<': return 'ptr-move';
        case '+': case '-': return 'val-mut';
        case '.': case ',': return 'io';
        case '[': case ']': return 'loop';
        case '#': return 'bp';
        default: return '';
      }
    }

    function renderStream() {
      if (instructions.length === 0) {
        streamWrapper.innerHTML = '<span style="color: var(--text-muted); padding: 4px;">Program is empty or no instructions found.</span>';
        streamCounter.textContent = '0 / 0';
        return;
      }

      streamCounter.textContent = (ip + 1) + ' / ' + instructions.length;

      // Windowed render around IP for 10,000+ length instructions
      const windowSize = 40;
      const start = Math.max(0, ip - 15);
      const end = Math.min(instructions.length, start + windowSize);

      let html = '';
      if (start > 0) {
        html += '<span style="color:var(--text-muted); padding:0 4px;">...</span>';
      }

      for (let i = start; i < end; i++) {
        const item = instructions[i];
        const isCur = (i === ip);
        const catClass = getCharCategoryClass(item.char);
        const disp = item.char === '<' ? '&lt;' : (item.char === '>' ? '&gt;' : item.char);
        html += '<div class="instr-chip ' + (isCur ? 'current ' : '') + catClass + '" data-idx="' + i + '">' + disp + '</div>';
      }

      if (end < instructions.length) {
        html += '<span style="color:var(--text-muted); padding:0 4px;">...</span>';
      }

      streamWrapper.innerHTML = html;

      // Click instruction chip to jump directly to it
      document.querySelectorAll('.instr-chip').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-idx'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < instructions.length) {
            pause();
            ip = idx;
            updateUI();
          }
        });
      });
    }

    function renderTape() {
      // Keep tape centered around ptr
      const half = Math.floor(VISIBLE_CELL_WINDOW / 2);
      let start = Math.max(0, ptr - half);
      if (start + VISIBLE_CELL_WINDOW > TAPE_SIZE) {
        start = TAPE_SIZE - VISIBLE_CELL_WINDOW;
      }

      let html = '';
      for (let i = start; i < start + VISIBLE_CELL_WINDOW; i++) {
        const val = memory[i];
        const isActive = (i === ptr);
        const isNonZero = val > 0;
        const hex = '0x' + val.toString(16).padStart(2, '0').toUpperCase();
        let chr = '.';
        if (val >= 32 && val <= 126) {
          if (val === 60) chr = '&lt;';
          else if (val === 62) chr = '&gt;';
          else if (val === 38) chr = '&amp;';
          else chr = String.fromCharCode(val);
        } else if (val === 10) {
          chr = 'LF';
        } else if (val === 0) {
          chr = 'NUL';
        }

        const fillPct = Math.round((val / 255) * 100);

        let valueContent = '';
        if (i === editingCell) {
          valueContent = '<input class="cell-edit-input" type="number" min="0" max="255" value="' + val + '" data-cell-edit="' + i + '" />';
        } else {
          valueContent = '<div class="cell-value-dec">' + val + '</div>';
        }

        html += '<div class="cell-card ' + (isActive ? 'active ' : '') + (isNonZero ? 'non-zero ' : '') + (i === editingCell ? 'editing ' : '') + '" data-cell="' + i + '" title="Click to edit cell #' + i + '">'
          + '<div class="cell-index">#' + i + '</div>'
          + valueContent
          + '<div class="cell-bottom-info">'
            + '<span>' + hex + '</span>'
            + "<span>'" + chr + "'</span>"
          + '</div>'
          + '<div class="cell-fill-bar" style="width: ' + fillPct + '%"></div>'
        + '</div>';
      }

      tapeConveyor.innerHTML = html;

      // Attach click to edit cell value directly
      document.querySelectorAll('.cell-card').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target && e.target.classList.contains('cell-edit-input')) return;
          const cIdx = parseInt(el.getAttribute('data-cell'), 10);
          if (editingCell === cIdx) return;
          ptr = cIdx;
          editingCell = cIdx;
          updateUI();
          setTimeout(() => {
            const input = tapeConveyor.querySelector('.cell-edit-input');
            if (input) {
              input.focus();
              input.select();
            }
          }, 30);
        });
      });

      const activeEditInput = tapeConveyor.querySelector('.cell-edit-input');
      if (activeEditInput) {
        const commit = () => {
          if (editingCell === null) return;
          const target = editingCell;
          const raw = activeEditInput.value;
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) {
            memory[target] = Math.max(0, Math.min(255, parsed));
          }
          editingCell = null;
          updateUI();
        };

        activeEditInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            editingCell = null;
            updateUI();
          }
        });

        activeEditInput.addEventListener('blur', () => {
          commit();
        });
      }
    }

    function updateUI() {
      // Stats
      statPtr.textContent = '#' + ptr;
      if (!isEditingCellJump && cellLabel) {
        cellLabel.textContent = '#' + ptr;
      }
      const currentVal = memory[ptr];
      const hex = '0x' + currentVal.toString(16).padStart(2, '0').toUpperCase();
      let chr = '.';
      if (currentVal >= 32 && currentVal <= 126) chr = String.fromCharCode(currentVal);
      statVal.textContent = currentVal + ' (' + hex + ") '" + chr + "'";
      statSteps.textContent = stepCount;

      // Status
      statusBadge.textContent = state;
      statusBadge.className = 'status-badge status-' + state;

      // Play button text
      btnPlayPause.textContent = isRunning ? '⏸ Pause' : '▶ Run';
      btnStepPrev.disabled = history.length === 0 || isRunning;
      btnStepNext.disabled = ip >= instructions.length || isRunning;

      renderStream();
      renderTape();

      // Keep active cell in view when not editing
      const activeCard = tapeConveyor.querySelector('.cell-card.active');
      if (activeCard && editingCell === null) {
        activeCard.scrollIntoView({ behavior: isRunning ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      }

      // Notify editor to highlight current instruction when executing
      if (instructions[ip] && (stepCount > 0 || state === 'RUNNING' || state === 'PAUSED')) {
        vscode.postMessage({
          type: 'highlightInstruction',
          sourceOffset: instructions[ip].offset
        });
      } else if (stepCount === 0 && state === 'READY') {
        vscode.postMessage({ type: 'clearHighlight' });
      }
    }

    function executeOneStep() {
      if (ip >= instructions.length) {
        state = 'TERMINATED';
        pause();
        return false;
      }

      const instr = instructions[ip];
      const prevVal = memory[ptr];
      const prevPtr = ptr;
      const prevIp = ip;
      const prevOutLen = output.length;

      history.push({
        ip: prevIp,
        ptr: prevPtr,
        cellVal: prevVal,
        outLen: prevOutLen
      });
      if (history.length > 50000) history.shift();

      switch (instr.char) {
        case '>':
          ptr = (ptr + 1) % TAPE_SIZE;
          ip++;
          break;
        case '<':
          ptr = (ptr - 1 + TAPE_SIZE) % TAPE_SIZE;
          ip++;
          break;
        case '+':
          memory[ptr] = (memory[ptr] + 1) & 0xff;
          ip++;
          break;
        case '-':
          memory[ptr] = (memory[ptr] - 1) & 0xff;
          ip++;
          break;
        case '.':
          output += String.fromCharCode(memory[ptr]);
          statOutput.textContent = output.split(String.fromCharCode(10)).join('↵') || '-';
          statOutput.title = output;
          ip++;
          break;
        case ',':
          // Visual inspection mode: comma yields 0 (EOF) so programs execute cleanly
          memory[ptr] = 0;
          ip++;
          break;
        case '[':
          if (memory[ptr] === 0) {
            if (instr.jumpTarget !== -1) {
              ip = instr.jumpTarget + 1;
            } else {
              state = 'ERROR';
              pause();
              return false;
            }
          } else {
            ip++;
          }
          break;
        case ']':
          if (memory[ptr] !== 0) {
            if (instr.jumpTarget !== -1) {
              ip = instr.jumpTarget + 1;
            } else {
              state = 'ERROR';
              pause();
              return false;
            }
          } else {
            ip++;
          }
          break;
        case '#':
          ip++;
          stepCount++;
          state = 'PAUSED';
          pause();
          return false;
        default:
          ip++;
          break;
      }

      stepCount++;
      if (ip >= instructions.length) {
        state = 'TERMINATED';
        pause();
        return false;
      } else {
        if (state !== 'WAITING_INPUT' && state !== 'ERROR') {
          state = isRunning ? 'RUNNING' : 'PAUSED';
        }
      }

      return true;
    }

    function stepForward() {
      const result = executeOneStep();
      updateUI();
      return result;
    }

    function stepBackward() {
      if (history.length === 0) return;
      const snap = history.pop();
      ip = snap.ip;
      ptr = snap.ptr;
      memory[snap.ptr] = snap.cellVal;
      output = output.substring(0, snap.outLen);
      statOutput.textContent = output.split(String.fromCharCode(10)).join('↵') || '-';
      statOutput.title = output;
      stepCount = Math.max(0, stepCount - 1);
      state = 'PAUSED';
      updateUI();
    }

    function runLoop() {
      if (!isRunning || state !== 'RUNNING') return;

      const batchSize = stepDelay < 20 ? Math.max(1, Math.floor(20 / stepDelay)) : 1;
      const tickDelay = stepDelay < 20 ? Math.max(16, batchSize * stepDelay) : stepDelay;

      let keepRunning = true;
      for (let i = 0; i < batchSize; i++) {
        keepRunning = executeOneStep();
        if (!keepRunning || !isRunning || state !== 'RUNNING') {
          break;
        }
      }

      updateUI();

      if (keepRunning && isRunning && state === 'RUNNING') {
        runTimer = setTimeout(runLoop, tickDelay);
      }
    }

    function play() {
      if (ip >= instructions.length) {
        reset();
      }
      isRunning = true;
      state = 'RUNNING';
      updateUI();
      runLoop();
    }

    function pause() {
      isRunning = false;
      if (runTimer) {
        clearTimeout(runTimer);
        runTimer = null;
      }
      if (state === 'RUNNING') {
        state = 'PAUSED';
      }
      updateUI();
    }

    function reset() {
      pause();
      memory.fill(0);
      ptr = 0;
      ip = 0;
      output = '';
      stepCount = 0;
      history = [];
      statOutput.textContent = '-';
      statOutput.title = '';
      state = 'READY';
      vscode.postMessage({ type: 'clearHighlight' });
      updateUI();
    }

    // Event Handlers
    btnPlayPause.addEventListener('click', () => {
      if (isRunning) pause();
      else play();
    });

    btnStepNext.addEventListener('click', () => {
      pause();
      stepForward();
    });

    btnStepPrev.addEventListener('click', () => {
      pause();
      stepBackward();
    });

    btnReset.addEventListener('click', reset);

    function updateSpeed(val) {
      let parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) {
        parsed = 1;
      } else if (parsed > 1000) {
        parsed = 1000;
      }
      stepDelay = parsed;
      speedSlider.value = parsed;
      speedLabel.textContent = parsed + 'ms';
      if (speedInput && document.activeElement !== speedInput) {
        speedInput.value = parsed;
      }
      if (isRunning && state === 'RUNNING') {
        if (runTimer) {
          clearTimeout(runTimer);
          runTimer = null;
        }
        runTimer = setTimeout(runLoop, stepDelay < 20 ? 0 : stepDelay);
      }
    }

    speedSlider.addEventListener('input', () => updateSpeed(speedSlider.value));
    speedSlider.addEventListener('change', () => updateSpeed(speedSlider.value));

    // Manual input toggle on speedLabel click
    speedLabel.addEventListener('click', () => {
      speedLabel.style.display = 'none';
      speedInput.style.display = 'inline-block';
      speedInput.value = stepDelay;
      speedInput.focus();
      speedInput.select();
    });

    const commitSpeedEdit = () => {
      if (speedInput.style.display !== 'none') {
        updateSpeed(speedInput.value);
        speedInput.style.display = 'none';
        speedLabel.style.display = 'inline-block';
      }
    };

    speedInput.addEventListener('input', () => {
      const val = parseInt(speedInput.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 1000) {
        stepDelay = val;
        speedSlider.value = val;
        speedLabel.textContent = val + 'ms';
        if (isRunning && state === 'RUNNING') {
          if (runTimer) {
            clearTimeout(runTimer);
            runTimer = null;
          }
          runTimer = setTimeout(runLoop, stepDelay < 20 ? 0 : stepDelay);
        }
      }
    });

    speedInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitSpeedEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        speedInput.style.display = 'none';
        speedLabel.style.display = 'inline-block';
      }
    });

    speedInput.addEventListener('blur', () => {
      commitSpeedEdit();
    });

    function jumpToCell(val) {
      let parsed = parseInt(val, 10);
      if (isNaN(parsed)) {
        parsed = ptr;
      } else if (parsed < 0) {
        parsed = 0;
      } else if (parsed >= TAPE_SIZE) {
        parsed = TAPE_SIZE - 1;
      }
      ptr = parsed;
      updateUI();
    }

    cellLabel.addEventListener('click', () => {
      isEditingCellJump = true;
      cellLabel.style.display = 'none';
      cellInput.style.display = 'inline-block';
      cellInput.value = ptr;
      cellInput.focus();
      cellInput.select();
    });

    const commitCellJump = () => {
      if (isEditingCellJump) {
        jumpToCell(cellInput.value);
        isEditingCellJump = false;
        cellInput.style.display = 'none';
        cellLabel.style.display = 'inline-block';
      }
    };

    cellInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCellJump();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        isEditingCellJump = false;
        cellInput.style.display = 'none';
        cellLabel.style.display = 'inline-block';
      }
    });

    cellInput.addEventListener('blur', () => {
      commitCellJump();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        btnPlayPause.click();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        btnStepNext.click();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        btnStepPrev.click();
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    });

    // Listen for VS Code messages
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'loadCode') {
        fileNameBadge.textContent = msg.fileName || 'Brainfuck';
        instructions = parseCode(msg.code || '');
        reset();
        if (msg.autoStep && msg.autoStep > 0) {
          for (let s = 0; s < msg.autoStep && ip < instructions.length; s++) {
            stepForward();
          }
          state = 'PAUSED';
          updateUI();
        }
      }
    });

    // Initial render
    let initialCode = '';
    let initialFileName = 'hello_world.bf';
    try {
      const initEl = document.getElementById('bf-initial-data');
      if (initEl && initEl.textContent) {
        const parsed = JSON.parse(initEl.textContent);
        initialCode = parsed.code || '';
        initialFileName = parsed.fileName || 'hello_world.bf';
      }
    } catch (e) {
      console.error('Initial data parse failed', e);
    }

    if (initialCode) {
      fileNameBadge.textContent = initialFileName;
      instructions = parseCode(initialCode);
      reset();
      const autoStep = 0;
      for (let s = 0; s < autoStep && ip < instructions.length; s++) {
        stepForward();
      }
      updateUI();
    } else {
      updateUI();
    }
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
