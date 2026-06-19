# Balans Areny 1 — "Przybrzeże" (10 stage'y)

Projekt liczb do wdrożenia w `src/config.js`. Cel: rosnąca trudność, gwiazdki
zdobywane stopniowo, brak skoku "2 ostatnie ryby = 2 gwiazdki", wczesne stage
grywalne sprzętem jaki gracz ma w danym momencie.

## 1. Mechanika — potwierdzona analiza łowialności

Stat kanoniczny wg briefu (atk = 1 baza + brąz 3 + kotwica 1; hp×(1+0.006·m)).

Epoki sprzętu w Arenie 1:
- **Stage 1**: brązowy hak → atk **4**, maxLatch 1, brak rakietnicy.
- **Stage 2**: + kotwica (ze skrzyni po s1) → atk **5**, maxLatch 2.
- **Stage 3+**: + rakietnica (ze skrzyni po s2) → atk 5 + 4 dmg/2 s autonomicznie.

Warunek złowienia samym hakiem: `atk · window ≥ hp_efektywne`.

| Ryba | hp baza | window | atk4·win | atk5·win | hp na ~dnie (dc30→66) | Werdykt |
|------|--------:|-------:|---------:|---------:|----------------------:|---------|
| plotka | 6 | 2.6 | 10.4 | 13.0 | 7–8 | **Łowialna zawsze**, każdą epoką |
| sredniak | 20 | 3.6 | 14.4 | 18.0 | 24–28 | **Niełowialna hakiem** w żadnej epoce (18 < 24) |
| twardziel (muskie) | 40 | 2.4 | 9.6 | 12.0 | 47–56 | **Nigdy hakiem**; rakieta ~12–14 trafień = brama na 3★ |

Wniosek bazowy: przy obecnych statach sredniak jest **martwą rybą** dopóki gracz
nie podbije atk — także po dodaniu rakietnicy (hak18 + rakieta ~4–8 = 22–26, a
hp na dnie 24–28: na styk/poniżej). To psuje fun, bo na stage 1 jedyną łowialną
rybą jest plotka.

## 2. REKOMENDACJA: tweak sredniaka — window 3.6 → 4.2 (hp zostaje 20)

Powody:
- **Zachowuje tożsamość ryby** (hp 20, scoreValue 3) — nie zmienia ekonomii monet
  ani score, tylko czyni ją realnie łowialną z odrobiną pomocy.
- **Stage 1 dalej uczciwy**: atk5·4.2 = 21 < hp 24 na dnie → sredniak na s1-s2
  (bez rakietnicy) pozostaje wyzwaniem/stratą okna, więc 3★ na wczesnych stage'ach
  wymaga ulepszeń (zgodne z marchewką). Ale gdy gracz "zapędzi" sredniaka płycej
  (hp ~21 na 8–12 m) potrafi go ubić → daje poczucie sprawczości zamiast
  twardego "nie da się".
- **Od stage 3 (rakietnica)**: hak21 + rakieta 2 trafienia·4 = 29 ≥ 28 (najgłębszy
  sredniak s10) → sredniak staje się **stabilnie łowialny**. To zamienia 2★ z
  "plotka grind" w realny cel "łap też sumy", co napędza krzywą trudności.

Alternatywa odrzucona: hp 20→18. Daje atk5·3.6 = 18 ≥ 21? Nie (hp18 na dnie = 21–25,
18 < 21). Słabsze niż window-tweak i psuje progi monet/score. **Wybierz window 4.2.**

Jeśli wolisz NIE ruszać statów ryby: zostaw sredniaka niełowialnego hakiem i traktuj
go jak "mini-muskie" zależnego od rakietnicy. Wtedy na s1-s2 jest czystą stratą żyć
i całe 2★ na s1-s2 musi stać na plotce + głębi (co i tak działa — patrz progi).
Rekomenduję jednak window 4.2, bo bez tego sredniak na stage 1 jest frustrujący.

## 3. Skład worka per stage

Liczba ryb = 20 + 5·(i−1). Muskie ramp łagodny **⌈i/2⌉** = 1,1,2,2,3,3,4,4,5,5
(rośnie, ale nie eksploduje — muskie to hazard/strata żyć, nie masa punktów).
Reszta dzielona plotka/sredniak; udział sredniaka rośnie 20% → 55% liniowo z i.

| Stage | plotka | sredniak | muskie | TOTAL | depthCap | spawn interwał |
|------:|-------:|---------:|-------:|------:|---------:|---------------:|
| 1  | 15 | 4  | 1 | 20 | 30 | 2.30 |
| 2  | 18 | 6  | 1 | 25 | 34 | 2.20 |
| 3  | 20 | 8  | 2 | 30 | 38 | 2.10 |
| 4  | 23 | 10 | 2 | 35 | 42 | 2.00 |
| 5  | 24 | 13 | 3 | 40 | 46 | 1.90 |
| 6  | 25 | 17 | 3 | 45 | 50 | 1.80 |
| 7  | 26 | 20 | 4 | 50 | 54 | 1.75 |
| 8  | 27 | 24 | 4 | 55 | 58 | 1.70 |
| 9  | 27 | 28 | 5 | 60 | 62 | 1.65 |
| 10 | 27 | 33 | 5 | 65 | 66 | 1.60 |

Interwał spawnu: lekko maleje (gęściej = więcej presji), z 2.3 do 1.6. `min` = `start`
(stały per stage, jak teraz). Opcjonalnie zostaw 2.3 stałe jeśli nie chcesz ruszać
tempa — wtedy trudność niesie sam skład worka i progi.

## 4. Progi gwiazdek — METODA (wzór generyczny)

Problem starego systemu: progi liczone jako % **teoretycznego maxa** (z muskie 60 pkt
i sredniakiem 30 pkt na końcu worka). Bo `SPAWN_WIN` wrzuca muskie na 0.92–1.0, dwie
ostatnie ryby przeskakiwały dwa progi. Naprawa: progi liczone od **realnie osiągalnego
score per epoka sprzętu**, z muskie zasilającym wyłącznie T3.

Dla każdego stage'a policz składowe punktów (wStun = 10, wDepth = 1):
```
P = plotka·1·10          // pkt z plotek (zawsze łowialne)
S = sredniak·3·10        // pkt z sredniaków (łowialne od epoki rakietnicy)
M = muskie·6·10          // pkt z muskie (tylko z ulepszeniami)
D = depthCap             // wkład głębi (gracz dochodzi do dna)
hasRocket = (globalLocalStage >= 3)   // w Arenie 1: rakietnica od stage 3
```

Progi (wartości absolutne w pkt):
```
T1 = round( D + 0.55·P )                          // 1★: złów większość plotek + głębia
T2 = round( D + 0.90·P + (hasRocket ? 0.70·S : 0) ) // 2★: prawie wszystkie plotki (+sumy gdy masz rakietę)
T3 = round( D + 1.00·P + 1.00·S + 0.50·M )         // 3★: pełne plotki+sumy + połowa muskie -> wymaga ulepszeń
```

Własności:
- **T1 zawsze osiągalny** każdą epoką (nawet stage-1 sprzętem: plotka+głębia > T1).
- **T2**: na s1-s2 osiągalny samą plotką (bo brak rakietnicy → człon S wyzerowany,
  a 0.90·P + D < plotReach). Od s3 wymaga łowienia sumów (rakietnica) — realny cel.
- **T3**: zawsze ponad sumę "wszystko łowialne bez muskie" → wymaga ubicia części
  muskie = ulepszenia. Nigdy trywialny, nigdy zależny od 2 ostatnich ryb.

## 5. Progi gwiazdek — TABELA (gotowe liczby)

| Stage | T1 (1★) | T2 (2★) | T3 (3★) | osiągalność |
|------:|--------:|--------:|--------:|-------------|
| 1  | 113 | 165 | 330  | T1/T2 plotką (s1 gear). T3 wymaga muskie/upgrade |
| 2  | 133 | 196 | 424  | T1/T2 plotką. T3 wymaga muskie/upgrade |
| 3  | 148 | 386 | 538  | T1 plotką; T2 wymaga sumów (rakietnica); T3 + muskie |
| 4  | 169 | 459 | 632  | jw. |
| 5  | 178 | 535 | 766  | jw. |
| 6  | 188 | 632 | 900  | jw. |
| 7  | 197 | 708 | 1034 | jw. |
| 8  | 207 | 805 | 1168 | jw. |
| 9  | 211 | 893 | 1322 | jw. |
| 10 | 215 | 1002| 1476 | jw. |

(Liczone wzorem z sekcji 4. Wartości stabilne — przy zmianie składu worka przeliczą
się automatycznie, więc preferuj implementację wzoru w `buildArenaStages`, nie hardkod.)

## 6. Osiągalność per epoka — weryfikacja

| Stage | plotka-only reach | T1 | T2 | rocket reach (P+S+D) | T3 |
|------:|------------------:|---:|---:|---------------------:|---:|
| 1  | 180 | 113 OK | 165 OK | 300 | 330 brak (muskie) |
| 2  | 214 | 133 OK | 196 OK | 394 | 424 brak |
| 3  | 238 | 148 OK | 386 — (trzeba sumów) | 478 | 538 brak |
| 5  | 286 | 178 OK | 535 — | 676 | 766 brak |
| 10 | 336 | 215 OK | 1002 — | 1326 | 1476 brak |

Czytanie: na s3+ samo plotka-grindowanie daje tylko 1★ — 2★ wymusza sumy (rakietnica),
3★ wymusza muskie (ulepszenia). Dokładnie jak chciał użytkownik.

## 7. Krzywa trudności — uzasadnienie

Stage 1-2 to strefa komfortu: plotka łowialna startowym hakiem daje pewne 2★, sredniak
i jedna muskie są tłem (utrata okna/życia, nie ściana), 3★ kusi ale wymaga sprzętu ze
skrzyni. Po dołożeniu rakietnicy (stage 3) skład worka przechyla się ku sredniakom, a
próg 2★ zaczyna wymagać ich łowienia — gracz odczuwa, że nowy sprzęt "otworzył" stage'e,
co nagradza progres. Muskie rosną łagodnie (1→5) i pełnią rolę bramy 3★ przez całą arenę:
zawsze widoczna marchewka na atk-upgrade, nigdy źródło przypadkowych gwiazdek. Tempo
spawnu lekko przyspiesza (2.3→1.6 s), więc późne stage'e dociskają zarządzaniem oknami i
życiami, a nie tylko liczbą hp. Efekt: ząbkowana, czytelna progresja — łatwe 1★ wszędzie,
2★ jako "graj dobrze obecnym sprzętem", 3★ jako "wróć po ulepszeniach".

## 8. Uwagi wdrożeniowe (do config.js)

- `FISH_TYPES.sredniak.window`: 3.6 → **4.2** (rekomendacja sekcja 2).
- W `buildArenaStages` zastąp obecny `STAR_FRAC`-od-maxScore wzorem z sekcji 4
  (oddzielne P/S/M, flaga `hasRocket = i >= 2` dla local index 0-based → stage 3).
- Muskie ramp: `muskie = Math.ceil((i+1)/2)` dla local 0-based, lub ⌈stageNo/2⌉.
- Skład plotka/sredniak: udział sredniaka `sf = 0.20 + 0.35·(i/9)` (i = stageNo-1),
  `sred = round(rem·sf)`, `plot = rem − sred`, `rem = total − muskie`.
- `depthCap = 30 + 4·(stageNo−1)`.
- Uwaga: w obecnym kodzie `BRONZE_HOOK.atk = 3` (komentarz mówi +7 — rozjazd). Brief
  zakłada atk4 na stage 1; potwierdź że brąz daje +3 (rusty1+brąz3 = 4) przed strojeniem.
