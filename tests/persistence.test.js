import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProgress, saveProgress, loadProgress } from '../src/persistence.js';

// localStorage nie istnieje w Node -> mockujemy, żeby faktycznie testować ścieżkę save/load.
function withMockStorage(fn) {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  try { return fn(); } finally { delete globalThis.localStorage; }
}

// REGRESJA: bug gdzie loadProgress gubił pole (np. tutBronzeDone) -> flaga wracała do default po reloadzie.
// Ten test sprawdza, że KAŻDE pole progresu przetrwa round-trip save->load.
test('persistence: save->load round-trips wszystkie pola progresu (nie gubi flag)', () => {
  withMockStorage(() => {
    const p = defaultProgress(30);
    p.stages[0].stars = 3; p.stages[0].bestScore = 500; p.stages[0].chestClaimed = true;
    p.stages[1].unlocked = true;
    p.hookEquipped = true;
    p.grid = ['bronze', 'anchor', null];
    p.coins = 777;
    p.pendingChests = 2;
    p.gotAnchor = true; p.gotRocket = true; p.gotWeight = true;
    p.tackleboxTier = 2;
    p.inventory = { rocket: 3, weight: 1 };
    p.tutBronzeDone = true; p.tutAnchorDone = true;
    saveProgress(p);

    const loaded = loadProgress(30);
    for (const key of ['hookEquipped', 'coins', 'pendingChests', 'gotAnchor', 'gotRocket',
                       'gotWeight', 'tackleboxTier', 'tutBronzeDone', 'tutAnchorDone']) {
      assert.deepEqual(loaded[key], p[key], `pole "${key}" nie przetrwało round-trip save->load`);
    }
    assert.deepEqual(loaded.grid, p.grid, 'grid nie przetrwał');
    assert.deepEqual(loaded.inventory, p.inventory, 'inventory nie przetrwało');
    assert.equal(loaded.stages[0].stars, 3);
    assert.equal(loaded.stages[0].chestClaimed, true);
    assert.equal(loaded.stages[1].unlocked, true);
  });
});

test('persistence: świeży progres (brak zapisu) = domyślny, stage 0 odblokowany', () => {
  withMockStorage(() => {
    const p = loadProgress(30);
    assert.equal(p.stages[0].unlocked, true);
    assert.equal(p.stages[1].unlocked, false);
    assert.equal(p.tutBronzeDone, false);
    assert.equal(p.tutAnchorDone, false);
    assert.equal(p.gotAnchor, false);
    assert.deepEqual(p.inventory, { bronze: 1 });
  });
});
