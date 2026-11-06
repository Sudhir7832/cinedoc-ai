import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCreditsByStage, creditForScene, creditsForMinutes } from '../src/lib/credits';

test('stage allocations preserve every quoted credit', () => {
  for (const total of [0, 1, 10, 30, 50, 137]) {
    const allocation = allocateCreditsByStage(total);
    assert.equal(allocation.script + allocation.images + allocation.narration + allocation.video, total);
    assert.ok(Object.values(allocation).every(value => Number.isInteger(value) && value >= 0));
  }
});

test('approved rate card uses the 10/40/25/25 split before integer remainder', () => {
  assert.deepEqual(allocateCreditsByStage(100), { script: 10, images: 40, narration: 25, video: 25 });
  assert.equal(creditsForMinutes(3, 2), 60);
});

test('per-scene consumption is lossless and deterministic', () => {
  const charges = Array.from({ length: 10 }, (_, index) => creditForScene(17, index + 1, 10));
  assert.equal(charges.reduce((sum, value) => sum + value, 0), 17);
  assert.deepEqual(charges, Array.from({ length: 10 }, (_, index) => creditForScene(17, index + 1, 10)));
  assert.throws(() => creditForScene(10, 0, 10));
});
