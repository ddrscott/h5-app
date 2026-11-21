# Heart of Five: visuals and motion

The game should read like a page out of an action manga: ink black, paper white, screentone
shading, hard panel borders, and lettering that hits. Most of the time the page stays calm so the
cards are easy to read. When a big play lands, the page explodes for half a second (a burst, focus
lines, a sound effect drawn in katakana) and then gets out of the way.

The genre is borrowed; nothing else is. Every motif here is our own: ink brush strokes, speed
lines, impact bursts, screentone dots, panel borders, made-up onomatopoeia, and the 红心五 seal
(the game's own name). No characters, symbols, headbands, eyes, logos, technique names or traced
art from any real series, and none of anything that looks like them.

## Palette

| Token | Hex | Used for |
|---|---|---|
| `ink` | `#0B0B0D` | page background, panels, outlines, hard offsets |
| `gray-950 … 50` | `#0E0E10` … `#F4F4F2` | screentone: neutral grays only, no tint |
| `paper` | `#FAFAF7` | card stock, panel outlines, caption boxes, secondary buttons |
| `ember` (Signal Orange) | `#E85D00` | live state only: your turn, the active seat, selection, the primary button, the bomb burst |
| `blood` / `blood-deep` | `#D7192B` / `#8F0C18` | the one hot color: hearts and diamonds, danger and errors, the Heart 5, last place |
| `bone` / `mist` | `#EFEFEA` / `#A3A3A8` | text on ink and secondary text |

Orange means "now": if something isn't live, it isn't orange. Red means danger or the Heart 5.
Everything else is black, white or gray. There are no gradients for decoration. The few gradients
left in the code are masks (fading a screentone field or a focus-line ring) or a light under a
card, never a colored fill.

## Type

- **Bangers** (SIL OFL, self-hosted from `@fontsource/bangers`, Latin only) for everything that
  should feel hand-lettered: the title, headings, callouts, buttons, caption boxes, tabs, the
  results table numbers and the face-card letters. It has one weight, and `font-synthesis: none`
  stops the browser from faking a bold or italic of it.
- **Barlow** (SIL OFL, `@fontsource/barlow`, weights 400 to 800, Latin only) for reading: body
  text, names, form fields, counts, W·L records (with `tabular-nums`), and the card indices,
  where legibility matters more than style.
- **H5 SFX**: a 3.6 KB subset of ZCOOL QingKe HuangYou (SIL OFL) holding only the Chinese comic
  sound effects (唰 轰 隆 砰 ！). It's a Chinese game, so the onomatopoeia is Chinese, not Japanese.
  In `src/client/assets/fonts`.
- **H5 Seal**: a 2 KB subset of Noto Serif SC holding only 红心五, so the name renders on devices
  without a CJK font.
- **No terminal look.** This is a family card table, not a developer tool. Don't use a monospace
  font (the code samples in the bring-your-own-bot panel are the one exception, because they're
  code), `// SECTION_HEADS`, snake_case labels, or a `$` prompt marker anywhere in the game. This
  overrides the default visual signature from the owner's global instructions; the orange accent
  and hard-edged panels stay.
- **Copy has some nerve.** Short and direct, with a grin: "Who's in?", "Leaving already?",
  "First one out takes it all.", "STUCK WITH 3". Never cute at the cost of clear: buttons still
  say what they do (Play, Pass, Start Game, Sign in).

## Shapes

- **Panels** are cut manga panels, never level boxes. Every dialog and big surface (sign-in,
  stats, the leave and connection dialogs, the welcome form, the lobby's add-a-bot panel, the
  tutor, the landing page's panels) uses `.panel-cut`: leaning left and right edges, the top-right
  and bottom-left corners cut off, a 3px paper outline and a hard black offset in the panel's own
  shape. The bot panel is a side sheet whose open edge leans (`.panel-sheet`). Dialogs also tilt
  about 1.2 degrees, like a panel pasted on at an angle; the text stays easy to read. The plain
  `.panel` (a level box) is left for small strips such as banners and the bot strip. Corners are
  sharp; the Tailwind radius scale is clamped to 2px. Cards are the only rounded thing on screen,
  because they are physical objects.
- **Caption boxes** (`.section-head`) are ink lettering on a paper box with one slanted edge, like
  a narration box. They replace the old tiny spaced-caps labels.
- **Buttons** are slanted parallelograms (`clip-path`), flat, with a dark inset along the bottom
  edge so they read as pressable. Primary is Signal Orange, secondary is paper. A disabled button
  stays part of the page: ink with dashed paper rules and paper lettering, never gray on gray.
  The Pass and Play buttons letter at 22–24px. Square header buttons (`.icon-btn`) are ink with a
  thick paper outline.
- **Fields** are speech balloons: paper fill, ink text, a thick outline that turns orange on focus.
- **Status** is shown with content: a crown, a `PASS` stamp, a place like `1ST` in a paper tag,
  an orange outline and orange hard offset around the whole active plate, or an inverted (paper)
  row for the winner. Never a colored stripe down one side of a card.
- **Seats** are name plates with the hand held up behind them. Each opponent is one leaning ink
  plate (172px wide at scale 1, 128px on a phone, a 3px paper outline) holding the name in a
  tilted paper caption box and a record line: W·L, the personality chip for a bot (its emblem and
  name, the blurb on hover, `thinking…` on its turn), and a place tag once out. The face-down
  hand is a small fan held above the plate, outside it, its cards tucked just behind the plate's
  top edge, with the card count in a paper tag beside it. There is no portrait tile: the chip
  already says who a bot is, and initials said nothing the name doesn't. The plate stamps a hard
  offset in its own shape (drawn as a second shape behind it, not a filter), orange on its turn.
  The leader's crown sits on the plate's top-left corner, and an absent player's 30-second ring
  goes round their card count. Off a phone the name is one line, as big as fits the plate (13 to
  16px before scale), then an ellipsis.
- **Seat size comes from the free felt** (`seatLayout` in `fx/layout.ts`), not a fixed number.
  It tries scales from 2.3 down and keeps the biggest where the seats stay on screen and clear of
  each other, your hand and your status stack, the newest five-card meld draws exactly as it did
  with old-size seats (`meldFit`) and no seat covers it, and the ring keeps at least 86% of its
  old radius (the top seat may grow into the felt above the ring). A side seat that would reach
  the hand is lifted. At 1400×1000 that's 1.9 (a 336px plate, 1.5× the old fixed size), 1100×1000
  1.8, 1920×1080 2.2. Phones keep the compact plate at 1. Your own seat, under the status chip,
  is the same plate with your name and record at the old size (`myPlateScale`), since it shares
  the bottom of the screen with your hand. It goes orange on your turn. Lobby seats keep the portrait-and-plate shape for now.
- **A passed seat** stays a solid ink panel: nothing behind it shows through. Its paper and ink
  go gray (outline, caption, card backs, record) with a faint screentone over the plate,
  while the card count and the `PASS` stamp keep full strength. Never fade a panel with opacity.
- **Personality emblems** (`PersonaEmblem.tsx`) are original bold ink silhouettes: a fin cutting
  a wave (Shark), a level beam (Regular), a flame (Hothead), a hex shell (Turtle), a sprout
  (Rookie) and a plain bot head for anything else. They live on the personality chip in the
  record line and in the lobby, on a small paper tag that turns orange while that bot thinks.

## Cards

Drawn in SVG on a 5:7 box (`src/client/components/ui/CardFace.tsx`), so they're crisp at any size.
Readability comes first: rank and suit have to read at a glance, at arm's length.

- **Stock** is flat paper white with a light ink outline, like a card drawn on the page. No sheen.
- **Indices** are big Barlow ExtraBold numerals with a suit pip under them, sized for the strip of
  a card that shows in a fanned hand on a 390px phone. `10` is condensed to fit.
- **Pips** for 2–10 follow the traditional layouts. Aces get one big pip in a hairline ring.
- **Faces** (J/Q/K) are an original design: an ink-framed panel holding a big lettered J, Q or K,
  crowned with one, two or three pips.
- **Jokers** carry an ink-outlined eight-point star (ink for the small joker, red with an orange
  core for the big joker), with `JOKER` lettered down the corners.
- **The Heart 5**, the game's namesake, is the one card that looks precious: an ink double frame
  with a red inner rule, a screentone halo, one dry-brush ring in red that lifts off before it
  closes, five small ink hearts, a big red heart with a lettered 5, the red 红心五 seal stamp, and
  a slow light glint sweeping across it.
- **The back** is an ink field of screentone dots inside a paper border, with an orange impact
  burst holding five ink hearts.

## Table

A screentone page with a ring drawn on it. The page is charcoal with broad diagonal bands of
halftone dots, a dry-brush grain and a vignette (`.felt-texture` in `index.css`, all CSS and a
tiny inline SVG noise, no images). In the middle, round the pile, is the ring (`TableRing` in
`GameTable.tsx`): the round play area where every meld lands, like a mat circle inked on the
page. Inside it is flat ink, so the cards pop. Round its edge runs a band of screentone between a
thin inner rule and a heavy paper brush stroke that lifts off before it closes (the same dry brush
as the Heart 5's ring, an SVG displacement filter), with a faint gutter rule outside. The house
motto is lettered along the band in paper Bangers with an ink edge: HEART OF FIVE over the top,
红心五 · IT'S DA BOMB! under the bottom. Each arc is left out where a seat or your status chip sits
on it, or where the cards reach into the band (`tableLanes`: `mottoTop`, `mottoBottom`), and an
arc fades out while a callout is printed over it (`onCalloutBox`), so decorative lettering never
sits under a word. The ring is as big as the gap between the top seats' plates and your status
chip allows (at most 42% of the width or 300px), never smaller than the newest meld at the
readable floor is tall, and it may pass under a side seat, which draws on top. A patch of orange
screentone glides to whoever's turn it is.

The lobby table is the same idea seen from above: an eight-sided arena drawn in ink with a paper
outline and screentone on the mat, with the room code on a paper tag in the middle.

### Lanes

Text never prints on top of other text. `tableLanes()` and `placeCallout()` in
`src/client/fx/layout.ts` split the table from the bottom up:

1. **Buttons:** Pass and Play sit in a fixed bar at the bottom, so a thumb learns where they are.
2. **Hand:** the arc is lifted until its lowest corner clears the bar, and it stays inside the
   screen with rotation included. A hand that would show less than about 30px of each card wraps
   to two rows.
3. **Status stack:** one chip slot above the hand, with your nameplate under it. The chip shows
   the most urgent of a rejected play (blood red), a new leader (paper, crown), `YOUR TURN`
   (orange) or who is thinking (an ink panel with paper rules top and bottom, the name lettered
   in caps). Your character plate sits under it. Your PASS stamp lands beside
   the plate rather than on it.
4. **Pile and ring:** the pile goes midway between the top seats and the status stack when a
   five-card spread fits there. When side seats crowd that band (phones with 4 to 6 players), it
   slides to the y with the most room sideways, so a settled meld never covers a nameplate. The
   newest meld then rests between the top seat's plate and your status chip, tilt included, and
   only seats level with it limit how wide it may spread (`meldRoom`), so a seat straight above
   the pile can't squeeze it.
   **The newest meld is always readable.** `meldFit()` lays it out loosely, then fans it tighter
   until only `MIN_STRIP` (36%) of each covered card shows, which is still the whole corner rank
   and suit, and only then shrinks it. It never draws narrower than `MIN_MELD_W` (69px): the
   corner rank is 0.29 of the card's width, so that keeps the rank at `MIN_RANK_PX` (20px), easy
   to read at arm's length on a car's centre screen. Table cards smaller than that (phones) are
   drawn up to it. A meld that can't fit at the floor spills past the ring instead of shrinking.
   Older melds keep its spacing, shrink to 0.8 and 0.66 and dim. They are nudged aside only as far
   as the room allows. On wide felt (`pileFlat()`, true when a five-card meld fits beside another
   at 0.8 scale), older melds slide out level with the newest one, alternating sides, instead of
   stacking above it, and may reach past the ring. `scripts/shots-pile.mjs` screenshots
   and measures this at square, desktop, tablet and phone sizes.
5. **Callouts:** a callout gets a spot of its own, the way a scoring slot sits apart from the
   cards it scores. It never prints over a seat, the newest meld, the header or your status
   stack, although it may ride over the dimmed older melds. `placeCallout()` tries, in order, the
   band above the whole pile, the band just above the newest meld, the band between the pile and
   your status chip, and the open felt beside the meld, nearest the pile's centre line first. A
   two-word callout may stack on two lines when that keeps it bigger. Only when none of these fits
   at full size does the font step down, and it stops at a floor per level (bombs and straight
   flushes 48px, Heart 5 44px, flourishes 32px, plain melds 24px). On a screen too small even for
   that, it goes a little smaller and takes the spot that covers the least. Long words tilt less
   than 4 degrees so their ends don't swing into a neighbour, and the pop-in spring starts small
   enough that its rebound never pushes the word off screen.
   **Hang time.** Once its entrance settles (`ENTER_MS`: about 0.36s, 0.56s for the big-play
   spring), a callout stays fully readable for `hold`: 0.9s for a pair or triple, 1.2s for a
   straight, sisters or full house, 1.8s for a bomb, straight flush or the Heart 5. Then it drifts
   up and fades in 0.28s. Under reduced motion the hold is the same, the entrance and exit just
   fades. It never blocks play: when the next play lands, the old word fades out in 0.1s
   (`dismissCallout`), and that play's own callout, if it has one, takes the spot. A player going
   out waits for the current one to finish. On a phone (under 640px
   wide) a bomb, straight flush or Heart 5 callout starts from the full width and may shrink to
   28px to clear the seats. It still never lands on a plate or a card count: the finisher frame
   just before it is the big moment on a phone. The lettering's ink stroke scales with its size, so a
   smaller burst still shows its fill.

Opponents' PASS stamps land on the left of their face-down fan, above the plate, and the card
count sits to the right of the fan, so neither the name nor the count is covered. The leader's
crown sits on the plate's top-left corner, clear of the name.
Names wrap to two lines on a phone instead of being cut, and only between words: the caption's
font (12px at most, 9px at least) shrinks until the longest word fits on its line, measured with
Barlow on a canvas (`nameFontPx` in `Seat.tsx`), so "Aggressive Annie" reads "Aggressive / Annie",
never "Aggressiv / e Annie". Only a single word too long for the box even at 9px (a
20-letter name on a phone) breaks inside the word, so it wraps whole instead of being cut at the
caption's slanted edge (`nameFit` reports that case). Names wrap at the table and in the lobby. In
the lobby, where seats still have portraits, two players with the same initials get a number (A2).


## Motion rules

1. **Every action answers at once.** A press dips the card (scale 0.94) on pointer-down, before
   any network round trip. Sound and haptics fire on the same frame.
2. **Springs, not tweens,** for anything a player touches. Stiff and slightly underdamped for
   selection (it overshoots and settles); softer for re-flow.
3. **Animate transform and opacity only.** Shadows and glows are separate layers whose opacity
   changes. Particles draw on one canvas that sleeps when nothing is alive.
4. **Animation never gates input.** State updates the moment the server says so; animations play
   on top. If a new play arrives mid-flight, the old one is interrupted toward its end state.
5. **Quiet, then loud.** The manga rhythm: most frames are still, and the big moments hit hard
   and short. Callout size, burst, hang time, sound, shake and particles scale together:

   | Play | Callout | Feedback |
   |---|---|---|
   | single | none (JOKER for jokers) | land thud, a 1–2px nudge |
   | pair, triple | lettering only, paper with an ink outline | thud, a few paper flecks |
   | straight, sisters, full house | ink lettering on a paper burst with focus lines, 唰！ (shuā, a swish) | flourish, 5px shake, paper flecks |
   | bomb, straight flush | paper lettering on an orange burst, 轰！ (hōng, a boom) | full-screen impact frame, boom, 16px shake (under 0.4s), sparks and embers, vibration |
   | Heart 5 | paper lettering on a blood-red burst, 隆隆隆 (lóng, a rumble) | full-screen impact frame in red, struck bell, 12px shake, ink-and-red hearts, vibration |

   **Burst frames** (`Burst` in `Callouts.tsx`) are jagged stars stretched to the callout's own
   box, with focus lines clipped inside them and a hard ink offset. Their padding is part of
   `calloutSize()`, so `placeCallout()` keeps the whole burst clear of seats, the newest meld and
   your status stack, just as it did for the bare word.

   **The impact frame** (`ImpactFrame` in `GameTable.tsx`) is the finisher for a bomb, a straight
   flush or the Heart 5. For 0.56s the play owns the screen, and all of it bursts out of the ring.
   The page outside the ring flashes (paper, or red for the Heart 5) and tapered ink focus lines
   shoot out from the ring's edge. A wedge whose sides are rays from the ring's centre (58° either
   side of straight up or down) bursts over the bigger side, above or below the ring: Signal
   Orange for a bomb, blood red for the Heart 5, with a paper edge and a black offset. It carries
   the word in giant tilted lettering, about 58% of the screen's width (92% on a phone, where
   HEART OF FIVE stacks on two lines), cut down if the wedge is narrower where the word's inner
   edge sits. `impactFit` measures each line in Bangers and sizes the word so the tilted block,
   stroke and drop shadow included, fits that width and the band's height, so the lettering
   always lands whole inside the frame. On a phone it picks the line split whose wider line is
   narrowest. A narrower ink wedge with the sound effect (轰！ or 隆隆隆) bursts the other way.
   Both swell a little from the ring and fade. The ring stays clear the whole time, and so does
   the newest meld where it spills past the ring, so you always see the cards that did it. The
   regular callout pops in as the frame leaves rather than under it. It never takes input and
   never delays the next play.
6. **Reduced motion** (`prefers-reduced-motion`): `MotionConfig reducedMotion="user"` turns every
   transform animation into a jump, so flights become fades in place. Shake, the impact frame,
   particles, the idle sway and the glint are all off. Callouts keep their full hang time and
   just fade in and out.
7. **Say no before the tap.** The Play button runs the same rules as the server
   (`src/client/fx/rules.ts`), so a selection that can't beat the table reads like
   "Single · needs a pair" and stays dim instead of pulsing and then bouncing.

### The moments

- **Hand:** cards sit on a wide arc and re-flow with springs when it changes. Each card sways on
  its own phase. On desktop a card tilts toward the pointer in 3D, and light slides across it.
  A tap selects or clears a card when the finger or mouse comes up. A selected card lifts with an
  orange edge and underglow, and its contact shadow grows and softens. Too many cards for one row
  (a two-player game) wrap to two rows.
- **Rearranging:** press a card and slide it (a mouse past 5px, a finger sideways past 10px) to
  carry it. It straightens, grows a little and rides the pointer on a stiff spring, and the others
  spring aside to open the slot it would drop into: the one whose card looks nearest, tilt
  included, which also works across the two rows on a phone. A drag never selects or clears
  anything, and a selected card stays selected when moved. Shift+arrows move the focused card.
  Two small sort tabs (Rank, Suit) sit over the right end of the hand's top row, clear of that
  card even when it's selected; on a phone they stack into a short column beside your plate,
  under the turn banner, with the label turned on its side. The live sort is orange. Sweeping
  across cards to select several is gone: it was the same gesture as a drag.
- **Deal:** cards fly from the table center into your hand one after another, flipping face up as
  they arrive, while backs fly out to every opponent's seat, each with a flick sound.
- **Play:** cards leave from where they actually are (your hand, or the opponent's fan), lob along
  a curved path with a turn of spin (a full turn for bombs), squash on contact and rebound. The
  previous meld is shoved back and dimmed at the moment of impact. When everyone passes, the trick
  is swept toward the player who won it.
- **Pass:** two knuckle knocks on the table, the way people pass at a real one, and a lettered
  `PASS` stamp on a paper tag that thunks onto the player's card fan (beside the plate for your own).
- **Turn:** the active seat gets an orange outline, an orange hard offset and a slight lift; the
  orange screentone patch moves to it. On your turn an orange `YOUR TURN` caption springs up with
  what you need to beat, the hand gets a warm underglow, and a soft two-note chime and a short
  vibration play once. An absent player's turn shows a 30-second orange ring, the time after
  which the room plays for them.
- **Going out and winning:** going out pops confetti from the player's seat with a callout of
  their place. Game over is a results page rather than a dialog. A full-bleed slab slashes in at
  -5 degrees with the winner in giant lettering (YOU WIN! on orange, or NAME WINS! on paper) and a
  砰！ (pēng) sound effect. Under it the standings come in as cut strips that step down like panels,
  sliding in by finishing order while the win and loss counts tick up. The winner's strip is
  paper with an orange offset. Your YOU chip and a STUCK WITH N chip sit beside and under the
  name, never inside it, so a long name truncates and the chips always land whole. The stats line and the Leave and Play again buttons sit in a cut
  panel at the bottom. If you won, confetti fires from
  both sides twice and a pentatonic run blooms into a chord.

## Sound and haptics

All sound is synthesized live with the Web Audio API (`src/client/fx/sound.ts`): no audio files.
Select is a wooden tok whose pitch climbs a pentatonic scale with each card you add. Play is a
whoosh and a landing thud, and a pass is a double knock. A bomb drops a saturated low boom with a
falling roar, and the Heart 5 is an inharmonic bell. There are also deal flicks, score ticks, and
the win run. `navigator.vibrate` adds taps on selection, your turn, bombs, the Heart 5 and a win.
One button mutes both sound and vibration, and it's remembered under `storageKey('muted')`.

## Performance

Textures are CSS (dot fields, clip paths) or small inline SVG (the ring's brush filter, the noise
grain); there are no texture images or video. The fonts are Latin-only subsets: Bangers, five
Barlow weights, and two CJK subsets of a couple of KB each.

The target is a steady 60fps on a desktop and no visible hitch with the CPU slowed 4x (a car or
an older phone). What keeps it there:

- **Moving things get their own compositor layer** (`will-change: transform`): every card on the
  pile, each meld's group, the deal sprites, the turn lamp, the callout, and the finisher frame's
  pieces. A card in flight then moves without repainting the table under it. The ring is a static
  layer of its own, so its brush filter is drawn once. The whole table is promoted only while the
  screen shakes; a full-screen layer left in place costs every frame of compositing.
- **No filters or blend modes on anything that animates.** Plate offsets are a second shape
  behind the plate, not a `drop-shadow` filter. The hand's contact shadows are a gradient, not a
  blur. The hover glint's blend mode only exists while a card is hovered.
- **The frame where a meld leaves the hand is kept short.** Card faces and the back are built
  once as plain SVG elements and reused (`faceArt` in `CardFace.tsx`), pre-built during idle
  time, so mounting a played card only creates DOM nodes. A pile card mounts one motion component;
  its dimming and its flip from face down are plain CSS. Seats are memoized on what they show,
  and the finisher frame lives in its own layer component, so firing it re-renders nothing else.
- **Particles stay out of the way.** One canvas, its size cached (no layout reads in the loop),
  its backing store capped at about 1.3 megapixels, cleared only where the last frame drew, and a
  quality dial that thins bursts out when frames start running long.

`scripts/perf-frames.mjs` measures it headless: a requestAnimationFrame logger records frame
times through a single, a five-card run, a full house, a bomb and the Heart 5 in the FX lab
(each repeated, keeping the median run), at normal speed and at 4x CPU throttle
(`Emulation.setCPUThrottlingRate`), and through 20 seconds of a real game against bots. By
default it runs the headless shell, which composites in software at 120Hz and so stands in for a
weak GPU; `GPU=1` runs real Chrome with GPU compositing and vsync off, where each frame's time is
its true cost. `--trace=dir` saves a Chrome performance trace of each moment.

```bash
node scripts/perf-frames.mjs http://localhost:5173 1920x1080 both
GPU=1 node scripts/perf-frames.mjs http://localhost:5173 390x844 lab
```

## App icon

The icon is the Heart 5's centre mark on card stock: the red dry-brush ring that lifts off before
it closes, five small ink hearts, the screentone halo, and the big red heart with a lettered 5
(the 5 is drawn as a path, so it needs no font). `public/h5/icon.svg` is the full drawing, inside
the card's ink frame and red rule, and makes the 96, 180 (apple-touch), 192 and 512px PNGs; the
maskable 192 and 512 drop the frame so the mark sits inside the launcher's safe circle.
`public/h5/favicon.svg` is a cut for 16 to 32px: a thicker ring with a wider gap, a bigger heart
and 5, and no small hearts, halo or brush texture. It's the SVG favicon and makes the 16, 32 and
48px images inside `favicon.ico`. After changing either SVG, regenerate the rest:

```bash
node scripts/make-icons.mjs
```

The 红心五 seal in the header stays as it is.

## Where to look

- `/h5/animation` is the FX lab: the real table with a scripted offline game. Its buttons (and
  `window.__lab` for scripts) trigger the deal, each meld type (pair, triple, straight, full
  house, sisters, bomb, straight flush, the Heart 5), passes, the sweep, going out, an error and
  game over.
- `/h5/cards` shows every card face and the back.
- `node scripts/shots-art.mjs http://localhost:5173 out-dir [screen]` screenshots every screen
  (landing, welcome, sign-in, stats, lobby, bot panel, a real table, the FX lab moments, cards)
  at 1920×1080, 1100×1000, 1024×768, 640×640 and 390×844, headless. `NAMES=long` runs the FX lab with
  20-character names (`/h5/animation?names=long`), and every shot checks that no seat name is cut
  without an ellipsis and that the YOU chip lands whole.
- `node scripts/shots-seats.mjs http://localhost:5173 out-dir` screenshots a mid-trick FX lab
  table with bot opponents (`/h5/animation?bots=1&players=N`) at 4 players 1400×1000, 1100×1000
  and 390×844 and 6 players 1400×1000 (`SHOTS=5@1920x1080,...` for others). It prints each seat's
  plate size and name font and fails if a seat overlaps another seat, your hand or the newest meld.
- `node scripts/perf-frames.mjs http://localhost:5173 [WxH] [lab|table|both]` records frame times
  (see Performance).
