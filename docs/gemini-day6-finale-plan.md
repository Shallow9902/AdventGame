# Gemini handoff: Day 6 finale redesign

## Goal

Replace the current Day 6 finale (`code -> balance -> pulse`) with a more memorable birthday finale for AdventGame.

The new finale should feel like one cohesive "birthday mechanism" built by Groot and Venom for Sonechka, with several puzzle locks inside it. The implementation should stay inside the existing game architecture and keep the public minigame type as `finale`.

Important tone decisions:

- Main feeling: cozy birthday finale.
- Main characters: Groot and Venom.
- Difficulty: beautiful and low-stress, no timer, no fail state, no hard punishment.
- Platform priority: desktop PC. Mobile only needs a basic non-broken layout.
- Personal photos/date/initials should not be central mechanics.

## Current project context

Project path:

`C:\Users\slywater\Projects\AdventGame`

Relevant files:

- `app.js`: day configuration, story scenes, progress, wheel transition.
- `games.js`: minigames, including `FinaleGame`.
- `style.css`: minigame styles.
- `tests/game_logic.test.js`: regression tests.
- `AGENTS.md`: project history and root-cause log; update it after implementation.

Current Day 6:

- `app.js` has `dayGames[5]` with `type: "finale"`.
- `games.js` has `FinaleGame` with three small phases:
  - remember code;
  - choose left/right balance;
  - hit pulse target.
- `POSTWIN[5]` calls `unlockFinal()` and then sends the player to the wheel. Keep this behavior.

## Required design

Keep the public game type:

```js
{ type: "finale", ... }
```

Rewrite `FinaleGame` into one coherent birthday mechanism with 4 sequential puzzle locks.

### Day 6 config text

In `app.js`, update Day 6 config to approximately:

- `badge`: `Праздник`
- `desc`: `4 замка праздничного механизма`
- `title`: `Праздничный механизм`
- `instruction`: `Помоги Грутику и Веному запустить день рождения.`

Also update the Day 6 intro scene so it no longer talks about "three phases", code, balance, or impulses. It should talk about four locks of a birthday mechanism prepared by Groot and Venom.

### FinaleGame flow

Create one main arena, for example:

- `.birthday-protocol`
- `.birthday-mechanism`
- `.birthday-lock`

Track:

- `this.lockIndex` from `0` to `3`;
- `this.solvedLocks` as 4 booleans;
- per-lock local state in a simple object.

After each solved lock:

- update progress: `25%`, `50%`, `75%`, `100%`;
- visually light one sector of the central mechanism;
- show a short in-game line from Groot or Venom;
- reveal a `Следующий замок` button, except after the final lock.

After lock 4:

```js
this.complete("Праздничный механизм запущен");
```

No timer. No game over. Wrong actions only shake/highlight and show a helpful line.

## Four locks

### Lock 1: Groot sprouts

Theme: Groot grows a living path to wake the mechanism.

Mechanic:

- A 5x5 grid of large rotatable sprout/conduit tiles.
- Fixed start: Groot pot.
- Fixed target: first birthday sector.
- Player rotates tiles to connect start to target.
- Make this simpler than Day 5 circuit: one obvious route, large cells, no difficult decoy solution requirement.

Win condition:

- A connected powered route exists from start to target.

Wrong state:

- Nothing bad happens; unpowered tiles stay dim.

### Lock 2: Venom warm shadow

Theme: Venom carefully places tendrils without scaring anyone.

Mechanic:

- 4 Venom tendrils and 4 matching anchors around the mechanism.
- Player selects a tendril, then selects an anchor.
- Matching can be by symbol/silhouette, not by personal info.

Suggested pairs:

- eye -> soft shadow;
- claw -> ribbon knot;
- smile -> party spark;
- drop -> dark lamp.

Win condition:

- All 4 tendrils are connected to correct anchors.

Wrong choice:

- Shake the chosen anchor/tendril.
- Show a short line like `Веном: Аккуратнее. Это не наш узел.`
- Do not reset progress.

### Lock 3: Team rhythm

Theme: Groot and Venom must light all birthday lamps together.

Mechanic:

- 6 lamps.
- 6 switches.
- Each switch toggles 2-3 lamps.
- Goal: all lamps on.
- Add a reset button `↺ Сбросить`.

Important:

- Use a fixed solvable configuration.
- Avoid randomness here, so tests can solve it reliably.
- No move limit.

Win condition:

- All 6 lamps are on.

### Lock 4: Birthday launch wheel

Theme: final assembly before the wheel spins.

Mechanic:

- Around a small wheel or central mechanism are 6 highlighted slots.
- Player places 6 festive tokens into matching slots.
- Tokens should be about Groot/Venom/birthday, not private couple data.

Suggested tokens:

- leaf;
- Venom eye;
- candle;
- ribbon;
- spark;
- star.

Win condition:

- All 6 tokens are in correct slots.

Finish:

- Play a warm reveal animation: lights, confetti, glow from Groot and Venom.
- Call `complete("Праздничный механизм запущен")`.

## Visual direction

Use the existing dark magical style, but make the finale warmer:

- warm candle/gold highlights;
- green Groot glow;
- violet/black Venom glow;
- birthday garlands and lights;
- no giant marketing hero, no separate landing page;
- stable dimensions so UI does not jump between locks.

Add CSS in `style.css` for the new finale classes. Keep it scoped to the Day 6 arena as much as possible.

Desktop is primary. Do a basic mobile media query only so the UI is not broken.

## What to remove or replace

In `games.js`, replace old `FinaleGame` internals:

- `startEcho`
- `showFinalCode`
- `finalEchoPick`
- `startBalance`
- `nextBalance`
- `balancePick`
- `startPulse`
- `newFinalPulse`
- `finalPulseLoop`
- `finalLock`

It is fine to delete these old methods if the new finale does not use them.

Do not change:

- `Games.create('finale', ...)` contract;
- `GameBase.complete(...)`;
- Day completion/wheel flow;
- `POSTWIN[5]` final-form unlock behavior.

## Tests

Update or add tests in `tests/game_logic.test.js`.

Required coverage:

- Day 6 text no longer advertises `Три фазы`, `код`, `баланс`, or `импульс` as the active mechanic.
- `FinaleGame` exposes 4 sequential locks.
- Each lock can be solved programmatically in tests.
- Wrong choice in Venom lock does not reset solved locks or overall progress.
- Team rhythm has a deterministic reset and deterministic solution.
- After lock 4, the game calls `complete("Праздничный механизм запущен")`.
- `POSTWIN[5]` still calls `unlockFinal()`.

Run:

```bash
npm test
```

For browser verification, open:

```text
index.html?day=6&test=1
```

Check:

- no console errors;
- all 4 locks are clickable;
- the game reaches the post-win scene;
- the wheel transition still works;
- desktop layout looks polished.

## AGENTS.md update

After implementation, append a dated entry to `AGENTS.md` explaining:

- old Day 6 was too fragmented and reaction-based;
- new Day 6 is a cohesive birthday mechanism with 4 puzzle locks;
- public `finale` contract was preserved;
- tests and browser checks run.

## Prompt to give Gemini

You are working in `C:\Users\slywater\Projects\AdventGame`.

Read `AGENTS.md`, `README.md`, and `docs/gemini-day6-finale-plan.md` before editing. Follow the project rule: answer in Russian, avoid superficial fixes, preserve existing architecture, update tests, run relevant checks, and append important decisions to `AGENTS.md`.

Task: implement the Day 6 finale redesign described in `docs/gemini-day6-finale-plan.md`.

Replace the current `FinaleGame` (`code -> balance -> pulse`) with a cohesive cozy birthday mechanism made by Groot and Venom. It must keep `type: "finale"` and the existing day-completion/wheel flow, but internally it should have 4 sequential low-stress puzzle locks:

1. Groot sprouts: rotate/connect a simple 5x5 living path.
2. Venom warm shadow: match 4 tendrils to 4 anchors.
3. Team rhythm: deterministic lamp toggle puzzle with reset.
4. Birthday launch wheel: place 6 tokens into matching slots.

No timer, no fail state, no harsh reset. Wrong actions should only give visual feedback and a helpful line. Desktop PC is the primary target. Use a cozy birthday visual tone centered on Groot and Venom, with minimal personal-photo/date mechanics.

Update `app.js`, `games.js`, `style.css`, `tests/game_logic.test.js`, and `AGENTS.md` as needed. Then run `npm test`. If possible, also browser-check `index.html?day=6&test=1` and report what was verified.
