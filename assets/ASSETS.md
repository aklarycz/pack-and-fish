# Assety — konwencja nazewnictwa i gdzie co wrzucać

Brief/prompty: `docs/art/gpt-asset-brief.md`. Po wrzuceniu plików napisz „wepnij assety".

## Zasady ogólne
- **małe litery, kebab-case** (myślniki), bez spacji i polskich znaków. Rozszerzenie `.png`.
- **Nazwa = identyfikator z kodu** (id ryby/akcesorium, numer stage/areny) — dzięki temu
  wiadomo 1:1 co jest czym i da się zmapować automatycznie.
- Numery **zero-padded**: `01`, `02`, … (sort i spójność).
- Sufiksy stanów: `-locked`, `-on`/`-off`, `-mounted`, `-stun`.
- Sprite sheety: sufiks `-sheet` + siatka, np. `-sheet-6x1` (6 klatek w rzędzie).
- Obiekty/ikony: PNG z **alfą**, jeden obiekt, wyśrodkowany, bez tekstu/ramki.
- Tła: pełnoekranowe **1080×1920**, bez alfy. Podwodne: kafelkowalne w pionie.
- Źródła w wysokiej rozdzielczości — downscale w grze.

## Mapa: plik → znaczenie → użycie w kodzie

### `assets/arenas/` — sceny (per arena)
| Plik | Co to | Kod |
|---|---|---|
| `arena-01-surface.png` | tło Home areny 1 (bez postaci) | `bg-surface` per arena |
| `arena-01-underwater.png` | tło pod wodą areny 1 (tile pionowy) | descent bg |
| `arena-02-surface.png` … | kolejne areny | |

### `assets/stages/` — ikony wyboru stage (kafelki na Home)
| Plik | Co to |
|---|---|
| `stage-01.png` | ikona stage 1 (odblokowany) |
| `stage-01-locked.png` | wersja zablokowana (sketch) |
| `pointer.png` | wskaźnik aktualnego stage |

### `assets/cat/` — bohater „Tofu"
| Plik | Co to |
|---|---|
| `cat-cast-sheet-6x1.png` | sprite sheet zarzutu (6 klatek: idle→wind-up→swing→release→follow) |
| `cat-idle.png` | pojedyncza poza spoczynkowa |
| `cat-avatar.png` | popiersie do HUD (~512px) |
| `cat-celebrate.png` | poza radości (end-screen) — opcjonalnie |
| `cat-turnaround.png` | referencja pod 3D — opcjonalnie |

### `assets/fish/` — ryby (id = klucz `FISH_TYPES`)
| Plik | Kod (id) |
|---|---|
| `plotka.png` | `plotka` |
| `sredniak.png` | `sredniak` |
| `twardziel.png` | `twardziel` |
| `<id>-stun.png` | wariant ogłuszony (opcjonalnie) |

### `assets/items/` — akcesoria (id = id w `ITEMS`), KAŻDE w 2 wersjach
| Plik | Co to |
|---|---|
| `anchor.png` | ikona do slotu/ekwipunku (id `anchor`) |
| `anchor-mounted.png` | wersja podpięta na haku (widoczna pod wodą) |
| `<id>.png` / `<id>-mounted.png` | każde kolejne akcesorium tak samo |

### `assets/` (root) — descent / wspólne
| Plik | Co to |
|---|---|
| `hook.png` | hak (side view, oczko na górze) |
| `line.png` | segment żyłki (1×256, tile pionowy) |
| `bubble.png` | bańka (jest — można podmienić) |

### `assets/ui/` — UI kit (Supercell/kawaii)
| Plik | Co to |
|---|---|
| `ui-btn-start.png` | duży przycisk START (amber) |
| `ui-panel.png` | panel/ramka |
| `ui-chip.png` | pigułka zasobu (tło) |
| `ui-icon-coin.png` / `ui-icon-gem.png` / `ui-icon-energy.png` | ikonki zasobów |
| `ui-star-on.png` / `ui-star-off.png` | gwiazdka pełna / pusta |
| `ui-arrow.png` | strzałka karuzeli (odbijana w kodzie L/P) |
| `ui-level-badge.png` | odznaka poziomu |
| `ui-chest.png` | skrzynia |
| `tab-shop.png` `tab-backpack.png` `tab-battle.png` `tab-skull.png` `tab-cash.png` | ikony dolnych zakładek |

## Dodając NOWE akcesorium / rybę / stage
- najpierw ustalmy **id** (trafi do `config.js`), potem pliki: `items/<id>.png` + `items/<id>-mounted.png`.
- ryba: `fish/<id>.png` + wpis w `FISH_TYPES`.
- stage/arena: kolejny numer `NN`.
