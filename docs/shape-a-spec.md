# Paper Empire — Shape A Spec

> MVP prototype scope. Approved 2026-05-14. Inspirations: Paper Boy Race + Minion Rush (see `docs/teardowns/`).

## Vision

Krótki (35-45s) runnik kuriera prasy. Gracz prowadzi rower po jezdni miejskiej, zjeżdża na pobocza żeby wyrzucić gazetę do skrzynki, zbiera coins, unika kolizji i przestrzega świateł. Po runie: 1-3 gwiazdki + payout.

Shape A jest celowo cienki — czysty test core inputu i pacingu. Brak meta, brak progresji, brak shopa. To czeka na Shape B/C.

## Sterowanie

- **Hold** palca na ekranie = gaz / forward thrust
- **Drag** palca lateralnie = pozycja roweru w poprzek drogi (free positioning, nie pasy)
- **Release** palca = brake (siła brake'u zależy od statystyki pojazdu)
- **Paper throw** = automatyczny, gdy rower wjedzie w "throw zone" na wysokości skrzynki

Jeden palec, jedno ciągłe interakcja. Brak osobnego inputu na jump/duck/swipe.

## Pojazd (jeden — rower)

| Stat | Wartość | Co kontroluje |
|---|---|---|
| Max speed | 8 m/s | Top speed gdy trzymasz |
| Acceleration | 4 m/s² | Czas dojścia do max (~2s) |
| Brake force | 6 m/s² | Czas zatrzymania z full speed (~1.3s) |
| Lateral speed | 3 m/s | Tempo zmiany pozycji w poprzek drogi |

Stała max speed przez cały run (brak ramp-upu).

## Layout drogi

```
[ chodnik L ] [ pas 1 ] [ pas 2 ] [ pas 3 ] [ chodnik P ]
[ skrzynki ]  [-------- jezdnia --------]  [ skrzynki ]
```

- Rower może jeździć po całej szerokości (chodniki + jezdnia)
- **Skrzynki** są tylko na chodnikach — żeby trafić, trzeba zjechać na pobocze
- **Coins** są tylko na jezdni — magnetyczny collect przy kolizji
- **Throw zone** = strefa lateralna ~30% szerokości od krawędzi chodnika. Wjazd w tę strefę na wysokości skrzynki = auto-throw

## Co JEST w Shape A

| Element | Konkret |
|---|---|
| Sterowanie | hold gaz, drag lateral, release brake |
| Rower | stats 8/4/6/3 |
| Skrzynki | ~8-12 per run, 1 punkt + payout coin każda |
| Coins | luźne na jezdni, ~20-30 per run |
| Przeszkoda: zaparkowane samochody | statyczne, kolizja = fail |
| Przeszkoda: pieszy/pies | wchodzi z chodnika na jezdnię w deterministycznym momencie, kolizja = fail |
| Skrzyżowanie | 1-2 per run, sygnalizacja widoczna z ~3s dystansu (green → yellow → red cykl). Wjazd na czerwone = fail (nadjeżdżający samochód) |
| End screen | Skrzynki X/Y · Coins · Gwiazdki 1-3 + Play Again |
| Star rating | 3★: 80%+ skrzynek + brak crashu. 2★: 50-79% lub przejazd na żółtym. 1★: <50% lub crash |
| Trasa | **deterministyczna** — identyczny układ co run dla testu balance |
| Visual | **top-down 2D** w stylu GTA 2 (Canvas/CSS) |

## Co NIE jest w Shape A (zaplanowane na B/C)

- Hugo-style intersection mini-game (warp-triggered, perspektywa)
- Vehicle ladder / upgrade'y
- Daily missions
- Fortune wheel
- Customer requests / specjalne skrzynki bonus
- Wiele tras / dzielnic
- Currency shop / cosmetics
- Run timer / leaderboard
- Pełne audio
- Pociągi / przejazdy kolejowe
- Speed ramp-up w trakcie runu

## Pętla testowa

1. Otwórz `index.html` (lub VS Code Live Server)
2. Tap **Start**
3. Run 35-45s
4. End screen → **Play Again**

Brak persystencji między runami. Czysty playtest.

## Następny krok

Implementacja Shape A w `src/game.js` (Canvas 2D). Po pierwszej grywalnej wersji: playtest 10-20 runów, oceny pacingu i feel'u sterowania, decyzja czy idziemy do Shape B czy poprawiamy A.

## Reference

- `docs/teardowns/2026-05-14-paper-boy-race.md` — primary genre reference (3-lane runner + paper throw)
- `docs/teardowns/2026-05-14-minion-rush.md` — secondary reference (warp mini-games, mission layer — relevant for B/C)
