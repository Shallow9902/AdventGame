const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const sandbox = {
    window: {},
    document: {
      createElement: (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, v) { if (v === undefined) v = !this.classes.has(c); if (v) this.classes.add(c); else this.classes.delete(c); },
            has(c) { return this.classes.has(c); }
          },
          style: {},
          children: [],
          setAttribute(k, v) { this[k] = v; },
          appendChild(child) { this.children.push(child); return child; },
          addEventListener() {},
          removeEventListener() {},
          querySelector(sel) {
            if (sel.startsWith('.')) {
              const cls = sel.slice(1);
              for (const child of this.children) {
                if (child.className && child.className.includes(cls)) return child;
                const found = child.querySelector && child.querySelector(sel);
                if (found) return found;
              }
            }
            return null;
          }
        };
        return el;
      },
      documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
      querySelector: () => null,
      querySelectorAll: () => []
    },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      clear() { this._data = {}; }
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math,
    Date,
    parseInt,
    isNaN
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  const giftsCode = fs.readFileSync(path.join(__dirname, '..', 'gifts.js'), 'utf8');
  const grutikCode = fs.readFileSync(path.join(__dirname, '..', 'grutik.js'), 'utf8');
  const gamesCode = fs.readFileSync(path.join(__dirname, '..', 'games.js'), 'utf8');

  vm.runInContext(giftsCode, ctx);
  vm.runInContext(grutikCode, ctx);
  vm.runInContext(gamesCode, ctx);

  return ctx;
}

test('GRUTIK_LINES: Day 2 line references blocks instead of route', () => {
  const ctx = loadContext();
  const lines = ctx.GRUTIK_LINES;
  assert.equal(typeof lines[2], 'string');
  assert.ok(!lines[2].toLowerCase().includes('маршрут'), 'Line should not mention "маршрут"');
  assert.ok(lines[2].toLowerCase().includes('блок') || lines[2].toLowerCase().includes('корн'), 'Line should mention blocks or roots');
});

test('Story and GREET: Day 1, Day 4, Day 5, Day 6 checks', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Day 1 greeting should not mention impulse
  const greet1Match = appCode.match(/var GREET = \[([\s\S]*?)\];/);
  assert.ok(greet1Match, 'GREET array should be defined in app.js');
  const greetContent = greet1Match[1];

  // Day 1
  assert.ok(!greetContent.includes('Светящееся сердце задаёт ритм'), 'Day 1 greeting should not use old pulse lore');
  assert.ok(greetContent.includes('воспоминани') || greetContent.includes('карточк'), 'Day 1 greeting should describe memory cards');

  // Day 4
  assert.ok(greetContent.includes('фотографи') || greetContent.includes('пазл'), 'Day 4 greeting should mention photo puzzle');

  // Day 5
  assert.ok(!greetContent.includes('рассудить'), 'Day 5 greeting should not have old "рассудить" leftover from split');
  assert.ok(greetContent.includes('схем'), 'Day 5 greeting should mention circuit/scheme');

  // Day 6
  assert.ok(greetContent.includes('SONECHKA'), 'Day 6 greeting should reference Protocol SONECHKA');
  assert.ok(greetContent.includes('заблокировано') || greetContent.includes('мощности мало') || greetContent.includes('защита'), 'Day 6 greeting should explain why wheel is locked');
});

test('After-gift buttons: no "Забрать подарок" in AFTERGIFT or DAY4_AFTER', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const aftergiftMatch = appCode.match(/var AFTERGIFT = \[([\s\S]*?)\];/);
  assert.ok(aftergiftMatch, 'AFTERGIFT should exist');
  assert.ok(!aftergiftMatch[1].includes('Забрать подарок'), 'AFTERGIFT must not contain "Забрать подарок" button');

  const day4AfterMatch = appCode.match(/var DAY4_AFTER = \[([\s\S]*?)\];/);
  assert.ok(day4AfterMatch, 'DAY4_AFTER should exist');
  assert.ok(!day4AfterMatch[1].includes('Забрать подарок'), 'DAY4_AFTER must not contain "Забрать подарок" button');
});

test('Stage logic: dayToStage in regular gameplay and preview mode', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Extract dayToStage function
  const dayToStageMatch = appCode.match(/function dayToStage\(d\) \{([\s\S]*?)\n  \}/);
  assert.ok(dayToStageMatch, 'dayToStage function should exist');

  const createDayToStage = (state, previewDay) => {
    const fn = new Function('state', 'window', 'd', `
      ${dayToStageMatch[0]}
      return dayToStage(d);
    `);
    return (d) => fn(state, { __previewDay: previewDay }, d);
  };

  // 1. Preview mode (clean profile, state without flags)
  const cleanState = { venomInfected: false, venomControlled: false, finalForm: false };
  assert.equal(createDayToStage(cleanState, 0)(0), 1, 'Preview 1 -> Stage 1');
  assert.equal(createDayToStage(cleanState, 1)(1), 2, 'Preview 2 -> Stage 2');
  assert.equal(createDayToStage(cleanState, 2)(2), 3, 'Preview 3 -> Stage 3');
  assert.equal(createDayToStage(cleanState, 3)(3), 5, 'Preview 4 -> Stage 5 (Venom infection)');
  assert.equal(createDayToStage(cleanState, 4)(4), 7, 'Preview 5 -> Stage 7 (Symbiote control)');
  assert.equal(createDayToStage(cleanState, 5)(5), 7, 'Preview 6 before final victory -> Stage 7');

  const wonFinalState = { venomInfected: true, venomControlled: true, finalForm: true };
  assert.equal(createDayToStage(wonFinalState, 5)(5), 8, 'Preview 6 after final victory -> Stage 8');

  // 2. Normal gameplay
  // Before victory on Day 6:
  const day6PlayingState = { venomInfected: true, venomControlled: true, finalForm: false };
  assert.equal(createDayToStage(day6PlayingState, null)(5), 7, 'Day 6 during gameplay must show Stage 7');

  // After Day 6 victory:
  const day6WonState = { venomInfected: true, venomControlled: true, finalForm: true };
  assert.equal(createDayToStage(day6WonState, null)(5), 8, 'Day 6 after victory must show Stage 8');
});

test('BlockBlastGame: Multi-colored pieces and board coloring', () => {
  const ctx = loadContext();
  const mockContainer = {
    innerHTML: '',
    appendChild() {}
  };

  const game = ctx.Games.create('blockblast', mockContainer, { lines: 4 }, () => {});

  // 1. Pieces have color between 1 and 6
  assert.equal(game.pieces.length, 3);
  game.pieces.forEach(piece => {
    assert.ok(piece.color >= 1 && piece.color <= 6, `Piece color ${piece.color} should be in [1..6]`);
  });

  // 2. Seeded board has colors
  const coloredSeeds = game.board.filter(cell => cell > 0);
  assert.ok(coloredSeeds.length > 0, 'Board should have colored seeds');
  coloredSeeds.forEach(val => {
    assert.ok(val >= 1 && val <= 6, 'Seed cell color should be in [1..6]');
  });

  // 3. Placing a piece assigns its color to the board cells
  // Clear board for a clean test
  game.board = game.board.map(() => 0);
  game.selected = 0;
  const testColor = game.pieces[0].color;
  game.place(0); // place at top-left
  const placedCells = game.board.filter(c => c === testColor);
  assert.equal(placedCells.length, game.pieces[0].shape.length, 'Placed cells must match piece color');
});

test('BlockBlastGame: Line clearing, scoring, and restart', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  const game = ctx.Games.create('blockblast', mockContainer, { lines: 4 }, () => {});

  // Fill row 0 completely except last cell
  for (let c = 0; c < 7; c++) {
    game.board[c] = 2;
  }
  // Fill last cell
  game.board[7] = 2;
  const prevLines = game.lines;
  const prevScore = game.score;

  game.clearLines();
  assert.equal(game.lines, prevLines + 1, 'Should have cleared 1 line');
  assert.equal(game.score, prevScore + 40, 'Should have awarded 40 points');
  for (let c = 0; c < 8; c++) {
    assert.equal(game.board[c], 0, `Cell ${c} in cleared row should be 0`);
  }

  // Test restart
  game.restart();
  assert.equal(game.score, 0, 'Score should be reset on restart');
  assert.equal(game.lines, 0, 'Lines should be reset on restart');
  assert.ok(game.board.some(c => c > 0), 'Board should be re-seeded on restart');
});

test('BlockBlastGame: Endless mode transition and high-score saving', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  const game = ctx.Games.create('blockblast', mockContainer, { lines: 1 }, () => {});

  game.startEndlessMode();
  assert.equal(game.endless, true, 'Game should enter endless mode');

  game.score = 500;
  if (game.score > game.bestScore) {
    game.bestScore = game.score;
    game.saveBestScore();
  }
  assert.equal(ctx.localStorage.getItem('advent_blockblast_best'), '500', 'Best score should be saved in localStorage');
});

test('lineForDay: Companion speech lines for normal and preview modes', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const lineForDayMatch = appCode.match(/function lineForDay\(d\) \{([\s\S]*?)\n  \}/);
  assert.ok(lineForDayMatch, 'lineForDay function should exist');

  const grutikLinesMatch = appCode.match(/var GRUTIK_LINES = \[([\s\S]*?)\];/);
  const GRUTIK_LINES = [
    "Сигнал едва заметен. Внутри точно что-то есть.",
    "Я есть Грутик. Начнём?",
    "Блоки готовы. Расчистим место для корней!",
    "Этот чёрный сигнал здесь раньше не появлялся.",
    "Я есть Грутик. А мы — Веном.",
    "Два голоса. Одна задача. Пока работает.",
    "Я есть Грутик. Мы всё ещё здесь."
  ];

  const createLineForDay = (state, previewDay) => {
    const fn = new Function('state', 'window', 'GRUTIK_LINES', 'd', `
      ${lineForDayMatch[0]}
      return lineForDay(d);
    `);
    return (d) => fn(state, { __previewDay: previewDay }, GRUTIK_LINES, d);
  };

  const cleanState = { venomInfected: false, venomControlled: false, finalForm: false };
  assert.equal(createLineForDay(cleanState, 3)(4), "Я есть Грутик!\n(...А МЫ — ВЕНОМ.)", 'Preview Day 4 line');
  assert.equal(createLineForDay(cleanState, 4)(5), "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)", 'Preview Day 5 line');
  assert.equal(createLineForDay(cleanState, 5)(6), "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)", 'Preview Day 6 line before final victory');

  const wonState = { venomInfected: true, venomControlled: true, finalForm: true };
  assert.equal(createLineForDay(wonState, 5)(6), "Я есть Грутик.\n(Мы всё ещё здесь.)", 'Preview Day 6 line after final victory');
});

test('Story Choice System: C() step constructor, choices in INTRO, GREET, POSTWIN, AFTERGIFT, FINAL_SCENE', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Check C() function definition
  assert.ok(appCode.includes('function C(key, prompt, options)'), 'C() constructor should be defined');

  // Check INTRO has choices
  assert.ok(appCode.includes('C("seed"'), 'INTRO should contain seed choice');
  assert.ok(appCode.includes('C("intro_react"'), 'INTRO should contain intro_react choice');

  // Check GREET has choices across multiple days
  assert.ok(appCode.includes('C("day1_react"'), 'Day 1 should have reaction choice');
  assert.ok(appCode.includes('C("day2_style"'), 'Day 2 should have style choice');
  assert.ok(appCode.includes('C("day3_drop"'), 'Day 3 should have drop choice');
  assert.ok(appCode.includes('C("day4_venom"'), 'Day 4 should have venom choice');
  assert.ok(appCode.includes('C("day5_repair"'), 'Day 5 should have repair choice');
  assert.ok(appCode.includes('C("day6_ready"'), 'Day 6 should have ready choice');

  // Check POSTWIN / AFTERGIFT / FINAL choices
  assert.ok(appCode.includes('C("venom_stay"'), 'POSTWIN Day 6 should have venom stay choice');
  assert.ok(appCode.includes('C("day1_bye"'), 'AFTERGIFT Day 1 should have goodbye choice');
  assert.ok(appCode.includes('C("final_words"'), 'FINAL_SCENE should have final words choice');
});

