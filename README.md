# VS Code Brainfuck Language Support & Visual Tape Debugger

> **The all-in-one, zero-dependency Brainfuck development studio & visual debugger for VS Code.**

A standalone, batteries-included development environment for Visual Studio Code. Write, format, lint, run, and visually debug Brainfuck programs with zero external compilers, runtimes, or configurations required.

![Brainfuck Visual Tape Debugger](https://raw.githubusercontent.com/Ohualtex/vscode-brainfuck/main/docs/preview.png)

---

## ⚡ Features

### 1. 🎨 Advanced Syntax Highlighting
- Colors all 8 core Brainfuck instructions by functional categories:
  - **Pointer Movement (`>`, `<`):** Blue / Cyan
  - **Value Mutation (`+`, `-`):** Green
  - **I/O Commands (`.`, `,`):** Red / Pink
  - **Loop Brackets (`[`, `]`):** Yellow / Amber
  - **Debugger Breakpoint (`#`):** Magenta
  - **Comments:** All other characters are styled as muted comments.
- Bracket matching and auto-closing bracket support.

### 2. 🔍 Real-Time Diagnostics
- **Unclosed loop bracket (`[`):** Flagged with red underlines when no matching `]` exists.
- **Unmatched closing bracket (`]`):** Flagged immediately when no preceding `[` exists.
- **Empty loop warning (`[]`):** Generates a warning diagnostic for potential infinite loops.

### 3. 📼 Visual Memory Tape & Time-Travel Debugger
High-performance, smooth memory visualizer built with native VS Code design tokens:
- **Live Cell Inspector:** View Decimal, Hex (0x00), and ASCII character representations for every memory cell.
- **Active Pointer Indicator:** Prominent active cell highlight with pointer position and stats.
- **Time-Travel Debugging:**
  - **Step Next (`▶` / `Right Arrow`):** Advance execution by one step.
  - **Step Prev (`◀` / `Left Arrow`):** Step backward (restores tape memory, pointer, and console output!).
  - **Run / Pause (`Space`):** Continuous auto-execution with adjustable speed.
  - **Reset (`R`):** Reset tape memory and terminal output.
- **Bidirectional Editor Sync:** The currently executing instruction in the editor is highlighted with a gold focus indicator.
- **Direct Cell Editing:** Click any memory cell to directly modify its value (0 - 255).
- **Input Buffer & Output Console:** Full support for `,` input queueing and real-time output terminal.

### 4. 🚀 Output Channel Runner
- Execute Brainfuck code instantly via the editor title bar Run button or the command palette (`Brainfuck: Run Code in Output Channel`).
- Reports total execution steps, duration in milliseconds, and final memory state.

### 5. 🧹 Formatter & Minifier
- **Format Document (`Shift+Alt+F`):** Automatically indents loop blocks (`[` and `]`) for readability.
- **Minify Code:** Strips comments and whitespace to produce compact Brainfuck code.

### 6. 📝 Built-in Snippets
- `bf-hello` / `hello`: Standard Hello World program.
- `bf-clear` / `clear`: Cell reset `[-]`.
- `bf-move`: Move cell value `[->+<]`.
- `bf-copy`: Copy cell value `[->+>+<<]>>[-<<+>>]<`.
- `bf-add` / `bf-sub`: Addition and subtraction between cells.
- `bf-mult`: Multiplication loop template.

### 7. 🎛️ Explorer Icons & Status Bar Integration
- **Explorer File Icon:** Branded `>+` badge icon for `.bf` and `.b` files in the VS Code explorer tree.
- **Status Bar Toggle:** Discreet `$(circuit-board) Brainfuck Tape` button in the status bar for instant 1-click access.

---

## ⌨️ Shortcuts & Commands

| Command | Shortcut / Location | Description |
|---|---|---|
| `Brainfuck: Open Visual Tape Debugger` | Editor Title Bar / Status Bar | Opens the interactive visual memory tape |
| `Brainfuck: Run Code in Output Channel` | Editor Title Bar Button | Executes the code in the output channel |
| `Brainfuck: Format / Indent Loops` | `Shift+Alt+F` | Indents and formats loops |
| `Brainfuck: Minify Code` | Command Palette | Strips comments and whitespace |

### Inside the Visual Debugger:
- **`Space`**: Run / Pause
- **`Right Arrow` (`→`)**: Step Next
- **`Left Arrow` (`←`)**: Step Prev (Time-Travel Undo)
- **`R`**: Reset tape and output

---

## ⚙️ Extension Settings

- `brainfuck.tapeSize`: Memory tape capacity in cells (Default: `30000`).
- `brainfuck.cellWrapping`: 8-bit wrapping (0 - 1 = 255, 255 + 1 = 0) (Default: `true`).
- `brainfuck.defaultRunDelayMs`: Step delay in milliseconds for visual auto-play (Default: `30ms`).

---

## 🛠️ Development & Testing

```bash
# Install dependencies
npm install

# Compile with TypeScript and esbuild
npm run compile

# Run unit tests
npm test

# Press F5 in VS Code to launch the Extension Development Host!
```
