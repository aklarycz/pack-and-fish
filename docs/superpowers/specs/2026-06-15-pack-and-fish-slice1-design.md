# Pack&Fish — Design plastra 1: Fishing Descent + mini-plecak (tutorial)

Data: 2026-06-15
Status: zatwierdzony (do review) — wersja 2 po przeglądzie prototypowo-designerskim

## Kontekst

Porzucamy prototyp PaperEmpire i przerabiamy jego worktree pod nową grę roboczo
nazwaną **Pack&Fish**. To **hybrid-casual**: core sekunda-do-sekundy w duchu
hyper-casual (jedna kontrola, instant retry), meta w stronę roguelite-lite
(plecak-arranger + progresja gwiazdkowa). Gra łączy dwa podsystemy:

1. **Fishing descent** — gameplay sekunda-do-sekundy: hak wolno opada coraz
   głębiej (top-down, kamera scrolluje w dół), gracz dryfuje nim lewo/prawo,
   ogłusza napotkane ryby, a ogłuszone ryby wypływają w bańkach na powierzchnię
   i liczą się do wyniku.
2. **Backpack arrange** — meta: akcesoria wypadające z ryb układasz w gridzie
   plecaka rybaka, żeby ich buffy (i synergie z ułożenia) wzmacniały hak.

Klimat humorystyczny, nie realistyczny — docelowo hak strzela laserami itp.,
gra ma być eye-candy.

**Świadoma decyzja gatunkowa:** mechanika "zarządzaj plecakiem + odpieraj fale"
jest już dowiedziona na mobile (warianty tower-defense / wave-defense). Nasz
twist i hipoteza różnicująca to **top-down opadanie i nacieranie na ryby**
zamiast statycznej obrony fal. Ryzyko, że grid-arranger jako taki to głównie
wzorzec Steam/premium, przyjmujemy świadomie.

Ten dokument opisuje **plaster 1**: cały fishing descent + **minimalny plecak
jako onboarding** (jeden startowy item-hak, który gracz wkłada do gridu przed
pierwszym zarzutem). Pełny arrange (wiele itemów, dropy, synergie), progresja
poziomów, areny i karty ulepszeń — to plaster 2+.

## Tech / baza

- Zostawiamy szkielet PaperEmpire: vanilla JS + HTML5 canvas, portret 540×720,
  jeden plik `src/game.js`, `index.html`, `src/style.css`, `assets/`.
- Logikę PaperEmpire (jazda/droga) wywalamy. `game.js` przepisujemy od zera.
- Bez frameworków i bez build-stepu — odpalane przez otwarcie `index.html`
  (lub Live Server), jak dotychczas.

## Onboarding — pierwszy zarzut (mini-plecak)

Wejście do gry uczy metafory plecaka od pierwszej sekundy:

1. Gracz widzi plecak rybaka. Tap → wypada **obskórny startowy hak** (= pierwszy
   item).
2. Gracz **wkłada hak w grid plecaka** (drag-drop w komórkę). To gest, którego
   nauczy się raz i będzie używał w pełnym arrange w plastrze 2.
3. Po umieszczeniu haka odblokowuje się zarzut → start descentu.

W plastrze 1 grid jest mały, item jest jeden, brak synergii i brak adjacency —
placement jest praktycznie tutorialowy (uczy gestu, nie jest jeszcze decyzją).
**Hak jest itemem** — jego staty pochodzą z definicji itemu (patrz niżej), nie
są zaszyte osobno. Dzięki temu plaster 2 dokłada kolejne itemy do tego samego
systemu, bez przepisywania logiki.

## Pętla sekunda-do-sekundy

- Hak opada sam ze stałą, wolną prędkością. Kamera scrolluje w dół za hakiem —
  schodzisz coraz głębiej, woda jest nieskończona (brak dna).
- Jedyna kontrola gracza w trakcie descentu: **dryf lewo/prawo** (drag myszą /
  touch). Pozycja boczna haka to wszystko, czym steruje gracz.
- Ryby zaludniają toń. Część patroluje; ryba, której hak wejdzie w aggro-range,
  dopływa do haka próbując go zaatakować.
- **Pierwszy kontakt = zaczepienie.** Zaczepiona ryba zaczyna obrywać `atk`
  dmg/s od haka. Każda ryba ma HP oraz **okno czasowe** na ogłuszenie.
  - HP spada do 0 w oknie → ryba **ogłuszona** → wypływa w bańce do powierzchni
    → +punkt; zaczep zwalnia się.
  - Okno minęło zanim HP zeszło do 0 → ryba **ucieka (zrywa się) = −1 życie**;
    zaczep zwalnia się.
- Bazowy hak zaczepia **1 rybę naraz** (multi-latch to akcesorium z plastra 2).
  Zaczepienie = commitment — skill polega na tym, **co dotknąć, a co ominąć**.
- **Jedyny warunek końca descentu: 3 zerwane ryby** (3 życia). Brak presji
  czasu, brak timera.

### Czytelność okna czasowego (krytyczne do testu)

Decyzja "dotknąć vs ominąć" pada, jeśli gracz nie czuje w sekundach "zdążę /
nie zdążę". Dlatego zaczepiona ryba musi mieć **czytelny wskaźnik**: pasek HP +
kurczące się okno czasowe (np. malejący pierścień / pasek na rybie). To jest
najważniejsza rzecz do walidacji w plastrze 1.

## Naturalny koniec i rampa trudności

- Wraz z głębokością ryby rosną: większe HP, gęściej, szybciej, agresywniej.
- W pewnym momencie nawet "bezpieczne" ryby przerastają startowy hak — gracz
  zaczyna tracić życia na zrywach i descent się kończy. End-screen w duchu
  "hak za słaby — wzmocnij się" (wzmocnienie = plaster 2).
- **Brak nieskończonego dodge-stalla** — domknięte dwiema dźwigniami:
  1. głębiej ryby są gęstsze i szybsze, więc nie da się wiecznie unikać
     kontaktu;
  2. punkty za samą głębokość mają **sufit poniżej progu 1★** (patrz Score).
- **Startowy hak jest celowo za słaby** — strojony tak, by ściana mocy
  przychodziła wcześnie i tworzyła pull do plecaka. NIE stroimy go pod "fun
  solo", bo plecak później złamałby taki balans.

## Ryby — 3 archetypy (plaster 1)

Trzy typy wystarczą, żeby istniała realna decyzja "zaczepić czy ominąć":

- **Płotka** — niskie HP, krótkie okno wystarcza; startowy hak ogłusza spokojnie.
  Bezpieczny target.
- **Średniak** — HP na styk z oknem czasowym; ryzykowny — czasem zdążysz, czasem
  nie.
- **Twardziel** — HP przekracza to, co startowy hak zbije w oknie; zaczepienie =
  niemal pewne zerwanie. Pojawia się głębiej, gracz uczy się go **omijać**.

Częstotliwość i miks archetypów zależą od głębokości (rampa).

Te 3 archetypy to **jedna oś** (HP vs okno) — wystarcza na test core w plastrze
1. **Druga oś decyzyjna** (wzorce ruchu: ryba unikowa / szybka / zasłona) to
fast-follow, gdy core się potwierdzi — patrz plaster 2.

## Staty haka / itemu (data-driven)

Startowy hak to **item** z definicją statów, trzymaną w configu na górze pliku,
żeby plaster 2 (plecak) tylko dokładał kolejne itemy modyfikujące te wartości:

- `atk` — dmg/s zadawany zaczepionej rybie
- `zwrotnosc` — prędkość dryfu lewo/prawo (px/s)
- `szybkoscOpadania` — tempo schodzenia w głąb (px/s)

Pola zarezerwowane (niewykorzystane w plastrze 1, wpięcie w plastrze 2):
zasięg aury, liczba jednoczesnych zaczepień (multi-latch), źródła DoT / lasery
rażące ryby niezaczepione.

## Score i gwiazdki

- `score = depth * W_DEPTH + stunned * W_STUN` (wagi w configu).
- **Sufit punktów za głębokość:** wkład `depth * W_DEPTH` jest tak dobrany (lub
  twardo capowany), że **sama głębokość, osiągalna startowym hakiem, nie wystarcza
  nawet na 1★**. Gwiazdki wymagają ogłuszania ryb. To zamyka dodge-stall: czysty
  zjazd bez łapania = 0 gwiazdek mimo punktów za głębokość.
- Na end-screenie liczymy **0–3 gwiazdki** wg progów `T1 < T2 < T3` w score.
- W plastrze 1: brak ekranu wyboru poziomu i brak zapisu odblokowań — po
  end-screenie tylko **restart**. Pełna progresja dochodzi w plastrze 2.

## Eye-candy / humor (lekko, w ramach plastra)

- Bańki unoszące ogłuszone ryby do powierzchni.
- Śmieszne miny ryb po ogłuszeniu (np. zezowanie / krzyżyki w oczach).
- Warstwa renderu efektów haka zostawia hook na przyszłe lasery/aury
  (placeholder, nie strzela jeszcze w plastrze 1).

Pełny eye-candy dokładamy, gdy core okaże się grywalny.

## Czego plaster 1 NIE waliduje

Spisane wprost, żeby nie ekstrapolować z prototypu złych wniosków:

- **Retencji / monetyzacji / progresji** — bez pełnego plecaka i bez meta nie ma
  z czego ich czytać. Jeśli zmierzymy D1/D7, są bez znaczenia dla docelowej gry.
- **Głębi buildów** — startowy hak jest stały; cała progresja siły jest w
  plecaku, którego (poza tutorialem 1-itemowym) jeszcze nie ma.
- **Skill-ceilingu docelowego** — commitment do 1 ryby jest dziś ostrzejszy;
  multi-latch w plastrze 2 to rozmiękczy.

Plaster 1 mierzy **wyłącznie**: czy feel + czytelność okna + decyzja
"dotknąć/ominąć" są satysfakcjonujące, czy fail state jest fair, i czy gracz sam
uczy się omijać twardziela.

## Architektura `game.js`

Jeden plik, czytelny podział na sekcje, data-driven:

1. **Config** — stałe świata, `ITEMS` (startowy hak jako item ze statami),
   `FISH_TYPES` (archetypy: HP, okno, prędkość, aggro-range, render), rampa wg
   głębokości, wagi score + sufit depth, progi gwiazdek.
2. **State** — stan gry (tryb: tutorial-plecak / descent / end-screen;
   głębokość, życia, score, lista ryb, aktualny zaczep, zawartość plecaka).
3. **Backpack** — grid + drag-drop itemu; w plastrze 1 obsługuje 1 item.
   Zarezerwowane (p2): wiele itemów, kształty, **adjacency / relacje między
   itemami**, rozdział **power vs skin** w slotach.
4. **Input** — drag-drop w plecaku; drag L/P w descentcie (mysz + touch).
5. **Spawn** — generowanie ryb wg głębokości (gęstość + miks archetypów).
6. **Fish AI / update** — patrol, aggro, dopływanie do haka.
7. **Hook + latch + damage** — wykrycie kontaktu, zaczepienie, dmg/s, okno
   czasowe, rozstrzygnięcie ogłuszona/uciekła.
8. **Scoring / stars** — naliczanie score (z sufitem depth), mapowanie na
   gwiazdki.
9. **Render** — warstwy: tło/głębia, ryby, hak + efekty, bańki, HUD (życia,
   score, głębokość, wskaźnik HP+okno na zaczepionej rybie), plecak, end-screen.
10. **Main loop** — requestAnimationFrame, delta time.

## Spójność z plastrem 2+ (zapis decyzji, NIE budujemy teraz)

Żeby plaster 1 nie zastygł w kształcie, który blokuje metę:

- **Plecak / arrange:** architektura rezerwuje **adjacency i relacje między
  itemami** (item wzmacnia sąsiada, kształty blokują sloty) oraz rozdział
  **power vs skin** — inaczej plaster 2 przepisuje logikę. Przed wejściem w pełny
  grid zdefiniować 2–3 docelowe **archetypy buildów** (np. "snajper": 1 latch,
  wysokie atk, omijasz tłum / "kosiarz": multi-latch + aura-DoT, latchujesz
  wszystko / "nurek": max opadanie+zwrotność, score z głębi) i sprawdzić, czy
  grid potrafi je wyrazić — inaczej plecak będzie płaskim stat-stickiem.
- **Głębia skaluje się szybciej niż build** — żeby "strefa decyzji"
  (dotknąć/ominąć) przesuwała się z buildem, a nie znikała, gdy wejdą multi-latch
  + aura. Inaczej meta spłaszcza core.
- **Poziomy = segmenty głębokości** (zones/biomes na osi głębi). Poziom ma
  start-depth (gating siły haka) i różni się **miksem ryb + rampą**, nie nowymi
  parametrami. Progi gwiazdek **lokalne per poziom**. **No-grind guarantee:**
  każdy poziom przechodalny na 1★ hakiem osiągalnym z poprzedniego; 2–3★ mogą
  wymagać lepszego haka (zdrowa pętla powrotu, nie ściana).
- **Gwiazdki = waluta progresji:** kamienie milowe odblokowywane na **sumę
  gwiazdek**; **XP za każdą gwiazdkę zdobytą pierwszy raz**. 3★ musi coś dawać
  (XP / lepszy drop / slot), inaczej to ozdoba.
- **Areny:** docelowo ~10 stage'y per arena; zmiana areny = inne miejsce, inne
  ryby, ewentualne upgrejdy — żeby się nie nudziło.
- **Karty ulepszeń:** zbieralne; upgradowalne — ulepszona karta daje silniejszy
  wariant danego wzmocnienia.
- **Deterministyczny sink + retencja dzienna** (waluta/reroll/upgrade kart,
  daily, sezonowość, leaderboard po głębokości) — do osobnej sesji z
  `gs-prototype-economy` / `gs-prototype-systems`. Monetyzacja: power dostępny
  F2P, sprzedaż waluty/slotów/kosmetyki (lasery/aury jako skiny) — bez P2W.
- **Strategiczny re-check:** teardown realnych mobile arrangerów (w tym
  wave-defense) przez `gs-prototype-analyst` przed pełnym plastrem 2, żeby
  potwierdzić, że top-down-descentowy twist niesie różnicowanie.

## Otwarte / do dostrojenia w trakcie

Konkretne wartości — prędkość opadania, zwrotność, atk, HP archetypów, długości
okien, wagi i sufit score, progi gwiazdek, parametry rampy — strojone iteracyjnie
po pierwszym uruchomieniu (prototyp).
