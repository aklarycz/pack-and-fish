import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, computeStars } from '../src/logic/scoring.js';
import { SCORE, STARS } from '../src/config.js';

test('depth contributes points but is capped at depthCeil', () => {
  assert.equal(computeScore(30, 0), 30);              // 30m * wDepth=1
  assert.equal(computeScore(1000, 0), SCORE.depthCeil); // capped
});

test('pure depth never reaches 1 star (anti dodge-stall)', () => {
  assert.ok(SCORE.depthCeil < STARS.t1, 'config invariant: depthCeil < t1');
  assert.equal(computeStars(computeScore(1000, 0)), 0);
});

test('stuns add points and unlock stars', () => {
  // 1000m -> depth capped at 60, + stuns
  assert.equal(computeScore(1000, 5), SCORE.depthCeil + 5); // wStun=1, scoreValue passed as units
});

test('computeStars maps thresholds', () => {
  assert.equal(computeStars(STARS.t1 - 1), 0);
  assert.equal(computeStars(STARS.t1), 1);
  assert.equal(computeStars(STARS.t2), 2);
  assert.equal(computeStars(STARS.t3), 3);
});
