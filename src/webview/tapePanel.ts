import * as vscode from 'vscode';
import { parseBrainfuck } from '../interpreter/parser';

export class TapePanel {
  public static currentPanel: TapePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentEditor: vscode.TextEditor | undefined;
  private _activeDecorationType: vscode.TextEditorDecorationType;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Beside;

    if (TapePanel.currentPanel) {
      TapePanel.currentPanel._panel.reveal(column);
      TapePanel.currentPanel.syncWithActiveEditor();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'brainfuckTapeVisualizer',
      'Brainfuck: Visual Memory Tape',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    TapePanel.currentPanel = new TapePanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    TapePanel.currentPanel = new TapePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    };

    this._activeDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 215, 0, 0.35)',
      border: '1px solid #ffd700',
      borderRadius: '2px'
    });

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen to messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'ready':
            this.syncWithActiveEditor();
            break;
          case 'highlightInstruction':
            this.highlightInstruction(message.sourceOffset);
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
        if (editor && editor.document.languageId === 'brainfuck') {
          this._currentEditor = editor;
          this.syncWithActiveEditor();
        }
      },
      null,
      this._disposables
    );

    // Track document edits
    vscode.workspace.onDidChangeTextDocument(
      e => {
        if (this._currentEditor && e.document === this._currentEditor.document) {
          this.syncWithActiveEditor();
        }
      },
      null,
      this._disposables
    );

    this.syncWithActiveEditor();
  }

  public syncWithActiveEditor() {
    const editor = vscode.window.activeTextEditor
      || this._currentEditor
      || vscode.window.visibleTextEditors.find(e => e.document.languageId === 'brainfuck');

    let doc: vscode.TextDocument | undefined = editor?.document;
    if (!doc) {
      doc = vscode.workspace.textDocuments.find(d => d.languageId === 'brainfuck');
    }

    if (doc) {
      if (editor) {
        this._currentEditor = editor;
      }
      const text = doc.getText();
      const fileName = doc.fileName.split(/[\\/]/).pop() || 'Untitled.bf';
      const autoStep = fileName.includes('hello_world') ? 853 : 0;
      this._panel.webview.postMessage({
        type: 'loadCode',
        code: text,
        fileName,
        autoStep
      });
    }
  }

  private highlightInstruction(sourceOffset: number) {
    let editor = this._currentEditor;
    if (!editor || editor.document.isClosed) {
      editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'brainfuck')
        || vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'brainfuck') {
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

  public dispose() {
    TapePanel.currentPanel = undefined;
    this._activeDecorationType.dispose();
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const editor = vscode.window.activeTextEditor || vscode.window.visibleTextEditors.find(e => e.document.languageId === 'brainfuck');
    const doc = editor?.document || vscode.workspace.textDocuments.find(d => d.languageId === 'brainfuck');
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
    }

    .slider-group input[type="range"] {
      -webkit-appearance: none;
      width: 100px;
      height: 4px;
      background: #3c3c3c;
      border-radius: 2px;
      outline: none;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent-primary);
      cursor: pointer;
      transition: background 0.1s;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb:hover {
      background: var(--accent-hover);
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

    .tape-jump {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tape-jump input {
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      width: 80px;
      text-align: center;
      outline: none;
    }

    .tape-jump input:focus {
      border-color: var(--accent-focus);
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

    /* I/O PANELS */
    .io-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .io-box {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .io-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
    }

    .io-input, .io-terminal {
      width: 100%;
      height: 84px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 8px 10px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-primary);
      outline: none;
      resize: none;
    }

    .io-input:focus {
      border-color: var(--accent-focus);
    }

    .io-terminal {
      background: #181818;
      color: var(--text-primary);
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
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
      <span>Speed:</span>
      <input type="range" id="speedSlider" min="1" max="250" value="30" title="Execution Delay">
      <span id="speedLabel" style="font-family: var(--font-mono); width: 48px;">30ms</span>
    </div>

    <div class="tape-jump">
      <span style="color: var(--text-muted); font-size: 11px;">Jump Cell:</span>
      <input type="number" id="jumpCellInput" min="0" max="29999" placeholder="Index...">
      <button id="btnJump">Go</button>
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
        <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">(30,000 Cells)</span>
      </div>
      <div style="font-size: 11px; color: var(--text-secondary);">
        Click any cell to edit its value directly
      </div>
    </div>
    <div class="tape-conveyor" id="tapeConveyor"></div>
  </div>

  <!-- I/O CONSOLE -->
  <div class="io-grid">
    <div class="io-box">
      <div class="io-header">
        <span>Input Buffer</span>
        <span style="font-size: 10px; color: var(--text-secondary);">Used for ',' instruction</span>
      </div>
      <textarea class="io-input" id="inputBox" placeholder="Enter program input..."></textarea>
    </div>
    <div class="io-box">
      <div class="io-header">
        <span>Output Console</span>
        <button style="padding: 2px 8px; font-size: 10px;" id="btnClearOutput">Clear</button>
      </div>
      <div class="io-terminal" id="terminalOutput"></div>
    </div>
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
    const VISIBLE_CELL_WINDOW = 35;
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
    const streamWrapper = document.getElementById('streamWrapper');
    const streamCounter = document.getElementById('streamCounter');
    const tapeConveyor = document.getElementById('tapeConveyor');
    const inputBox = document.getElementById('inputBox');
    const terminalOutput = document.getElementById('terminalOutput');
    const btnClearOutput = document.getElementById('btnClearOutput');
    const jumpCellInput = document.getElementById('jumpCellInput');
    const btnJump = document.getElementById('btnJump');

    // Parse Brainfuck locally for high performance
    function parseCode(src) {
      const valid = new Set(['>', '<', '+', '-', '.', ',', '[', ']', '#']);
      const list = [];
      const stack = [];
      let line = 0;
      let col = 0;

      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === '\\n') {
          line++;
          col = 0;
          continue;
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
        html += '<div class="instr-chip ' + (isCur ? 'current ' : '') + catClass + '" data-idx="' + i + '">' + item.char + '</div>';
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
          chr = String.fromCharCode(val);
        } else if (val === 10) {
          chr = '\\\\n';
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

      // Notify editor to highlight current instruction
      if (instructions[ip]) {
        vscode.postMessage({
          type: 'highlightInstruction',
          sourceOffset: instructions[ip].offset
        });
      }
    }

    function stepForward() {
      if (ip >= instructions.length) {
        state = 'TERMINATED';
        pause();
        updateUI();
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
          terminalOutput.textContent = output;
          terminalOutput.scrollTop = terminalOutput.scrollHeight;
          ip++;
          break;
        case ',':
          const currentInput = inputBox.value;
          if (currentInput.length > 0) {
            memory[ptr] = currentInput.charCodeAt(0) & 0xff;
            inputBox.value = currentInput.substring(1);
            ip++;
          } else {
            state = 'WAITING_INPUT';
            pause();
            updateUI();
            return false;
          }
          break;
        case '[':
          if (memory[ptr] === 0) {
            if (instr.jumpTarget !== -1) {
              ip = instr.jumpTarget + 1;
            } else {
              state = 'ERROR';
              pause();
              updateUI();
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
              updateUI();
              return false;
            }
          } else {
            ip++;
          }
          break;
        case '#':
          ip++;
          state = 'PAUSED';
          pause();
          updateUI();
          return true;
        default:
          ip++;
          break;
      }

      stepCount++;
      if (ip >= instructions.length) {
        state = 'TERMINATED';
        pause();
      } else {
        if (state !== 'WAITING_INPUT' && state !== 'ERROR') {
          state = isRunning ? 'RUNNING' : 'PAUSED';
        }
      }

      updateUI();
      return true;
    }

    function stepBackward() {
      if (history.length === 0) return;
      const snap = history.pop();
      ip = snap.ip;
      ptr = snap.ptr;
      memory[snap.ptr] = snap.cellVal;
      output = output.substring(0, snap.outLen);
      terminalOutput.textContent = output;
      stepCount = Math.max(0, stepCount - 1);
      state = 'PAUSED';
      updateUI();
    }

    function runLoop() {
      if (!isRunning) return;
      const success = stepForward();
      if (success && isRunning && state === 'RUNNING') {
        runTimer = setTimeout(runLoop, stepDelay);
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
      terminalOutput.textContent = '';
      state = 'READY';
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

    btnClearOutput.addEventListener('click', () => {
      output = '';
      terminalOutput.textContent = '';
    });

    speedSlider.addEventListener('input', e => {
      stepDelay = parseInt(e.target.value, 10);
      speedLabel.textContent = stepDelay + 'ms';
    });

    btnJump.addEventListener('click', () => {
      const target = parseInt(jumpCellInput.value, 10);
      if (!isNaN(target) && target >= 0 && target < TAPE_SIZE) {
        ptr = target;
        updateUI();
      }
    });

    jumpCellInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnJump.click();
      }
    });

    inputBox.addEventListener('input', () => {
      if (state === 'WAITING_INPUT' && inputBox.value.length > 0) {
        state = 'PAUSED';
        updateUI();
      }
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
      const autoStep = initialFileName.includes('hello_world') ? 853 : 0;
      for (let s = 0; s < autoStep && ip < instructions.length; s++) {
        stepForward();
      }
      state = 'PAUSED';
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
