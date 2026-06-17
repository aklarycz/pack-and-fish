# Pack&Fish — Brief produkcji assetów przez GPT

Cel: spójny zestaw grafik do całej gry, generowany w ChatGPT (GPT‑4o image gen).
Styl: **Supercell-grade mobile** (ciepło Hay Day + czytelność/boldness Brawl Stars).
Bohater: **kot-wędkarz** (kotek łowiący rybki). Pętla: na Home kot siedzi nad łowiskiem,
przy starcie stage zarzuca wędką → kamera schodzi pod wodę (descent).

> WAŻNE: GPT generuje **2D**. „Kot 3D z animacjami” → albo 2D sprite-sheety klatek
> (gotowe do canvasa), albo 2D turnaround/expression sheet jako **referencja** dla
> artysty 3D / image‑to‑3D (Meshy, Rodin, Tripo). Pod prototyp: idź w 2D sprite.

---

## 0. Jak używać tego briefu
1. Najpierw wygeneruj **STYLE SHEET** (sekcja 2) i zatwierdź — to „biblia”.
2. Do KAŻDEGO promptu doklejaj **STYLE BLOCK** (sekcja 2.1) — to gwarantuje spójność.
3. Do wszystkich assetów kota doklejaj **CHARACTER BLOCK** (sekcja 3.1).
4. Proś o **przezroczyste tło (PNG, alpha)** dla obiektów; tła pełnoekranowe bez alphy.
5. Generuj 3 warianty → wybierz → poproś o „matching set” w tym samym stylu.
6. Trzymaj źródła w wysokiej rozdzielczości, downscale w grze.

---

## 1. Rola GPT (wklej jako pierwszą wiadomość / custom instructions)

```
You are the Art Director and 2D asset generator for "Pack&Fish", a cozy, humorous
mobile fishing game in a premium Supercell-grade style (warm like Hay Day, bold and
readable like Brawl Stars). Your #1 job is VISUAL CONSISTENCY across every asset.

How you work:
1. You maintain a STYLE BIBLE (palette, outline, shading, lighting, proportions,
   perspective, resolution). You restate the relevant style constraints in every image
   you generate so the set stays cohesive.
2. You keep a fixed CHARACTER SHEET for the hero (a cat angler) and reproduce the SAME
   cat (colors, outfit, rod, proportions) in every pose/scene.
3. Default output: transparent-background PNG, single centered subject, no text, no UI
   frames, soft long shadow optional and separate. Backgrounds: full-bleed, no alpha.
4. You generate at high resolution for downscaling (heroes ~2048px, items ~1024px,
   full-screen backgrounds 1080×1920 portrait).
5. One light source, top-left, warm key + cool shadow. Soft cel-shading + subtle gradient,
   thick soft dark-teal outlines (not pure black), rounded chunky shapes.
6. Before a batch, you confirm the style with one reference sheet. After approval you
   produce matching assets on request, always referencing the locked style.
7. You are honest: image generation is 2D. For "3D" you deliver clean turnarounds and
   orthographic views suitable for a 3D artist or image-to-3D tools, and/or 2D sprite
   frames for direct in-engine animation.

When asked for an asset, you: (a) restate style+character block, (b) describe the subject,
(c) specify view/format/resolution/background, (d) generate, (e) offer 2-3 variants.
```

## 2. STYLE BIBLE (wygeneruj i zatwierdź najpierw)

Prompt do wygenerowania arkusza referencyjnego:

```
Create a single STYLE REFERENCE SHEET for a cozy premium mobile fishing game in a
Supercell-grade style. On one image show: a colour palette swatch row, an example
chunky rounded UI button, a small prop (wooden tackle box), and the hero cat angler bust.
Style: thick soft dark-teal outlines (not black), soft cel-shading with a subtle gradient,
one top-left warm light source, saturated but harmonious colours, rounded chunky shapes,
high readability, premium polish, no realistic textures. Flat neutral background.
Palette anchors: CTA amber #FFB627→#FF8A00, gold #FFCB45, water teal #0E3B5C→#041422,
UI glass #0E2233, gem blue #52D0FF, success green #7CFF8A, surface sky #BFE0FF.
```

### 2.0 Decyzje stylu (LOCKED)
- **Finish:** 2D, słodkie **kawaii** (urocze kotki), spójne z UI gry.
- **Outline:** grube, ciemne (dark-teal), stała grubość — czytelność jak w UI.
- **Detal:** średni (czysto i czytelnie, kilka uroczych akcentów, bez tłoku).
- **Nastrój/paleta:** ciepło, przytulnie (areny różnią się paletą, baza ciepła).

### 2.1 STYLE BLOCK (doklejaj do każdego promptu)
```
STYLE (LOCKED): cute kawaii 2D mobile game art, cozy and warm, premium polish.
Thick consistent dark-teal outlines (not pure black), soft cel-shading with subtle
gradients, single top-left warm light, gentle cool shadows. Rounded chunky shapes,
MEDIUM detail (clean, readable, a few cute accents - not busy), warm cozy mood, high
readability at small sizes. No photoreal textures, no harsh contrast, no thin scratchy lines.
Palette: amber CTA #FFB627->#FF8A00, gold #FFCB45, water #0E3B5C->#041422, UI #0E2233,
gem #52D0FF, green #7CFF8A, warm sky #BFE0FF.
```

### 2.2 KEY ART — zrób NAJPIERW i zatwierdź (wizualna kotwica)
```
[STYLE BLOCK][CHARACTER BLOCK]
Hero key art: the adorable kawaii cat "Tofu" sitting on a folding chair at the edge of a
cozy dawn lake, holding a little wooden fishing rod, line in the water, warm morning light,
soft reflections. Vertical composition, inviting and premium. 1024px.
```
Iteruj aż będzie idealne, potem używaj tego obrazka jako referencji + bloków do reszty.

## 3. Bohater — kot-wędkarz

### 3.1 CHARACTER BLOCK (doklejaj do każdego assetu kota)
```
CHARACTER: "Tofu", an ADORABLE KAWAII chibi cat angler. Big round head (~1:1.6 head:body),
huge sparkly eyes, tiny rosy cheek blush, small triangular ears, stubby little paws. Soft
cream-orange fur with white muzzle and belly, pink nose. Outfit: cozy mustard knitted beanie,
teal fishing vest with tiny colourful lures, always holds a small wooden fishing rod. Super
sweet, cute, slightly goofy. Keep identical colours, outfit and proportions in every image.
```

### 3.2 Prompty (kota)
- **Turnaround (pod 3D / referencja):**
```
[STYLE BLOCK][CHARACTER BLOCK]
Character turnaround sheet: front, 3/4, side, back views in a row, T-pose-ish neutral,
orthographic, even lighting, transparent background, high detail for 3D reference. 2048px.
```
- **Arkusz ekspresji/pozy (sprite źródła):**
```
[STYLE BLOCK][CHARACTER BLOCK]
Expression + pose sheet on transparent background: idle sitting on a folding chair,
wind-up before casting, cast release (rod forward, line out), reeling, happy/celebration,
surprised. Side view, consistent scale, 2048px.
```
- **Klatki animacji ZARZUTU (do canvasa, side-view sprite sheet):**
```
[STYLE BLOCK][CHARACTER BLOCK]
2D side-view sprite sheet, 6 frames left-to-right of the cat CASTING a fishing rod:
1 idle, 2 wind-up back, 3-4 swing forward, 5 release (line flies out), 6 follow-through.
Identical character/scale per frame, transparent background, evenly spaced, 6×1 grid.
```
- **Avatar do HUD (mały, okrągły):**
```
[STYLE BLOCK][CHARACTER BLOCK]
Tight bust portrait of the cat for a UI avatar, facing 3/4, inside no frame, transparent
background, centered, 512px.
```

## 4. Tła Home (arena) — pełnoekranowe, per klimat

Kompozycja (KAŻDE tło): portret **1080×1920**. Zostaw czyste strefy pod UI:
- górne ~12% (pasek zasobów),
- dolne ~20% (tab bar + przycisk START),
- **kot ~centralnie-dolnie** na molo/krzesełku (zostaw miejsce, postać wklejamy osobno
  jako sprite — albo poproś wersję z kotem i bez).

Wspólny ogon promptu (doklej do każdej areny):
```
[STYLE BLOCK]
Full-bleed vertical 1080×1920 game background, cozy diorama, slightly elevated cute view.
Composition: open sky/top kept simple (space for a HUD bar), a focal fishing spot in the
mid-lower third, foreground dock/ice with room for a character to sit center, calm bottom
area (space for UI buttons). No characters, no text, no UI. Atmospheric, inviting.
```
Areny (przykłady — dołącz do ogona):
- **Arena 1 — Przybrzeże (świt):** `a calm lake at golden dawn, wooden dock, reeds, distant misty pines, warm low sun.`
- **Arena 2 — Mgła nad jeziorem:** `a foggy morning lake, moody soft fog over still water, silhouetted trees, cool muted palette, mysterious calm.`
- **Arena 3 — Zamarznięte jezioro:** `a frozen winter lake, snow, an ice-fishing hole in the center, a small folding chair beside it, soft blue-white palette, cozy winter light.`
- **Arena 4 — Rafa/ciepłe morze (opcja):** `a tropical shallow lagoon, turquoise water, palm, sandy shore, bright cheerful.`

## 5. UI kit (Supercell style) — przezroczyste PNG

```
[STYLE BLOCK]
A cohesive mobile game UI kit on transparent background, matching the palette: a big amber
primary button (#FFB627→#FF8A00) with soft top highlight and rounded pill shape; a wooden
rounded panel/frame; a small glass info pill (#0E2233); 3 resource chips with round icons
(green energy, blue gem, gold coin) and a small "+"; a 3-star rating (filled gold, empty
grey); a level badge hexagon; left/right round nav arrows; a bottom tab-bar icon set
(shop, backpack, crossed-rods "battle", skull, cash). Each element separated, centered,
no text, 2048px sheet.
```
Pojedyncze elementy generuj tym samym blokiem, prosząc o **jeden element, wyśrodkowany,
przezroczyste tło** (np. „only the amber START button, 1024px, transparent”).

## 6. Pod wodą (descent)

- **Tło podwodne per arena (pionowe, kafelkowalne w pionie):**
```
[STYLE BLOCK]
Vertical seamless-tiling underwater background, 1080×1920, top-to-bottom depth gradient
(lighter teal near top to near-black deep), faint god rays from top, drifting particles,
soft terrain/rock silhouettes at the sides, no fish, no UI, no text. Must tile vertically.
```
  (Poproś o „seamless vertical tile” — descent jest nieskończony w obrębie stage.)
- **Hak + żyłka (podstawowy):**
```
[STYLE BLOCK]
Game sprite, transparent background, side view: a simple shiny fishing hook with a small
swivel ring at top (attachment point), clean and readable, 512px. Plus separately: a thin
vertical fishing line segment, 1×256px, that can repeat seamlessly.
```
- **Bąbelki / bańka z ogłuszoną rybą:**
```
[STYLE BLOCK]
Transparent PNG: a clean cartoon air bubble with soft highlight (several sizes), and one
larger bubble big enough to hold a small fish inside. 512px.
```

## 7. Akcesoria (widoczne pod wodą po założeniu)

Każde akcesorium potrzebuje **dwóch wersji**:
1. **Ikona ekwipunku** (kwadrat, jak slot plecaka) — czytelna miniatura.
2. **Wersja „zamontowana na haku”** — jak wygląda pod wodą podpięta przy haku.

Szablon:
```
[STYLE BLOCK]
Game item on transparent background, two versions side by side:
(A) inventory icon — the item centered in a square, clean readable silhouette;
(B) mounted view — the same item attached to a fishing hook as seen underwater.
Item: <OPIS AKCESORIUM>. Consistent style/scale, 1024px.
```
- **Kotwica (anchor) — „hak z 2 haków”:** `a double-hook anchor attachment: two fishing hooks joined into one heavier rig, slightly comedic, metallic with amber accents (gives +1 simultaneous catch).`
- (przyszłe) **Ostrze/Grot (+atk):** `a sharp blade/spear tip clamped to the hook line, glinting (raw +atk).`
- (przyszłe) **Aura/magnes, laser-emitter** itd. — ten sam szablon.

## 8. Mapowanie na pliki w kodzie (co czym podmienić)
| Asset z GPT | Plik w repo |
|---|---|
| Tło areny (surface) | `assets/bg-surface.png` (per arena: `bg-arena-N.png`) |
| Tło podwodne | nowy `assets/underwater-N.png` (descent) |
| Hak + żyłka | nowy `assets/hook.png`, `assets/line.png` |
| Bańka | `assets/bubble.png` |
| Ryby (jeśli regen) | `assets/fish/*.png` |
| Ikony stage (areny) | `assets/stages/*.png` |
| Ikona akcesorium | `assets/items/<id>.png` |
| Akcesorium na haku | `assets/items/<id>_mounted.png` |
| Kot — klatki zarzutu | `assets/cat/cast_*.png` (sprite sheet) |
| Kot — avatar HUD | `assets/cat/avatar.png` |
| UI kit | `assets/ui/*` |

## 9. Checklist spójności (przy każdym evaluowaniu wyniku)
- [ ] Te same kolory/światło/outline co STYLE SHEET?
- [ ] Kot identyczny (sierść, czapka, kamizelka, wędka)?
- [ ] Przezroczyste tło dla obiektów (bez wbudowanej ramki/cienia jeśli ma być sprite)?
- [ ] Czytelność w małej skali (zmruż oczy — sylwetka jasna)?
- [ ] Rozdzielczość zapasowa do downscale?
- [ ] Strefy UI na tłach wolne (góra/dół)?
