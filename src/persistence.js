// Zapis postępu w localStorage (gwiazdki/best score/odblokowania + hak).
// Guard na środowisko bez localStorage (testy Node) — wtedy działa na domyślnych.
const KEY = 'packfish_progress_v8'; // bump = reset progresu (v8 = reset na żądanie)

export function defaultProgress(stageCount) {
  const stages = [];
  for (let i = 0; i < stageCount; i++) {
    stages.push({ unlocked: i === 0, bestScore: 0, stars: 0, chestClaimed: false });
  }
  return {
    stages,
    hookEquipped: true,
    // zardzewiały hak = bazowe staty (NIE item). Grid trzyma tylko akcesoria: brązowy hak
    // (z tutoriala, w ekwipunku) i kotwica (z 1. skrzyni). Start: pusty grid.
    grid: null,
    coins: 0,            // soft currency (do mergowania akcesoriów)
    pendingChests: 0,    // skrzynki do otwarcia na Home
    gotAnchor: false,    // czy pierwsza (wymuszona) Kotwica już przyznana
    gotRocket: false,    // czy druga (wymuszona) Wyrzutnia rakiet już przyznana
    tackleboxTier: 0,    // poziom tackleboxa (pojemność gridu) — rośnie z lepszym tackleboxem
    inventory: { bronze: 1 }, // start: brązowy hak (z tutoriala) — +3 atk po włożeniu
    tutBronzeDone: false,     // czy tutorial zakładania brązowego haka zaliczony
    tutAnchorDone: false, // czy tutorial łączenia kotwicy zaliczony
  };
}

export function loadProgress(stageCount) {
  const prog = defaultProgress(stageCount);
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.stages)) {
          for (let i = 0; i < stageCount; i++) {
            if (data.stages[i]) Object.assign(prog.stages[i], data.stages[i]);
          }
          prog.hookEquipped = !!data.hookEquipped;
          prog.grid = Array.isArray(data.grid) ? data.grid : null;
          prog.coins = data.coins || 0;
          prog.pendingChests = data.pendingChests || 0;
          prog.gotAnchor = !!data.gotAnchor;
          prog.gotRocket = !!data.gotRocket;
          prog.tackleboxTier = data.tackleboxTier || 0;
          prog.inventory = data.inventory || {};
          prog.tutAnchorDone = !!data.tutAnchorDone;
        }
      }
    }
  } catch (e) { /* uszkodzony zapis -> domyślne */ }
  return prog;
}

export function saveProgress(prog) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(prog));
    }
  } catch (e) { /* brak dostępu -> ignoruj */ }
}
