const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext(random = Math.random) {
  const sandboxMath = Object.create(Math);
  sandboxMath.random = random;
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
            has(c) { return this.classes.has(c); },
            contains(c) { return this.classes.has(c); }
          },
          dataset: {},
          style: {},
          children: [],
          _innerHTML: '',
          get innerHTML() { return this._innerHTML; },
          set innerHTML(val) {
            this._innerHTML = val;
            if (!val) this.children = [];
          },
          setAttribute(k, v) { this[k] = String(v); },
          getAttribute(k) { return this[k]; },
          removeAttribute(k) { delete this[k]; },
          appendChild(child) { this.children.push(child); return child; },
          removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx >= 0) this.children.splice(idx, 1);
            return child;
          },
          remove() { this.removed = true; },
          listeners: {},
          addEventListener(ev, fn) {
            (this.listeners[ev] = this.listeners[ev] || []).push(fn);
          },
          removeEventListener() {},
          click() {
            if (this.onclick) this.onclick();
            (this.listeners['click'] || []).forEach(fn => fn());
          },
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
          },
          querySelectorAll(sel) {
            const results = [];
            const walk = (node) => {
              for (const child of node.children) {
                if (sel.startsWith('.')) {
                  const selectors = sel.split(',').map(s => s.trim());
                  for (const s of selectors) {
                    if (s.startsWith('.') && child.className && child.className.includes(s.slice(1))) {
                      results.push(child);
                      break;
                    }
                  }
                }
                if (child.children && child.children.length) walk(child);
              }
            };
            walk(this);
            return results;
          }
        };
        return el;
      },
      createElementNS: (ns, tag) => {
        return sandbox.document.createElement(tag);
      },
      documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
      getElementById: () => null,
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
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    Math: sandboxMath,
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

  // Day 3
  assert.ok(!greetContent.includes('Это пока только намёк'), 'Day 3 should not break immersion with a meta hint');
  assert.ok(greetContent.includes('Распутать звёздные нити') || greetContent.includes('Звёздные нити'), 'Day 3 story should lead naturally into the untangle puzzle');

  // Day 6
  assert.ok(greetContent.includes('SONECHKA'), 'Day 6 greeting should reference Protocol SONECHKA');
  assert.ok(greetContent.includes('заблокировано') || greetContent.includes('мощности мало') || greetContent.includes('защита'), 'Day 6 greeting should explain why wheel is locked');
  assert.ok(!appCode.includes('Три фазы. Один финальный запуск'), 'Day 6 config text should no longer advertise three phases');
  assert.ok(appCode.includes('3 праздничных этапа с фото'), 'Day 6 config should advertise 4 locks of birthday mechanism');
  assert.ok(appCode.includes('Праздничный механизм'), 'Day 6 title should be Праздничный механизм');
  assert.ok(!greetContent.includes('Три фазы'), 'Day 6 greeting must not advertise three phases');
  assert.ok(!greetContent.includes('запомни код'), 'Day 6 must not talk about code memory');
  assert.ok(!greetContent.includes('удержи баланс'), 'Day 6 must not talk about balance');
  assert.ok(!greetContent.includes('точных импульса'), 'Day 6 must not talk about pulse target');
});

test('After-gift buttons: no "Забрать подарок" and no duplicate DAY4_AFTER', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const aftergiftMatch = appCode.match(/var AFTERGIFT = \[([\s\S]*?)\];/);
  assert.ok(aftergiftMatch, 'AFTERGIFT should exist');
  assert.ok(!aftergiftMatch[1].includes('Забрать подарок'), 'AFTERGIFT must not contain "Забрать подарок" button');
  assert.ok(!appCode.includes('var DAY4_AFTER'), 'DAY4_AFTER duplicate scene must stay removed');
});

test('Day 5 ending and Day 6 story celebrate the birthday without promising a main gift', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const greet = appCode.match(/var GREET = \[([\s\S]*?)\n  \];/);
  const aftergift = appCode.match(/var AFTERGIFT = \[([\s\S]*?)\n  \];/);
  const finalScene = appCode.match(/var FINAL_SCENE = \[([\s\S]*?)\n  \];/);

  assert.ok(greet && aftergift && finalScene, 'Birthday story sections must be present');
  assert.match(aftergift[1], /завтра[^\n]*день рождения|день рождения[^\n]*завтра/i, 'Day 5 must lead into the birthday');
  assert.doesNotMatch(aftergift[1], /завтра\s*[—-]?\s*(финал|последний день)/i, 'Day 5 must not call the birthday a finale or last day');
  assert.match(greet[1], /день рождения/i, 'Day 6 must explicitly celebrate the birthday');
  assert.doesNotMatch(greet[1], /последний день нашего приключения|главн(?:ый|ого|ому)\s+(?:секрет|сюрприз|подарок)/i, 'Day 6 must not promise a main gift or call the birthday the last day');
  assert.match(greet[1], /сегодняшн(?:ий|его|ему)\s+секрет/i, 'Day 6 should refer only to today’s secret');
  assert.doesNotMatch(finalScene[1], /Всё закончено/i, 'The birthday finale must not sound like everything is over');
  assert.match(finalScene[1], /праздник[^\n]*продолжа/i, 'The final scene must say the celebration continues');
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

test('BlockBlastGame: Random board and rotated piece orientations', () => {
  const seededRandom = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const makeGame = (seed) => {
    const ctx = loadContext(seededRandom(seed));
    const game = ctx.Games.create('blockblast', { innerHTML: '', appendChild() {} }, { lines: 4 }, () => {});
    return { ctx, game };
  };

  const first = makeGame(7);
  const second = makeGame(19);
  assert.notDeepEqual(Array.from(first.game.board), Array.from(second.game.board), 'Different sessions should start with different board layouts');
  assert.ok(first.game.board.filter(Boolean).length >= 14 && first.game.board.filter(Boolean).length <= 20, 'Random board should keep a playable density');

  const corner = [[0, 0], [0, 1], [1, 1]];
  const orientations = new Set();
  for (let turns = 0; turns < 4; turns++) {
    const transformed = first.ctx.transformBlockShape(corner, turns, false);
    orientations.add(JSON.stringify(Array.from(transformed, point => Array.from(point))));
  }
  assert.equal(orientations.size, 4, 'Asymmetric pieces should support every rotated orientation');
});

test('EchoGame: Untangle constellation puzzle with real-time crossing calculation and rounds', () => {
  const ctx = loadContext();
  const relationship = ctx.SITE_CONFIG.relationship;
  assert.equal(relationship.him, 'Вадим');
  assert.equal(relationship.her, 'Сонечка');
  assert.equal(relationship.startDate, '2024-07-24');
  assert.equal(relationship.constellationCode, 'VS-240724');

  const game = ctx.Games.create('echo', { innerHTML: '', appendChild() {} }, { relationship }, () => {});
  assert.equal(game.totalRounds, 4, 'Game should have 4 progressive untangle rounds');
  assert.equal(game.round, 0, 'Should start at round 0');
  assert.equal(game.starElements.length, 7, 'Round 1 (Drift) should have 7 stars');
  assert.equal(game.lineElements.length, 10, 'Round 1 should have 10 lines');
  assert.ok(game.crossingsCount > 0, 'Round 1 should start in scrambled state with crossings');

  // Solve Round 1 (Planar)
  game.positions = ctx.UNTANGLE_ROUNDS[0].nodes.map(n => ({ x: n.x, y: n.y }));
  game.updateCrossings();
  assert.equal(game.crossingsCount, 0, 'Planar positions should have 0 crossings');
  assert.equal(game.roundSolved, true, 'Round 1 should be marked solved');
  game.clearAsync();

  // Test Round 2 (Signal from the Abyss, 8 nodes, 13 edges)
  game.startRound(1);
  assert.equal(game.round, 1);
  assert.equal(game.starElements.length, 8, 'Round 2 should have 8 stars');
  assert.equal(game.lineElements.length, 13, 'Round 2 should have 13 lines');
  assert.ok(game.crossingsCount > 0, 'Round 2 should start scrambled');

  game.positions = ctx.UNTANGLE_ROUNDS[1].nodes.map(n => ({ x: n.x, y: n.y }));
  game.updateCrossings();
  assert.equal(game.crossingsCount, 0, 'Round 2 planar positions should have 0 crossings');
  assert.equal(game.roundSolved, true, 'Round 2 should be solved');
  game.clearAsync();

  // Test Round 3 (Dark Klyntar, 9 nodes, 14 edges)
  game.startRound(2);
  assert.equal(game.round, 2);
  assert.equal(game.starElements.length, 9, 'Round 3 should have 9 stars');
  assert.equal(game.lineElements.length, 14, 'Round 3 should have 14 lines');
  assert.ok(game.crossingsCount > 0, 'Round 3 should start scrambled');

  game.positions = ctx.UNTANGLE_ROUNDS[2].nodes.map(n => ({ x: n.x, y: n.y }));
  game.updateCrossings();
  assert.equal(game.crossingsCount, 0, 'Round 3 planar positions should have 0 crossings');
  assert.equal(game.roundSolved, true, 'Round 3 should be solved');
  game.clearAsync();

  // Test Round 4 (Constellation WE / Heart, 9 nodes, 12 edges)
  game.startRound(3);
  assert.equal(game.round, 3);
  assert.equal(game.starElements.length, 9, 'Round 4 should have 9 stars');
  assert.equal(game.lineElements.length, 12, 'Round 4 should have 12 lines');
  assert.equal(game.currentData.name, 'Созвездие «МЫ»');
  assert.ok(game.crossingsCount > 0, 'Round 4 should start scrambled');

  // Verify special stars: Vadim, Sonya, 24.07
  const hasVadim = game.currentData.nodes.some(n => n.name === 'Вадим' && n.special === 'vadim');
  const hasSonya = game.currentData.nodes.some(n => n.name === 'Соня' && n.special === 'sonya');
  const hasDate = game.currentData.nodes.some(n => n.name === '24.07.24' && n.special === 'date');
  assert.ok(hasVadim, 'Should have Vadim star');
  assert.ok(hasSonya, 'Should have Sonya star');
  assert.ok(hasDate, 'Should have 24.07.24 star');

  // Solve Round 4
  game.positions = ctx.UNTANGLE_ROUNDS[3].nodes.map(n => ({ x: n.x, y: n.y }));
  game.updateCrossings();
  assert.equal(game.crossingsCount, 0, 'Round 4 heart constellation should have 0 crossings');
  assert.equal(game.roundSolved, true, 'Round 4 should trigger game completion');

  const finalCard = game.sky.children.find(child => child.className && child.className.includes('astro-final-card'));
  assert.ok(finalCard, 'Final card should be appended');
  const continueBtn = finalCard.children.find(child => child.className && child.className.includes('echo-final-btn'));
  assert.ok(continueBtn, 'Final card must have a "Продолжить ✦" button to let player inspect constellation');
  continueBtn.click();
  assert.equal(game.done, true, 'Clicking continue button must complete the game');
  game.destroy();

  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const cssCode = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.ok(appCode.includes('Звёздные нити'));
  assert.ok(appCode.includes('24.07.24'));
  assert.ok(appCode.includes('наш новый дом') || appCode.includes('хищных белых глаза'), 'Night 3 should reveal Venom eyes setting up Day 4');
  assert.ok(appCode.includes('venomLurk'), 'Night 3 should have synchronized venomLurk reveal');
  assert.ok(cssCode.includes('.fx-venom-lurk'), 'style.css should define fx-venom-lurk');
  assert.ok(cssCode.includes('.story-line.whisper'), 'style.css should define whisper text style');
  assert.ok(cssCode.includes('.untangle-line'));
  assert.ok(cssCode.includes('.untangle-star'));
  assert.ok(cssCode.includes('.untangle-cross-badge'));
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

test('BlockBlastGame: Cleared lines reveal the shared photo', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  const game = ctx.Games.create('blockblast', mockContainer, {
    lines: 4,
    photo: 'photos/blockblast.jpg'
  }, () => {});

  game.board = game.board.map(() => 0);
  for (let i = 0; i < 8; i++) {
    game.board[i] = 2;
    game.board[i * 8] = 3;
  }

  game.clearLines();
  assert.equal(game.revealed.filter(Boolean).length, 15, 'A row and column should reveal 15 unique photo fragments');
  assert.ok(game.revealed[0] && game.revealed[7] && game.revealed[56], 'Cleared row and column cells should stay revealed');

  game.renderBoard();
  assert.ok(game.blockCells[7].className.includes('photo-revealed'), 'An empty revealed cell should display its photo fragment');
  assert.ok(game.blockBoard.style['--block-photo'].includes('photos/blockblast.jpg'), 'The configured photo should be rendered as one board underlay');
  assert.ok(game.blockCells[7].style.backgroundImage.includes('photos/blockblast.jpg'), 'Only revealed cells should display photo fragments before completion');

  game.board[7] = 4;
  game.renderBoard();
  assert.ok(!game.blockCells[7].className.includes('photo-revealed'), 'A placed block should temporarily cover a revealed fragment');
  game.board[7] = 0;
  game.renderBoard();
  assert.ok(game.blockCells[7].className.includes('photo-revealed'), 'The photo fragment should return when the cell is empty again');

  for (let c = 0; c < 8; c++) game.board[c] = 5;
  game.clearLines();
  for (let c = 0; c < 8; c++) assert.equal(game.board[c], 0, 'Revealed photo state must not prevent a full row from clearing');

  game.restart();
  assert.equal(game.revealed.filter(Boolean).length, 0, 'Restart should hide all photo fragments');
  assert.ok(game.stats.innerHTML.includes('Фото: <strong>0 / 64</strong>'), 'Stats should show photo reveal progress');

  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('photo: "photos/blockblast.jpg"'), 'Day 2 should configure blockblast.jpg');
  assert.ok(appCode.includes('lines: 7, photo: "photos/blockblast.jpg"'), 'Day 2 should reveal the full photo after 7 lines');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'photos', 'blockblast.jpg')), 'The Block Blast photo should exist');

  const cssCode = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.ok(cssCode.includes('.block-shell .game-head'), 'Block Blast header should have its own wrapping layout');
  assert.ok(cssCode.includes('flex: 1 0 100%'), 'Long Block Blast stats should occupy a separate row');
  assert.ok(cssCode.includes('.block-cell.photo-revealed.drop-preview'), 'Placement preview should remain visible over revealed photo cells');
  assert.ok(cssCode.includes('background-image: none !important'), 'Placement preview should cover the photo while dragging');
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

test('BlockBlastGame: Initial goal reveals the whole photo before endless choice', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  const game = ctx.Games.create('blockblast', mockContainer, { lines: 1 }, () => {});

  game.board = game.board.map(() => 0);
  for (let c = 0; c < 7; c++) game.board[c] = 2;
  game.board[20] = 6;
  game.pieces = [
    { shape: [[0, 0]], used: false, color: 3 },
    { shape: [[0, 0]], used: false, color: 4 },
    { shape: [[0, 0]], used: false, color: 5 }
  ];
  game.selected = 0;
  game.later = fn => fn();
  game.place(7);

  assert.equal(game.revealed.filter(Boolean).length, 64, 'Reaching the first goal should reveal all photo cells');
  assert.equal(game.board[20], 6, 'Full-photo preview should preserve blocks outside the cleared line');
  assert.equal(game.photoComplete, true, 'The full-photo underlay should activate only after reaching the goal');
  assert.equal(game.wonCelebrated, true, 'Endless-mode choice should appear after the reveal');
  assert.ok(game.status.textContent.includes('Фотография открыта'), 'Status should announce the completed photo');
});

test('BlockBlastGame: No moves offers tray reroll or full restart', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  const game = ctx.Games.create('blockblast', mockContainer, { lines: 4 }, () => {});

  game.board = game.board.map(() => 2);
  game.board[63] = 0;
  game.revealed[0] = true;
  game.score = 125;
  game.lines = 2;
  game.pieces = [
    { shape: [[0, 0], [1, 0]], used: false, color: 1 },
    { shape: [[0, 0], [0, 1]], used: false, color: 2 },
    { shape: [[0, 0], [1, 0], [0, 1], [1, 1]], used: false, color: 3 }
  ];
  assert.equal(game.hasAnyMove(), false, 'Prepared board should have no move for current pieces');

  game.showNoMoves();
  assert.ok(game.noMovesOverlay, 'No-moves overlay should be shown');
  const card = game.noMovesOverlay.children[0];
  const actions = card.children.find(child => child.className.includes('block-win-actions'));
  const rerollBtn = actions.children.find(child => child.className.includes('block-reroll-btn'));
  const restartBtn = actions.children.find(child => child.className.includes('block-full-restart-btn'));
  assert.ok(rerollBtn && restartBtn, 'Overlay should offer both reset choices');

  rerollBtn.click();
  assert.equal(game.score, 125, 'Tray reroll should preserve score');
  assert.equal(game.lines, 2, 'Tray reroll should preserve cleared lines');
  assert.equal(game.revealed[0], true, 'Tray reroll should preserve revealed photo cells');
  assert.equal(game.board[0], 2, 'Tray reroll should preserve the board');
  assert.equal(game.hasAnyMove(), true, 'Replacement tray should contain an available move');

  game.showNoMoves();
  const restartCard = game.noMovesOverlay.children[0];
  const restartActions = restartCard.children.find(child => child.className.includes('block-win-actions'));
  restartActions.children.find(child => child.className.includes('block-full-restart-btn')).click();
  assert.equal(game.score, 0, 'Full restart should reset score');
  assert.equal(game.lines, 0, 'Full restart should reset lines');
  assert.equal(game.revealed.filter(Boolean).length, 0, 'Full restart should hide the photo again');
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
  assert.ok(appCode.includes('C("day3_night"'), 'Day 3 should have an after-gift choice');
  assert.ok(appCode.includes('C("day4_venom"'), 'Day 4 should have venom choice');
  assert.ok(appCode.includes('C("day5_repair"'), 'Day 5 should have repair choice');
  assert.ok(appCode.includes('C("day6_ready"'), 'Day 6 should have ready choice');

  // Check POSTWIN / AFTERGIFT / FINAL choices
  assert.ok(appCode.includes('C("venom_stay"'), 'POSTWIN Day 6 should have venom stay choice');
  assert.ok(appCode.includes('C("day1_bye"'), 'AFTERGIFT Day 1 should have goodbye choice');
  assert.ok(appCode.includes('C("final_words"'), 'FINAL_SCENE should have final words choice');
});

test('Calendar progression: 2026-09-14 is day 1 (index 0), 2026-09-19 is day 6 (index 5)', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('parseStartDate'), 'parseStartDate function should exist');

  const DAYS = 6;
  const DAY_MS = 86400000;
  const parseStartDate = (startDate) => {
    const parts = startDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const getDayIdxForDate = (dateStr, startDateStr = '2026-09-14') => {
    const base = parseStartDate(startDateStr);
    const curParts = dateStr.split('-');
    const curDate = new Date(parseInt(curParts[0], 10), parseInt(curParts[1], 10) - 1, parseInt(curParts[2], 10));
    curDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((curDate.getTime() - base) / DAY_MS);
    if (diff < 0) return 0;
    return Math.min(DAYS - 1, diff);
  };

  assert.equal(getDayIdxForDate('2026-09-14'), 0, '14 сентября -> День 1 (index 0)');
  assert.equal(getDayIdxForDate('2026-09-15'), 1, '15 сентября -> День 2 (index 1)');
  assert.equal(getDayIdxForDate('2026-09-16'), 2, '16 сентября -> День 3 (index 2)');
  assert.equal(getDayIdxForDate('2026-09-17'), 3, '17 сентября -> День 4 (index 3)');
  assert.equal(getDayIdxForDate('2026-09-18'), 4, '18 сентября -> День 5 (index 4)');
  assert.equal(getDayIdxForDate('2026-09-19'), 5, '19 сентября -> День 6 (index 5)');
  assert.equal(getDayIdxForDate('2026-09-20'), 5, '20 сентября и далее -> День 6 (cap at index 5)');
});

test('CircuitGame: procedural levels contain one long unique route and working decoy tiles', () => {
  const seededRandom = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  [3, 4, 5].forEach((size, levelIndex) => {
    const ctx = loadContext(seededRandom(100 + levelIndex));
    const level = ctx.generateCircuitLevel(size, levelIndex);
    const total = size * size;

    assert.equal(level.size, size);
    assert.equal(level.connections.length, total, 'Every cell should have a connector set');
    assert.equal(level.rotations.length, total, 'Every cell should have a starting rotation');

    const route = Array.from(level.path);
    const routeSet = new Set(route);
    assert.equal(routeSet.size, route.length, 'The generated route must never visit one cell twice');
    assert.equal(route[0], level.source, 'The route must begin at Groot');
    assert.equal(route[route.length - 1], level.target, 'The route must end at the wheel');
    assert.ok(route.length >= Math.ceil(total * 0.7), 'The route should use at least 70% of the board');
    assert.ok(route.length < total, 'Some cells must remain outside the correct route to mislead the player');
    assert.equal(level.decoys.length, total - route.length, 'Every off-route cell must be a decoy');
    assert.ok(level.connections.every(directions => directions.length > 0), 'The board must not contain empty cells');
    level.decoys.forEach(cell => assert.equal(level.connections[cell].length, 1, 'A decoy must be a rotatable dead-end wire'));

    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const cell = route[i];
      const distance = Math.abs(Math.floor(prev / size) - Math.floor(cell / size)) + Math.abs((prev % size) - (cell % size));
      assert.equal(distance, 1, 'Consecutive route cells must share an edge');
    }

    assert.notEqual(level.source, level.target, 'Source and wheel output must be different cells');
    assert.deepEqual(Array.from(level.fixed).sort((a, b) => a - b), [level.source, level.target].sort((a, b) => a - b), 'Source and wheel output must be fixed anchors');
    assert.equal(level.rotations[level.source], 0, 'Source anchor must start in its solved orientation');
    assert.equal(level.rotations[level.target], 0, 'Target anchor must start in its solved orientation');
    assert.equal(ctx.countCircuitSolutions(level, 2), 1, 'Every generated level must have exactly one valid solution');

    const directionKey = dirs => Array.from(dirs).sort().join(',');
    const rotatable = level.connections.filter((dirs, index) => routeSet.has(index) && !level.fixed.includes(index) && new Set([0, 1, 2, 3].map(turns => directionKey(dirs.map(dir => (dir + turns) % 4)))).size > 1).length;
    const wrong = level.connections.filter((dirs, index) => {
      if (!routeSet.has(index) || level.fixed.includes(index)) return false;
      const rotated = dirs.map(dir => (dir + level.rotations[index]) % 4);
      return directionKey(rotated) !== directionKey(dirs);
    }).length;
    assert.ok(wrong >= Math.ceil(rotatable * 0.7), 'At least 70% of rotatable tiles should start incorrectly');
    assert.ok(level.initialPowered <= 2, 'At most two nodes should be powered at the start');
  });

  const ctxA = loadContext(seededRandom(7));
  const ctxB = loadContext(seededRandom(19));
  assert.notDeepEqual(
    Array.from(ctxA.generateCircuitLevel(5, 2).path),
    Array.from(ctxB.generateCircuitLevel(5, 2).path),
    'Different sessions should generate different long routes'
  );
});

test('CircuitGame: start gate locks controls and three levels advance 3x3 -> 4x4 -> 5x5', () => {
  let seed = 37;
  const ctx = loadContext(() => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const game = ctx.Games.create('circuit', { innerHTML: '', appendChild() {} }, {}, () => {});

  assert.deepEqual(Array.from(game.levels, level => level.size), [3, 4, 5]);
  assert.equal(game.levelIndex, 0);
  assert.equal(game.tiles.length, 9);
  assert.equal(game.started, false);
  assert.ok(game.tiles.every(tile => tile.el.disabled), 'Circuit tiles must stay disabled behind the start overlay');
  assert.ok(game.stats.textContent.endsWith('0/7'), 'A gated circuit must display zero powered route cells before start');

  const before = game.tiles[0].rotation;
  game.rotate(0);
  assert.equal(game.tiles[0].rotation, before, 'Rotating before start must do nothing');
  assert.equal(game.moves, 0, 'Pre-start input must not increment moves');

  game.startCurrentLevel();
  assert.equal(game.started, true);
  assert.ok(game.tiles.filter((tile, index) => game.level.path.includes(index) && !game.level.fixed.includes(index)).every(tile => !tile.el.disabled), 'Starting should unlock ordinary route tiles');
  assert.ok(game.level.fixed.every(index => game.tiles[index].el.disabled), 'Source and target anchors must remain disabled after start');
  assert.ok(game.level.decoys.every(index => !game.tiles[index].el.disabled), 'Decoy cells must rotate like ordinary route tiles');
  assert.ok(game.level.decoys.every(index => game.tiles[index].correct.length === 1), 'Decoys must display real wire stubs instead of empty damage marks');

  const sourceRotation = game.tiles[game.level.source].rotation;
  game.rotate(game.level.source);
  assert.equal(game.tiles[game.level.source].rotation, sourceRotation, 'Source anchor must never rotate');
  assert.equal(game.moves, 0, 'Trying to rotate a fixed anchor must not increment moves');

  game.tiles.forEach(tile => { tile.rotation = 0; });
  game.renderTiles();
  game.updatePower();
  assert.equal(game.levelSolved, true, 'A solved generated circuit should complete the current level');
  assert.equal(game.done, false, 'Solving level 1 must not finish the whole day');

  game.advanceLevel();
  assert.equal(game.levelIndex, 1);
  assert.equal(game.tiles.length, 16);
  assert.equal(game.started, true);

  game.tiles.forEach(tile => { tile.rotation = 0; });
  game.renderTiles();
  game.updatePower();
  game.advanceLevel();
  assert.equal(game.levelIndex, 2);
  assert.equal(game.tiles.length, 25);

  game.tiles.forEach(tile => { tile.rotation = 0; });
  game.renderTiles();
  game.updatePower();
  assert.equal(game.done, true, 'Solving level 3 must finish the Day 5 challenge');
});

test('CircuitGame: Russian node counter uses correct forms', () => {
  const ctx = loadContext();
  assert.equal(ctx.formatCircuitNodeCount(1), '1 узел');
  assert.equal(ctx.formatCircuitNodeCount(2), '2 узла');
  assert.equal(ctx.formatCircuitNodeCount(5), '5 узлов');
  assert.equal(ctx.formatCircuitNodeCount(21), '21 узел');
});

test('CircuitGame: electricity flows into every physically connected dead-end branch', () => {
  const ctx = loadContext();
  const level = {
    size: 3,
    source: 0,
    sourceDir: 3,
    target: 8,
    targetDir: 2,
    fixed: [0, 8],
    path: [0, 1, 4, 5, 8],
    decoys: [2, 3, 6, 7],
    connections: [
      [3, 1], [3, 2], [2],
      [1], [0, 1], [3, 2],
      [0], [1], [0, 2]
    ]
  };
  const rotations = [0, 0, 0, 0, 3, 0, 0, 0, 0];

  const powered = ctx.circuitPoweredNetwork(level, rotations);

  assert.deepEqual(
    Object.keys(powered).map(Number).sort((a, b) => a - b),
    [0, 1, 3, 4],
    'A wrong turn must still conduct electricity into a connected decoy dead end'
  );
  assert.equal(powered[level.target], undefined, 'Lighting a decoy branch must not complete the route to the exit');
});

test('Gifts configuration: gifted book g2 is excluded, LEGO g7 is active, and Day 4 guarantees Venomized Groot', () => {
  const ctx = loadContext();
  const pool = ctx.GIFT_POOL;
  assert.equal(pool.length, 9, 'There should be 9 gifts in GIFT_POOL');

  // Verify photos and IDs
  for (let i = 0; i < 9; i++) {
    assert.equal(pool[i].id, `g${i + 1}`);
    assert.equal(pool[i].photo, `photos/${i + 1}.webp`);
  }

  // Verify currently active/inactive items
  assert.equal(pool[1].active, false, 'Gift 2 (Игра для двоих) should be inactive after it was gifted');
  assert.notEqual(pool[3].active, false, 'Gift 4 (Принцесса Ардена) should be active');
  assert.notEqual(pool[6].active, false, 'Gift 7 (LEGO Spider-Man) should be active');
  assert.equal(pool[7].active, false, 'Gift 8 (Как приручить дракона) should be inactive');

  // Verify Gift 6 is Venomized Groot with specialDay: 3
  assert.equal(pool[5].id, 'g6');
  assert.ok(pool[5].title.includes('Веномизированный Грут'), 'Gift 6 should be Venomized Groot');
  assert.equal(pool[5].specialDay, 3, 'Gift 6 should be tied to Day 4 (specialDay: 3)');

  // Test normalizeGift, pool() and remainingPool(dayIdx) logic from app.js
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('normalizeGift'), 'normalizeGift should exist in app.js');

  const normalizeGiftMatch = appCode.match(/function normalizeGift[\s\S]*?function remainingPool\(dayIdx\) \{[\s\S]*?\n  \}/);
  assert.ok(normalizeGiftMatch, 'gift helper functions should match');

  const fn = new Function('GIFT_POOL', 'state', `
    ${normalizeGiftMatch[0]}
    return { pool, remainingPool };
  `);

  const state = { given: [] };
  const helpers = fn(pool, state);

  // pool() should exclude inactive gifts 2 and 8
  const activeGifts = helpers.pool();
  assert.equal(activeGifts.length, 7, 'There should be 7 active gifts');
  assert.ok(!activeGifts.some(g => g.id === 'g2'), 'Already gifted book should not be in pool()');
  assert.ok(activeGifts.some(g => g.id === 'g7'), 'LEGO gift should be available in pool()');
  assert.ok(!activeGifts.some(g => g.id === 'g8'), 'Inactive dragon gift should not be in pool()');

  // Days 0, 1, 2 should NOT have g6 in remainingPool
  assert.ok(!helpers.remainingPool(0).some(g => g.id === 'g6'), 'Day 1 should not have g6');
  assert.ok(!helpers.remainingPool(1).some(g => g.id === 'g6'), 'Day 2 should not have g6');
  assert.ok(!helpers.remainingPool(2).some(g => g.id === 'g6'), 'Day 3 should not have g6');

  // Day 3 (Day 4: Venom) MUST have g6 in remainingPool
  const day4Rem = helpers.remainingPool(3);
  assert.ok(day4Rem.some(g => g.id === 'g6'), 'Day 4 should include g6');

  // Test pickResult logic on Day 4
  const pickResultMatch = appCode.match(/function pickResult\(pool, dayIdx\) \{([\s\S]*?)\n  \}/);
  assert.ok(pickResultMatch, 'pickResult function should exist');
  const pickResult = new Function('pool', 'dayIdx', pickResultMatch[0] + '\nreturn pickResult(pool, dayIdx);');

  const wonDay4 = pickResult(day4Rem, 3);
  assert.equal(wonDay4.id, 'g6', 'pickResult on Day 4 MUST guarantee Venomized Groot (g6)');
});

test('MemoryPairsGame gate overlay: no verbose description', () => {
  const gamesCode = fs.readFileSync(path.join(__dirname, '..', 'games.js'), 'utf8');
  assert.ok(!gamesCode.includes('На поле спрятаны 12 пар ваших фотографий'), 'Verbose description should be removed');
  assert.ok(gamesCode.includes('this.gate("Открыть воспоминания", "", function () {})'), 'Memory gate should be called with empty text');
});

test('Companion lines: All GRUTIK_LINES follow canonical Groot speech with translation', () => {
  const grutikCode = fs.readFileSync(path.join(__dirname, '..', 'grutik.js'), 'utf8');
  const match = grutikCode.match(/var GRUTIK_LINES = \[([\s\S]*?)\];/);
  assert.ok(match, 'GRUTIK_LINES should be defined in grutik.js');

  const ctx = loadContext();
  const lines = ctx.GRUTIK_LINES;
  assert.ok(lines.length >= 7, 'Should have at least 7 lines in GRUTIK_LINES');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    assert.ok(line.includes('Грутик'), `Line ${i} should have Groot voice: "${line}"`);
    assert.ok(line.includes('\n('), `Line ${i} should have translation in parenthesis: "${line}"`);
  }
});

test('Secret gifts: won gifts are blurred and classified with gift numbers', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('Секретный подарок №'), 'Modal title should display secret gift number');
  assert.ok(appCode.includes('gift-secret-badge'), 'Modal should create a secret badge');
  assert.ok(appCode.includes('modal-photo secret'), 'Photo box should have secret class for blur');
  assert.ok(appCode.includes('final-item secret'), 'Final grid should render blurred secret items');

  // Verify CSS contains blur filters
  const cssCode = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.ok(cssCode.includes('.modal-photo.secret img'), 'CSS should have .modal-photo.secret img selector');
  assert.ok(cssCode.includes('filter: blur'), 'CSS should have blur filter');
  assert.ok(cssCode.includes('.gift-secret-number'), 'CSS should style gift secret number');
});

test('grutikLine: does not say "Начнём?" when day is already completed', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('function grutikLine()'), 'grutikLine function should exist');

  const match = appCode.match(/function grutikLine\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, 'grutikLine should match regex');

  const DAYS = 6;
  const GRUTIK_LINES = [
    "Я есть Грутик...\n(Сигнал едва заметен.)",
    "Я есть Грутик.\n(Начнём?)",
    "Я есть Грутик!\n(Блоки готовы.)"
  ];
  const lineForDay = (d) => GRUTIK_LINES[d] || "line";
  const currentDayIdx = () => 0; // Day 1

  // Day 1 completed: givenDay has [0]
  const stateCompletedDay1 = {
    grootPlanted: true,
    givenDay: [0],
    won: [],
    venomInfected: false,
    finalForm: false
  };

  const getPendingSpinDay = () => null;

  const fn = new Function('state', 'window', 'DAYS', 'GRUTIK_LINES', 'lineForDay', 'currentDayIdx', 'getPendingSpinDay', `
    ${match[0]}
    return grutikLine();
  `);

  const result = fn(stateCompletedDay1, {}, DAYS, GRUTIK_LINES, lineForDay, currentDayIdx, getPendingSpinDay);
  assert.ok(!result.includes('Начнём?'), `grutikLine should not ask "Начнём?" when Day 1 is already finished, got: "${result}"`);
  assert.ok(result.includes('Буду ждать') || result.includes('справились') || result.includes('Отдыхаем'), 'Should indicate completion/waiting for tomorrow');
});

test('Sleeping Grutik: sleeping animation, particles, and pose after day completion', () => {
  const grutikCode = fs.readFileSync(path.join(__dirname, '..', 'grutik.js'), 'utf8');
  assert.ok(grutikCode.includes('function drawSleepParticles'), 'drawSleepParticles should exist in grutik.js');
  assert.ok(grutikCode.includes('function isGrutikSleeping'), 'isGrutikSleeping should exist in grutik.js');
  assert.ok(grutikCode.includes('function runGrutikSleep'), 'runGrutikSleep should exist in grutik.js');
  assert.ok(grutikCode.includes('pose.sleeping'), 'drawHead should support pose.sleeping');

  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(appCode.includes('waitGrutikCanvas'), 'waitGrutikCanvas should be referenced in app.js');

  const htmlCode = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(htmlCode.includes('waitGrutikCanvas'), 'index.html should have waitGrutikCanvas element');
});

test('Replay Minigames Hub: Elements in index.html, style.css, and app.js logic', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('id="waitReplaySection"'), 'index.html should have waitReplaySection');
  assert.ok(html.includes('id="waitGamesList"'), 'index.html should have waitGamesList');
  assert.ok(html.includes('id="finalReplaySection"'), 'index.html should have finalReplaySection');
  assert.ok(html.includes('id="finalGamesList"'), 'index.html should have finalGamesList');
  assert.ok(html.includes('id="gameTopNav"'), 'index.html should have gameTopNav');
  assert.ok(html.includes('id="gameExitBtn"'), 'index.html should have gameExitBtn');

  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.ok(css.includes('.wait-replay-section'), 'style.css should style wait-replay-section');
  assert.ok(css.includes('.replay-game-card'), 'style.css should style replay-game-card');
  assert.ok(css.includes('.btn-replay-exit'), 'style.css should style btn-replay-exit');
  assert.ok(css.includes('.game-btn-exit'), 'style.css should style game-btn-exit');
  assert.ok(css.includes('.replay-win-overlay'), 'style.css should style replay-win-overlay');

  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('function renderReplayCards'), 'app.js should define renderReplayCards');
  assert.ok(app.includes('function launchReplayGame'), 'app.js should define launchReplayGame');
  assert.ok(app.includes('function showReplayWin'), 'app.js should define showReplayWin');
  assert.ok(app.includes('function isDayCompleted'), 'app.js should define isDayCompleted');
});

test('GameBase & BlockBlast: Replay exit buttons and callbacks', () => {
  const ctx = loadContext();
  let exitCalled = false;
  const mockContainer = {
    children: [],
    innerHTML: '',
    appendChild(child) { this.children.push(child); return child; }
  };

  // 1. MemoryPairsGame with isReplay and onExit
  const game = ctx.Games.create('memory', mockContainer, {
    isReplay: true,
    onExit: () => { exitCalled = true; }
  }, () => {});

  // Find exit button in game-head
  const head = game.root.children.find(c => c.className && c.className.includes('game-head'));
  assert.ok(head, 'game-head should exist in root');
  const exitBtn = head.children.find(c => c.className && c.className.includes('game-btn-exit'));
  assert.ok(exitBtn, 'game-btn-exit button should be created in game-head');

  // Trigger exit on Memory game
  exitBtn.click();
  assert.equal(exitCalled, true, 'Clicking game-btn-exit should invoke onExit');

  // Let's test calling onExit on BlockBlast
  let blockExitCalled = false;
  const blockContainer = {
    children: [],
    innerHTML: '',
    appendChild(child) { this.children.push(child); return child; }
  };
  const blockGame = ctx.Games.create('blockblast', blockContainer, {
    isReplay: true,
    endless: true,
    onExit: () => { blockExitCalled = true; }
  }, () => {});

  assert.ok(blockGame.wheelShortcut, 'BlockBlast should have wheelShortcut button');
  assert.equal(blockGame.wheelShortcut.textContent, 'Выйти ✕');
  blockGame.wheelShortcut.click();
  assert.equal(blockExitCalled, true, 'Clicking BlockBlast wheelShortcut in replay mode should invoke onExit');
});

test('renderReplayCards: Generates correct cards for completed days', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Extract isDayCompleted and renderReplayCards functions, and dayGames array
  const dayGamesMatch = appCode.match(/var dayGames = \[([\s\S]*?)\];/);
  assert.ok(dayGamesMatch, 'dayGames should exist in app.js');

  const isDayCompletedMatch = appCode.match(/function isDayCompleted\(i\) \{([\s\S]*?)\n  \}/);
  assert.ok(isDayCompletedMatch, 'isDayCompleted should exist in app.js');

  const renderReplayCardsMatch = appCode.match(/function renderReplayCards\(containerId\) \{([\s\S]*?)\n  \}/);
  assert.ok(renderReplayCardsMatch, 'renderReplayCards should exist in app.js');

  const makeEl = (tag, cls, text) => {
    const el = {
      tagName: tag.toUpperCase(),
      className: cls || '',
      textContent: text || '',
      children: [],
      setAttribute(k, v) { this[k] = v; },
      appendChild(c) { this.children.push(c); return c; }
    };
    return el;
  };

  const testHarness = (state, previewDay, bestScore) => {
    const container = {
      children: [],
      innerHTML: '',
      appendChild(c) { this.children.push(c); return c; }
    };
    const elements = {
      testList: container
    };
    const $ = (id) => elements[id] || null;
    const localStorage = {
      getItem: (k) => k === 'advent_blockblast_best' ? bestScore : null
    };

    const fn = new Function('state', 'window', 'makeEl', '$', 'localStorage', 'SITE_CONFIG', 'launchReplayGame', `
      var dayGames = [${dayGamesMatch[1]}];
      ${isDayCompletedMatch[0]}
      ${renderReplayCardsMatch[0]}
      return renderReplayCards('testList');
    `);

    const count = fn(state, { __previewDay: previewDay }, makeEl, $, localStorage, {}, () => {});
    return { count, container };
  };

  // Case 1: Only Day 1 completed (givenDay: [0])
  const res1 = testHarness({ givenDay: [0], won: [0] }, null, null);
  assert.equal(res1.count, 1, 'Should render 1 card when only Day 1 is done');
  assert.equal(res1.container.children.length, 1);
  assert.equal(res1.container.children[0]['data-day'], '0');

  // Case 2: Days 1 and 2 completed (givenDay: [0, 1]), with best score 450
  const res2 = testHarness({ givenDay: [0, 1], won: [0, 1] }, null, '450');
  assert.equal(res2.count, 2, 'Should render 2 cards when Days 1 and 2 are done');
  const day2Card = res2.container.children[1];
  assert.equal(day2Card['data-day'], '1');

  // Case 3: All 6 days completed (givenDay: [0, 1, 2, 3, 4, 5])
  const res6 = testHarness({ givenDay: [0, 1, 2, 3, 4, 5], won: [0, 1, 2, 3, 4, 5] }, null, '1200');
  assert.equal(res6.count, 6, 'Should render 6 cards when all days are done');

  // Case 4: Nothing completed yet (givenDay: [], won: [])
  const res0 = testHarness({ givenDay: [], won: [] }, null, null);
  assert.equal(res0.count, 0, 'Should render 0 cards before any day is finished');
});

test('Sleeping Grutik detection: grutik.js and app.js integration', () => {
  const grutikCode = fs.readFileSync(path.join(__dirname, '..', 'grutik.js'), 'utf8');
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Verify app.js exposes __isGrutikSleeping and __appState
  assert.ok(appCode.includes('window.__isGrutikSleeping = isSleeping'), 'app.js should bind __isGrutikSleeping');
  assert.ok(appCode.includes('window.__appState = state'), 'app.js should bind __appState');
  assert.ok(grutikCode.includes('window.__isGrutikSleeping'), 'grutik.js should check window.__isGrutikSleeping');

  // Run in VM with mock DOM
  const ctx = loadContext();
  let drawnCanvases = [];
  ctx.drawGrutik = (canvas, stage, pose) => {
    drawnCanvases.push({ canvas, stage, pose });
  };

  // Test isGrutikSleeping logic
  ctx.window.__isGrutikSleeping = () => true;
  assert.equal(ctx.isGrutikSleeping(), true, 'isGrutikSleeping should return true when __isGrutikSleeping is true');

  ctx.window.__isGrutikSleeping = () => false;
  assert.equal(ctx.isGrutikSleeping(), false, 'isGrutikSleeping should return false when __isGrutikSleeping is false');

  // Test wait screen active fallback
  const mockScreenWait = {
    classList: {
      has(c) { return c === 'active'; },
      contains(c) { return c === 'active'; }
    }
  };
  ctx.document.getElementById = (id) => id === 'screenWait' ? mockScreenWait : null;
  delete ctx.window.__isGrutikSleeping;
  assert.equal(ctx.isGrutikSleeping(), true, 'isGrutikSleeping should detect active screenWait');

  // Test runGrutikSleep draws to both companion and waitCanvas with sleeping: true
  const mockCompanionCanvas = { width: 280, height: 240 };
  const mockWaitCanvas = { width: 380, height: 330 };
  ctx.startGrutikIdle(mockCompanionCanvas, () => 1);
  ctx.cancelAnimationFrame(ctx.grutikSleepRaf);
  ctx.window.__waitCanvas = mockWaitCanvas;
  ctx.window.__forceSleeping = true;
  drawnCanvases = [];

  ctx.runGrutikSleep(1000);
  assert.ok(drawnCanvases.length >= 2, 'runGrutikSleep should draw to both companion and waitCanvas');
  assert.equal(drawnCanvases[0].canvas, mockCompanionCanvas, 'First canvas should be companion');
  assert.equal(drawnCanvases[0].pose.sleeping, true, 'Companion should be drawn with sleeping: true');
  assert.equal(drawnCanvases[1].canvas, mockWaitCanvas, 'Second canvas should be waitCanvas');
  ctx.window.__forceSleeping = false;
  ctx.stopGrutikIdle();
});

test('Full-day simulation: ?day=N parameter sets simulated day and allows full storyline experience', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  // Verify forceDayIndex handles ?day=
  assert.ok(appCode.includes('q.has("day")'), 'app.js forceDayIndex should check for ?day= parameter');
  assert.ok(appCode.includes('window.__simulatedDay'), 'app.js should bind window.__simulatedDay');

  // Test simulated day logic
  const forceDayIndexMatch = appCode.match(/function forceDayIndex\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(forceDayIndexMatch, 'forceDayIndex function should exist');

  const DAYS = 6;
  const state = {
    started: false,
    introSeen: false,
    grootPlanted: false,
    venomInfected: false,
    venomControlled: false,
    speechSeen: [1],
    won: [1],
    givenDay: [1]
  };
  const windowObj = {};
  const save = () => {};

  const simulateDay = (search) => {
    const fn = new Function('state', 'window', 'DAYS', 'save', 'location', `
      ${forceDayIndexMatch[0]}
      forceDayIndex();
    `);
    fn(state, windowObj, DAYS, save, { search });
  };

  // Simulate Day 2 (?day=2)
  simulateDay('?day=2');
  assert.equal(windowObj.__simulatedDay, 1, 'Day 2 should map to simulated index 1');
  assert.equal(state.introSeen, true, 'Intro should be marked seen for Day 2 simulation');
  assert.equal(state.grootPlanted, true, 'Groot should be marked planted for Day 2 simulation');
  assert.ok(!state.speechSeen.includes(1), 'Day 2 greeting should be reset to allow viewing the full story');
  assert.ok(!state.won.includes(1), 'Day 2 won status should be reset to allow playing the full day');
  assert.ok(!state.givenDay.includes(1), 'Day 2 givenDay should be reset to allow winning the gift and spinning the wheel');

  // Simulate Day 4 (?day=4): checks Venom infection
  simulateDay('?day=4');
  assert.equal(windowObj.__simulatedDay, 3, 'Day 4 should map to simulated index 3');
  assert.equal(state.venomInfected, true, 'Day 4 should activate Venom infection');

  // Simulate Day 5 (?day=5): checks symbiote control
  simulateDay('?day=5');
  assert.equal(windowObj.__simulatedDay, 4, 'Day 5 should map to simulated index 4');
  assert.equal(state.venomControlled, true, 'Day 5 should activate symbiote control');
});

test('Skip Minigame in Test Mode: Elements, logic, and fast transition to dialogs', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const gamesCode = fs.readFileSync(path.join(__dirname, '..', 'games.js'), 'utf8');

  // 1. UI Elements exist
  assert.ok(html.includes('id="gameSkipBtn"'), 'index.html must have #gameSkipBtn in gameTopNav');
  assert.ok(css.includes('.btn-skip-game'), 'style.css must have .btn-skip-game styles');
  assert.ok(css.includes('.game-btn-skip'), 'style.css must have .game-btn-skip styles');

  // 2. Logic exists in app.js
  assert.ok(appCode.includes('function isTestMode()'), 'app.js must define isTestMode');
  assert.ok(appCode.includes('function skipCurrentGame()'), 'app.js must define skipCurrentGame');
  assert.ok(appCode.includes('window.skipCurrentGame = skipCurrentGame'), 'app.js should export skipCurrentGame on window');
  assert.ok(appCode.includes('window.skipGame = skipCurrentGame'), 'app.js should export skipGame on window');

  // 3. GameBase renders skip button in test mode
  assert.ok(gamesCode.includes('game-btn-skip'), 'GameBase should render game-btn-skip in test mode');

  // 4. Test GameBase skip button behavior
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild() {} };
  let winCalled = false;
  const game = ctx.Games.create('memory', mockContainer, { isTest: true }, () => {
    winCalled = true;
  });

  // Verify skip button element created in head
  const head = game.root.children.find(c => c.tagName === 'header' || (c.className && c.className.includes('game-head')));
  assert.ok(head, 'Game shell should have a header');
  const skipBtn = head.children.find(c => c.className && c.className.includes('game-btn-skip'));
  assert.ok(skipBtn, 'Header should contain the skip button when isTest is true');

  // Click skip button
  skipBtn.click();
  assert.equal(game.done, true, 'Skipping should set game.done to true');

  // 5. Test skipCurrentGame function logic
  const isTestModeMatch = appCode.match(/function isTestMode\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(isTestModeMatch, 'isTestMode function definition should be matched');
  const checkTestMode = (search, hostname) => {
    const fn = new Function('location', 'localStorage', 'window', `
      ${isTestModeMatch[0]}
      return isTestMode();
    `);
    return fn({ search, hostname: hostname || 'example.com', protocol: 'https:' }, { getItem() { return null; } }, {});
  };

  assert.equal(checkTestMode('?test=1'), true, '?test=1 should activate test mode');
  assert.equal(checkTestMode('?debug=1'), true, '?debug=1 should activate test mode');
  assert.equal(checkTestMode('?skip=1'), true, '?skip=1 should activate test mode');
  assert.equal(checkTestMode('?day=3'), true, '?day=3 should activate test mode');
  assert.equal(checkTestMode('?preview=3'), true, '?preview=3 should activate test mode');
  assert.equal(checkTestMode('', 'localhost'), true, 'localhost should activate test mode');
  assert.equal(checkTestMode(''), false, 'Standard production without params should not be test mode');

  game.destroy();
});

test('Day 4 Protocol MY: story, secrecy, config, and preview stage contract', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.ok(appCode.includes('Грутик, смотри на меня. Ты здесь'), 'Day 4 must let Sonechka ground Groot');
  assert.ok(appCode.includes('Веном, разожми щупальце. Сейчас'), 'Day 4 must let Sonechka set a boundary with Venom');
  assert.ok(appCode.includes('Вы вчера сказали: «мы»'), 'Venom must connect Day 4 to the constellation from Day 3');
  assert.ok(appCode.includes('Собрать нашу фотографию'), 'Day 4 must launch the photo puzzle challenge');
  assert.ok(appCode.includes('C("day4_after"'), 'Day 4 must have a post-gift choice');
  assert.ok(appCode.includes('боевые конусы'), 'Post-gift scene must use the party-hat visual joke');
  assert.ok(!appCode.includes('фигурку Веномизированного Грута'), 'Day 4 dialogue must not reveal secret gift g6');
  assert.ok(!appCode.includes('var DAY4_AFTER'), 'Dead duplicate DAY4_AFTER scene must be removed');

  const postWinStart = appCode.indexOf('var POSTWIN =');
  const postWinEnd = appCode.indexOf('function controlVenom()', postWinStart);
  const postWinCode = appCode.slice(postWinStart, postWinEnd);
  const day4FirstLine = postWinCode.indexOf('L("nar", "Последний кусочек');
  const day4PostWinStart = postWinCode.lastIndexOf('S(5)', day4FirstLine);
  const day4PostWinEnd = postWinCode.indexOf('B("Крутить колесо")', day4FirstLine);
  const day4PostWin = postWinCode.slice(day4PostWinStart, day4PostWinEnd);
  const consentIndex = day4PostWin.indexOf('Теперь можно!');
  const controlIndex = day4PostWin.indexOf('FN(controlVenom)');
  const controlledStageIndex = day4PostWin.indexOf('S(6)', consentIndex);
  assert.ok(day4PostWin.includes('S(5)'), 'Day 4 post-win scene must stay at infected stage before consent');
  assert.ok(consentIndex >= 0, 'Groot must explicitly consent before Venom is controlled');
  assert.ok(controlIndex > consentIndex, 'controlVenom() must run only after Groot consents');
  assert.ok(controlledStageIndex > controlIndex, 'Stage 6 must appear only after controlVenom()');

  const day4Config = appCode.match(/\{ type: "photoPuzzle"[^\n]+\}/);
  assert.ok(day4Config, 'Day 4 photoPuzzle config must exist');
  assert.ok(day4Config[0].includes('rows: 4'), 'Day 4 must use four portrait rows');
  assert.ok(day4Config[0].includes('cols: 3'), 'Day 4 must use three portrait columns');
  assert.ok(day4Config[0].includes('photos: SITE_CONFIG.day4Photos'), 'Day 4 must pass the full memory deck into the puzzle');
  assert.ok(day4Config[0].includes('relationship: SITE_CONFIG.relationship'), 'Day 4 must receive relationship metadata');

  const dayToStageMatch = appCode.match(/function dayToStage\(d\) \{([\s\S]*?)\n  \}/);
  assert.ok(dayToStageMatch, 'dayToStage must exist');
  const stageFor = (state) => new Function('state', 'window', 'd', `
    ${dayToStageMatch[0]}
    return dayToStage(d);
  `)(state, { __previewDay: 3 }, 3);
  assert.equal(stageFor({ venomControlled: false, finalForm: false }), 5, 'Preview Day 4 starts infected');
  assert.equal(stageFor({ venomControlled: true, finalForm: false }), 6, 'Preview Day 4 stays controlled after victory');
});

test('Day 4: captive sprite, readable symbiote forms, and 3 sequential photo puzzles', () => {
  const ctx = loadContext();
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const cssCode = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const expectedPhotos = [
    'photos/couple.webp',
    'photos/photo_2026-02-27_21-48-28.jpg',
    'photos/photo_2026-03-08_00-22-53.jpg'
  ];

  assert.equal(ctx.getGrutikStage(4.5).venomMode, 'captive', 'Capture scene needs its own suspended sprite');
  assert.equal(ctx.getGrutikStage(5).venomMode, 'conflict', 'Infection must keep Groot visible while Venom struggles for control');
  assert.equal(ctx.getGrutikStage(6).venomMode, 'alliance', 'Consent must switch to a calm, readable shared silhouette');

  const day4FirstLine = appCode.indexOf('L("sonechka", "Грутик?.. Почему ты на потолке?")');
  const day4SceneStart = appCode.lastIndexOf('S(4.5)', day4FirstLine);
  const infectIndex = appCode.indexOf('FN(infect)', day4SceneStart);
  const captiveStageIndex = appCode.indexOf('S(4.5)', day4SceneStart);
  const infectedStageIndex = appCode.indexOf('S(5)', infectIndex);
  assert.ok(day4FirstLine > captiveStageIndex && captiveStageIndex < infectIndex, 'Suspended sprite must be visible before infection');
  assert.ok(infectedStageIndex > infectIndex, 'Conflict sprite must appear only after infect()');

  assert.deepEqual(Array.from(ctx.SITE_CONFIG.day4Photos), expectedPhotos, 'Day 4 must expose all three shared memories');
  expectedPhotos.forEach(photo => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', photo)), `Missing Day 4 photo asset: ${photo}`);
  });

  const container = ctx.document.createElement('div');
  const game = ctx.Games.create('photoPuzzle', container, {
    photos: ctx.SITE_CONFIG.day4Photos,
    rows: 4,
    cols: 3
  }, () => {});
  assert.deepEqual(Array.from(game.photos), expectedPhotos, 'Photo puzzle must retain the configured memory deck');
  assert.equal(game.image, expectedPhotos[0], 'The party portrait remains the assembled puzzle image');
  assert.equal(game.unlockedPhotoCount(), 1, 'Only the first puzzle is unlocked initially');

  // Start puzzle 1 (photo 0)
  game.startPhotoPuzzle(0);
  assert.equal(game.currentPhotoIndex, 0);
  assert.equal(game.slotsBar.children.length, 3, 'Should show 3 photo slots');
  assert.ok(game.slotsBar.children[0].classList.contains('active'), 'Slot 1 should be active');
  assert.ok(game.slotsBar.children[1].classList.contains('locked'), 'Slot 2 should be locked and hidden');
  assert.ok(game.slotsBar.children[2].classList.contains('locked'), 'Slot 3 should be locked and hidden');

  // Starting puzzle 2 (photo 1) unlocks photo 2 while photo 3 remains locked
  game.startPhotoPuzzle(1);
  assert.equal(game.currentPhotoIndex, 1);
  assert.equal(game.image, expectedPhotos[1]);
  assert.equal(game.unlockedPhotoCount(), 2);
  assert.ok(game.slotsBar.children[1].classList.contains('active'), 'Slot 2 should be active');
  assert.ok(game.slotsBar.children[2].classList.contains('locked'), 'Slot 3 must remain locked');

  // Starting puzzle 3 (photo 2) unlocks photo 3
  game.startPhotoPuzzle(2);
  assert.equal(game.currentPhotoIndex, 2);
  assert.equal(game.image, expectedPhotos[2]);
  assert.equal(game.unlockedPhotoCount(), 3);
  assert.ok(game.slotsBar.children[2].classList.contains('active'), 'Slot 3 should be active');

  assert.ok(cssCode.includes('.protocol-puzzle-slots'), 'CSS must include puzzle slots style');
  assert.ok(cssCode.includes('.puzzle-slot.locked'), 'CSS must style locked puzzle slots');
});

test('PhotoPuzzleGame Day 4: rectangular pieces, 3 sequential puzzles, choice to proceed or solve next', () => {
  const ctx = loadContext();
  const proto = ctx.PhotoPuzzleGame.prototype;

  assert.equal(ctx.photoPieceEdges.length, 4, 'photoPieceEdges must accept index, rows, cols, and edge storage');
  const edges = [];
  for (let i = 0; i < 12; i++) ctx.photoPieceEdges(i, 4, 3, edges);
  assert.equal(edges[0].top, 0);
  assert.equal(edges[0].left, 0);
  assert.equal(edges[2].right, 0);
  assert.equal(edges[11].right, 0);
  assert.equal(edges[11].bottom, 0);

  const container = ctx.document.createElement('div');
  let completedMsg = null;
  const game = ctx.Games.create('photoPuzzle', container, {
    photos: ctx.SITE_CONFIG.day4Photos,
    rows: 4,
    cols: 3
  }, (msg) => { completedMsg = msg; });

  game.startPhotoPuzzle(0);
  assert.equal(game.currentPhotoIndex, 0);

  // Check spacious board geometry and assembly frame
  assert.equal(game.unitX, 16, 'Pieces must occupy only 16% width so board is spacious');
  assert.equal(game.unitY, 16, 'Pieces must occupy only 16% height');
  assert.ok(game.assemblyFrame, 'Assembly frame must exist inside photoBoard');

  // Check random scatter
  assert.equal(game.pieceStates.length, 12);
  const distinctX = new Set(game.pieceStates.map(p => p.x));
  assert.ok(distinctX.size > 3, 'Pieces should spawn with random x coordinates rather than rigid 3 columns');

  // Check lift pieces button exists
  assert.ok(game.liftPiecesButton, 'liftPiecesButton must be created');
  assert.equal(game.liftPiecesButton.textContent, '⬆ Несобранные детали наверх');

  // Test lifting and rescuing unassembled pieces trapped under main cluster
  game.joinPhotoPair(0, 1, true); // Pieces 0 and 1 joined into group of 2
  game.pieceStates[2].x = game.pieceStates[0].x;
  game.pieceStates[2].y = game.pieceStates[0].y;
  game.liftPiecesButton.click();
  assert.equal(game.pieces[0].classList.contains('lifted'), false, 'Joined piece 0 should not be lifted');
  assert.equal(game.pieces[2].classList.contains('lifted'), true, 'Unassembled piece 2 must be lifted to top layer');
  assert.notEqual(game.pieceStates[2].x, game.pieceStates[0].x, 'Trapped piece 2 must be rescued and moved out of the assembled cluster');

  // Complete puzzle 0
  game.onPuzzleSolved();
  assert.equal(game.solvedPhotos[0], true, 'Puzzle 0 must be marked solved');
  assert.equal(game.stats.textContent, 'СОБРАНО: 1/3');

  // Check completion card offers choice to continue or do next puzzle
  const continueBtn = game.stage.querySelector('.protocol-continue');
  const nextBtn = game.stage.querySelector('.protocol-next-puzzle');
  assert.ok(continueBtn, 'Completion card must offer continue to wheel button');
  assert.ok(nextBtn, 'Completion card must offer button to start puzzle 2');

  // Start puzzle 1
  game.startPhotoPuzzle(1);
  assert.equal(game.currentPhotoIndex, 1);
  game.onPuzzleSolved();
  assert.equal(game.solvedPhotos[1], true, 'Puzzle 1 must be marked solved');
  assert.equal(game.stats.textContent, 'СОБРАНО: 2/3');

  const nextBtn2 = game.stage.querySelector('.protocol-next-puzzle');
  assert.ok(nextBtn2, 'Completion card must offer button to start puzzle 3');

  // Start puzzle 2
  game.startPhotoPuzzle(2);
  assert.equal(game.currentPhotoIndex, 2);
  game.onPuzzleSolved();
  assert.equal(game.solvedPhotos[2], true, 'Puzzle 2 must be marked solved');
  assert.equal(game.stats.textContent, 'СОБРАНО: 3/3');

  // After puzzle 3, no more next puzzle button, only final continue
  const finalNextBtn = game.stage.querySelector('.protocol-next-puzzle');
  assert.equal(finalNextBtn, null, 'No next puzzle button after puzzle 3');
  const finalContinueBtn = game.stage.querySelector('.protocol-continue');
  assert.ok(finalContinueBtn, 'Final completion card offers continue to wheel');

  finalContinueBtn.click();
  assert.equal(game.done, true);
});

test('Day 4 Protocol MY: visual states, explicit finale, and reduced motion', () => {
  const gamesCode = fs.readFileSync(path.join(__dirname, '..', 'games.js'), 'utf8');
  const cssCode = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

  assert.ok(gamesCode.includes('Продолжить к колесу ✦'), 'Final photo must wait for an explicit continue button');
  assert.ok(!gamesCode.includes('self.complete("Фотография собрана")'), 'Assembled photo must not auto-complete on a timer');
  assert.ok(gamesCode.includes('⬆ Несобранные детали наверх'), 'Control to lift unassembled pieces to top layer must exist');
  assert.ok(!gamesCode.includes('controls.appendChild(this.grootHintButton)'), 'Old hint buttons must be removed from puzzle controls');
  assert.ok(!gamesCode.includes('controls.appendChild(this.venomAssistButton)'), 'Old venom assist button must be removed from puzzle controls');
  assert.ok(!gamesCode.includes('controls.appendChild(this.previewButton)'), 'Old preview button must be removed from puzzle controls');
  assert.ok(!gamesCode.includes('controls.appendChild(this.resetLayoutButton)'), 'Old reset layout button must be removed from puzzle controls');
  assert.ok(cssCode.includes('.protocol-lift-btn'), 'Button to lift unassembled pieces must be styled');
  assert.ok(cssCode.includes('.photo-piece.lifted'), 'Lifted pieces must receive higher z-index in CSS');

  [
    '.protocol-release-board',
    '.protocol-tendril',
    '.protocol-containment-node',
    '.protocol-photo-workspace',
    '.protocol-living-frame',
    '.protocol-weave-node',
    '.protocol-final-card'
  ].forEach(selector => assert.ok(cssCode.includes(selector), `Missing Day 4 style ${selector}`));
  assert.ok(cssCode.includes('prefers-reduced-motion: reduce'), 'Day 4 animation must respect reduced motion');
  assert.ok(cssCode.includes('.protocol-my-arena'), 'Reduced-motion rules must target the Day 4 arena');
  assert.ok(gamesCode.includes('protocol-my-shell'), 'Day 4 game shell must expose a scoped mobile-layout hook');
  assert.ok(cssCode.includes('.protocol-my-shell .game-meta'), 'Day 4 mobile header must reserve a full row for its title');
  const nodePulse = cssCode.match(/@keyframes protocolNodePulse\s*\{([\s\S]*?)\n\}/);
  assert.ok(nodePulse, 'Containment nodes must have a pulse animation');
  assert.ok(!nodePulse[1].includes('transform'), 'Clickable nodes must not animate geometry or become unstable during interaction');
});

test('PhotoPuzzleGame Protocol MY: hint, multi-join Venom charge, and bounds recovery', () => {
  const ctx = loadContext();
  const proto = ctx.PhotoPuzzleGame.prototype;
  const game = Object.create(proto);
  game.rows = 4;
  game.cols = 3;
  game.unitX = 28;
  game.unitY = 21;
  game.manualConnections = 0;
  game.nextVenomChargeAt = 3;
  game.venomCharges = 0;
  game.dialogueSeen = {};
  game.pieceStates = Array.from({ length: 12 }, (_, index) => ({
    x: 5 + (index % 3) * 31,
    y: 4 + Math.floor(index / 3) * 23,
    group: index,
    rotation: 0
  }));
  game.restoreDialogue = { textContent: '' };

  assert.deepEqual(Array.from(game.findHintPair()), [0, 1], 'Hint must return a real neighboring pair in different groups');
  game.recordPhotoConnection(true, 3);
  assert.equal(game.manualConnections, 3, 'A drag that merges three groups must count all three manual joins');
  assert.equal(game.venomCharges, 1, 'Every three manual joins must grant one Venom assist');

  game.connectionCount = () => 6;
  game.recordPhotoConnection(true, 2);
  assert.equal(game.dialogueSeen[5], true, 'Crossing the fifth connection in a multi-join must still show its story beat');

  game.pieceStates[0].group = 99;
  game.pieceStates[1].group = 99;
  game.pieceStates[0].x = -14;
  game.pieceStates[0].y = 92;
  game.pieceStates[1].x = 14;
  game.pieceStates[1].y = 92;
  game.clampPhotoGroup(99);
  const members = game.groupMembers(99).map(index => game.pieceStates[index]);
  assert.ok(Math.min(...members.map(state => state.x)) >= 1, 'Recovered group must stay inside the left edge');
  assert.ok(Math.max(...members.map(state => state.y + game.unitY)) <= 99, 'Recovered group must stay inside the bottom edge');

  const assistGame = Object.create(proto);
  assistGame.rows = 4;
  assistGame.cols = 3;
  assistGame.unitX = 28;
  assistGame.unitY = 21;
  assistGame.manualConnections = 0;
  assistGame.nextVenomChargeAt = 3;
  assistGame.venomCharges = 1;
  assistGame.dialogueSeen = {};
  assistGame.pieceStates = Array.from({ length: 12 }, (_, index) => ({
    x: 5 + (index % 3) * 31,
    y: 4 + Math.floor(index / 3) * 23,
    group: index,
    rotation: index === 0 ? 8 : index === 1 ? -6 : 0
  }));
  assistGame.restoreDialogue = { textContent: '' };
  assistGame.status = { textContent: '' };
  assistGame.photoBoard = { classList: { add() {} } };
  assistGame.renderPhoto = () => {};
  assistGame.clampPhotoGroup = () => {};
  assistGame.findHintPair = () => [0, 1];
  assistGame.connectionCount = () => 5;

  assert.equal(assistGame.useVenomAssist(), true, 'Charged Venom assist must join a valid pair');
  assert.equal(assistGame.pieceStates[0].rotation, 0, 'Moving side of an assisted join must be aligned');
  assert.equal(assistGame.pieceStates[1].rotation, 0, 'Stationary side of an assisted join must also be aligned');
  assert.match(assistGame.restoreDialogue.textContent, /Можно посмотреть\?/, 'Threshold story beat must remain visible after Venom assist');
  assert.doesNotMatch(assistGame.restoreDialogue.textContent, /Не сильнее/, 'Generic assist copy must not overwrite a threshold story beat');
});


test('FinaleGame: 3 tactile surprise phases', () => {
  const ctx = loadContext();
  const mockContainer = { innerHTML: '', appendChild(c) { return c; } };

  let won = false;
  const game = ctx.Games.create('finale', mockContainer, {}, () => { won = true; });

  assert.equal(game.phaseIndex, 0, 'Must start at phase 0');
  if (game.gateBtn && game.gateBtn.click) game.gateBtn.click();

  // Phase 1: Leaves
  assert.ok(game.phaseLabel.textContent.includes('ЛИСТЬЯ ГРУТИКА'), 'Phase 1 label');
  game.solveLock(0);
  assert.equal(game.solvedPhases[0], true);
  
  game.nextPhase();
  assert.equal(game.phaseIndex, 1);

  // Phase 2: Scratch
  assert.ok(game.phaseLabel.textContent.includes('ЗАВЕСА ВЕНОМА'), 'Phase 2 label');
  game.solveLock(1);
  assert.equal(game.solvedPhases[1], true);
  
  game.nextPhase();
  assert.equal(game.phaseIndex, 2);

  // Phase 3: Wrapper
  assert.ok(game.phaseLabel.textContent.includes('ГЛАВНЫЙ ПОДАРОК'), 'Phase 3 label');
  game.solveLock(2);
  assert.equal(game.solvedPhases[2], true);
  
  assert.ok(game.phaseLabel.textContent.includes('ПРАЗДНИК ЗАПУЩЕН'));
  assert.equal(game.completedMessage, 'Праздничный механизм запущен');
});
test('Day 6 texts no longer advertise three phases, code, balance, or impulse', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const gamesCode = fs.readFileSync(path.join(__dirname, '..', 'games.js'), 'utf8');

  // app.js Day 6 config
  assert.match(appCode, /type:\s*"finale"[^}]+badge:\s*"Праздник"/, 'Day 6 config badge must be "Праздник"');
  assert.match(appCode, /3 праздничных этапа с фото/, 'Day 6 description must be 3 photo phases');
  assert.match(appCode, /title:\s*"Праздничный механизм"/, 'Day 6 title must be "Праздничный механизм"');
  assert.match(appCode, /Грутик и Веном спрятали фотографии. Распакуй их!/, 'Day 6 instruction must match requirement');

  // app.js Day 6 GREET
  const greetMatch = appCode.match(/var GREET = \[([\s\S]*?)\];/);
  assert.ok(greetMatch);
  const greetContent = greetMatch[1];
  assert.ok(!greetContent.includes('Три фазы'), 'Day 6 greeting must not mention "Три фазы"');
  assert.ok(!greetContent.includes('запомни код'), 'Day 6 greeting must not mention remembering code');
  assert.ok(!greetContent.includes('удержи баланс'), 'Day 6 greeting must not mention balance');
  assert.ok(!greetContent.includes('точных импульса'), 'Day 6 greeting must not mention pulse hits');

  // games.js FinaleGame internals
  assert.ok(!gamesCode.includes('startEcho'), 'Old startEcho must be removed');
  assert.ok(!gamesCode.includes('showFinalCode'), 'Old showFinalCode must be removed');
  assert.ok(!gamesCode.includes('startBalance'), 'Old startBalance must be removed');
  assert.ok(!gamesCode.includes('startPulse'), 'Old startPulse must be removed');
  assert.ok(!gamesCode.includes('finalPulseLoop'), 'Old finalPulseLoop must be removed');

  // POSTWIN[5] behavior
  const postwinMatch = appCode.match(/var POSTWIN = \[([\s\S]*?)\];/);
  assert.ok(postwinMatch);
  assert.ok(postwinMatch[1].includes('FN(unlockFinal)'), 'POSTWIN[5] must still call unlockFinal');
});
