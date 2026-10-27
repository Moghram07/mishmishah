# Mishmishah 🍑

**The world of fabric, reimagined.** Mishmishah (Arabic for _apricot_) is a global
platform for discovering fabrics, visualizing them on real products before buying,
and connecting with fabric sellers and tailors.

This repository contains the **foundation build**: a production-ready Next.js
application with the brand design system, full bilingual EN/AR (with real RTL),
light/dark mode, the complete landing page, discover/search, and the signature
**Fabric Visualizer**.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run test`.

Four art tools, none of which the app imports:

```bash
npm run mannequin        # places a photograph onto public/mannequin/*.png
npm run measure:body     # reads the body's edges, landmarks and light into profile.ts
npm run check:garments   # coverage, fit, collars, necklines, sleeves, anchors, seams
npm run shoot -- .preview/skin-tones.html   # any .preview sheet → PNG beside it
```

The `.preview/*.html` sheets are written by `npx vitest run
src/lib/garments/look.test.tsx` and drawn by the real `MannequinStage`.
`npm run shoot` photographs them in a headless Edge or Chrome (or the one
`BROWSER` names); they load the mannequin from the dev server, so keep
`npm run dev` running. `.preview/wardrobe/<garment>.html` shows each garment on
its own mannequin, whole and close up. For garment work, copy those PNGs to
`.preview/wardrobe/before/` first; `node scripts/compare-preview.mjs <round>
<garment-id>...` then writes before/after sheets, and `npm run shoot` turns them
into PNGs.

Requires Node 18.18+ (developed on Node 22; `check:garments` reads the
TypeScript records directly and needs Node 22's type stripping).

---

## What's built

| Area | Status |
| --- | --- |
| Brand design system (apricot palette, typography, tokens) | ✅ |
| Bilingual **English / Arabic** with true LTR/RTL | ✅ |
| **Light & dark mode** (no flash, respects system) | ✅ |
| Home page — hero, search, featured fabrics/stores/tailors, categories, inspiration, why, become-a-seller, download-app, footer | ✅ |
| **Fabric Visualizer** — two photographic mannequins, a wardrobe each, dressed in layers with swappable collars, fifteen necklines and ten sleeve types, plus home goods | ✅ |
| Discover / search — filter by color, material, pattern, category, country, price, text | ✅ |
| Procedural fabric texture engine (7 tileable motifs, at true print size) | ✅ |
| SEO metadata, responsive, accessible, reduced-motion aware | ✅ |

## The Fabric Visualizer

The signature feature. Press **✨ Try this fabric** anywhere and the selected
fabric is mapped onto the mannequin — or onto a sofa — in real time, no reload.

### Everything is drawn at its real print size

Fabrics are synthesized into **seamlessly tileable SVG patterns**
(`src/lib/fabrics/patterns.ts`). **The motif owns the scale**: each motif
carries a `repeatCm` — the real-world size of one repeat — and every fabric
drawn from it inherits that. Two plaids are always the same size as each other;
the type system forbids a fabric from overriding it. Only a *photographed*
fabric carries its own measured `cmPerPixel`, because every photo is shot
differently.

The renderer turns that into SVG units using the canvas's `cmPerUnit`, so a
1 cm herringbone is 1 cm on a sleeve and on a curtain. There is **no pattern
scale slider** — a control that lets you pick a size is a control that lets you
lie about the fabric you are buying. What you get instead:

- **Free rotation, 0–360°.** Straight grain, true bias and cross grain are all
  real cuts a tailor makes, so the control is continuous rather than three
  buttons (the three are there as presets). The lattice pivots about the centre
  of the canvas, so the pattern turns *in place* under the piece.
- **A close-up, 1–8×.** Below about six screen pixels a repeat stops resolving
  and averages into grey mush, so under that the renderer paints the motif's
  true average colour plus a fine held-open weave — which is honestly what a
  1 cm herringbone looks like from across a room. Zooming restores the real
  repeat at true scale.
- **The exact repeat, in centimetres**, printed beside the fabric picker.

### The mannequin

The body is a **cut-out photograph**, not a drawing — `public/mannequin/*.png`,
transparent background, front view. Anything drawn with paths ends up looking
like a drawing, and no amount of editing those paths fixes it.

- **One fixed canvas.** 600 × 1000 units, ≈ 0.19 cm per unit, crown at y 40
  and floor at y 950 for every body. That is what lets one fabric scale and one
  coverage vocabulary serve both figures. Nothing else is shared: each body's
  shoulder point, elbow, wrist, waist, hip and crotch are **measured from its
  own photograph** (see below), and his waist is 33 units below hers.
- **Registered on the trunk.** Each photograph is placed with its **trunk's**
  axis on x 300 — the median midpoint of the trunk across the torso — because
  every garment is mirrored about that line. It used to be the median of whole
  rows, hands included; his right hand hangs further out, which left both
  trunks 2.5 units off-centre and every garment 10 units off one hip and 5 off
  the other.
- **Its own widths.** Each body publishes its own anchors and its own zone
  geometry (`src/lib/mannequin/bodies.ts`), because a shoulder seam has to sit
  outside the shoulder it is drawn over. The male form is 9 units wider at the
  chest and 14 at the waist; a single cut loose enough for both fits neither.
  The thirteen zones are the body's, not the wardrobe's — `shoulderCap` follows
  each figure's own trapezius, and stops two units short of the neck point its
  yoke is sewn from, which on him is 270 and on her 272.
- **The neck, measured.** Her neck column is about 49 units wide and his 55.
  Registered on the trunk, her neck sits **three units left of it** and his
  within one — a head is never quite square on a photographed mannequin. Collar
  art is built against those numbers rather than against the `neck` *zone*,
  which is a different thing: zones erase the photograph, these numbers are for
  drawing on it.
- **Female and male**, two assets in the same slot, **one wardrobe each**.
- **Ten skin tones built from measured skin** (`data/skinMeasurements.ts`,
  `data/skinTones.ts`), from spectrophotometer data on over 14 000
  measurements of 2 106 people in eight groups ([Sources](#sources)). They are
  evenly spaced in L* across the measured range. Each takes the redness and
  yellowness real skin has at that lightness, with chroma lifted by one
  measured standard deviation so it does not read dusty on screen. Together
  they cover all six Individual Typology Angle classes, from very light to
  dark. The tests fail if a tone leaves the measured range (L*, a*, b*,
  chroma, hue) or if two neighbours come closer than 4 in CIEDE2000.
  - They replaced the ten Monk Skin Tone swatches. Those are category labels
    for sorting photographs, not colours a body is: three were near paper
    white, two near black, and the light ones nearly identical.
  - Before Monk there were six tones picked by eye. Two of those were more
    saturated than any measured skin, which is why they read orange.
- **The tint is a lookup table, not a multiply** (`mannequin/skinTint.ts`). The
  photographs are neutral grey, and the tint is one `feComponentTransfer` of
  per-channel tables over them. The photograph's **measured median** grey
  renders as the measured colour; a plain multiply left every tone a tenth
  darker. Lit skin scales every channel alike, so it keeps its hue. In shadow,
  red falls a little slower than green and blue, so shadows turn slightly
  redder rather than grey-brown.
  - A single gamma curve per channel could not do both: warming the shadows
    that way cooled the highlights, and the tones read grey.
  - Dropping blue faster as well looks like the same idea and is not: less
    blue is more *yellow* in CIELAB.

  The highlight is kept short of white on the lightest tone. The median and
  highlight come from `profile.ts` (`light`), measured by `npm run
  measure:body` and checked for freshness by `npm run check:garments`.
  `.preview/skin-tones.html`, shot by `npm run shoot`, is the contact sheet:
  the ten tones on both bodies, whole and close up, under the six they
  replaced, with each tone's L*a*b*, ITA and CIEDE2000 step.
- **Chosen under the figure.** The mannequin and its skin tone sit in a bar
  directly beneath the body on the stage, not at the end of the control panel,
  and the tone's name ("Tone 3", "درجة 3") is shown beside the label.
- **Swappable as data.** A different form, a different photograph: edit the
  record and drop in the file. The renderer never learns which body it is
  drawing.
- **No measurements, ever.** Scaling the body would scale the fabric with it and
  destroy the real-world print size the whole product rests on.

#### Garments are drafted against the body, not drawn near it

Every outline in the wardrobe used to be a list of typed coordinates, and that
one fact was the root cause behind every fit complaint this project had. The
symptoms looked like four separate bugs and were one:

- **A crooked shoulder.** The left seam and the right seam were written out as
  two independent curves. `art/female/yoke.ts` called the second "the same curve
  run the other way" and it was not — the two differed by **5.2 units at y 194**,
  the steepest part of the shoulder slope and exactly where the eye reads
  shoulder shape. Two hand-typed halves drift.
- **Triangular wedges off the shoulders.** A sleeve was four straight lines with
  an underarm guessed twenty units below the real one.
- **No gap between the arms and the ribs.** Both mannequins hold their arms
  clear of the body — hers by up to 27 units, his by up to 32 — and that fact
  was written down nowhere, so every sleeve was welded to its side seam and the
  figure came out a slab.
- **No daylight between the legs.** Worse, because the two bodies differ most
  here: her ankles are 42 units apart and his are 96, and the two trouser
  drawings carried the same inner edge *character for character*.

So drawings do not type coordinates. They ask the body where it is.

- **`scripts/measure-body.mjs`** (`npm run measure:body`) reads each photograph's
  alpha row by row, sorts the runs into trunk, arms and legs **by position
  rather than by count** — a hand against a thigh splits a row into five runs —
  and writes `src/lib/mannequin/profile.ts`: the measured edges, folded to
  whichever side of the body reaches further, since a garment is cut
  symmetrically and a photographed mannequin never is — and the **landmarks**
  every garment hangs from:

  | Landmark | How it is found | Her | Him |
  |---|---|---|---|
  | `shoulderPointY` | where the outline turns from shoulder to arm | 202 | 202 |
  | `armpitY` | where the arms leave the ribs | 246 | 271 |
  | `waistY` | the middle of the trunk's narrowest band | 350 | 383 |
  | `hipY` | the first row below the waist at its widest | 454 | 511 |
  | `crotchY` | where the legs part | 495 | 521 |
  | `wristY` | the narrowest the arm gets above the hand | 474 | 483 |
  | `elbowY` | placed 55% of the way from shoulder point to wrist | 352 | 357 |

  The elbow is the one that is placed rather than read: a hanging arm has no
  corner there for an outline to find.
- **`src/lib/garments/fit.ts`** turns those edges into seams, armholes, sleeves
  and legs with ease added. A left side is built once and **mirrored**, which is
  the only construction under which two shoulders cannot disagree. Garments call
  `top` (`garments/sleeves.ts`), `openFront`, `trousers` or `column` and supply
  only what is genuinely their own — how much ease, and where they sit relative
  to the body's landmarks. **No garment types a body coordinate**: a trouser
  says how far below the waist it is worn, a sleeve says which length it is.
- **`npm run check:garments`** measures the result against the body: the two
  sides may not sit more than 2.5 units apart, the arm must keep a share of its
  own daylight, the legs must keep theirs, cloth may not stand more than 9 units
  off the waist, hip or thigh (12 for a jacket) — **read on each side
  separately**, which is what catches a garment cut about the wrong centre line
  — and the checked-in profile must still match the shipped PNG. Coverage alone
  never caught any of this — a sealed slab with a crooked shoulder passes it
  perfectly, and did.

The neck is the one place the "cut it symmetrically about the trunk" rule is
wrong. Everything else is folded to whichever side of the body reaches further,
because clothes are cut symmetrically and a photographed mannequin never is —
but **her throat sits three units left of her trunk**, and a neckline cut about
300 crowds one side of it and gapes on the other. That is visible. So the
opening is cut about the throat's own centre, and every collar is reflected
about a **collar axis** (`collarAxis` in `fit.ts`) that is the neck's centre at
the neck and blends to the trunk's by the waist — the line a sailor collar's V
and a jacket's lapels meet on. The opening is sized to the neck **column**
rather than to the silhouette at the row it is sewn to (62 units across against
a 48-unit neck — size it there and a crew comes out a boat neck), and it is one
half-ellipse mirrored rather than two ends typed independently. The old plain
necklines ran from a right collar point at x 328 to a left one at 278, six
units adrift, and closed the gap with a straight diagonal.

It is also only the **front**. This is a front view over an opaque neck, so the
only part of a neckline that can be seen is the arc round the front of the
throat. The neckline's topstitch and the shadow it throws are both built from
that same arc, offset onto the cloth — they used to be separate curves, which is
why the stitch crossed the opening and the shadow read as a much deeper scoop
than the cloth was cut to.

A few things the model had to be told, because cloth is not a taut string:

- A straight-cut seam **bridges** the waist rather than diving into it, but only
  three units. Pulled literally taut it stood 23 units off her waist and
  swallowed the entire arm gap; it is capped, and the cap ramps in below the
  underarm.
- A **waistband grips**. Trousers are hung a stated `rise` below the body's own
  waist, and the band is cut at one unit of ease — the seat's five only arrive
  at the hip. A band cut at the seat's ease stood seven units off his waist and
  read as a box placed round him.
- A skirt is **close to the hip and free below it**. `column` holds the waist's
  ease down to `hipY` and only then flares; flaring from the waist stood the
  dress 26 units off her hip.
- The **armhole starts at the shoulder point**, where the outline turns into the
  arm, and drops almost straight to the underarm. It used to start fourteen
  units lower, on the outside of the deltoid, and the armhole seam cut
  diagonally across the top of the arm.
- A trouser leg **hangs** on the outside and **follows the leg** on the inside.
  Followed exactly on both edges it becomes a legging; pulled taut on both it
  closes the gap it exists to show.
- A top longer than the crotch **hangs from the hip** (`bodySide`). It skims the
  body down to the hip, then takes the tightest line to the hem that clears the
  thighs, never coming back in. It used to walk each leg's outer edge, so the
  thobe came in at the knee and flared below it, like a mermaid. `hemEase` is the
  A-line: 28 units on the thobe.
- Hems end where the garment is worn. Both t-shirts sit at mid-hip (hers at
  y 426, his at y 452, mid-fly); they used to reach the crotch. The shirt and the
  blouse have a **shirttail** (`tail`): the side seams end high and the front
  falls below them. The shirt's side seams end at y 470 and its front at 514; the
  blouse's sides end at y 440 and its front at 470, so it no longer shows below
  her jacket. A knit **neckband** is 9 units, about 1.7 cm.
- The **placket** (`art/placket.tsx`) is one piece shared by his shirt, polo
  and thobe and her blouse. On the shirt and blouse it runs collar to hem with 7
  and 6 buttons; the blouse's follows her collar axis.
- Trousers have no seat patch and no inseam topstitch in the front view: the
  dark crescent read as a stain, and the inseam is not visible from the front.
  The skirt's waistband is 18 units, about 3.4 cm.
- The sleeve is held off the side seam **that was actually drawn**, not off one
  recomputed from the body and the garment's ease — the two differ by seven
  units on a straight cut, which is the whole of the daylight.
- A shoulder seam **hugs**. Cloth laid over a shoulder follows it, so the seam
  is the measured edge plus the thickness of the cloth. Two other constructions
  were tried and both put a shoulder pad back: clearing the neighbourhood stood
  21 units off at the deltoid, and pulling a taut line from the neck point —
  which sits inboard of the silhouette, so the line bridges everything outboard
  of it — stood 20.8 off the trapezius, worse than the hand-solved cubic it
  replaced.
- The measured edge is stored as a **conservative envelope**: each sample is the
  outermost edge across the rows it stands for, and smoothing may move an edge
  outward but never inward. Both exist because the deltoid is a step rather than
  a slope — her silhouette drops 13 units in a single row — and anything
  interpolated across it lands inside the shoulder, which is skin above the
  cloth. Three smoothing taps, which is what an inseam needs, rounded that
  corner off by six units on their own.

Topstitch is drawn at 0.9 units with 2.6-unit dashes, masked to its own region.
It was 2 units thick with 6-unit dashes at 0.9 opacity, and a unit is 1.9 mm —
a 3.8 mm thread laying 11 mm stitches, four times life size. And it was not
masked, so any stitch falling outside its piece painted onto whatever was
behind: every neckline stitch crossed the opening and drew on the throat.

And a stitch is drawn **only on a line the garment is actually sewn along** —
an armhole, a raglan seam, a hem, a neckline. Collars carry none at all for now:
theirs were typed lines that no longer matched the collar, or insets that
drifted off its edge, and a clean collar reads better than a wrong seam.

#### The close-up

Zoom aims itself at whatever region is being edited — each region's drawing
carries its own `focus`, so cutting a collar points the camera at the throat and
cutting a trouser leg points it at the knee — and from there it can be **dragged**
to look anywhere.

Both halves were missing. A collar is a separate, swappable asset, not a region
of a garment's art, so `garmentArt(shirt).regions.collar` is `undefined` on every
garment in the wardrobe; that `undefined` fell through to "the centre of the
canvas", and choosing a collar and zooming to 8× framed the hips. And with no
way to pan, whatever the app decided to point at was the only thing you could
ever see.

**It runs to the stage's edges.** The figure used to be drawn into a box its
own shape, standing in the middle of the stage. Zoomed out, that box can't be
seen, because the figure fills it and the rest is transparent. Zoomed in, the
body filled it edge to edge and was cut off square in the middle of an empty
stage, like a picture in a window. The stage hands its measured size to
`frameFor` now, as a `Viewport`. The frame is then always the stage's shape,
so a close-up fills the stage and its only edges are the stage's own. At 1×
the figure stands whole in the room the inset leaves: clear of the mannequin
and close-up controls laid over the bottom of the stage, which are measured
too. Panning is clamped to what 1× shows, and a drag moves the picture exactly
as far as the pointer. The share card always frames the whole figure, since a
close-up on a card would bring the window back.

Nothing in the controls under the figure changes size with the zoom, and the
slider has a row to itself. It once shared a centred row with the note beside
it, and that note's text changes at 1×. The row re-centred and the slider slid
85 px under a pointer that was dragging it. The same pointer position then meant
another value, so the zoom flicked between 1× and a close-up on every move. The
arrow keys never read the pointer, which is why they still worked. The dock's
height also feeds the framing, so it has to stay put.

The viewBox maths is `mannequin/frame.ts` and the focus lookup is
`garments/closeUp.ts` — both out of the component on purpose, because a viewBox
computed inside a render and thrown at an attribute has nothing to assert
against, which is why this went unnoticed. `garments/closeUp.test.tsx` renders
the real stage and reads the real attribute; `.preview/zoom.html` shows the same
figure aimed at four different places.

#### Shooting a replacement

Nothing generates the body. `scripts/normalise-mannequin.mjs` takes a
photograph, measures it, and places it on the canvas — it does not retouch,
redraw or stretch. To shoot your own:

| | |
|---|---|
| **Background** | **genuinely transparent alpha**, not white. This is the one that matters — every anchor, seam and coverage measurement in this project reads the alpha channel, so a white background measures the rectangle instead of the body and fails nothing while corrupting everything. The tool refuses a file whose corners are opaque. |
| **Format** | PNG-32, 8-bit RGBA, non-interlaced |
| **Stand** | removed, along with any base plate or neck spigot |
| **View** | square-on front, whole figure crown to sole, arms down and clear of the body |
| **Framing** | anything — the tool scales and centres. Both supplied photographs were 459 × 861 and framed differently. |
| **Canvas it lands on** | 600 × 1000 units at 1.5 px per unit ⇒ 900 × 1500 |
| **Crown → floor** | y 40 → y 950, set by uniform scale |
| **Centre line** | x 300, from the median midpoint of the **trunk** across the torso — not of whole rows, which the hands pull off centre |
| **Shoulder width** | roughly 190–200 units once placed |
| **Lighting** | flat and even, and neutral grey; the app tints the body for ten skin tones from its measured light, so bake in no colour |

Then: `npm run mannequin`, `npm run measure:body`, `npm run check:garments`, and
fix whatever it reports. The edges, landmarks and shoulders are all measured
*from* the photograph, so most of a new figure is re-measured rather than
re-drawn — the checker prints the shoulder stand-off, the fit on each side and
every coverage hole, which is the whole worklist.

### Layered garments

A garment is a plain data record (`src/lib/data/garments.ts`):

```ts
{ id, name: { en, ar }, category, gender, layer,
  coverage: [...bodyZones], fabricRegions: [...], incompatibleWith: [...],
  acceptsCollar, defaultCollar?, acceptsNeckline?, defaultNeckline?,
  sleeves?: { types: [...sleeveTypes], default: { type, length } },
  asset: { front } }
```

Layer order is `skin → base → bottom → top → mid → outer → accessory`, and four
rules fall out of the data with no renderer involvement:

- **`gender` is the one body a garment is cut for**, and there is no `unisex`.
  A drawing is built against one figure's anchors and its coverage erases that
  figure's zones, so a garment on the wrong body does not merely look wrong —
  it erases what it cannot reach, and the mannequin comes through the hole. The
  picker offers one wardrobe, and the renderer drops anything that slips through
  anyway.
- **Each mannequin keeps its own wardrobe** (`switchBody`, `Outfit.away`). The
  body leaving the stage is put away exactly as it is, and the one arriving comes
  back exactly as it was left. Switching never redesigns a garment. It used to:
  the outfit was one list, and switching *replaced* it with the other body's
  counterparts. A dress cut high with a mandarin collar, puff sleeves and a plaid
  skirt came back from the male mannequin rebuilt from the thobe: no neckline
  showing, set-in short sleeves, the skirt in the bodice's cloth, and the
  mandarin on a round neck it does not fit. Only a body that has never been on
  the stage is dressed from the other (`changeBody`). That first dressing
  carries the collar, the cut of neck and the sleeve type and length wherever
  the counterpart offers them, and cuts a neck that can carry the collar.
  `garments/bodySwitch.test.ts` covers both round trips, every neckline with
  every collar it carries, and whole outfits.
- **A cut and its collar always agree.** `necklineOf` reads a garment that
  stores no cut as its default, which is what is drawn, and `collarOf` refuses
  a collar the cut cannot carry. Recutting the neck takes such a collar off.
- **Two garments on the same layer cannot both be worn.** A blouse replaces a
  t-shirt.
- **`incompatibleWith` clears the rest**, in either direction — a dress clears
  the top and the bottom, and putting a skirt on afterwards clears the dress
  even though the skirt says nothing about dresses.
- **`coverage` decides what is still visible.** A garment whose every covered
  zone is already covered from above is not drawn at all: trousers under a thobe
  cost nothing until the thobe comes off, at which point they reappear exactly
  as they were. Covered zones are also erased from the photograph, so no pale
  edge of mannequin survives around a garment — while a zone left bare wins the
  argument, because zones overlap the way bodies do. A bare forearm is drawn
  back over the skirt it hangs in front of — but never over a sleeve: each
  drawing hands the renderer the cloth lying over the arms (`armCover`), and
  the forearm is masked out of it. Before that, any sleeve ending partway down
  the forearm had its hem painted over, square, at the zone's edge.

  The vocabulary decides how well this works, and it used to be too coarse
  above the bust. Between `neck`, which stopped at y 216 — since re-cut to 200,
  where her neck actually ends — and `torso`, which
  starts at y 268, lay fifty units of chest and the entire shoulder slope that
  belonged to no zone at all — so a jacket and the t-shirt under it covered
  exactly the same list, and the t-shirt was hidden as redundant while the
  jacket's deep V showed bare photograph. `shoulderCap` and `upperChest` were
  added for the collars and fixed that on the way. The jackets now claim no
  chest **and no torso**: they open to a button at the waist and fall away
  below it, so their cloth covers the trunk everywhere except their own opening,
  and erasing it would cut a hole the shape of the V. The top underneath is
  drawn and shows through it. The optimisation survives wherever the garment
  above really does cover everything, which is what it was always claiming.

Twelve garments, front view, six per body:

| | |
| --- | --- |
| **Female** | t-shirt, blouse, trousers, skirt, dress, jacket |
| **Male** | t-shirt, shirt, polo, trousers, jacket, thobe |

The thobe is the clearest case of coverage doing the work — worn over trousers
it covers every zone they do, so the renderer simply stops drawing them, with
no `incompatibleWith` entry involved, and they are back the moment it comes off.

**The jackets are single-breasted blazers**, built with `openFront`: two fronts
closing on one button at the wearer's own natural waist, cut in a straight V
above it and falling away below it into rounded corners, with flap pockets at
the hip, a breast welt and front darts. The shoulder is three units wider than
a top's, not six, and the lapels are cut from the same neck points and button
as the fronts (`JACKET` and `LAPEL` in each yoke), so a lapel's inner edge *is*
the jacket's V and it ends exactly at the button. Each body's jacket is drafted
against that body — his button sits 33 units lower than hers because his waist
does.

**Adding a garment is one record plus one drawing** in
`src/lib/garments/art/<body>/` — the same "add one case" the products have
always had.

### Sleeves: a type and a length

Every top except the jackets can be cut with a choice of sleeve, and the choice
is **two**: how the sleeve is built, and where it ends. They are separate
because they are separate — a puff sleeve is a puff sleeve whether it stops
above the elbow or at it — and keeping them apart means each type simply names
the lengths it comes in, with no list of combinations to maintain.

What separates the types is **construction**: where and how the sleeve is
joined to the body.

| Type | Construction | Lengths | Offered on |
|---|---|---|---|
| Set-in | sewn into an armhole from the shoulder point to the underarm | short, elbow, ¾, long | both |
| Drop shoulder | the shoulder runs on down the arm; the seam falls on the upper arm, into a lowered underarm | short, elbow, long | both |
| Raglan | a diagonal seam from the neckline to the underarm; the sleeve carries the shoulder | short, elbow, ¾, long | both |
| Kimono | cut in one with the body, underarm a third of the way to the waist | short, elbow | both |
| Dolman | cut in one with the body, underarm nearly at the waist, tapering to the wrist | ¾, long | her |
| Puff | set-in, a raised crown, gathered into a band | short, elbow | her |
| Bishop | set-in, fullness growing down the arm, bloused over a cuff | ¾, long | her |
| Bell | set-in, fitted to the elbow, flaring to the hem | elbow, ¾, long | her |
| Flutter | a short sleeve cut on the circle: flared, its hem rippled | short | her |
| Cap | no sleeve piece — the bodice carried a little way over the arm | its own | her |

Sleeveless is a length, and every type has it. His wardrobe offers the four
cuts menswear is actually made in.

- **Lengths are the body's.** Short is past halfway to the elbow, elbow is the
  elbow, three-quarter is halfway on to the wrist, long covers the wrist — each
  from the landmarks above, so her sleeves and his end on their own arms. Every
  garment used to type its own cuff row, and a "short" sleeve on one ended where
  an elbow-length one did on another.
- **One drafting.** `top()` in `src/lib/garments/sleeves.ts` builds the body and
  sleeves for any choice from the measured shoulder point, underarm, arm edges
  and side seam, and every top draws through it (`art/sleevedTop.tsx`). A
  garment keeps only its own numbers: its ease, its hem, its neckline.
- **The shoulder and neckline come in as a frame.** Everything below the
  shoulder seam is the sleeve's; the seam and the opening above it are the
  garment's — a top's own crew neck, or whichever of the dress's fifteen cuts it
  is wearing. A raglan sleeve takes the two shoulder seams off the body and onto
  itself, which is why every cut that keeps both shoulders exposes them.
- **The neckline decides what is offered on the dress.** A cut that keeps both
  shoulders offers every type; the one-sleeved cut offers only sleeves built on
  the set-in join; a strapless or one-shoulder cut offers none.
- **A sleeve hangs as a tube** (`hang` in `top()`). It is widest at the
  underarm and tapers to the wrist, bridging the forearm rather than following
  it. Every type cut close to the arm hangs this way: set-in, drop, raglan
  and kimono.
  - The inner edge is taut against the arm's inner side and held off the body
    by the arm gap.
  - The width is whatever covers the arm with the garment's ease, never growing
    from the underarm down, in straight runs.
  - Anything extra goes outward, and the head joins the top of the tube.

  It used to walk the arm's own outline, and both photographs show the forearm
  broader from the front than the upper arm (his 50 against 39). So every long
  sleeve swelled below the elbow: 48, 61 and 40 units across his upper arm,
  forearm and wrist, which is a puff sleeve. Now his long thobe sleeve runs
  59 → 40 and her dress's 50 → 37. A sleeve that never widens has to clear the
  forearm, so it stands about 11 units clear of his deltoid at the underarm,
  which is the room any sleeve has at the bicep. `check:garments` measures
  every sleeve type and length but the loose four, every 2 units from the
  underarm row (`underarmRow`) to the hem. It fails any that widens more than
  2 units. `.preview/sleeves/widths.html` is the before-and-after table.
- **Loose sleeves are loose on purpose.** Gathers where a puff or bishop is
  drawn into its band, flare folds on a bell, drape under a kimono or dolman —
  shading that makes the volume read as cloth rather than as a wide shape. A
  puff, bishop, bell or flutter keeps its shape, and a dolman keeps the
  wide-to-narrow taper it is cut with.
- **A seam is drawn where the construction has one**: the set-in and drop
  armholes, the raglan diagonal, the hems. A kimono, a dolman and a cap have no
  armhole, so they get no armhole stitch.
- **A sleeve claims only the arm it spans.** An arm zone is erased only if the
  sleeve reaches its whole length; a short sleeve leaves the upper arm in the
  photograph and is drawn over it.

`check:garments` cuts every top in **every type at every length** it offers —
34 combinations on each of hers, 17 on each of his — and holds each to the same
rules as the garment's default.

### Necklines: a cut, not a piece

A collar and a neckline are different things, and keeping them different is what
lets **Dress + Neckline + Collar** be three independent choices instead of one
hardcoded garment per combination.

- A **collar** is separate cloth sewn on: its own record, its own drawing, its
  own fabric region, its own coverage. It only ever *adds*.
- A **neckline** is a cut. It reshapes the garment's own outline, takes no
  fabric of its own, and is the only thing in the system that can **subtract**
  coverage — six of the fifteen take the shoulders and the sleeves off a dress
  that otherwise covers them.

All fifteen are drafted through `garments/fit.ts` against the measured body, not
drawn: `src/lib/garments/necklines.ts` is the geometry, `src/lib/data/necklines.ts`
the catalogue, and the two are kept in step by construction — ids, openings,
sleeves and bared zones are read from the first rather than retyped in the
second. Two rules the cuts obey, both learned here the hard way:

- **Every endpoint sits on the body.** An opening's corners are placed by
  walking *along the shoulder seam*, not by naming an x. Asked for by width, a
  boat neck wants to start seventeen units outside her body; asked for as "58%
  of the way to the shoulder point", it lands on the shoulder.
- **A corner is a join between runs.** Catmull-Rom rounds whatever it passes
  through, so a V's apex and a square's corners are the seams *between* two
  `run()` fragments rather than points inside one.

**Releasing a zone is safe; claiming one is not.** Coverage decides what of the
photograph is *erased*, so a bared zone is simply drawn with cloth painted over
whatever part of it the cut covers. That is why a one-shoulder cut needs no
per-side zone split — `shoulderCap` is one shape covering both, and leaving it
un-erased shows both shoulders with cloth over the one that has cloth. It is
also why four wide cuts (scoop, boat, square, cowl) bare it despite still
covering most of it: an opening that reaches past the zone's inner edge exposes
part of it, and `check:garments` found each one — 1254 px of bare shoulder on
the boat neck.

**The collar list follows the cut.** A collar names the opening it needs and a
neckline presents one, so a standing band is only offered where there is cloth
at the base of the throat to stand on. Choosing a cut takes off a collar that no
longer fits; the Collared cut arrives wearing one, still swappable. The dress
used to recut *itself* to a high opening whenever a standing collar was picked —
invisible, and it would make a neckline picker a liar.

The geometry lives in `art/female/dressCut.ts` rather than in `dress.tsx`
because `check:garments` reads a `.tsx` drawing by evaluating its `const`
declarations out of the source, which cannot call a function — so a generated
cut is exactly the shape of thing it cannot see, and a drawing it cannot see is
one none of its rules apply to. The plain module is imported by both, and the
checker runs every rule fifteen times: holes, symmetry, the arm gap, the leg
gap, the seam stand-off, and that a collar covers the seam it is sewn to. A
bodice is drafted per neckline **and** sleeve, on first asking, and kept —
fifteen cuts times every sleeve is too many to draft at load for a picker that
shows a handful.

### Swappable collars

A collar used to be a path buried inside one garment's drawing, which made the
one part of an outfit people actually choose the one part that was not a choice.
It is a record of its own now (`src/lib/data/collars.ts`), on the same terms a
garment is:

```ts
{ id, name: { en, ar }, gender, coverage: [...bodyZones],
  fabricRegions: ["collar"], compatibleWith: [...categories],
  footprint: { width: [cm, cm], drop: [cm, cm] },
  build: { stand, fall, front? }, opening, asset: { front, behindBody? } }
```

Twelve ship: eight for her — shirt, Peter Pan, mandarin, bow, notched, sailor,
ruffled and turtleneck — and four for him — shirt, polo, mandarin and notched.
None of the rules live in the renderer. Every one of them is a rule about what
the collar looks like **front-on**, because that is the only way it is ever
seen: a shape that would need a side view to explain it is a shape that does
not work here.

**Only what is in front of the neck is drawn in front of it.** This is the rule
most of the collars used to break, and breaking it is what made them look like
rings placed on the mannequin:

- **His shirt collar is built the way a shirt collar is made**
  (`art/male/collars/shirt.tsx`).
  - **The band:** it wraps the neck and closes at the throat on the collar
    axis. It is built with `stand()` like his mandarin and rises 20 units
    (about 3.8 cm). Its top edge is the roll line: at the side of his neck the
    seam is at y 178 and his jaw at y 138, so the roll line lands at y 158,
    halfway up the neck and level with the top of the mandarin.
  - **The leaves:** they are sewn to the *top* of the band (its edges come from
    `standEdges`) and fold down over it. They cover it to 5 units below the
    seam and meet on the axis in a narrow upside-down V.
  - **The points:** about 8 cm along the front edge, angled toward the placket,
    ending on the upper chest.
  - **What shows:** above the roll line, the neck. Below it, only the leaves and
    the V, where the band shows and closes with buttons. The garment sets the
    count (`collarButtons`: two on the thobe, one on the shirt and polo). The
    collar sets where they go (`bandButtons`).
  - **Behind:** the band behind the neck rises to the roll line.

  It used to be cut from the neckline, each leaf's inner edge the seam. The
  whole neck showed and it lay on the shoulders like an open camp collar, but a
  thobe is closed at the throat. Before that, the band was drawn across the
  front with the leaves hung from its *bottom* edge, and showed above them.
- **Her shirt collar is still cut from the neckline**, each leaf's inner edge
  the seam, and so has the same problem as his old one. It is left as it is for
  now.
- A **notched collar** has no band in front at all. The jacket is open in a V,
  the collar's back stands behind the neck, and each upper collar starts where
  it comes out from behind the neck rather than meeting its partner over the
  throat.
- A **sailor collar** is open at the front: its panels start at the collar
  points and meet in a V on the collar axis, and what shows between them is the
  garment's own neckline — the dickey it is worn with. Its record says
  `front: "open"`, which is what lets the checker excuse the stretch of seam in
  that opening and nowhere else.
- A **standing band** — mandarin, turtleneck, the bow's band — does pass in front
  of the neck, and is built by `stand()` in `fit.ts` as what it is: a strip sewn
  along the opening, its lower edge the seam plus a seam allowance, its top
  nearly level. It used to be drawn as a hoop seen from above, its top lifting at
  centre front over a lower edge sagging eighteen units onto the chest.
- The **ruff** is a front-only sweep struck from the neck's own centre, its
  inner edge the neckline and both ends turned the same way; its back half is
  behind the neck.

- **Drawn as worn, not as cut.** A collar is a flat pattern piece wrapped round
  a neck, and the two look nothing alike. Copying the flat shape onto the body —
  which is what a technical drawing shows, and what these were built from for
  several rounds — gives a large shape lying on the chest instead of cloth going
  round a throat. So: the front foreshortens to roughly three fifths of the flat
  width, the back is hidden behind the neck with at most a thin edge showing at
  either side, the inner edge stays on the neckline, and every collar is sized
  against the **neck**. Her neck is 64 units across at its base and her shoulders
  are 157; a shirt collar is the first number plus a little. The sailor is the
  single exception on width, because it genuinely reaches the shoulder point —
  and even its front is foreshortened.

  Two of them show the difference plainly. The worn Peter Pan is a pair of
  crescents cut from the opening (`flatCollar`), where the flat one is two big
  lobes; the worn shirt collar stands beside the neck with its points falling
  toward the placket, where the flat one spreads wide and splays outward. Both
  had been drawn from the flat version.
- **A collar is cloth, never topstitch.** Every one is a filled region with its
  own outer edge and its own shading, and reads with no stitching at all — which
  is how they ship for now. Trim decorates a shape and can never be the shape.
- **The collar is its own fabric region.** It takes a different cloth from the
  body of the garment, through the same `FabricRegion` path at true print size
  and the current grain angle — which is the point of the feature, and the
  reason a collar is a part rather than a style.
- **Each collar's stand is its own.** `build.stand` is how far the band rises
  above the neckline seam: 0 for the Peter Pan, 6 for the sailor and the polo, 8
  for the bow, 10 for the shirt collars, 14 for her mandarin and both lapels,
  20 for his mandarin, 24 for the ruff and the turtleneck. `stand()` builds a
  band from that number, walking the throat's measured edge every four units.

  Front-on is the only view, so a stand has to *look* wrapped from straight
  ahead — hence the band behind the neck, four units wider than the front and
  level along the top. A band round a cylinder seen head-on is hidden by it
  except at the edges, and the numbers say exactly that.
- **A collar is symmetric about the neck, not the canvas.** Its left half is
  drawn once and reflected about the collar axis — the neck's centre at the
  neck, the trunk's by the waist. Reflected about x 300, which her neck is three
  units left of, the sailor sat on her throat on one side and beside it on the
  other.

  This was once the bug that made every collar look like a mandarin: seven of
  the first nine shared one hard-coded 22-unit band, while their records
  declared nine different stand heights that nothing read. `check:garments`
  measures how high each drawing rises and fails when the cloth and the number
  disagree, so the declaration cannot go stale again.
- **A collar with a stand wraps the neck.** It draws a `behindBody` half: the
  part of the collar that passes *behind* the throat, rendered under the
  mannequin photograph so the body hides all but the sliver either side. This is
  the difference between a collar and a decal. For a collar that is open at the
  front — a shirt collar, a lapel, a sailor — it is the only band there is.

  `behindBody` is a layer within the front view, not a camera angle. `front`,
  `back` and `side` on a garment are angles and only `front` ships; naming this
  one `back` would have collapsed two different ideas into one word.
- **They are not the same size, and `footprint` says so.** A mandarin is a band
  at the throat, 10 × 5 cm; a sailor collar crosses the whole shoulder at
  28 × 21 cm, eleven times the box; a jacket's lapel runs from the neck to its
  button at 23 × 36 cm. The first nine were all drawn to whatever
  fitted most easily round a neck and spanned barely four times from smallest to
  largest — nine costumes on one shape. Seams and coverage cannot see that: a
  collar half the size it should be is sewn on just as neatly. So the size is
  declared in centimetres, the dimension a tailor would give, and the drawing is
  measured against it.
- **Coverage is the union** of the garment's and the collar's — and today no
  collar claims anything. Each covers cloth without covering a whole zone of
  body, and says so by claiming nothing: a claimed zone is erased from the
  photograph, and a collar that claimed more than it spans would leave a hole.
- **The collar names its opening and the garment cuts it.** A standing band can
  only be sewn at the base of the neck, so every top that takes a collar cuts a
  `high` opening as well as its own crew or scoop — her t-shirt and blouse, his
  shirt, polo and thobe, and the dress through its neckline cuts — and
  `opening` says which one a collar needs. That is the seam `check:garments` then
  walks: the collar's inner edge and the garment's neckline are one curve rather
  than a collar laid over unbroken cloth.
- **`compatibleWith` is geometry, not taste.** A collar is sewn *into* a
  neckline, so it has to cover it: the notched lapels fit outerwear alone,
  because each is cut from its own jacket's V and button. The Peter Pan is the
  flat one — no stand, nothing behind the neck, sewn to the round opening, and
  correct that way. His shirt collar fits a shirt, a polo and a thobe.
- **A garment finishes its own neck or leaves it to a collar, never both.** Both
  wardrobes take their collars as records now; his four were added as four
  records and four drawings in `art/male/collars/`, with no change to the
  picker, the renderer or the checker — which is the claim the female ones were
  built to test.

Garments name a default: her blouse the shirt collar and her jacket the notched
lapel; his shirt the shirt collar, his polo the polo collar, his jacket the
notched lapel and his thobe the mandarin. The blouse's own neckline was re-cut
from a deep V to a round opening when its collar was lifted out — a collar can
only be sewn to a neckline it can cover, and the V comes back with the collar
that has one.

**The collar declares the opening and the garment cuts it.** The renderer asks
each garment for its cut with the whole choice at once — neckline, the opening
the worn collar needs, and the sleeve — and `check:garments` rasterizes each
garment once per opening, never the union of them, which would be a shape
nothing renders and would let every coverage check pass against art no one can
see.

`npm run check:garments` checks the things types cannot:

- **Coverage.** Every garment really covers every zone it claims to, on the body
  it is cut for — a garment that claims the thigh but stops above the knee
  leaves a hole where a leg used to be. Collars are held to it too, alone and
  paired with each garment they name.
- **Eligibility.** Every garment names exactly one body, under a unique id, and
  no body has an empty wardrobe. This is the assertion the original male bug
  needed: the coverage pass was green throughout, because the female drawings
  happened to clear the male figure too. Fit was never the question. Collars are
  checked the same way, and never reach a garment from the other body.
- **Every collar against every garment it names** — the whole cross product, not
  a sample, because tops sharing one yoke still cut different openings. Four questions per pair: the neckline seam runs under the collar for
  its whole length, the two share enough cloth to be sewn together, no collar
  pixel hangs over neither cloth nor body, and the pair together leave nothing
  erased and unpainted.
- **Anchors.** Each body still meets its own table — crown, floor, shoulder
  width, neck, leg separation and centring — read from the shipped PNG's own
  alpha channel, so a photograph dropped into the slot is checked exactly as
  thoroughly as a generated one.
- **Shoulder seams.** How far each yoke stands off the body it is drawn over,
  read from the same alpha. The shoulder is the one part of a dressed figure no
  coverage zone reaches, so nothing else watches it: a seam that cuts inside the
  body shows a stripe of skin above the garment and passes every other check
  here. The stand-off is reported rather than bounded — how much ease a shoulder
  wants is a question about cloth — and cutting into the body fails.
- **The band behind the neck.** A `behindBody` piece is judged by its own rule,
  not by the front layer's. Most of it is hidden and the rest sits against the
  background above the shoulder, which "nothing may hang over neither cloth nor
  body" would reject — rightly, for a front piece. What is wrong *here* is a
  band that is not a band, so every visible pixel has to lie within 9 units of
  the neck read from the alpha: it may wrap, it may not become a cape. A collar
  that declares a stand and ships no such piece fails outright.
- **The stand.** How high each drawing actually rises above the neckline, against
  the `build.stand` its record declares. Seams, coverage and footprint all pass
  a collar wearing somebody else's neck band — the footprint is a bounding box,
  and a band swapped for a taller one barely moves it. This is what noticed that
  seven of the first nine were drawn to one height while nine were written down.
- **A flat collar stays outside the opening.** A collar that declares no stand
  may not paint above the neckline seam of any garment it is sewn to, read
  column by column against the curve. The Peter Pan used to sit up to 18 units
  inside the opening, which left a smaller round hole of its own with the neck
  through it — a ring, not a collar.
- **An open front is excused only its own opening.** A collar marked
  `front: "open"` may leave the stretch of seam that lies *between* its pieces
  bare; any other bare seam point — cloth on one side of it or none — still
  fails, so a collar that has come off its seam is still caught.
- **Silhouette.** Everything above is about where a collar's edges *meet*
  things, and a collar can satisfy all of it at any size. So the drawing's
  bounding box is measured in centimetres against the `footprint` its record
  declares; no two of a body's collars may occupy the same box, to within 1.5 cm
  on both axes; and the largest must be at least six times the area of the
  smallest. Shrink the sailor collar to a band at the neck and it is still sewn
  to every neckline it names, still covers what it claims, still hangs over
  cloth rather than space — and these three are what notice.
- **Straight edges.** No more than 45% of a collar's outline may be straight.
  Long edges are written as several curves on the same line, because a single
  curve 150 units long flattens into steps as long as a ruled line's.

Cloth around a neck is always **wider** than the bare neck, which is the rule
the turtleneck kept breaking: drawn flush to the throat it read as a panel
standing in front of it. Every band is cut the opening's own three units outside
the neck column, so there is cloth clear on both sides at every height.

It also writes `.preview/collar-<body>.png`, a contact sheet with one tile per
collar, cropped to the neck and shoulders — each over the garment cut to *that*
collar's opening, with the band behind the neck in a paler orange so whether a
collar wraps is visible rather than inferred. Not one figure with every collar
stacked on it — they overlap almost entirely, so only side by side can they be
compared. It shows silhouette alone, which is deliberate: a picture that
included the shading would let a flat shape pass on its decoration.
`.preview/collarfront-<body>.html` shows the same collars rendered, head-on.

### Fabric regions

Each garment names the areas that take their own fabric — a dress is cut from
`top` and `bottom`, a blouse from `body` plus whatever collar is sewn to it —
and each takes a fabric independently, with its own topstitch colour. Region
fill uses the same SVG
`<pattern>` path as everything else, at the fabric's real scale and the current
rotation, under a **fixed greyscale shading layer** composited with
`mix-blend-mode: multiply`. The shading belongs to the piece, not the fabric, so
swapping cloth never disturbs how the piece is lit — which is what makes a fill
read as cloth rather than as a sticker.

#### Form comes from the outline, not from a bounding box

That greyscale layer used to carry the *form* as well: a left-to-right ramp for
"this is round", a second for "this is a tube", keyed to the piece's bounding
box. A box knows nothing about a shape inside it, so a blouse's whole
three-dimensional form was five linear gradients and four straight lines, and it
looked like it.

A piece that wants form now asks for `surface` instead, and gets it from its own
silhouette. `clothSurface` blurs the piece's alpha into a height field, lights
that with `feDiffuseLighting`, lifts the result off black with an ambient floor
and multiplies it over the cloth. `clothWarp` takes the same field, differences
it against itself shifted to get a slope, and runs the weave through an
`feDisplacementMap` so a check foreshortens where the form turns away instead of
lying flat across it. Both are pure filters on geometry the garment already has:
no maps to bake, no files to ship, and nothing new to keep in step when an
outline changes.

Two things about them are load-bearing and easy to get wrong again:

- **The slope has to be measured at the blur's own scale.** The first version
  ran a 3x3 Sobel over a field blurred by sixteen units, which reads a slope of
  almost nothing: the map came out a flat 0.5 and the displacement degenerated
  to a uniform shift, invisible on a repeating weave. The offsets are now tied
  to `blur`.
- **Filters apply per piece, not per region.** A filter on a group sees the
  union of what is inside it, so lighting a region in one pass merged a body and
  its two sleeves into a single smooth slab with no arm anywhere in it —
  literally a cape. `FabricRegion` lights each piece of a region on its own,
  which gives the body a body's form, each sleeve its own tube, and a seam where
  the two meet. It has to open fragments to find the pieces — `Children.toArray`
  does not, and nearly every drawing returns one, so for a while "per piece"
  quietly meant "the union" everywhere.
- **Each piece is finished before the next begins** — cloth, outline, form — so
  a piece drawn later covers what it lies on, edges included. They used to be
  three passes over every piece, and nothing could hide an earlier piece's edge:
  a shirt collar's band showed through its own leaves as a ring.

What is left in the hand-drawn shading layer is only what an outline cannot know
it has: a hem's weight, the shadow a collar's fall throws on its own stand, a
cut edge. Several pieces now have none of that and draw no shading at all.

#### Folds are light, never print

Every fold goes through one helper, `garments/folds.tsx`. It changes how much
light the cloth catches and nothing else. A fold is painted into a region's
`shading` (multiplied, so it can only darken) and its `light` (screened, so it
can only lighten), both masked to the region. The fabric's fill is never touched,
so the print stays at its true repeat under every crease.
`garments/folds.test.tsx` renders the dress in a plaid and checks that every tile
is still the plaid's real size and that a fold layer holds nothing but flat grey
and white.

There is one primitive: a **ridge** with a width that can change along it, a
flank that catches the light (from the upper left, as `clothSurface` has it) and
a flank in shadow. Every layout is built from it:

- **`hangingFolds`** are pipe folds from a seam to a hem, narrow where the
  cloth is released and wider toward the hem.
- **`gathers`** are short tight folds where cloth is eased into a seam.
- **`dart`** is a fine seam running out to a point.
- **`contour`** is where cloth turns under a form, such as the bust.
- **`sleeveDrape`** is a sleeve hanging from the shoulder: its folds run down
  it, not across. It draws:
  - two long, soft folds that follow the sleeve's taper;
  - the shadow the body throws along its inner edge, whichever way the light
    falls (a fold's `shadowToward`);
  - at most a faint crease or two at the inner elbow;
  - a few small folds above the wrist, where a long sleeve's length collects.

  It replaced bands across the elbow, which made a sleeve that bulged there look
  worse. A sleeve's width at a row is read off its own outline (`rowSpan`).

Layouts are seeded, so a garment folds the same way on every render and on server
and client alike. The dress is the first garment on it: gathers and pipe folds
from the waist seam, a waist dart under each bust point, and the turn of the
cloth under the bust. Her bust points are read from the photograph's own shading
(`BUST` in `art/female/yoke.ts`). Those details hold on all fifteen cuts.

A sleeved top opts in through `sleevedTop`'s `folds`, which gives one cut's
body folds and sleeve folds separately. Each set is masked to its own pieces, so
a fold hanging down the body never shades the sleeve beside it. The thobe is the
first to use it. It has no waist seam, so its folds fall the whole length from
across the chest, opening toward the hem, and each sleeve hangs from his
shoulder (`sleeveDrape`).

### Front view only

No rotate, no back, no side. `asset` is `{ front }` and nothing else: the
visualizer shows one view, that view is the product, and every collar and
garment here is drawn to read straight on rather than to be explained by an
angle nobody will see. A stand collar has to *look* wrapped from the front,
which is why each one carries a band behind the neck — and why nothing that
goes round the back of the neck is ever drawn in front of it.

The type used to offer optional `back` and `side` slots. Nothing ever filled
them, and a type promising three views while one exists misleads everyone who
reads it — the cost of a second view was always the art, one drawing per
garment and per collar, never the slot. So the slots are gone.

### Home goods

Sofa, dining chair, pillow and curtain still live on the original engine
(`src/lib/products/registry.tsx`), drawn through the same
`FabricRegion` component the garments use. Clothing is not there: a garment is
worn on a body, in layers, and a curtain is not.

## Architecture

```
src/
  app/                 App Router: layout, home, /discover, /visualizer
  components/
    layout/            Navbar, Footer
    home/              Hero + every landing section
    fabric/ store/ tailor/   Domain cards
    visualizer/        FabricVisualizer (modal), MannequinStage,
                       ProductTemplate, FabricRegion (shared fill + shading)
    discover/          Search + filters
    ui/                Button, Badge, Logo, Rating, toggles, Section…
    providers/         Theme + i18n + Visualizer context
  lib/
    i18n/              Dictionaries (en/ar) + RTL-aware provider
    theme/             Theme provider + pre-paint flash guard
    fabrics/           Procedural tileable texture engine
    mannequin/         Body assets: canvas, per-body anchors + zone geometry,
                       profile.ts (measured edges + landmarks, generated)
    garments/          fit.ts (the drafting kit), sleeves.ts, necklines.ts,
                       collar.ts, outfit rules, shared shading,
                       art/<body>/ (one file per garment, yoke.ts per body)
                       art/<body>/collars/ (one file per collar)
    products/          Home-product geometry
    data/              Mock fabrics, stores, tailors, categories,
                       garments, collars, necklines, sleeves
    share/             Design → shareable PNG
    utils/             cn, price/region formatting
  types/               Domain model (Fabric, Garment, BodyAsset, Outfit…)
scripts/
  normalise-mannequin.mjs  Places a photograph onto public/mannequin/*.png
  measure-body.mjs         Reads each photograph into mannequin/profile.ts
  preview-garments.mjs     Verifies coverage, fit, eligibility, collars,
                           necklines, every sleeve, anchors and shoulder seams
```

**Design tokens** live as CSS variables in `src/app/globals.css` (light/dark) and
map to Tailwind semantic colors (`background`, `foreground`, `card`, `muted`…),
plus the static `apricot` brand scale in `tailwind.config.ts`.

**Internationalization**: all copy flows through `useI18n().t(key)`; domain data
uses `{ en, ar }` objects resolved with `pick()`. Switching locale flips
`document.dir` for genuine RTL. The production upgrade path is locale-segmented
routing (e.g. `next-intl`) — the dictionary structure is already compatible.

## Branding

The uploaded neon apricot logo lives at `public/brandLogo.png` and is featured in
the hero. For crisp, theme-adaptive UI chrome (nav, footer) it is redrawn as an
inline SVG mark (`src/components/ui/Logo.tsx`) that inherits `currentColor`.

Palette: **Apricot** `#FF6A2C` · Cream `#FBF7F0` · Charcoal `#1B1714` · warm grays.

## Roadmap (architecture is ready for these)

- **More garments and more collars** — one record and one drawing each;
  layering, coverage and compatibility already work.
- **The polo collar, rebuilt like the shirt collars.** It is the one collar
  still drawn with a band across the front of the throat.
- **Collar topstitch, done accurately** — as a true offset of each collar's own
  edge — and the sailor's braid with it. Both were removed rather than drawn
  wrong.
- **A matched pair of figures.** The two photographs are not from one set: the
  male has a sculpted face and modelled abdomen where the female is the abstract
  egg every shop mannequin wears. Both are correct bodies and neither is
  retouched, but side by side in the picker they do not read as a pair.
- **Modular garment builder** — collars, necklines and sleeves ship; cuffs,
  plackets and pockets are the same shape of problem. Sleeves on the jackets are
  the obvious next case: they are still fixed, because a tailored sleeve is what
  makes a jacket. Compatible with open-source pattern systems (e.g. FreeSewing)
  under their licenses.
- **AI Stylist** — color/palette/pairing guidance from skin tone (decision
  support, not garment generation).
- **Furniture customizer** — size/shape/arm/cushion options on the same engine.
- **Seller & Tailor dashboards** — inventory, media, QR, analytics, orders, clients.
- **Marketplace** — favorites, compare, follow, share; then payments, order
  tracking, international shipping.

## Sources

The skin tones (`src/lib/data/skinMeasurements.ts`, `skinTones.ts`) are
derived from these:

- Lu Y, Xiao K, Li C, Pointer M. *Skin Colour Does Not Define Ethnicity:
  Quantifying Variation and Overlap Across Diverse Populations.* Skin Research
  and Technology, 2026. [doi:10.1111/srt.70343](https://doi.org/10.1111/srt.70343).
  Table 2 gives mean and SD of L*, a*, b* and C* for eight groups, from the
  International Skin Spectra Archive.
- Chardon A, Cretois I, Hourseau C. *Skin colour typology and suntanning
  pathways.* International Journal of Cosmetic Science 13(4):191–208, 1991.
  [doi:10.1111/j.1467-2494.1991.tb00561.x](https://doi.org/10.1111/j.1467-2494.1991.tb00561.x).
  This defines the Individual Typology Angle and its first five classes.
- Del Bino S, Duval C, Bernerd F. *Clinical and Biological Characterization of
  Skin Pigmentation Diversity and Its Consequences on UV Impact.* International
  Journal of Molecular Sciences 19(9):2668, 2018.
  [doi:10.3390/ijms19092668](https://doi.org/10.3390/ijms19092668). It states the six
  ITA classes, with brown and dark split at −30° per Del Bino et al. 2006.
- Sharma G, Wu W, Dalal EN. *The CIEDE2000 color-difference formula:
  implementation notes, supplementary test data, and mathematical
  observations.* Color Research & Application 30(1):21–30, 2005. Its test pairs
  check `src/lib/color/cielab.ts`.

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · lucide-react.
Fabric rendering has no network dependency — patterns are generated as inline
SVG. The mannequin is a local asset in `public/`, not a remote image.
