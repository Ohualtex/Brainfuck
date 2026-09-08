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
    assert.match(res.errors[0].message, /Unclosed loop/);
  });

  it('should report unmatched closing bracket', () => {
    const code = '++ > ] +';
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0].message, /Unmatched closing/);
  });

  it('should warn on empty loop []', () => {
    const code = '+[]';
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0].message, /Empty loop/);
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

    const clampUnderflowEngine = new BrainfuckEngine('-', { cellWrapping: false });
    clampUnderflowEngine.step();
    assert.equal(clampUnderflowEngine.memory[0], 0);

    const clampOverflowEngine = new BrainfuckEngine('+', { cellWrapping: false });
    clampOverflowEngine.memory[0] = 255;
    clampOverflowEngine.step();
    assert.equal(clampOverflowEngine.memory[0], 255);
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

  it('should ignore operators and brackets inside line comments when minifying', () => {
    const code = [
      '// Add 5: +++++',
      '; Reset to zero: [-]',
      '# Comment with +++',
      '++[>+<-]'
    ].join('\n');
    const min = minifyBrainfuckSource(code);
    assert.equal(min, '++[>+<-]');
  });

  it('should format code with indentation for loops', () => {
    const code = '++[>+<-]';
    const formatted = formatBrainfuckSource(code, 2, true);
    assert.equal(formatted, '++[\n  >+<-\n]\n');
  });

  it('should format code with custom tabSize and tabs', () => {
    const code = '++[>+<-]';
    const formatted = formatBrainfuckSource(code, 4, false);
    assert.equal(formatted, '++[\n\t>+<-\n]\n');
  });
});

describe('Parser Edge Cases & Bug Fixes', () => {
  it('should track line numbers correctly through multiline header comments', () => {
    const code = [
      '[ Header Comment Block',
      '  Line 2 of comment',
      '  Line 3 of comment ]',
      '++',
      ']' // Unmatched bracket on line 4 (0-indexed line 4)
    ].join('\n');
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 1);
    assert.equal(res.errors[0].line, 4);
    assert.match(res.errors[0].message, /Unmatched closing/);
  });

  it('should not create an out-of-bounds line index for EOF line comment without newline', () => {
    const code = '++\n// end of file comment without newline';
    const res = parseBrainfuck(code);
    assert.equal(res.instructions.length, 2);
    // Error on unclosed loop should have exact line
    const codeWithErr = '++[\n// eof';
    const resErr = parseBrainfuck(codeWithErr);
    assert.equal(resErr.errors[0].line, 0); // '[' was on line 0
  });

  it('should treat # with whitespace as comment and bare # as breakpoint instruction', () => {
    const code = [
      '# This is a comment with +++',
      '++#--'
    ].join('\n');
    const res = parseBrainfuck(code);
    const chars = res.instructions.map(i => i.char).join('');
    assert.equal(chars, '++#--');
  });

  it('should parse 135,000 character pure Brainfuck program swiftly without crashing', () => {
    const huge = '>'.repeat(50000) + '+'.repeat(30000) + '-'.repeat(30000) + '<'.repeat(25000);
    const t0 = Date.now();
    const res = parseBrainfuck(huge);
    const duration = Date.now() - t0;
    assert.equal(res.instructions.length, 135000);
    assert.equal(res.errors.length, 0);
    assert.ok(duration < 500, `Expected parse time under 500ms, took ${duration}ms`);
  });

  it('should handle nested brackets inside header comments without syntax errors', () => {
    const code = [
      '[ Brainfuck Program: Author [Miyamura] - test [nested] info ]',
      '++'
    ].join('\n');
    const res = parseBrainfuck(code);
    assert.equal(res.errors.length, 0);
    assert.equal(res.instructions.length, 2);
    assert.equal(res.instructions[0].char, '+');
    assert.equal(res.instructions[1].char, '+');
  });

  it('should preserve line comments and inline comments containing brackets without corrupting formatting', () => {
    const code = [
      '// Loop description: [ decrements counter ]',
      '++ [',
      '  > + < - // inline comment: [cell 1]',
      ']'
    ].join('\n');
    const formatted = formatBrainfuckSource(code, 2, true);
    assert.ok(formatted.includes('// Loop description: [ decrements counter ]'));
    assert.ok(formatted.includes('// inline comment: [cell 1]'));
    // Should not have split orphan comment lines
    assert.ok(!formatted.includes('decrements counter\n]'));
  });

  it('should respect eofBehavior zero, no-change, and waiting', () => {
    // 1. zero on EOF (default): cleanly terminates an echo loop
    const echoCode = ',[.[-],]';
    const echoEngine = new BrainfuckEngine(echoCode, { eofBehavior: 'zero' });
    echoEngine.setInput('Hi');
    const echoRes = echoEngine.runBatch(10000);
    assert.equal(echoRes.state, ExecutionState.TERMINATED);
    assert.equal(echoEngine.output, 'Hi');

    // 2. no-change on EOF
    const noChangeEngine = new BrainfuckEngine(',,', { eofBehavior: 'no-change' });
    noChangeEngine.setInput('A'); // first comma gets 'A', second comma gets EOF (keeps 'A')
    noChangeEngine.step(); // reads 'A' (65)
    assert.equal(noChangeEngine.memory[0], 65);
    noChangeEngine.step(); // reads EOF with no-change -> cell remains 65
    assert.equal(noChangeEngine.memory[0], 65);

    // 3. waiting on EOF
    const waitingEngine = new BrainfuckEngine(',', { eofBehavior: 'waiting' });
    waitingEngine.setInput('');
    waitingEngine.step();
    assert.equal(waitingEngine.state, ExecutionState.WAITING_INPUT);
  });

  it('should batch-prune history efficiently and allow time-travel after exceeding history limit', () => {
    // A program that executes >1,000 steps using 8-bit wrapping
    // '-' sets cell 0 to 255, then '[>+<-]' runs 255 loop iterations (1,277 total steps)
    const code = '-[>+<-]';
    const engine = new BrainfuckEngine(code, { maxHistoryLength: 100, cellWrapping: true });
    const res = engine.runBatch(5000);
    assert.equal(res.state, ExecutionState.TERMINATED);
    assert.ok(engine.stepCount >= 1000);
    assert.ok(engine.canStepBackward());
    const preBackStep = engine.stepCount;
    const steppedBack = engine.stepBackward();
    assert.equal(steppedBack, true);
    assert.equal(engine.stepCount, preBackStep - 1);
  });

  it('should support recordHistory: false for high-performance headless execution', () => {
    const code = '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.';
    const engine = new BrainfuckEngine(code, { recordHistory: false });
    assert.equal(engine.recordHistoryEnabled, false);
    const res = engine.runBatch(50000);
    assert.equal(res.state, ExecutionState.TERMINATED);
    assert.equal(engine.output, 'Hello World!\n');
    assert.equal(engine.canStepBackward(), false);
    assert.equal(engine.stepBackward(), false);
  });
});

