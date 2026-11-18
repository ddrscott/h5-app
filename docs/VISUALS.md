# Heart of Five: visuals and motion

The game should feel like a good evening at a real card table. Cards are physical objects with
weight, the table is lit from above, and the big moments land hard. Everything else stays quiet so
those moments have room. The look is our own: a lacquered jade table, warm card stock, cinnabar
red, brass, and Signal Orange for whatever is live right now.

## Palette

| Token | Hex | Used for |
|---|---|---|
| `ink` | `#0A1012` | page background, plates, panel fill |
| `jade-900 … 500` | `#0B201D` … `#2C6E60` | the table surface, lit center to dark edge |
| `paper` | `#F6F0E2` | card stock (warm, never pure white) |
| `cinnabar` | `#C7352C` | hearts and diamonds, the 红心五 seal, the Heart 5 |
| `card-black` | `#1C1D24` | spades and clubs |
| `brass` / `brass-light` | `#D6A54A` / `#F2CF7E` | the Heart 5 frame, the leader's crown, wins, the table inlay |
| `ember` (Signal Orange) | `#E85D00` | live state only: your turn, the active seat, selection, the primary button |
| `bone` / `mist` | `#ECE5D3` / `#8FA7A0` | text and secondary text |

The Tailwind `gray` scale is tinted toward jade, so any `gray-800` panel sits on the same surface.
Orange means "now": if something isn't live, it isn't orange. There are no blue accents and no
decorative gradients; the only gradients model light (the lamp over the table, the sheen on a card).

## Type

- **Fraunces** (variable, SOFT axis, self-hosted from `@fontsource-variable`) for display: the
  title, combo callouts, the winner's name. Black weight, soft terminals, italic for bombs.
- **JetBrains Mono** for data and labels: card indices, counts, W·L records, the room code, and
  `// SECTION_HEADS` whose slashes are orange. A `$` in orange marks the live prompt (your turn,
  the active player).
- System sans for body text and names.
- **H5 Seal**: a 2 KB subset of Noto Serif SC holding only 红心五 (`src/client/assets/fonts`),
  so the name renders on devices without a CJK font.

## Shapes

UI chrome has hard edges: 2px at most (the Tailwind radius scale is clamped). Cards are the only
rounded thing on screen, because they are physical objects. Status is shown with content, such as
a crown, a `PASS` stamp, a place like `1ST`, or an orange outline around the whole plate, and
never with a colored stripe down one side of a card.

## Cards

Drawn in SVG on a 5:7 box (`src/client/components/ui/CardFace.tsx`), so they're crisp at any size.

- **Indices** are large mono numerals with a suit pip under them, sized for the strip of a card
  that shows in a fanned hand on a 390px phone. `10` is condensed to fit.
- **Pips** for 2–10 follow the traditional layouts. Aces get one big pip in a hairline ring.
- **Faces** (J/Q/K) are an original design: a framed panel holding a big serif letter, crowned
  with one, two or three pips.
- **Jokers** carry an eight-point star: ink for the small joker, cinnabar and brass for the big
  joker, with `JOKER` set vertically in the corners.
- **The Heart 5**, the game's namesake, is the one card that looks precious: a brass double frame,
  a heart holding a 5 inside a ring of five small brass hearts, a cinnabar seal stamp reading
  红心五, and a slow foil glint sweeping across it.
- **The back** is an ink field inside a paper border, with a diagonal lattice of tiny orange
  hearts and a five-heart rosette in a brass ring at the center.

## Table

A radial lamp lights the middle of the jade table, which falls off into a vignette, under a fine
noise grain blended at low strength. A brass inlay ring marks where melds land. The house motto
sits on its top arc (HEART OF FIVE) and bottom arc (红心五 · IT'S DA BOMB), and an arc is left
out wherever a seat would sit on its letters. A second, softer lamp glides to whoever's turn it is.

### Lanes

Text never prints on top of other text. `tableLanes()` and `placeCallout()` in
`src/client/fx/layout.ts` split the felt from the bottom up:

1. **Buttons:** Pass and Play sit in a fixed bar at the bottom, so a thumb learns where they are.
2. **Hand:** the arc is lifted until its lowest corner clears the bar, and it stays inside the
   screen with rotation included. A hand that would show less than about 30px of each card wraps
   to two rows.
3. **Status stack:** one chip slot above the hand, with your nameplate under it. The chip shows
   the most urgent of a rejected play (cinnabar), a new leader (brass, crown), `$ YOUR TURN`
   (orange) or who is thinking. Your PASS stamp lands beside the plate rather than on it.
4. **Pile and ring:** the pile goes midway between the top seats and the status stack when a
   five-card spread fits there. When side seats crowd that band (phones with 4 to 6 players), it
   slides to the y with the most room sideways, so a settled meld never covers a nameplate. Wide
   melds tighten their spacing to fit that room and shrink only if they still don't, and older
   melds are nudged aside only as far as the room allows. On wide felt (`pileFlat()`, true when a
   five-card meld fits beside another at 0.8 scale), older melds slide out level with the newest
   one, alternating sides, instead of stacking above it. The ring is sized to fit around it.
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
   enough that its rebound never pushes the word off screen. A play's callout replaces the current
   one, while a player going out waits for the current one to finish.

Opponents' PASS stamps land low on their face-down fan, short of the card count, so neither the
name nor the count is covered. The active seat's `$` sits on the stats line and the leader's crown
on the avatar's inner corner, so the name keeps both of its lines and nothing pokes off screen.
Names wrap to two lines on a phone instead of being cut, at the table and in the lobby, and if two
players' initials match, the avatars get a number (A2) in both places.

## Motion rules

1. **Every action answers at once.** A press dips the card (scale 0.94) on pointer-down, before
   any network round trip. Sound and haptics fire on the same frame.
2. **Springs, not tweens,** for anything a player touches. Stiff and slightly underdamped for
   selection (it overshoots and settles); softer for re-flow.
3. **Animate transform and opacity only.** Shadows and glows are separate layers whose opacity
   changes. Particles draw on one canvas that sleeps when nothing is alive.
4. **Animation never gates input.** State updates the moment the server says so; animations play
   on top. If a new play arrives mid-flight, the old one is interrupted toward its end state.
5. **Strength sets volume.** Callout size, hang time, sound, shake and particles scale together:

   | Play | Callout | Feedback |
   |---|---|---|
   | single | none (JOKER for jokers) | land thud, a 1–2px nudge |
   | pair, triple | small, paper | thud, a few brass sparks |
   | straight, sisters, full house | medium, brass | flourish, 5px shake, spark burst |
   | bomb, straight flush | huge, orange italic | boom, 18px shake, warm flash, 150 sparks and embers, vibration |
   | Heart 5 | large, paper on cinnabar | struck bronze bell, red bloom, brass hearts, vibration |

6. **Reduced motion** (`prefers-reduced-motion`): `MotionConfig reducedMotion="user"` turns every
   transform animation into a jump, so flights become fades in place. Shake, flashes, particles,
   the idle sway, the foil and the inlay spin are all off.
7. **Say no before the tap.** The Play button runs the same rules as the server
   (`src/client/fx/rules.ts`), so a selection that can't beat the table reads like
   "Single · needs a pair" and stays dim instead of pulsing and then bouncing.

### The moments

- **Hand:** cards sit on a wide arc and re-flow with springs when it changes. Each card sways on
  its own phase. On desktop a card tilts toward the pointer in 3D, and light slides across it.
  A press selects; keep the finger or mouse down and sweep across cards to select or clear several
  in one stroke. A selected card lifts with an orange edge and underglow, and its contact shadow
  grows and softens. Too many cards for one row (a two-player game) wrap to two rows.
- **Deal:** cards fly from the table center into your hand one after another, flipping face up as
  they arrive, while backs fly out to every opponent's seat, each with a flick sound.
- **Play:** cards leave from where they actually are (your hand, or the opponent's fan), lob along
  a curved path with a turn of spin (a full turn for bombs), squash on contact and rebound. The
  previous meld is shoved back and dimmed at the moment of impact. When everyone passes, the trick
  is swept toward the player who won it.
- **Pass:** two knuckle knocks on the table, the way people pass at a real one, and a `PASS` stamp
  that thunks onto the player's card fan (beside the plate for your own).
- **Turn:** the active seat gets an orange outline, a `$` before the name and a slight lift; the
  lamp moves to it. On your turn an orange `$ YOUR TURN` chip springs up with what you need to
  beat, the hand gets a warm underglow, and a soft two-note chime and a short vibration play
  once. An absent player's turn shows a 30-second ring, the time after which the room plays for
  them.
- **Going out and winning:** going out pops confetti from the player's seat with a callout of
  their place. Game over raises a results panel whose rows slide in by finishing order while win
  and loss counts tick up. If you won, confetti fires from both sides twice and a pentatonic run
  blooms into a chord.

## Sound and haptics

All sound is synthesized live with the Web Audio API (`src/client/fx/sound.ts`): no audio files.
Select is a wooden tok whose pitch climbs a pentatonic scale with each card you add. Play is a
whoosh and a landing thud, and a pass is a double knock. A bomb drops a saturated low boom with a
falling roar, and the Heart 5 is an inharmonic bell. There are also deal flicks, score ticks, and
the win run. `navigator.vibrate` adds taps on selection, your turn, bombs, the Heart 5 and a win.
One button mutes both sound and vibration, and it's remembered under `storageKey('muted')`.

## Where to look

- `/h5/animation` is the FX lab: the real table with a scripted offline game. Its buttons (and
  `window.__lab` for scripts) trigger the deal, each meld type, a bomb, the Heart 5, passes, the
  sweep, going out, an error and game over.
- `/h5/cards` shows every card face and the back.
