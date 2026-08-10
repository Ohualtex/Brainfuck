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
});
