# Paper Empire — Shape A2 Spec (Memory Variant)

> Rozszerzenie Shape A o warstwę nawigacji i pamięci. Approved 2026-05-14. Bazuje na `docs/shape-a-spec.md` — input i fizyka pojazdu identyczne, dochodzi mapa, peek i level-based progresja z rozgałęzieniami trasy.

## Vision

Krótkie levele (30-60s każdy) kuriera prasy. Na początku levelu gracz widzi schematyczną mapę — gdzie są skrzynki i gdzie jest meta. Mapa znika ze startem. Gracz musi zapamiętać trasę, ustawiać się lateralnie pod skręty na skrzyżowaniach, rozwieźć wszystkie gazety i dojechać do mety. W trakcie levelu dostępny limit peeków mapy. Brak time presure w proto.

Shape A2 nie zastępuje Shape A — Shape A jest podzbiorem Shape A2 (level 1 = prosta droga, czysty Shape A core bez memory).

## Sterowanie (identyczne z Shape A)

- **Hold** palca = gaz
- **Drag** palca lateralnie = pozycja roweru w poprzek drogi (free, ciągła)
- **Release** = brake
- **Paper throw** = automatyczny na proximity skrzynki
- **Tap ikony mapy** (UI top-right) = peek (1.5s ghost overlay mapy, gra NIE pauzuje)

Jeden palec do jazdy + osobny tap na mapę. Ikona mapy obecna od levelu 1 (gracz oswaja się z UI, nawet jeśli peek niepotrzebny).

## Pojazd

Stats jak Shape A: 8 m/s max, 4 m/s² accel, 6 m/s² brake, 3 m/s lateral. Stała max speed.

## Intersection logic

- Każda ulica ma 2-3 wizualne pasy (markerowane na asfalcie)
- Skrzyżowanie ma wymalowane strefy skrętu: strzałki lewo / prosto / prawo
- W momencie wjazdu na środek skrzyżowania, lateralna pozycja roweru decyduje o kierunku:
  - Lewa 1/3 szerokości jezdni → skręt w lewo
  - Środkowa 1/3 → prosto
  - Prawa 1/3 → skręt w prawo
- Brak dostępnej drogi w danym kierunku = jedziesz prosto (fallback). Wtedy musisz objechać blok, żeby wrócić.
- **Zły pas nie powoduje crashu** — tylko stratę czasu i potencjalnie pominięcie skrzynki.

## Mapa i peek

- **Brief na starcie:** 3s (lvl 1-3), 4s (lvl 4+). Pełna mapa widoczna, auto-fade. Pokazuje ulice, skrzynki, metę. NIE pokazuje sugerowanej trasy — gracz planuje sam.
- **Peek w trakcie:** tap ikony → ghost overlay mapy przez 1.5s. Gra biegnie dalej (peek ma realny koszt — chwilę nie patrzysz na drogę).
- **Liczba peeków per level:**
  - Lvl 1: 1 (mapa jest trywialna, peek dla oswojenia UI)
  - Lvl 2-5: 2
  - Lvl 6+: 2-3 w zależności od złożoności mapy

## Progresja leveli

| Level | Layout | Skrzynki | Peeki | Cel learnu |
|---|---|---|---|---|
| 1 | Prosta droga, brak skrętów | 3 | 1 | Gaz, drag, skrzynki, meta, ikona mapy w UI |
| 2 | Prosta + 1 boczne osiedle (1 skręt w bok + powrót) | 4 | 2 | Pierwszy skręt, pierwsze użycie peeka |
| 3-5 | 2-3 boczne osiedla / krótkie odgałęzienia | 4-6 | 2 | Planowanie kolejności, multiple skręty |
| 6-9 | Mała siatka ~3x3 bloki | 5-7 | 2-3 | Pełna memory navigation |
| 10-15 | Większe siatki, one-way streets, więcej hazardów | 6-8 | 2-3 | Endgame proto, test górnego pułapu trudności |

Lvle hand-crafted (nie procgen). 10-15 leveli w proto wystarczy do oceny pacingu i scaling trudności.

## Fail / win conditions

| Sytuacja | Konsekwencja |
|---|---|
| Kolizja z zaparkowanym samochodem | Slow down ~1s, minus 1 coin. **Nie end-run.** |
| Kolizja z pieszym/psem | Slow down ~1s, minus 1 coin. **Nie end-run.** |
| Wjazd na czerwone światło | **End run** (nadjeżdżający samochód) — pozostaje single-fail jako świadomy skill check |
| Brak skrzynki na końcu | Level zaliczony ale niska ocena (patrz star rating) |

**Win:** dojazd do mety. Liczba dostarczonych skrzynek + użyte peeki + crash = star rating.

## Star rating

- ⭐⭐⭐ — wszystkie skrzynki + max 1 peek użyty + brak crashu (czerwone)
- ⭐⭐ — wszystkie skrzynki + 2-3 peeki / lub 1 niegroźna kolizja
- ⭐ — meta osiągnięta, skrzynki niepełne, lub przejazd na żółtym

End run na czerwonym = 0★, retry.

## Layout drogi (single-segment)

```
[ chodnik L ] [ pas 1 ] [ pas 2 ] [ pas 3 ] [ chodnik P ]
[ skrzynki ]  [-------- jezdnia --------]  [ skrzynki ]
```

Jak w Shape A — skrzynki na chodnikach, coins na jezdni, throw zone ~30% szerokości od krawędzi chodnika.

Mapa overlay (brief / peek) używa tego samego top-down viewportu co gameplay — brak dezorientacji wizualnej. Schematyczna (ulice jako linie, skrzynki jako ikony, meta jako flaga).

## Co JEST w Shape A2

- Wszystko z Shape A (input, fizyka, skrzynki, coins, kolizje, sygnalizacja)
- Mapa brief na starcie + peek w trakcie
- Skrzyżowania z lateral-position turn logic
- Level-based progresja (10-15 hand-crafted leveli)
- Soft-fail na kolizjach (slowdown, nie end-run)
- Single-fail na czerwonym (zostaje ze Shape A)

## Co NIE jest w Shape A2

- Time limit per level (rozważyć w B jeśli proto za łatwe)
- Procgen mapy (osobny problem, nie w proto)
- Hugo-style perspective swap (Shape B)
- Vehicle ladder, upgrade'y, shop, daily missions (Shape C)
- Endless mode (Shape A2 jest level-based z definicji)

## Pętla testowa

1. Otwórz `index.html`
2. Wybierz level z listy (lvl 1 unlock by default, kolejne unlock po przejściu poprzedniego)
3. 3-4s brief mapy → run
4. End screen: skrzynki X/Y · coins · peeki użyte · gwiazdki + Next Level / Retry

Brak persystencji poza unlock'iem leveli w sesji (memory only).

## Następny krok

Implementacja level 1 + 2 w `src/game.js` (Canvas 2D) — minimum żeby przetestować czy memory hook + lateral turning ma chemię. Po pierwszych 2 levelach: playtest, ocena czy mapa daje wystarczający nawigacyjny przyciąganie, czy peek balance jest sensowny, decyzja czy budujemy dalej.

## Reference

- `docs/shape-a-spec.md` — Shape A baseline (input, fizyka, core)
- `docs/teardowns/2026-05-14-paper-boy-race.md` — primary genre reference
- `docs/teardowns/2026-05-14-minion-rush.md` — secondary reference (level-based level structure)
