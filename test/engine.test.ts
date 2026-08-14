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
