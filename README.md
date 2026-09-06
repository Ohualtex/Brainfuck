# VS Code Brainfuck Language Support & Visual Tape Debugger

> **The all-in-one, zero-dependency Brainfuck development studio & visual debugger for VS Code.**

[![Version](https://img.shields.io/badge/version-0.1.3-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](#)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC.svg)](https://code.visualstudio.com/)

A standalone, batteries-included development environment for Visual Studio Code. Write, format, lint, run, and visually debug Brainfuck programs with zero external compilers, runtimes, or configurations required.

![Brainfuck Visual Tape Debugger](docs/preview.png)

---

## ⚡ Features

### 1. 🎨 Advanced Syntax Highlighting & Clean Minimap
- Colors all 8 core Brainfuck instructions by functional categories:
  - **Pointer Movement (`>`, `<`):** Blue / Cyan
  - **Value Mutation (`+`, `-`):** Green
  - **I/O Commands (`.`, `,`):** Red / Pink
  - **Loop Brackets (`[`, `]`):** Yellow / Amber
  - **Debugger Breakpoint (`#`):** Magenta
  - **Comments:** All other characters are styled as muted comments.
- **Clean Minimap:** Optimized folding configuration prevents loop brackets from inflating into oversized block markers on the VS Code minimap.
- Bracket pair colorization and auto-closing bracket support.

### 2. 🔍 Real-Time Diagnostics
- **Unclosed loop bracket (`[`):** Flagged with red underlines when no matching `]` exists.
- **Unmatched closing bracket (`]`):** Flagged immediately when no preceding `[` exists.
- **Empty loop warning (`[]`):** Generates a warning diagnostic for potential infinite loops.

### 3. 📼 Visual Memory Tape & Time-Travel Debugger
High-performance, smooth memory visualizer built with native VS Code design tokens:
- **Ultra-Fast Adaptive Engine:** Adjustable step delay from `1ms` to `1000ms`. At high speeds, an adaptive batching scheduler executes up to 1,000+ steps per second while maintaining smooth 60fps DOM rendering.
- **Direct Cell Jump Control:** Interactive `Cell: [#ptr]` inline input with boundary clamping (`0` to `29999`) to instantly inspect any memory location.
- **50-Cell Conveyor Tape View:** Extended sliding tape window smoothly centered around the active memory pointer.
- **Live Cell Inspector:** Displays Decimal, Hex (`0x00`), and ASCII character representations for every memory cell.
- **Time-Travel Debugging:**
  - **Step Next (`▶` / `Right Arrow`):** Advance execution by one instruction.
  - **Step Prev (`◀` / `Left Arrow`):** Step backward (restores tape memory, pointer, and console output).
  - **Run / Pause (`Space`):** Continuous auto-execution with dynamic speed control.
  - **Reset (`R`):** Reset tape memory, pointer, and output console.
- **Bidirectional Editor Sync:** The currently executing instruction in the editor is highlighted with a gold focus indicator in real-time.
- **Direct Cell Editing:** Click any memory cell on the tape to directly modify its value (0 - 255).
- **Input Buffer & Output Console:** Interactive `,` input queuing and real-time output terminal.

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
- **Branded Explorer Icons:** Custom transparent `>+` badge icons for `.bf` and `.b` files in the VS Code explorer tree and editor tabs.
- **Dedicated Icon Theme:** Includes the official `Brainfuck (Official)` icon theme.
- **Status Bar Integration:** Discreet `$(circuit-board) Brainfuck Tape` button in the status bar for instant 1-click access.

---

## ⌨️ Shortcuts & Commands

| Command | Shortcut / Location | Description |
|---|---|---|
| `Brainfuck: Open Visual Tape Debugger` | Title Bar / Status Bar / Context Menu | Opens the interactive visual memory tape |
| `Brainfuck: Run Code in Output Channel` | Title Bar / Context Menu | Executes the code in the output channel |
| `Brainfuck: Format / Indent Loops` | `Shift+Alt+F` / Context Menu | Indents and formats loops |
| `Brainfuck: Minify Code` | Command Palette / Context Menu | Strips comments and whitespace |

### Inside the Visual Debugger:
- **`Space`**: Run / Pause
- **`Right Arrow` (`→`)**: Step Next
- **`Left Arrow` (`←`)**: Step Prev (Time-Travel Undo)
- **`R`**: Reset tape and output
- **`Cell: [#...]`**: Jump to specific cell index

---

## ⚙️ Extension Settings

- `brainfuck.tapeSize`: Memory tape capacity in cells (Default: `30000`).
- `brainfuck.cellWrapping`: 8-bit wrapping (0 - 1 = 255, 255 + 1 = 0) (Default: `true`).
- `brainfuck.defaultRunDelayMs`: Step delay in milliseconds for visual auto-play (Default: `30ms`).

---

## 📂 Examples Included

The repository comes with ready-to-run Brainfuck examples in the [`examples/`](examples) directory:
- [`hello_world.bf`](examples/hello_world.bf): Standard Hello World program.
- [`addition.bf`](examples/addition.bf): Multi-cell addition algorithm with memory walkthrough.
- [`echo.bf`](examples/echo.bf): Character echo demonstrating interactive `,` input.

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

---

## 📄 License

MIT License © [Ohualtex](https://github.com/Ohualtex)
