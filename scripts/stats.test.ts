// Run: npm test
import assert from 'node:assert/strict';
import { hemicycle } from '../src/hemicycle.ts';
import { blocPosition, nameKey } from './stats.ts';

assert.equal(blocPosition(['A', 'A', 'N', 'X']), 'A');
assert.equal(blocPosition(['N', 'N', 'B', 'A']), 'N');
assert.equal(blocPosition(['A', 'N']), null, 'tie');
assert.equal(blocPosition(['A', 'X', 'X']), null, 'single vote cast');
assert.equal(blocPosition(['X', 'P', '.']), null, 'nobody cast');

assert.equal(nameKey('Ali, Ernesto "Pipi"'), nameKey('Alí, Ernesto Félix'));
assert.equal(nameKey('Rodriguez Machado, Laura'), 'rodriguezmachado|laura');
assert.notEqual(nameKey('Perez, Juan'), nameKey('Perez, Maria'));

const seats = hemicycle(257, 11);
assert.equal(seats.length, 257);
assert.equal(seats[0].angle, Math.PI, 'starts on the left');
assert.ok(seats.every((s, i) => i === 0 || s.angle <= seats[i - 1].angle), 'ordered left to right');
assert.ok(seats.every((s) => s.y >= -1e-9 && Math.hypot(s.x, s.y) <= 1 + 1e-9), 'inside the half disc');

console.log('stats ok');
