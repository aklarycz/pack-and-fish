// Zapis postępu w localStorage (gwiazdki/best score/odblokowania + hak).
// Guard na środowisko bez localStorage (testy Node) — wtedy działa na domyślnych.
const KEY = 'packfish_progress_v1';

export function defaultProgress(stageCount) {
  const stages = [];
  for (let i = 0; i < stageCount; i++) {
    stages.push({ unlocked: i === 0, bestScore: 0, stars: 0 });
  }
  return { stages, hookEquipped: false };
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
