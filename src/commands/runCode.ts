import * as vscode from 'vscode';
import { BrainfuckEngine, ExecutionState } from '../interpreter/engine';
import { parseBrainfuck } from '../interpreter/parser';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Brainfuck Output');
  }
  return outputChannel;
}

export async function runBrainfuckCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'brainfuck') {
    vscode.window.showInformationMessage('Lütfen çalıştırmak için bir Brainfuck dosyası (.bf) açın.');
    return;
  }

  const source = editor.document.getText();
  const parseResult = parseBrainfuck(source);

  const errors = parseResult.errors.filter(e => !e.message.includes('İçi boş döngü'));
  // if (errors.length > 0) {
    vscode.window.showErrorMessage(
      `Kod çalıştırılamadı! ${errors.length} sözdizimi hatası bulundu: ${errors[0].message} (Satır ${errors[0].line + 1})`
    );
    return;
  }

  // Check if code contains comma (input)
  const hasInput = parseResult.instructions.some(i => i.char === ',');
  let userInput = '';
  if (hasInput) {
    const input = await vscode.window.showInputBox({
      prompt: 'Program girdi bekliyor (","). Lütfen girdi metnini yazın:',
      placeHolder: 'Girdi (boş bırakabilirsiniz)...'
    });
    if (input === undefined) {
      // User cancelled
      return;
    }
    userInput = input;
  }

  const channel = getOutputChannel();
  channel.show(true);
  channel.appendLine(`\n[${new Date().toLocaleTimeString()}] Brainfuck programı başlatılıyor...`);
  channel.appendLine('----------------------------------------------------');

  const config = vscode.workspace.getConfiguration('brainfuck');
  const tapeSize = config.get<number>('tapeSize', 30000);
  const cellWrapping = config.get<boolean>('cellWrapping', true);

  const engine = new BrainfuckEngine(parseResult, { tapeSize, cellWrapping });
  if (userInput) {
    engine.setInput(userInput);
  }

  const startTime = Date.now();
  const maxSteps = 5000000; // 5 million steps max safeguard
  let steps = 0;

  while (
    engine.state !== ExecutionState.TERMINATED &&
    engine.state !== ExecutionState.ERROR &&
    engine.state !== ExecutionState.WAITING_INPUT &&
    steps < maxSteps
  ) {
    const batch = engine.runBatch(10000);
    steps += batch.stepsExecuted;
  }

  const durationMs = Date.now() - startTime;

  if (engine.output.length > 0) {
    channel.appendLine(engine.output);
  } else {
    channel.appendLine('(Program herhangi bir çıktı üretmedi)');
  }

  channel.appendLine('----------------------------------------------------');
  if (steps >= maxSteps) {
    channel.appendLine(`[UYARI] Program ${maxSteps} adım sınırına ulaştı ve durduruldu (Olası sonsuz döngü).`);
  } else if (engine.state === ExecutionState.ERROR) {
    channel.appendLine(`[HATA] ${engine.errorMessage}`);
  } else {
    channel.appendLine(
      `[BAŞARILI] Tamamlandı: ${steps} adım | ${durationMs} ms | Aktif Hücre: ${engine.ptr} | Hücre Değeri: ${engine.memory[engine.ptr]}`
    );
  }
}
