import { formatBrainfuckSource, minifyBrainfuckSource } from '../src/interpreter/formatter';
import { BrainfuckEngine, ExecutionState } from '../src/interpreter/engine';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrainfuck } from '../src/interpreter/parser';

describe('Brainfuck Parser', () => {
  it('should parse instructions and ignore whitespace/comments', () => {
    const code = '++ Hello > - [ < + ] . ,';
    const res = parseBrainfuck(code);
    assert.equal(res.instructions.length, 10);
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

  it('should execute Hello World correctly', () => {
    const helloWorld = '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.';
    const engine = new BrainfuckEngine(helloWorld);
    const res = engine.runBatch(100000);
    assert.equal(res.state, ExecutionState.TERMINATED);
    assert.equal(engine.output, 'Hello World!\n');
  });

  it('should support step forward and step backward (time travel)', () => {
    const engine = new BrainfuckEngine('+++>++');
    engine.step(); engine.step(); engine.step(); engine.step(); engine.step(); engine.step();
    assert.equal(engine.ptr, 1);
    assert.equal(engine.memory[0], 3);
    assert.equal(engine.memory[1], 2);
    engine.stepBackward();
    assert.equal(engine.memory[1], 1);
  });

  it('should read input with comma', () => {
    const engine = new BrainfuckEngine(',>,');
    engine.setInput('AB');
    engine.step();
    assert.equal(engine.memory[0], 65);
    engine.step();
    assert.equal(engine.ptr, 1);
    engine.step();
    assert.equal(engine.memory[1], 66);
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
});

describe('Brainfuck Formatter & Minifier', () => {
  it('should minify code by removing comments and whitespace', () => {
    const code = '++ Hello\n   [ > + < - ]   World !';
    const min = minifyBrainfuckSource(code);
    assert.equal(min, '++[>+<-]');
  });
});
