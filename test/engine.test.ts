/**
 * Comprehensive unit tests for Brainfuck Language Support & Visual Debugger
 */
/**
 * Comprehensive unit tests for Brainfuck Language Support & Visual Debugger
 */
/**
 * Comprehensive unit tests for Brainfuck Language Support & Visual Debugger
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrainfuck } from '../src/interpreter/parser';
import { BrainfuckEngine, ExecutionState } from '../src/interpreter/engine';
import { formatBrainfuckSource, minifyBrainfuckSource } from '../src/interpreter/formatter';

describe('Brainfuck Parser', () => {
  it('should parse instructions and ignore whitespace/comments', () => {
    const code = '++ Hello > - [ < + ] . ,';
    const res = parseBrainfuck(code);
    assert.equal(res.instructions.length, 10);
    assert.equal(res.errors.length, 0);
    assert.equal(res.bracketPairs.get(4), 7);
    assert.equal(res.bracketPairs.get(7), 4);
  });

  it('should report unclosed opening bracket', () => {
    const code = '++ [ > +';
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0].message, /Kapatılmamış döngü/);
  });

  it('should report unmatched closing bracket', () => {
    const code = '++ > ] +';
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0].message, /Eşleşmeyen kapanış/);
  });

  it('should warn on empty loop []', () => {
    const code = '+[]';
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0].message, /İçi boş döngü/);
  });
});

describe('Brainfuck Engine', () => {
  it('should execute basic arithmetic and wrapping', () => {
    const engine = new BrainfuckEngine('+');
    engine.step();
    assert.equal(engine.memory[0], 1);

    const wrapEngine = new BrainfuckEngine('-', { cellWrapping: true });
    wrapEngine.step();
    assert.equal(wrapEngine.memory[0], 255);
  });

  it('should execute Hello World correctly', () => {
    // Standard Hello World
    const helloWorld = '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.';
    const engine = new BrainfuckEngine(helloWorld);
    const res = engine.runBatch(100000);
    assert.equal(res.state, ExecutionState.TERMINATED);
    assert.equal(engine.output, 'Hello World!\n');
  });

  it('should support step forward and step backward (time travel)', () => {
    const engine = new BrainfuckEngine('+++>++');
    assert.equal(engine.stepCount, 0);

    engine.step(); // + (cell 0 = 1)
    engine.step(); // + (cell 0 = 2)
    engine.step(); // + (cell 0 = 3)
    engine.step(); // > (ptr = 1)
    engine.step(); // + (cell 1 = 1)
    engine.step(); // + (cell 1 = 2)

    assert.equal(engine.ptr, 1);
    assert.equal(engine.memory[0], 3);
    assert.equal(engine.memory[1], 2);

    // Step backward
    engine.stepBackward(); // undo + (cell 1 = 1)
    assert.equal(engine.memory[1], 1);
    assert.equal(engine.ptr, 1);

    engine.stepBackward(); // undo + (cell 1 = 0)
    assert.equal(engine.memory[1], 0);

    engine.stepBackward(); // undo > (ptr = 0)
    assert.equal(engine.ptr, 0);
    assert.equal(engine.memory[0], 3);
  });

  it('should read input with comma', () => {
    const engine = new BrainfuckEngine(',>,');
    engine.setInput('AB');
    engine.step();
    assert.equal(engine.memory[0], 65); // 'A'
    engine.step();
    assert.equal(engine.ptr, 1);
    engine.step();
    assert.equal(engine.memory[1], 66); // 'B'
  });
});

describe('Brainfuck Formatter & Minifier', () => {
  it('should minify code by removing comments and whitespace', () => {
    const code = '++ Hello\n   [ > + < - ]   World !';
    const min = minifyBrainfuckSource(code);
    assert.equal(min, '++[>+<-]');
  });

  it('should format code with indentation for loops', () => {
    const code = '++[>+<-]';
    const formatted = formatBrainfuckSource(code, 2, true);
    assert.equal(formatted, '++[\n  >+<-\n]\n');
  });
});
