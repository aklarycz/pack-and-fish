# Pack&Fish

Prototyp HTML5 (plaster 1: fishing descent + mini-plecak). Vanilla JS + canvas, bez build-stepu.

## Uruchomienie

Otwórz `index.html` w przeglądarce — albo VS Code **Live Server** (prawy klik → "Open with Live Server") dla hot reload i ES modules.

## Testy logiki

```
npm test
```

(uruchamia `node --test` na `tests/` — wymaga Node 18+)

## Struktura

- `src/config.js` — wszystkie staty/stałe (data-driven)
- `src/logic/` — czysta logika (testowana jednostkowo)
- `src/state.js` — maszyna stanu gry
- `src/fish.js`, `src/input.js`, `src/render.js`, `src/main.js` — warstwa IO/render/feel
