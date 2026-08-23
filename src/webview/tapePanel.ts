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
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

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

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

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
    const editor = vscode.window.activeTextEditor || this._currentEditor;
    if (editor && editor.document.languageId === 'brainfuck') {
      this._currentEditor = editor;
      const text = editor.document.getText();
      const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'Untitled.bf';
      this._panel.webview.postMessage({
        type: 'loadCode',
        code: text,
        fileName
      });
    }
  }

  private highlightInstruction(sourceOffset: number) {
    if (!this._currentEditor || sourceOffset === undefined || sourceOffset < 0) {
      return;
    }
    const doc = this._currentEditor.document;
    if (sourceOffset >= doc.getText().length) {
      return;
    }
    const startPos = doc.positionAt(sourceOffset);
    const endPos = doc.positionAt(sourceOffset + 1);
    const range = new vscode.Range(startPos, endPos);
    this._currentEditor.setDecorations(this._activeDecorationType, [range]);
    this._currentEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
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
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brainfuck Visual Tape Debugger</title>
  <style>
    :root {
      --bg-primary: #0a0d14;
      --bg-secondary: #111726;
      --bg-tertiary: #1b2234;
      --bg-card: rgba(26, 34, 52, 0.7);
      --border-color: rgba(64, 196, 255, 0.2);
      --border-glow: rgba(0, 229, 255, 0.4);
      --accent-cyan: #00e5ff;
      --accent-magenta: #ff007f;
      --accent-purple: #9d4edd;
      --accent-green: #00ffaa;
      --accent-amber: #ffb703;
      --accent-red: #ff3366;
      --text-primary: #f0f4fc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
      --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      background: radial-gradient(circle at 50% 0%, #172033 0%, #080b12 80%);
      color: var(--text-primary);
      font-family: var(--font-ui);
      font-size: 13px;
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent-cyan);
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta));
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-weight: 900;
      font-size: 16px;
      color: #000;
      box-shadow: 0 0 16px var(--accent-cyan);
    }

    .title-group h1 {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(90deg, #fff, var(--text-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .file-badge {
      font-size: 11px;
      font-family: var(--font-mono);
      color: var(--accent-cyan);
      background: rgba(0, 229, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 229, 255, 0.25);
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
      letter-spacing: 1px;
      color: var(--text-muted);
    }

    .stat-val {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid currentColor;
    }
    .status-READY { color: var(--accent-cyan); background: rgba(0, 229, 255, 0.1); }
    .status-RUNNING { color: var(--accent-green); background: rgba(0, 255, 170, 0.1); box-shadow: 0 0 12px rgba(0, 255, 170, 0.3); }
    .status-PAUSED { color: var(--accent-amber); background: rgba(255, 183, 3, 0.1); }
    .status-WAITING_INPUT { color: var(--accent-magenta); background: rgba(255, 0, 127, 0.1); animation: pulse 1.2s infinite; }
    .status-TERMINATED { color: var(--text-muted); background: rgba(255, 255, 255, 0.05); }
    .status-ERROR { color: var(--accent-red); background: rgba(255, 51, 102, 0.1); }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.98); }
    }

    /* CONTROLS */
    .controls-panel {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 10px 16px;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    button:hover:not(:disabled) {
      background: var(--bg-tertiary);
      border-color: var(--accent-cyan);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.25);
      transform: translateY(-1px);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    button.btn-primary {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(157, 78, 221, 0.2));
      border-color: var(--accent-cyan);
      color: #fff;
    }

    button.btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.35), rgba(157, 78, 221, 0.35));
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.4);
    }

    .slider-group {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .slider-group input[type="range"] {
      -webkit-appearance: none;
      width: 110px;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      outline: none;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-cyan);
      cursor: pointer;
      box-shadow: 0 0 8px var(--accent-cyan);
      transition: transform 0.1s;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    /* INSTRUCTION STREAM */
    .stream-container {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px;
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
      padding: 6px 0;
      scrollbar-width: thin;
    }

    .instr-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 30px;
      padding: 0 6px;
      background: var(--bg-secondary);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      color: var(--text-secondary);
      transition: all 0.15s ease;
      cursor: pointer;
      flex-shrink: 0;
    }

    .instr-chip.current {
      background: linear-gradient(135deg, var(--accent-magenta), var(--accent-purple));
      border-color: #fff;
      color: #fff;
      transform: scale(1.15);
      box-shadow: 0 0 14px var(--accent-magenta);
      z-index: 2;
    }

    .instr-chip.ptr-move { color: #38bdf8; }
    .instr-chip.val-mut { color: #4ade80; }
    .instr-chip.io { color: #f43f5e; }
    .instr-chip.loop { color: #fbbf24; }
    .instr-chip.bp { color: #ec4899; }

    /* MEMORY TAPE SECTION */
    .tape-section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
    }

    .tape-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tape-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-cyan);
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
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 4px 8px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      width: 80px;
      text-align: center;
    }

    .tape-conveyor {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 12px 6px 18px 6px;
      scroll-behavior: smooth;
    }

    .cell-card {
      position: relative;
      flex: 0 0 88px;
      height: 112px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 8px 6px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cell-card:hover {
      border-color: var(--accent-cyan);
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }

    .cell-card.active {
      background: radial-gradient(circle at center, #1b2f4f 0%, #101a2d 100%);
      border: 2px solid var(--accent-cyan);
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.5), inset 0 0 10px rgba(0, 229, 255, 0.2);
      transform: translateY(-4px) scale(1.04);
      z-index: 5;
    }

    .cell-card.active::after {
      content: '▲ PTR';
      position: absolute;
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 800;
      color: var(--accent-cyan);
      letter-spacing: 0.5px;
      text-shadow: 0 0 8px var(--accent-cyan);
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
      font-size: 24px;
      font-weight: 800;
      text-align: center;
      color: #fff;
    }
    .cell-card.non-zero .cell-value-dec {
      color: var(--accent-green);
      text-shadow: 0 0 10px rgba(0, 255, 170, 0.4);
    }

    .cell-bottom-info {
      display: flex;
      justify-content: space-around;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-secondary);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 4px;
    }

    .cell-fill-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-green));
      border-radius: 0 0 8px 8px;
      transition: width 0.15s ease;
    }

    /* I/O PANELS */
    .io-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .io-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .io-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
    }

    .io-input, .io-terminal {
      width: 100%;
      height: 90px;
      background: var(--bg-secondary);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #fff;
      outline: none;
      resize: none;
    }

    .io-input:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
    }

    .io-terminal {
      background: #06090e;
      color: var(--accent-green);
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

  <!-- INSTRUCTION STREAM (FOLLOW ACTIVE OPCODES) -->
  <div class="stream-container">
    <div class="stream-header">
      <span>Instruction Stream</span>
      <span id="streamCounter">0 / 0</span>
    </div>
    <div class="stream-wrapper" id="streamWrapper">
      <span style="color: var(--text-muted); padding: 4px;">Brainfuck programı yükleniyor...</span>
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
        Hücreye tıklayarak değeri doğrudan düzenleyebilirsiniz
      </div>
    </div>
    <div class="tape-conveyor" id="tapeConveyor"></div>
  </div>

  <!-- I/O CONSOLE -->
  <div class="io-grid">
    <div class="io-box">
      <div class="io-header">
        <span>Girdi Tamponu (Input Queue)</span>
        <span style="font-size: 10px; color: var(--accent-magenta);">',' komutu için kullanılır</span>
      </div>
      <textarea class="io-input" id="inputBox" placeholder="Program girdisi girin..."></textarea>
    </div>
    <div class="io-box">
      <div class="io-header">
        <span>Çıktı Terminali (Console Output)</span>
        <button style="padding: 2px 8px; font-size: 10px;" id="btnClearOutput">Temizle</button>
      </div>
      <div class="io-terminal" id="terminalOutput"></div>
    </div>
  </div>

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
        streamWrapper.innerHTML = '<span style="color: var(--text-muted); padding: 4px;">Program boş veya komut bulunamadı.</span>';
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

        html += \`
          <div class="cell-card \${isActive ? 'active' : ''} \${isNonZero ? 'non-zero' : ''}" data-cell="\${i}" title="Hücre #\${i}">
            <div class="cell-index">#\${i}</div>
            <div class="cell-value-dec">\${val}</div>
            <div class="cell-bottom-info">
              <span>\${hex}</span>
              <span>'\${chr}'</span>
            </div>
            <div class="cell-fill-bar" style="width: \${fillPct}%"></div>
          </div>
        \`;
      }

      tapeConveyor.innerHTML = html;

      // Attach click to edit cell value
      document.querySelectorAll('.cell-card').forEach(el => {
        // click edit
// el.addEventListener('click', () => {
          const cIdx = parseInt(el.getAttribute('data-cell'), 10);
          const currentV = memory[cIdx];
          const newV = prompt('Hücre #' + cIdx + ' için yeni değer (0 - 255):', currentV);
          if (newV !== null) {
            const parsed = parseInt(newV, 10);
            if (!isNaN(parsed)) {
              memory[cIdx] = Math.max(0, Math.min(255, parsed));
              updateUI();
            }
          }
        });
      });
    }

    function updateUI() {
      // Stats
      statPtr.textContent = '#' + ptr;
      const currentVal = memory[ptr];
      const hex = '0x' + currentVal.toString(16).padStart(2, '0').toUpperCase();
      let chr = '.';
      if (currentVal >= 32 && currentVal <= 126) chr = String.fromCharCode(currentVal);
      statVal.textContent = currentVal + ' (' + hex + ') \\'' + chr + '\\'';
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
      }
    });

    // Initial render
    updateUI();
  </script>
</body>
</html>`;
  }
}
