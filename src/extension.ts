import * as vscode from 'vscode';
import { subscribeToDocumentChanges } from './interpreter/diagnostics';
import {
  BrainfuckDocumentFormattingEditProvider,
  formatActiveDocument,
  minifyActiveDocument
} from './commands/formatter';
import { runBrainfuckCode } from './commands/runCode';
import { TapePanel, isBrainfuckDocument } from './webview/tapePanel';

import { BrainfuckHoverProvider } from './providers/hoverProvider';

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

  // 3. Hover Provider (Bracket pairing, value adjustments, pointer shifts, idioms)
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      'brainfuck',
      new BrainfuckHoverProvider()
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

  // 4. Brainfuck Interpreter Status Bar Item (Python/TypeScript-inspired)
  const interpreterStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  interpreterStatusBarItem.command = 'brainfuck.showInterpreterMenu';
  context.subscriptions.push(interpreterStatusBarItem);

  const updateInterpreterStatusBar = (editor: vscode.TextEditor | undefined) => {
    if (editor && isBrainfuckDocument(editor.document)) {
      const config = vscode.workspace.getConfiguration('brainfuck');
      const tapeSize = config.get<number>('tapeSize', 30000);
      const cellWrapping = config.get<boolean>('cellWrapping', true);
      const maxSteps = config.get<number>('execution.maxSteps', 5000000);

      interpreterStatusBarItem.text = '$(chip) Brainfuck (Built-in)';

      const extVersion = context.extension?.packageJSON?.version || '1.0.0';
      const tooltip = new vscode.MarkdownString('', true);
      tooltip.isTrusted = true;
      tooltip.appendMarkdown('### Brainfuck Interpreter (Built-in)\n');
      tooltip.appendMarkdown(`- **Runtime:** Zero-dependency Built-in Engine (v${extVersion})\n`);
      tooltip.appendMarkdown(`- **Memory Tape:** ${tapeSize.toLocaleString()} cells (Uint8Array)\n`);
      tooltip.appendMarkdown(`- **Cell Wrapping:** ${cellWrapping ? '8-bit Wrapping (0-255)' : 'Clamped [0, 255]'}\n`);
      tooltip.appendMarkdown(`- **Max Step Limit:** ${maxSteps.toLocaleString()} steps\n\n`);
      tooltip.appendMarkdown('---\n');
      tooltip.appendMarkdown('*$(settings-gear) Click to choose interpreter actions or configure settings.*');

      interpreterStatusBarItem.tooltip = tooltip;
      interpreterStatusBarItem.show();
    } else {
      interpreterStatusBarItem.hide();
    }
  };

  updateInterpreterStatusBar(vscode.window.activeTextEditor);

  // Update status bar when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('brainfuck')) {
        updateInterpreterStatusBar(vscode.window.activeTextEditor);
      }
    })
  );

  // 5. Register Interpreter QuickPick Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('brainfuck.showInterpreterMenu', async () => {
      interface InterpreterQuickPickItem extends vscode.QuickPickItem {
        action: 'run' | 'tape' | 'settings' | 'format' | 'minify';
      }

      const items: InterpreterQuickPickItem[] = [
        {
          label: '$(run) Run Code in Output Channel',
          description: 'Execute active Brainfuck code with metrics and runtime summary',
          action: 'run'
        },
        {
          label: '$(circuit-board) Open Visual Memory Tape Debugger',
          description: 'Step-by-step visual inspection, time-travel, and terminal output console',
          action: 'tape'
        },
        {
          label: '$(gear) Configure Interpreter Settings...',
          description: 'Tape size, wrapping, run delays, output height, diagnostics',
          action: 'settings'
        },
        {
          label: '$(indent) Format Document / Indent Loops',
          description: 'Auto-indent loop blocks [ and ] for clean readability (Shift+Alt+F)',
          action: 'format'
        },
        {
          label: '$(file-zip) Minify Brainfuck Code',
          description: 'Strip comments and whitespace for compact production code',
          action: 'minify'
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Brainfuck action or configure the interpreter',
        title: 'Brainfuck Interpreter (Built-in)'
      });

      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'run':
          await vscode.commands.executeCommand('brainfuck.run');
          break;
        case 'tape':
          await vscode.commands.executeCommand('brainfuck.openVisualTape');
          break;
        case 'settings':
          await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Ohualtex.extension-pack-for-brainfuck');
          break;
        case 'format':
          await vscode.commands.executeCommand('brainfuck.format');
          break;
        case 'minify':
          await vscode.commands.executeCommand('brainfuck.minify');
          break;
      }
    })
  );

  // 6. Sync open visual tape when switching Brainfuck files (only if already opened manually by user)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      updateInterpreterStatusBar(editor);
      if (editor && isBrainfuckDocument(editor.document)) {
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
