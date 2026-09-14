var GAME_SYMBOLS = ["✦", "◆", "●", "▲", "■", "✧", "◈", "◇", "⬟"];

function gameEl(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function gameShuffle(items) {
  for (var i = items.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
  return items;
}

function GameBase(container, opts, onWin) {
  this.container = container;
  this.opts = opts || {};
  this.onWin = onWin;
  this.done = false;
  this.timers = [];
  this.rafs = [];
  this.root = gameEl("section", "game-shell");

  var head = gameEl("header", "game-head");
  var meta = gameEl("div", "game-meta");
  meta.appendChild(gameEl("span", "game-kicker", this.opts.kicker || "ИСПЫТАНИЕ"));
  meta.appendChild(gameEl("h2", "game-heading", this.opts.title || "Испытание"));
  head.appendChild(meta);
  this.stats = gameEl("div", "game-stats");
  head.appendChild(this.stats);
  if (this.opts.isReplay || this.opts.onExit) {
    var exitBtn = gameEl("button", "game-btn-exit", "✕ Назад");
    exitBtn.type = "button";
    exitBtn.setAttribute("title", "Вернуться к Грутику");
    var self = this;
    exitBtn.addEventListener("click", function () {
      if (self.opts.onExit) self.opts.onExit();
    });
    head.appendChild(exitBtn);
  }
  this.root.appendChild(head);

  this.arena = gameEl("div", "game-arena");
  this.root.appendChild(this.arena);
  this.status = gameEl("div", "game-status", this.opts.instruction || "Приготовься.");
  this.status.setAttribute("aria-live", "polite");
  this.root.appendChild(this.status);

  container.innerHTML = "";
  container.appendChild(this.root);
}

GameBase.prototype.later = function (fn, ms) {
  var self = this;
  var id = setTimeout(function () {
    self.timers = self.timers.filter(function (timer) { return timer !== id; });
    if (!self.done) fn();
  }, ms);
  this.timers.push(id);
  return id;
};

GameBase.prototype.frame = function (fn) {
  var self = this;
  var id = requestAnimationFrame(function (time) {
    self.rafs = self.rafs.filter(function (raf) { return raf !== id; });
    if (!self.done) fn(time);
  });
  this.rafs.push(id);
  return id;
};

GameBase.prototype.clearAsync = function () {
  this.timers.forEach(clearTimeout);
  this.rafs.forEach(cancelAnimationFrame);
  this.timers = [];
  this.rafs = [];
};

GameBase.prototype.gate = function (label, text, start) {
  var overlay = gameEl("div", "game-gate");
  overlay.appendChild(gameEl("div", "gate-mark", this.opts.mark || "01"));
  if (text) {
    overlay.appendChild(gameEl("p", "gate-copy", text));
  }
  var btn = gameEl("button", "btn big", label || "Начать");
  overlay.appendChild(btn);
  this.arena.appendChild(overlay);
  btn.addEventListener("click", function () {
    overlay.remove();
    start();
  });
};

GameBase.prototype.complete = function (text) {
  if (this.done) return;
  this.done = true;
  this.clearAsync();
  this.root.classList.add("game-complete");
  var result = gameEl("div", "game-result");
  result.appendChild(gameEl("div", "result-mark", "✓"));
  result.appendChild(gameEl("strong", null, text || "Испытание пройдено"));
  this.arena.appendChild(result);
  var win = this.onWin;
  this.finishTimer = setTimeout(function () { win(); }, 850);
};

GameBase.prototype.destroy = function () {
  this.done = true;
  clearTimeout(this.finishTimer);
  this.clearAsync();
};

if (!window.Games) window.Games = {};

Games.create = function (type, container, opts, onWin) {
  var map = {
    memory: MemoryPairsGame,
    pulse: PulseGame,
    trace: TraceGame,
    blockblast: BlockBlastGame,
    echo: EchoGame,
    split: SplitGame,
    photoPuzzle: PhotoPuzzleGame,
    circuit: CircuitGame,
    finale: FinaleGame
  };
  var Game = map[type];
  if (!Game) throw new Error("Unknown game type: " + type);
  return new Game(container, opts || {}, onWin);
};

function MemoryPairsGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.photos = (opts.photos || []).slice(0, 12);
  while (this.photos.length < 12) this.photos.push("");
  this.centerPhoto = opts.centerPhoto || "";
  this.first = null;
  this.locked = false;
  this.pairs = 0;
  this.attempts = 0;
  this.cards = [];
  this.values = [];
  for (var value = 0; value < 12; value++) this.values.push(value, value);
  gameShuffle(this.values);
  this.arena.classList.add("memory-arena");
  this.grid = gameEl("div", "memory-grid");
  var self = this;
  var cardIndex = 0;
  for (var position = 0; position < 25; position++) {
    if (position === 12) {
      this.grid.appendChild(this.createMemoryCenter());
      continue;
    }
    var card = this.createMemoryCard(cardIndex, this.values[cardIndex]);
    card.addEventListener("click", (function (index) { return function () { self.revealMemoryCard(index); }; })(cardIndex));
    this.grid.appendChild(card);
    this.cards.push(card);
    cardIndex++;
  }
  this.arena.appendChild(this.grid);
  this.updateMemoryStats();
  this.gate("Открыть воспоминания", "", function () {});
}

MemoryPairsGame.prototype = Object.create(GameBase.prototype);
MemoryPairsGame.prototype.constructor = MemoryPairsGame;

MemoryPairsGame.prototype.createMemoryCard = function (index, value) {
  var button = gameEl("button", "memory-card");
  button.setAttribute("aria-label", "Закрытая карточка " + (index + 1));
  var inner = gameEl("span", "memory-card-inner");
  var back = gameEl("span", "memory-card-back", "S");
  var front = gameEl("span", "memory-card-front");
  front.appendChild(gameEl("span", "memory-photo-label", String(value + 1).padStart(2, "0")));
  var photo = this.photos[value];
  if (photo) {
    front.style.backgroundImage = "url(\"" + photo + "\")";
    var preload = new Image();
    preload.onload = function () { front.classList.add("has-photo"); };
    preload.src = photo;
  }
  inner.appendChild(back);
  inner.appendChild(front);
  button.appendChild(inner);
  button.memoryValue = value;
  return button;
};

MemoryPairsGame.prototype.createMemoryCenter = function () {
  var center = gameEl("div", "memory-center");
  center.appendChild(gameEl("span", "memory-center-label", "НАША ФОТО"));
  if (this.centerPhoto) {
    center.style.backgroundImage = "url(\"" + this.centerPhoto + "\")";
    var preload = new Image();
    preload.onload = function () { center.classList.add("has-photo"); };
    preload.src = this.centerPhoto;
  }
  return center;
};

MemoryPairsGame.prototype.updateMemoryStats = function () {
  this.stats.textContent = this.pairs + " / 12";
};

MemoryPairsGame.prototype.revealMemoryCard = function (index) {
  if (this.done || this.locked) return;
  var card = this.cards[index];
  if (!card || card.classList.contains("flipped") || card.classList.contains("matched")) return;
  card.classList.add("flipped");
  card.setAttribute("aria-label", "Открытая карточка " + (index + 1));
  if (this.first == null) {
    this.first = index;
    this.status.textContent = "Найди вторую такую же фотографию.";
    return;
  }
  var firstIndex = this.first;
  var firstCard = this.cards[firstIndex];
  this.first = null;
  this.attempts++;
  if (firstCard.memoryValue === card.memoryValue) {
    firstCard.classList.add("matched");
    card.classList.add("matched");
    this.pairs++;
    this.updateMemoryStats();
    if (this.pairs === 12) {
      this.complete("Все воспоминания собраны");
    } else {
      this.status.textContent = "Пара найдена. Осталось: " + (12 - this.pairs) + ".";
    }
    return;
  }
  this.locked = true;
  this.status.textContent = "Не совпало. Карточки снова закроются.";
  var self = this;
  this.later(function () {
    firstCard.classList.remove("flipped");
    card.classList.remove("flipped");
    firstCard.setAttribute("aria-label", "Закрытая карточка " + (firstIndex + 1));
    card.setAttribute("aria-label", "Закрытая карточка " + (index + 1));
    self.locked = false;
  }, 760);
};

function PulseGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.goal = opts.goal || 4;
  this.hits = 0;
  this.misses = 0;
  this.round = 0;
  this.running = false;
  this.speed = 0.00115;
  this.targetStart = 0.38;
  this.targetWidth = 0.18;

  this.arena.classList.add("pulse-arena");
  var halo = gameEl("div", "pulse-halo");
  this.track = gameEl("div", "pulse-track");
  this.target = gameEl("div", "pulse-target");
  this.cursor = gameEl("div", "pulse-cursor");
  this.track.appendChild(this.target);
  this.track.appendChild(this.cursor);
  halo.appendChild(this.track);
  this.arena.appendChild(halo);
  this.lockButton = gameEl("button", "pulse-lock", "ЗАФИКСИРОВАТЬ");
  this.arena.appendChild(this.lockButton);
  this.updateStats();

  var self = this;
  this.lockButton.addEventListener("click", function () { self.lock(); });
  this.gate("Настроить импульс", "Линия движется быстрее после каждого попадания. Зафиксируй её внутри светового коридора 4 раза.", function () {
    self.running = true;
    self.newRound();
    self.loop(performance.now());
  });
}

PulseGame.prototype = Object.create(GameBase.prototype);
PulseGame.prototype.constructor = PulseGame;

PulseGame.prototype.updateStats = function () {
  this.stats.textContent = this.hits + " / " + this.goal;
};

PulseGame.prototype.newRound = function () {
  this.round++;
  this.targetWidth = Math.max(0.075, 0.19 - this.hits * 0.025);
  this.targetStart = 0.08 + Math.random() * (0.84 - this.targetWidth);
  this.target.style.left = this.targetStart * 100 + "%";
  this.target.style.width = this.targetWidth * 100 + "%";
  this.speed = 0.0011 + this.hits * 0.00026;
  this.status.textContent = this.hits ? "Коридор уже. Не спеши." : "Лови момент, а не кнопку.";
};

PulseGame.prototype.loop = function (time) {
  if (!this.running || this.done) return;
  this.position = (Math.sin(time * this.speed) + 1) / 2;
  this.cursor.style.left = this.position * 100 + "%";
  var self = this;
  this.frame(function (next) { self.loop(next); });
};

PulseGame.prototype.lock = function () {
  if (!this.running || this.done) return;
  this.running = false;
  var good = this.position >= this.targetStart && this.position <= this.targetStart + this.targetWidth;
  this.track.classList.remove("hit", "miss");
  void this.track.offsetWidth;
  this.track.classList.add(good ? "hit" : "miss");
  if (good) {
    this.hits++;
    this.status.textContent = this.hits === this.goal ? "Синхронизация завершена." : "Точно. Следующий импульс быстрее.";
    this.updateStats();
    if (this.hits >= this.goal) {
      this.complete("Сердечный ритм пойман");
      return;
    }
  } else {
    this.misses++;
    this.status.textContent = "Мимо коридора. Поймай ритм глазами.";
  }
  var self = this;
  this.later(function () {
    self.newRound();
    self.running = true;
    self.loop(performance.now());
  }, 620);
};

var TRACE_ROUTES = [
  [[10, 80], [25, 58], [18, 28], [48, 18], [68, 42]],
  [[12, 22], [34, 16], [46, 42], [30, 72], [62, 82], [84, 58]],
  [[8, 72], [22, 42], [42, 62], [57, 28], [78, 18], [88, 48], [72, 82]]
];

var TRACE_DANGERS = [
  [[54, 66, 10], [76, 20, 9]],
  [[18, 54, 9], [68, 23, 9], [72, 37, 8]],
  [[34, 20, 8], [52, 82, 8], [88, 68, 7]]
];

function TraceGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.round = 0;
  this.nextNode = 0;
  this.dragging = false;
  this.arena.classList.add("trace-arena");
  this.field = gameEl("div", "trace-field");
  this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  this.svg.setAttribute("viewBox", "0 0 100 100");
  this.svg.classList.add("trace-svg");
  this.pathLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  this.pathLine.setAttribute("class", "trace-guide");
  this.svg.appendChild(this.pathLine);
  this.liveLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  this.liveLine.setAttribute("class", "trace-live");
  this.svg.appendChild(this.liveLine);
  this.field.appendChild(this.svg);
  this.arena.appendChild(this.field);
  this.updateStats();

  var self = this;
  this.down = function (e) { self.pointerDown(e); };
  this.move = function (e) { self.pointerMove(e); };
  this.up = function () { self.pointerUp(); };
  this.field.addEventListener("pointerdown", this.down);
  this.field.addEventListener("pointermove", this.move);
  this.field.addEventListener("pointerup", this.up);
  this.field.addEventListener("pointercancel", this.up);
  this.gate("Открыть маршрут", "Зажми первую точку и проведи линию через номера по порядку. Чёрные зоны обнуляют текущую попытку.", function () {
    self.renderRound();
  });
}

TraceGame.prototype = Object.create(GameBase.prototype);
TraceGame.prototype.constructor = TraceGame;

TraceGame.prototype.updateStats = function () {
  this.stats.textContent = Math.min(this.round + 1, 3) + " / 3";
};

TraceGame.prototype.renderRound = function () {
  this.field.querySelectorAll(".trace-node,.trace-danger").forEach(function (node) { node.remove(); });
  this.route = TRACE_ROUTES[this.round];
  this.dangers = TRACE_DANGERS[this.round];
  this.pathLine.setAttribute("points", this.route.map(function (p) { return p.join(","); }).join(" "));
  this.liveLine.setAttribute("points", "");
  this.nextNode = 0;
  this.dragging = false;
  var self = this;
  this.dangers.forEach(function (danger) {
    var el = gameEl("span", "trace-danger");
    el.style.left = danger[0] + "%";
    el.style.top = danger[1] + "%";
    el.style.width = danger[2] * 2 + "%";
    el.style.aspectRatio = "1";
    self.field.appendChild(el);
  });
  this.nodes = this.route.map(function (point, i) {
    var node = gameEl("span", "trace-node", String(i + 1));
    node.style.left = point[0] + "%";
    node.style.top = point[1] + "%";
    self.field.appendChild(node);
    return node;
  });
  this.status.textContent = "Начни с точки 1 и не отпускай палец.";
};

TraceGame.prototype.point = function (e) {
  var rect = this.field.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / Math.max(1, rect.width) * 100,
    y: (e.clientY - rect.top) / Math.max(1, rect.height) * 100
  };
};

TraceGame.prototype.near = function (a, b, radius) {
  return Math.hypot(a.x - b[0], a.y - b[1]) <= radius;
};

TraceGame.prototype.pointerDown = function (e) {
  if (this.done || !this.route) return;
  var p = this.point(e);
  if (!this.near(p, this.route[0], 8)) {
    this.status.textContent = "Маршрут начинается с точки 1.";
    return;
  }
  this.dragging = true;
  this.nextNode = 1;
  this.nodes[0].classList.add("passed");
  if (this.field.setPointerCapture) this.field.setPointerCapture(e.pointerId);
  this.drawLive(p);
};

TraceGame.prototype.pointerMove = function (e) {
  if (!this.dragging || this.done) return;
  var p = this.point(e);
  for (var i = 0; i < this.dangers.length; i++) {
    if (this.near(p, this.dangers[i], this.dangers[i][2])) {
      this.resetAttempt("Симбиот задел линию. Начни маршрут заново.");
      return;
    }
  }
  if (this.nextNode < this.route.length && this.near(p, this.route[this.nextNode], 8)) {
    this.nodes[this.nextNode].classList.add("passed");
    this.nextNode++;
    if (this.nextNode === this.route.length) {
      this.dragging = false;
      this.round++;
      if (this.round >= TRACE_ROUTES.length) {
        this.complete("Маршрут энергии открыт");
        return;
      }
      this.updateStats();
      this.status.textContent = "Маршрут чист. Следующая схема сложнее.";
      var self = this;
      this.later(function () { self.renderRound(); }, 700);
      return;
    }
  }
  this.drawLive(p);
};

TraceGame.prototype.drawLive = function (p) {
  var points = this.route.slice(0, this.nextNode).map(function (point) { return point.join(","); });
  points.push(p.x + "," + p.y);
  this.liveLine.setAttribute("points", points.join(" "));
};

TraceGame.prototype.pointerUp = function () {
  if (this.dragging) this.resetAttempt("Не отпускай линию до последней точки.");
};

TraceGame.prototype.resetAttempt = function (message) {
  this.dragging = false;
  this.nextNode = 0;
  this.liveLine.setAttribute("points", "");
  this.nodes.forEach(function (node) { node.classList.remove("passed"); });
  this.field.classList.remove("error");
  void this.field.offsetWidth;
  this.field.classList.add("error");
  this.status.textContent = message;
};

TraceGame.prototype.destroy = function () {
  GameBase.prototype.destroy.call(this);
  this.field.removeEventListener("pointerdown", this.down);
  this.field.removeEventListener("pointermove", this.move);
  this.field.removeEventListener("pointerup", this.up);
  this.field.removeEventListener("pointercancel", this.up);
};

var BLOCK_SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]]
];

function transformBlockShape(shape, turns, reflected) {
  var points = shape.map(function (point) {
    return [reflected ? -point[0] : point[0], point[1]];
  });
  for (var turn = 0; turn < turns; turn++) {
    points = points.map(function (point) { return [-point[1], point[0]]; });
  }
  var minX = Math.min.apply(null, points.map(function (point) { return point[0]; }));
  var minY = Math.min.apply(null, points.map(function (point) { return point[1]; }));
  return points.map(function (point) { return [point[0] - minX, point[1] - minY]; })
    .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
}

function randomBlockShape() {
  var shape = BLOCK_SHAPES[Math.floor(Math.random() * BLOCK_SHAPES.length)];
  return transformBlockShape(shape, Math.floor(Math.random() * 4), Math.random() < .5);
}

function BlockBlastGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.size = 8;
  this.lineGoal = opts.lines || 4;
  this.lines = 0;
  this.score = 0;
  this.bestScore = 0;
  try {
    var saved = localStorage.getItem("advent_blockblast_best");
    if (saved) this.bestScore = parseInt(saved, 10) || 0;
  } catch (e) { }
  this.endless = !!opts.endless;
  this.wonCelebrated = false;
  this.photoCompleting = false;
  this.photoComplete = false;
  this.selected = -1;
  this.photo = opts.photo || "photos/blockblast.jpg";
  this.revealed = [];
  this.justRevealed = {};
  this.board = [];
  for (var i = 0; i < 64; i++) {
    this.board.push(0);
    this.revealed.push(false);
  }
  this.seedBoard();

  this.root.classList.add("block-shell");
  this.arena.classList.add("block-arena");

  var head = (this.root && this.root.querySelector) ? this.root.querySelector(".game-head") : null;
  var ctrl = gameEl("div", "block-controls");
  var restartBtn = gameEl("button", "block-btn-restart", "↺ Заново");
  restartBtn.setAttribute("type", "button");
  restartBtn.setAttribute("title", "Сбросить поле и начать заново");
  var self = this;
  restartBtn.addEventListener("click", function () { self.restart(); });
  ctrl.appendChild(restartBtn);

  var wheelShortcut = gameEl("button", "block-btn-wheel" + (this.endless ? "" : " hidden"), this.endless ? "Выйти ✕" : "К колесу 🎡");
  wheelShortcut.setAttribute("type", "button");
  wheelShortcut.addEventListener("click", function () {
    if (self.opts.onExit && (self.endless || self.opts.isReplay)) {
      self.opts.onExit();
    } else {
      self.complete("Поле корней очищено");
    }
  });
  ctrl.appendChild(wheelShortcut);
  this.wheelShortcut = wheelShortcut;
  if (head) head.appendChild(ctrl);

  this.blockBoard = gameEl("div", "block-board");
  var photoBackground = 'url("' + this.photo.replace(/"/g, '\\"') + '")';
  if (this.blockBoard.style.setProperty) this.blockBoard.style.setProperty("--block-photo", photoBackground);
  else this.blockBoard.style["--block-photo"] = photoBackground;
  this.blockCells = [];
  for (var cell = 0; cell < 64; cell++) {
    var blockCell = gameEl("div", "block-cell");
    this.blockBoard.appendChild(blockCell);
    this.blockCells.push(blockCell);
  }
  this.tray = gameEl("div", "block-tray");
  this.arena.appendChild(this.blockBoard);
  this.arena.appendChild(this.tray);
  this.updateStats();
  this.renderBoard();
  this.newPieces();
  if (this.endless) {
    this.gate("Начать игру", "Бесконечный режим: набирай очки, очищая строки и столбцы. Ставь новые рекорды!", function () {});
  } else {
    this.gate("Начать уровень", "Перетаскивай фигуры снизу на свободные клетки. Полные строки и столбцы исчезают. Очисти " + this.lineGoal + " линий.", function () {});
  }
}

BlockBlastGame.prototype = Object.create(GameBase.prototype);
BlockBlastGame.prototype.constructor = BlockBlastGame;

BlockBlastGame.prototype.seedBoard = function () {
  var target = 14 + Math.floor(Math.random() * 7);
  var rowCounts = new Array(this.size).fill(0);
  var colCounts = new Array(this.size).fill(0);
  var placed = 0;
  var attempts = 0;
  while (placed < target && attempts < 256) {
    attempts++;
    var index = Math.floor(Math.random() * this.board.length);
    var row = Math.floor(index / this.size);
    var col = index % this.size;
    if (this.board[index] || rowCounts[row] >= 4 || colCounts[col] >= 4) continue;
    this.board[index] = 1 + Math.floor(Math.random() * 6);
    rowCounts[row]++;
    colCounts[col]++;
    placed++;
  }
};

BlockBlastGame.prototype.updateStats = function () {
  var revealedCount = this.revealed.filter(function (cell) { return cell; }).length;
  var photoProgress = ' · Фото: <strong>' + revealedCount + ' / 64</strong>';
  if (this.endless) {
    this.stats.innerHTML = '<span class="bb-tag">Бесконечный режим</span> Очки: <strong>' + this.score + '</strong> · Рекорд: <strong>' + this.bestScore + '</strong>' + photoProgress;
  } else {
    this.stats.innerHTML = 'Линии: <strong>' + this.lines + ' / ' + this.lineGoal + '</strong> · Очки: <strong>' + this.score + '</strong>' + photoProgress;
  }
};

BlockBlastGame.prototype.saveBestScore = function () {
  try {
    localStorage.setItem("advent_blockblast_best", String(this.bestScore));
  } catch (e) { }
};

BlockBlastGame.prototype.newPieces = function () {
  this.generatePieces();
  if (!this.hasAnyMove()) {
    this.showNoMoves();
    return;
  }
  this.status.textContent = this.endless ? "Бесконечный режим. Набирай очки!" : "Перетащи одну из фигур на поле.";
};

BlockBlastGame.prototype.generatePieces = function () {
  this.pieces = [];
  for (var i = 0; i < 3; i++) {
    var color = 1 + Math.floor(Math.random() * 6);
    this.pieces.push({ shape: randomBlockShape(), used: false, color: color });
  }
  this.selected = -1;
  this.renderTray();
};

BlockBlastGame.prototype.rerollPieces = function () {
  var attempts = 0;
  do {
    this.generatePieces();
    attempts++;
  } while (!this.hasAnyMove() && attempts < 40);

  if (!this.hasAnyMove()) {
    this.pieces[0] = { shape: transformBlockShape(BLOCK_SHAPES[0], 0, false), used: false, color: 1 + Math.floor(Math.random() * 6) };
    this.renderTray();
  }
  this.status.textContent = "Фигуры заменены. Поле и открытая фотография сохранены.";
};

BlockBlastGame.prototype.renderBoard = function () {
  this.blockCells.forEach(function (cell, i) {
    var val = this.board[i];
    var photoVisible = !val && this.revealed[i];
    cell.className = "block-cell" + (val ? " filled block-color-" + val : "") + (photoVisible ? " photo-revealed" : "") + (photoVisible && this.justRevealed[i] ? " photo-new" : "");
    if (photoVisible && !this.photoComplete) {
      var row = Math.floor(i / this.size);
      var col = i % this.size;
      cell.style.backgroundImage = 'url("' + this.photo.replace(/"/g, '\\"') + '")';
      cell.style.backgroundSize = (this.size * 100) + "% " + (this.size * 100) + "%";
      cell.style.backgroundPosition = (col * 100 / (this.size - 1)) + "% " + (row * 100 / (this.size - 1)) + "%";
    } else {
      cell.style.backgroundImage = "";
      cell.style.backgroundSize = "";
      cell.style.backgroundPosition = "";
    }
  }, this);
  this.justRevealed = {};
};

BlockBlastGame.prototype.renderTray = function () {
  this.tray.innerHTML = "";
  var self = this;
  this.pieces.forEach(function (piece, index) {
    var button = gameEl("button", "block-piece" + (piece.used ? " used" : "") + " piece-color-" + piece.color);
    button.setAttribute("aria-label", "Выбрать фигуру " + (index + 1));
    var maxX = 0, maxY = 0;
    piece.shape.forEach(function (point) { maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]); });
    var mini = gameEl("span", "block-mini");
    mini.style.gridTemplateColumns = "repeat(" + (maxX + 1) + ", 13px)";
    mini.style.gridTemplateRows = "repeat(" + (maxY + 1) + ", 13px)";
    piece.shape.forEach(function (point) {
      var dot = gameEl("i", "block-dot block-color-" + piece.color);
      dot.style.gridColumn = point[0] + 1;
      dot.style.gridRow = point[1] + 1;
      mini.appendChild(dot);
    });
    button.appendChild(mini);
    piece.element = button;
    button.addEventListener("pointerdown", function (event) { self.startBlockDrag(event, index); });
    self.tray.appendChild(button);
  });
};

BlockBlastGame.prototype.startBlockDrag = function (event, index) {
  var piece = this.pieces[index];
  if (this.done || this.photoCompleting || this.blockDrag || piece.used || (event.button != null && event.button !== 0)) return;
  event.preventDefault();
  var button = piece.element;
  var ghost = button.cloneNode(true);
  ghost.className = "block-piece block-drag-ghost block-color-" + piece.color;
  var maxX = 0, maxY = 0;
  piece.shape.forEach(function (point) { maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]); });
  ghost.style.width = (maxX + 1) * 25 + "px";
  ghost.style.height = (maxY + 1) * 25 + "px";
  document.body.appendChild(ghost);
  this.selected = index;
  this.blockDrag = { index: index, button: button, ghost: ghost, row: -1, col: -1, moved: false, x: event.clientX, y: event.clientY };
  var self = this;
  this.blockMove = function (moveEvent) { self.moveBlockDrag(moveEvent); };
  this.blockUp = function (upEvent) { self.endBlockDrag(upEvent, false); };
  this.blockCancel = function (cancelEvent) { self.endBlockDrag(cancelEvent, true); };
  window.addEventListener("pointermove", this.blockMove, { passive: false });
  window.addEventListener("pointerup", this.blockUp);
  window.addEventListener("pointercancel", this.blockCancel);
  document.documentElement.classList.add("block-drag-active");
  button.classList.add("dragging");
  if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
  this.moveBlockDrag(event);
};

BlockBlastGame.prototype.moveBlockDrag = function (event) {
  if (!this.blockDrag) return;
  var drag = this.blockDrag;
  var boardRect = this.blockBoard.getBoundingClientRect();
  var lift = event.pointerType === "touch" ? 30 : 8;
  drag.ghost.style.left = event.clientX - drag.ghost.offsetWidth / 2 + "px";
  drag.ghost.style.top = event.clientY - drag.ghost.offsetHeight - lift + "px";
  if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 5) drag.moved = true;
  var cellWidth = boardRect.width / this.size;
  var cellHeight = boardRect.height / this.size;
  var shape = this.pieces[drag.index].shape;
  var maxX = 0, maxY = 0;
  shape.forEach(function (point) { maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]); });
  drag.col = Math.floor((event.clientX - boardRect.left) / Math.max(cellWidth, 1) - maxX / 2);
  drag.row = Math.floor((event.clientY - boardRect.top) / Math.max(cellHeight, 1) - maxY / 2);
  this.previewBlockDrop(shape, drag.row, drag.col, this.pieces[drag.index].color);
  event.preventDefault();
};

BlockBlastGame.prototype.previewBlockDrop = function (shape, row, col, color) {
  var valid = this.canPlace(shape, row, col);
  this.blockCells.forEach(function (cell) {
    cell.classList.remove("drop-preview", "drop-invalid", "preview-c1", "preview-c2", "preview-c3", "preview-c4", "preview-c5", "preview-c6");
  });
  for (var i = 0; i < shape.length; i++) {
    var c = col + shape[i][0], r = row + shape[i][1];
    if (c < 0 || c >= this.size || r < 0 || r >= this.size) continue;
    var cell = this.blockCells[r * this.size + c];
    if (valid) {
      cell.classList.add("drop-preview");
      if (color) cell.classList.add("preview-c" + color);
    } else {
      cell.classList.add("drop-invalid");
    }
  }
};

BlockBlastGame.prototype.endBlockDrag = function (event, cancelled) {
  if (!this.blockDrag) return;
  var drag = this.blockDrag;
  this.blockDrag = null;
  window.removeEventListener("pointermove", this.blockMove);
  window.removeEventListener("pointerup", this.blockUp);
  window.removeEventListener("pointercancel", this.blockCancel);
  this.blockMove = null;
  this.blockUp = null;
  this.blockCancel = null;
  document.documentElement.classList.remove("block-drag-active");
  drag.button.classList.remove("dragging");
  drag.ghost.remove();
  this.blockCells.forEach(function (cell) {
    cell.classList.remove("drop-preview", "drop-invalid", "preview-c1", "preview-c2", "preview-c3", "preview-c4", "preview-c5", "preview-c6");
  });
  if (!cancelled && drag.moved && this.canPlace(this.pieces[drag.index].shape, drag.row, drag.col)) {
    this.selected = drag.index;
    this.place(drag.row * this.size + drag.col);
  } else {
    this.selected = -1;
    this.status.textContent = cancelled ? "Перетаскивание отменено." : "Фигура не помещается в этом месте.";
  }
};

BlockBlastGame.prototype.destroy = function () {
  if (this.blockDrag && this.blockDrag.ghost) this.blockDrag.ghost.remove();
  window.removeEventListener("pointermove", this.blockMove);
  window.removeEventListener("pointerup", this.blockUp);
  window.removeEventListener("pointercancel", this.blockCancel);
  document.documentElement.classList.remove("block-drag-active");
  this.blockDrag = null;
  GameBase.prototype.destroy.call(this);
};

BlockBlastGame.prototype.canPlace = function (shape, row, col) {
  for (var i = 0; i < shape.length; i++) {
    var c = col + shape[i][0], r = row + shape[i][1];
    if (c < 0 || c >= this.size || r < 0 || r >= this.size || this.board[r * this.size + c]) return false;
  }
  return true;
};

BlockBlastGame.prototype.hasAnyMove = function () {
  for (var p = 0; p < this.pieces.length; p++) {
    if (this.pieces[p].used) continue;
    for (var row = 0; row < this.size; row++) {
      for (var col = 0; col < this.size; col++) {
        if (this.canPlace(this.pieces[p].shape, row, col)) return true;
      }
    }
  }
  return false;
};

BlockBlastGame.prototype.previewFits = function () {
  var piece = this.pieces[this.selected];
  this.blockCells.forEach(function (cell, idx) {
    var row = Math.floor(idx / 8), col = idx % 8;
    cell.classList.toggle("can-fit", piece && this.canPlace(piece.shape, row, col));
  }, this);
};

BlockBlastGame.prototype.place = function (idx) {
  if (this.done || this.photoCompleting || this.selected < 0) {
    if (!this.done) this.status.textContent = "Сначала выбери фигуру снизу.";
    return;
  }
  var piece = this.pieces[this.selected];
  var row = Math.floor(idx / this.size), col = idx % this.size;
  if (!this.canPlace(piece.shape, row, col)) {
    this.blockBoard.classList.remove("error");
    void this.blockBoard.offsetWidth;
    this.blockBoard.classList.add("error");
    this.status.textContent = "Здесь фигура не помещается.";
    return;
  }
  for (var i = 0; i < piece.shape.length; i++) {
    var c = col + piece.shape[i][0], r = row + piece.shape[i][1];
    this.board[r * this.size + c] = piece.color;
  }
  this.score += piece.shape.length * 5;
  if (this.endless && this.score > this.bestScore) {
    this.bestScore = this.score;
    this.saveBestScore();
  }
  piece.used = true;
  this.selected = -1;
  this.clearLines();
  this.renderBoard();
  this.blockCells.forEach(function (cell) { cell.classList.remove("can-fit"); });
  this.updateStats();

  if (!this.endless && this.lines >= this.lineGoal) {
    var self = this;
    this.later(function () {
      self.photoCompleting = false;
      self.blockBoard.classList.remove("photo-preview");
      self.showVictoryChoice();
    }, 950);
    return;
  }

  if (this.pieces.every(function (item) { return item.used; })) this.newPieces();
  else {
    this.renderTray();
    if (!this.hasAnyMove()) {
      this.showNoMoves();
    }
  }
};

BlockBlastGame.prototype.clearLines = function () {
  var clear = {};
  for (var row = 0; row < this.size; row++) {
    var rowFull = true;
    for (var col = 0; col < this.size; col++) if (!this.board[row * this.size + col]) rowFull = false;
    if (rowFull) for (var rc = 0; rc < this.size; rc++) clear[row * this.size + rc] = true;
  }
  for (var c = 0; c < this.size; c++) {
    var colFull = true;
    for (var r = 0; r < this.size; r++) if (!this.board[r * this.size + c]) colFull = false;
    if (colFull) for (var cr = 0; cr < this.size; cr++) clear[cr * this.size + c] = true;
  }
  var rowsAndCols = 0;
  for (var rowCheck = 0; rowCheck < this.size; rowCheck++) {
    var rowCleared = true;
    for (var rowCol = 0; rowCol < this.size; rowCol++) if (!clear[rowCheck * this.size + rowCol]) rowCleared = false;
    if (rowCleared) rowsAndCols++;
  }
  for (var colCheck = 0; colCheck < this.size; colCheck++) {
    var columnCleared = true;
    for (var colRow = 0; colRow < this.size; colRow++) if (!clear[colRow * this.size + colCheck]) columnCleared = false;
    if (columnCleared) rowsAndCols++;
  }
  var indexes = Object.keys(clear);
  if (indexes.length) {
    this.justRevealed = {};
    for (var key in clear) {
      var clearedIndex = Number(key);
      this.board[clearedIndex] = 0;
      if (!this.revealed[clearedIndex]) {
        this.revealed[clearedIndex] = true;
        this.justRevealed[clearedIndex] = true;
      }
    }
    this.lines += rowsAndCols;
    this.score += rowsAndCols * 40;
    if (!this.endless && this.lines >= this.lineGoal && !this.wonCelebrated) {
      this.photoCompleting = true;
      this.photoComplete = true;
      for (var photoIndex = 0; photoIndex < this.revealed.length; photoIndex++) {
        if (!this.revealed[photoIndex]) this.justRevealed[photoIndex] = true;
        this.revealed[photoIndex] = true;
      }
      this.blockBoard.classList.add("photo-complete");
      this.blockBoard.classList.add("photo-preview");
      this.status.textContent = "Фотография открыта! ✨";
    }
    if (this.endless && this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore();
    }
    if (this.photoCompleting) {
      this.status.textContent = "Фотография открыта! ✨";
    } else if (this.endless) {
      this.status.textContent = "Линия очищена! +" + (rowsAndCols * 40) + " очков.";
    } else {
      this.status.textContent = "Линия очищена. Освободи ещё " + Math.max(0, this.lineGoal - this.lines) + ".";
    }
  }
};

BlockBlastGame.prototype.restart = function () {
  this.clearAsync();
  if (this.noMovesOverlay) {
    this.noMovesOverlay.remove();
    this.noMovesOverlay = null;
  }
  if (this.blockDrag && this.blockDrag.ghost) this.blockDrag.ghost.remove();
  this.blockDrag = null;
  this.photoCompleting = false;
  this.photoComplete = false;
  this.wonCelebrated = false;
  this.blockBoard.classList.remove("photo-complete");
  this.blockBoard.classList.remove("photo-preview");
  this.board = [];
  this.revealed = [];
  this.justRevealed = {};
  for (var i = 0; i < 64; i++) {
    this.board.push(0);
    this.revealed.push(false);
  }
  this.seedBoard();
  this.score = 0;
  if (!this.endless) {
    this.lines = 0;
  }
  this.renderBoard();
  this.newPieces();
  this.updateStats();
  this.status.textContent = "Поле сброшено. Удачи!";
};

BlockBlastGame.prototype.showVictoryChoice = function () {
  if (this.wonCelebrated) return;
  this.wonCelebrated = true;
  var self = this;
  var overlay = gameEl("div", "block-win-overlay");
  var card = gameEl("div", "block-win-card");
  card.appendChild(gameEl("div", "block-win-icon", "🎉"));
  card.appendChild(gameEl("h3", "block-win-title", "Цель дня достигнута!"));
  card.appendChild(gameEl("p", "block-win-desc", "Ты очистила " + this.lineGoal + " линии и полностью открыла нашу фотографию! Можно перейти к подарку прямо сейчас или продолжить играть на рекорд очков."));

  var actions = gameEl("div", "block-win-actions");
  var exitLabel = (this.opts.isReplay || this.opts.onExit) ? "Вернуться 💤" : "К колесу 🎡";
  var wheelBtn = gameEl("button", "btn btn-primary big", exitLabel);
  var endlessBtn = gameEl("button", "btn big", "Бесконечный режим 🏆");

  wheelBtn.addEventListener("click", function () {
    overlay.remove();
    if (self.opts.onExit && self.opts.isReplay) {
      self.opts.onExit();
    } else {
      self.complete("Поле корней очищено");
    }
  });

  endlessBtn.addEventListener("click", function () {
    overlay.remove();
    self.startEndlessMode();
  });

  actions.appendChild(wheelBtn);
  actions.appendChild(endlessBtn);
  card.appendChild(actions);
  overlay.appendChild(card);
  this.arena.appendChild(overlay);
};

BlockBlastGame.prototype.startEndlessMode = function () {
  this.endless = true;
  this.status.textContent = "Бесконечный режим активирован! Ставь новый рекорд.";
  if (this.wheelShortcut) this.wheelShortcut.classList.remove("hidden");
  this.updateStats();
  if (this.pieces.every(function (item) { return item.used; })) this.newPieces();
  else {
    this.renderTray();
    if (!this.hasAnyMove()) this.showGameOver();
  }
};

BlockBlastGame.prototype.showGameOver = function () {
  this.showNoMoves();
};

BlockBlastGame.prototype.showNoMoves = function () {
  if (this.noMovesOverlay) return;
  var self = this;
  var overlay = gameEl("div", "block-win-overlay");
  var card = gameEl("div", "block-win-card");
  card.appendChild(gameEl("div", "block-win-icon", "🧩"));
  card.appendChild(gameEl("h3", "block-win-title", "Фигуры больше не помещаются"));
  card.appendChild(gameEl("p", "block-win-desc", "Можно заменить только текущие фигуры и сохранить поле, очки и фотографию — или полностью начать игру заново."));

  var actions = gameEl("div", "block-win-actions");
  var rerollBtn = gameEl("button", "btn btn-primary big block-reroll-btn", "Заменить текущие фигуры");
  var restartBtn = gameEl("button", "btn big block-full-restart-btn", "Начать игру заново ↺");

  rerollBtn.addEventListener("click", function () {
    overlay.remove();
    self.noMovesOverlay = null;
    self.rerollPieces();
  });
  restartBtn.addEventListener("click", function () {
    overlay.remove();
    self.noMovesOverlay = null;
    self.restart();
  });

  actions.appendChild(rerollBtn);
  actions.appendChild(restartBtn);
  card.appendChild(actions);
  overlay.appendChild(card);
  this.arena.appendChild(overlay);
  this.noMovesOverlay = overlay;
};

function puzzleFallback() {
  var canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 720;
  var ctx = canvas.getContext("2d");
  var gradient = ctx.createLinearGradient(0, 0, 720, 720);
  gradient.addColorStop(0, "#44253b");
  gradient.addColorStop(1, "#15111a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 720);
  ctx.strokeStyle = "rgba(243,93,145,.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(360, 330, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f7edf3";
  ctx.font = "700 42px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("YOUR PHOTO", 360, 330);
  ctx.fillStyle = "#bca8b3";
  ctx.font = "24px system-ui";
  ctx.fillText("photos/couple.webp", 360, 380);
  return canvas.toDataURL("image/png");
}

var photoClipCounter = 0;

function photoPiecePath(edges) {
  var top = edges.top * -14;
  var right = 100 + edges.right * 14;
  var bottom = 100 + edges.bottom * 14;
  var left = edges.left * -14;
  return [
    "M 0 0 L 34 0 C 40 0 37 " + top + " 50 " + top + " C 63 " + top + " 60 0 66 0 L 100 0",
    "L 100 34 C 100 40 " + right + " 37 " + right + " 50 C " + right + " 63 100 60 100 66 L 100 100",
    "L 66 100 C 60 100 63 " + bottom + " 50 " + bottom + " C 37 " + bottom + " 40 100 34 100 L 0 100",
    "L 0 66 C 0 60 " + left + " 63 " + left + " 50 C " + left + " 37 0 40 0 34 L 0 0 Z"
  ].join(" ");
}

function photoPieceEdges(index, size, allEdges) {
  var row = Math.floor(index / size);
  var col = index % size;
  var edges = {
    top: row === 0 ? 0 : -allEdges[index - size].bottom,
    left: col === 0 ? 0 : -allEdges[index - 1].right,
    right: col === size - 1 ? 0 : ((row * 3 + col) % 2 ? -1 : 1),
    bottom: row === size - 1 ? 0 : ((row + col * 2) % 2 ? 1 : -1)
  };
  allEdges[index] = edges;
  return edges;
}

function PhotoPuzzleGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.size = opts.size || 4;
  this.moves = 0;
  this.selected = null;
  this.drag = null;
  this.unit = 21;
  this.image = opts.photo || "";
  this.edges = [];
  this.pieceStates = [];
  this.clipPrefix = "photo-piece-" + (++photoClipCounter) + "-";
  this.arena.classList.add("photo-puzzle-arena");
  this.photoBoard = gameEl("div", "photo-workspace");
  this.pieces = [];
  var self = this;
  for (var pieceIndex = 0; pieceIndex < this.size * this.size; pieceIndex++) {
    photoPieceEdges(pieceIndex, this.size, this.edges);
    this.pieceStates.push({ x: 0, y: 0, group: pieceIndex, rotation: 0 });
    var piece = this.createPhotoPiece(pieceIndex);
    this.pieces[pieceIndex] = piece;
    this.photoBoard.appendChild(piece);
  }
  this.preview = gameEl("div", "photo-preview hidden");
  this.hintButton = gameEl("button", "photo-hint", "ПОКАЗАТЬ ФОТО");
  this.hintButton.addEventListener("pointerdown", function () { self.preview.classList.remove("hidden"); });
  this.hintButton.addEventListener("pointerup", function () { self.preview.classList.add("hidden"); });
  this.hintButton.addEventListener("pointercancel", function () { self.preview.classList.add("hidden"); });
  this.hintButton.addEventListener("pointerleave", function () { self.preview.classList.add("hidden"); });
  this.arena.appendChild(this.photoBoard);
  this.arena.appendChild(this.hintButton);
  this.arena.appendChild(this.preview);
  this.loadPhoto();
  this.scatterPhotoPieces();
  this.renderPhoto();
  this.gate("Собрать фотографию", "Соединяй подходящие края. Скреплённые детали можно дальше перетаскивать вместе.", function () {});
}

PhotoPuzzleGame.prototype = Object.create(GameBase.prototype);
PhotoPuzzleGame.prototype.constructor = PhotoPuzzleGame;

PhotoPuzzleGame.prototype.loadPhoto = function () {
  var self = this;
  if (!this.image) {
    this.image = puzzleFallback();
    return;
  }
  var image = new Image();
  image.onload = function () { self.renderPhoto(); };
  image.onerror = function () {
    self.image = puzzleFallback();
    self.renderPhoto();
    self.status.textContent = "Добавь вашу фотографию в photos/couple.webp.";
  };
  image.src = this.image;
};

PhotoPuzzleGame.prototype.createPhotoPiece = function (index) {
  var self = this;
  var ns = "http://www.w3.org/2000/svg";
  var button = gameEl("button", "photo-piece");
  button.dataset.piece = index;
  button.setAttribute("aria-label", "Фрагмент фотографии " + (index + 1));
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "-15 -15 130 130");
  svg.setAttribute("aria-hidden", "true");
  var defs = document.createElementNS(ns, "defs");
  var clip = document.createElementNS(ns, "clipPath");
  var clipId = this.clipPrefix + index;
  clip.setAttribute("id", clipId);
  var clipShape = document.createElementNS(ns, "path");
  var path = photoPiecePath(this.edges[index]);
  clipShape.setAttribute("d", path);
  clip.appendChild(clipShape);
  defs.appendChild(clip);
  svg.appendChild(defs);
  var group = document.createElementNS(ns, "g");
  group.setAttribute("clip-path", "url(#" + clipId + ")");
  var base = document.createElementNS(ns, "rect");
  base.setAttribute("x", "-15");
  base.setAttribute("y", "-15");
  base.setAttribute("width", "130");
  base.setAttribute("height", "130");
  base.setAttribute("fill", "#2b2029");
  group.appendChild(base);
  var image = document.createElementNS(ns, "image");
  image.setAttribute("x", -(index % this.size) * 100);
  image.setAttribute("y", -Math.floor(index / this.size) * 100);
  image.setAttribute("width", this.size * 100);
  image.setAttribute("height", this.size * 100);
  image.setAttribute("preserveAspectRatio", "xMidYMid slice");
  group.appendChild(image);
  svg.appendChild(group);
  var outline = document.createElementNS(ns, "path");
  outline.setAttribute("d", path);
  outline.setAttribute("class", "photo-piece-outline");
  svg.appendChild(outline);
  button.appendChild(svg);
  button.photoImage = image;
  button.addEventListener("click", function () {
    if (button.skipClick) {
      button.skipClick = false;
      return;
    }
    self.pickPiece(index);
  });
  button.addEventListener("pointerdown", function (event) { self.startPhotoDrag(event, index); });
  button.addEventListener("pointermove", function (event) { self.movePhotoDrag(event); });
  button.addEventListener("pointerup", function (event) { self.endPhotoDrag(event); });
  button.addEventListener("pointercancel", function (event) { self.endPhotoDrag(event); });
  return button;
};

PhotoPuzzleGame.prototype.scatterPhotoPieces = function () {
  var locations = [];
  for (var i = 0; i < this.pieces.length; i++) locations.push(i);
  gameShuffle(locations);
  for (var index = 0; index < this.pieceStates.length; index++) {
    var location = locations[index];
    this.pieceStates[index].x = 4 + location % this.size * 24;
    this.pieceStates[index].y = 4 + Math.floor(location / this.size) * 24;
    this.pieceStates[index].rotation = (index % 5 - 2) * 2.5;
  }
};

PhotoPuzzleGame.prototype.renderPhoto = function () {
  var self = this;
  this.pieces.forEach(function (piece, index) {
    if (!piece) return;
    var state = self.pieceStates[index];
    piece.photoImage.setAttribute("href", self.image);
    piece.style.left = state.x + "%";
    piece.style.top = state.y + "%";
    piece.style.width = self.unit + "%";
    piece.style.transform = "rotate(" + state.rotation + "deg)";
    piece.classList.toggle("selected", state.group === self.selected);
    piece.classList.toggle("connected", self.groupMembers(state.group).length > 1);
  });
  this.preview.style.backgroundImage = "url(\"" + this.image + "\")";
  this.stats.textContent = this.groupCount() + " ГРУПП";
};

PhotoPuzzleGame.prototype.pickPiece = function (index) {
  if (this.done || (this.drag && this.drag.moved)) return;
  var group = this.pieceStates[index].group;
  this.selected = this.selected === group ? null : group;
  this.renderPhoto();
  this.status.textContent = this.selected == null ? "Соединяй детали по краям изображения." : "Перетаскивай всю выбранную группу.";
};

PhotoPuzzleGame.prototype.groupMembers = function (group) {
  var members = [];
  for (var i = 0; i < this.pieceStates.length; i++) if (this.pieceStates[i].group === group) members.push(i);
  return members;
};

PhotoPuzzleGame.prototype.groupCount = function () {
  var groups = {};
  this.pieceStates.forEach(function (state) { groups[state.group] = true; });
  return Object.keys(groups).length;
};

PhotoPuzzleGame.prototype.shiftGroup = function (group, dx, dy) {
  this.pieceStates.forEach(function (state) {
    if (state.group !== group) return;
    state.x += dx;
    state.y += dy;
    state.rotation = 0;
  });
};

PhotoPuzzleGame.prototype.tryPhotoSnap = function (pieceIndex) {
  var movingGroup = this.pieceStates[pieceIndex].group;
  var snapped = false;
  var searching = true;
  while (searching) {
    searching = false;
    var members = this.groupMembers(movingGroup);
    for (var m = 0; m < members.length && !searching; m++) {
      var current = members[m];
      var row = Math.floor(current / this.size);
      var col = current % this.size;
      var neighbors = [];
      if (col > 0) neighbors.push(current - 1);
      if (col < this.size - 1) neighbors.push(current + 1);
      if (row > 0) neighbors.push(current - this.size);
      if (row < this.size - 1) neighbors.push(current + this.size);
      for (var n = 0; n < neighbors.length; n++) {
        var neighbor = neighbors[n];
        var otherGroup = this.pieceStates[neighbor].group;
        if (otherGroup === movingGroup) continue;
        var dc = neighbor % this.size - col;
        var dr = Math.floor(neighbor / this.size) - row;
        var targetX = this.pieceStates[neighbor].x - dc * this.unit;
        var targetY = this.pieceStates[neighbor].y - dr * this.unit;
        if (Math.abs(this.pieceStates[current].x - targetX) > 6 || Math.abs(this.pieceStates[current].y - targetY) > 6) continue;
        this.shiftGroup(movingGroup, targetX - this.pieceStates[current].x, targetY - this.pieceStates[current].y);
        this.groupMembers(movingGroup).forEach(function (index) { this.pieceStates[index].group = otherGroup; }, this);
        movingGroup = otherGroup;
        this.groupMembers(movingGroup).forEach(function (index) { this.pieceStates[index].rotation = 0; }, this);
        snapped = true;
        searching = true;
        break;
      }
    }
  }
  this.selected = movingGroup;
  this.renderPhoto();
  if (this.groupCount() === 1) {
    var origin = (100 - this.unit * this.size) / 2;
    var anchor = this.pieceStates[0];
    this.shiftGroup(movingGroup, origin - anchor.x, origin - anchor.y);
    this.renderPhoto();
    this.photoBoard.classList.add("assembled");
    this.status.textContent = "Все детали соединились.";
    var self = this;
    this.later(function () { self.complete("Фотография собрана"); }, 450);
  } else if (snapped) {
    this.status.textContent = "Края совпали. Осталось отдельных групп: " + this.groupCount() + ".";
  } else {
    this.status.textContent = "Края пока не совпадают.";
  }
  return snapped;
};

PhotoPuzzleGame.prototype.startPhotoDrag = function (event, index) {
  if (this.done || (event.button != null && event.button !== 0)) return;
  var group = this.pieceStates[index].group;
  var members = this.groupMembers(group);
  var starts = {};
  members.forEach(function (member) {
    starts[member] = { x: this.pieceStates[member].x, y: this.pieceStates[member].y };
    this.pieceStates[member].rotation = 0;
    this.pieces[member].classList.add("dragging");
  }, this);
  this.selected = group;
  this.drag = { piece: this.pieces[index], index: index, group: group, members: members, starts: starts, x: event.clientX, y: event.clientY, moved: false };
  var piece = this.pieces[index];
  if (piece.setPointerCapture) piece.setPointerCapture(event.pointerId);
  this.renderPhoto();
};

PhotoPuzzleGame.prototype.movePhotoDrag = function (event) {
  if (!this.drag) return;
  var rect = this.photoBoard.getBoundingClientRect();
  var dx = (event.clientX - this.drag.x) / Math.max(rect.width, 1) * 100;
  var dy = (event.clientY - this.drag.y) / Math.max(rect.height, 1) * 100;
  if (Math.abs(dx) + Math.abs(dy) > 5) this.drag.moved = true;
  this.drag.members.forEach(function (member) {
    this.pieceStates[member].x = this.drag.starts[member].x + dx;
    this.pieceStates[member].y = this.drag.starts[member].y + dy;
  }, this);
  this.renderPhoto();
  if (this.drag.moved) event.preventDefault();
};

PhotoPuzzleGame.prototype.endPhotoDrag = function (event) {
  if (!this.drag) return;
  var drag = this.drag;
  this.drag = null;
  drag.members.forEach(function (member) { this.pieces[member].classList.remove("dragging"); }, this);
  if (!drag.moved) return;
  drag.piece.skipClick = true;
  this.moves++;
  this.tryPhotoSnap(drag.index);
};

function EchoGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.lengths = opts.lengths || [3, 4, 5, 6];
  this.round = 0;
  this.input = 0;
  this.locked = true;
  this.arena.classList.add("echo-arena");
  this.grid = gameEl("div", "echo-grid");
  this.tiles = [];
  var self = this;
  for (var i = 0; i < 9; i++) {
    var tile = gameEl("button", "echo-tile", GAME_SYMBOLS[i]);
    tile.setAttribute("aria-label", "Ячейка " + (i + 1));
    tile.addEventListener("click", (function (idx) { return function () { self.pick(idx); }; })(i));
    this.grid.appendChild(tile);
    this.tiles.push(tile);
  }
  this.arena.appendChild(this.grid);
  this.updateStats();
  this.gate("Запомнить сигнал", "Сетка покажет последовательность. Повтори её без подсказок; ошибка повторяет текущий раунд.", function () {
    self.newSequence();
  });
}

EchoGame.prototype = Object.create(GameBase.prototype);
EchoGame.prototype.constructor = EchoGame;

EchoGame.prototype.updateStats = function () {
  this.stats.textContent = Math.min(this.round + 1, this.lengths.length) + " / " + this.lengths.length;
};

EchoGame.prototype.newSequence = function () {
  var length = this.lengths[this.round];
  this.sequence = [];
  while (this.sequence.length < length) {
    var n = Math.floor(Math.random() * 9);
    if (this.sequence[this.sequence.length - 1] !== n) this.sequence.push(n);
  }
  this.showSequence();
};

EchoGame.prototype.showSequence = function () {
  this.locked = true;
  this.input = 0;
  this.status.textContent = "Смотри внимательно...";
  var self = this;
  this.sequence.forEach(function (idx, step) {
    self.later(function () {
      self.tiles[idx].classList.add("signal");
      self.later(function () { self.tiles[idx].classList.remove("signal"); }, 420);
    }, 360 + step * 650);
  });
  this.later(function () {
    self.locked = false;
    self.status.textContent = "Теперь повтори последовательность.";
  }, 500 + this.sequence.length * 650);
};

EchoGame.prototype.pick = function (idx) {
  if (this.locked || this.done) return;
  var expected = this.sequence[this.input];
  this.tiles[idx].classList.add(idx === expected ? "correct" : "wrong");
  var self = this;
  this.later(function () { self.tiles[idx].classList.remove("correct", "wrong"); }, 280);
  if (idx !== expected) {
    this.locked = true;
    this.status.textContent = "Сигнал сбился. Последовательность повторится.";
    this.root.classList.add("soft-shake");
    this.later(function () {
      self.root.classList.remove("soft-shake");
      self.showSequence();
    }, 700);
    return;
  }
  this.input++;
  if (this.input === this.sequence.length) {
    this.locked = true;
    this.round++;
    if (this.round >= this.lengths.length) {
      this.complete("Эхо восстановлено");
      return;
    }
    this.updateStats();
    this.status.textContent = "Верно. Сигнал становится длиннее.";
    this.later(function () { self.newSequence(); }, 800);
  }
};

var SPLIT_ITEMS = [
  { mark: "✦", name: "Свет", side: "groot" },
  { mark: "❯", name: "Ветка", side: "groot" },
  { mark: "♥", name: "Сердце", side: "groot" },
  { mark: "⬢", name: "Кора", side: "groot" },
  { mark: "●", name: "Капля", side: "venom" },
  { mark: "⌁", name: "Щупальце", side: "venom" },
  { mark: "◢", name: "Клык", side: "venom" },
  { mark: "◉", name: "Симбиот", side: "venom" }
];

function SplitGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.goal = opts.goal || 12;
  this.score = 0;
  this.stability = 3;
  this.turn = 0;
  this.active = false;
  this.arena.classList.add("split-arena");
  this.mode = gameEl("div", "split-mode", "ОБЫЧНЫЙ РЕЖИМ");
  this.card = gameEl("div", "split-card");
  this.cardMark = gameEl("div", "split-mark");
  this.cardName = gameEl("strong", "split-name");
  this.card.appendChild(this.cardMark);
  this.card.appendChild(this.cardName);
  this.timer = gameEl("div", "split-timer");
  this.timerFill = gameEl("span");
  this.timer.appendChild(this.timerFill);
  var actions = gameEl("div", "split-actions");
  this.grootButton = gameEl("button", "split-choice groot-choice", "ГРУТИК");
  this.venomButton = gameEl("button", "split-choice venom-choice", "ВЕНОМ");
  actions.appendChild(this.grootButton);
  actions.appendChild(this.venomButton);
  this.arena.appendChild(this.mode);
  this.arena.appendChild(this.card);
  this.arena.appendChild(this.timer);
  this.arena.appendChild(actions);
  this.updateStats();
  var self = this;
  this.grootButton.addEventListener("click", function () { self.choose("groot"); });
  this.venomButton.addEventListener("click", function () { self.choose("venom"); });
  this.gate("Разделить поток", "Отправляй свет и древесную энергию Грутику, тёмную материю — Веному. При сигнале ИНВЕРСИЯ правила меняются местами.", function () {
    self.nextItem();
  });
}

SplitGame.prototype = Object.create(GameBase.prototype);
SplitGame.prototype.constructor = SplitGame;

SplitGame.prototype.updateStats = function () {
  this.stats.textContent = this.score + " / " + this.goal + "  ·  " + "◆".repeat(this.stability);
};

SplitGame.prototype.nextItem = function () {
  if (this.done) return;
  this.turn++;
  this.reversed = this.turn % 5 === 0 || this.turn % 5 === 1 && this.turn > 5;
  this.mode.textContent = this.reversed ? "ИНВЕРСИЯ ПРАВИЛ" : "ОБЫЧНЫЙ РЕЖИМ";
  this.root.classList.toggle("is-reversed", this.reversed);
  this.item = SPLIT_ITEMS[Math.floor(Math.random() * SPLIT_ITEMS.length)];
  this.cardMark.textContent = this.item.mark;
  this.cardName.textContent = this.item.name;
  this.card.classList.remove("good", "bad");
  this.active = true;
  this.startedAt = performance.now();
  this.duration = Math.max(1150, 2350 - this.score * 70);
  this.tick(this.startedAt);
};

SplitGame.prototype.tick = function (time) {
  if (!this.active || this.done) return;
  var left = Math.max(0, 1 - (time - this.startedAt) / this.duration);
  this.timerFill.style.transform = "scaleX(" + left + ")";
  if (left <= 0) {
    this.answer(false, "Время вышло");
    return;
  }
  var self = this;
  this.frame(function (next) { self.tick(next); });
};

SplitGame.prototype.choose = function (side) {
  if (!this.active || this.done) return;
  var expected = this.reversed ? (this.item.side === "groot" ? "venom" : "groot") : this.item.side;
  this.answer(side === expected, side === expected ? "Точно" : "Не тот поток");
};

SplitGame.prototype.answer = function (correct, message) {
  this.active = false;
  this.card.classList.add(correct ? "good" : "bad");
  if (correct) {
    this.score++;
    this.status.textContent = message + ". Баланс держится.";
  } else {
    this.score = Math.max(0, this.score - 1);
    this.stability--;
    if (this.stability <= 0) {
      this.stability = 3;
      this.score = Math.max(0, this.score - 1);
      this.status.textContent = "Баланс сорван, но Грутик удержал симбиота.";
    } else {
      this.status.textContent = message + ". Стабильность снижена.";
    }
  }
  this.updateStats();
  if (this.score >= this.goal) {
    this.complete("Грутик и Веном синхронизированы");
    return;
  }
  var self = this;
  this.later(function () { self.nextItem(); }, 520);
};

var CIRCUIT_PATH = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function CircuitGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.moves = 0;
  this.size = 4;
  this.arena.classList.add("circuit-arena");
  this.board = gameEl("div", "circuit-board");
  this.arena.appendChild(this.board);
  this.tiles = [];
  this.buildCircuit();
  this.updatePower();
  this.gate("Подать питание", "Поворачивай элементы. Свет должен пройти непрерывно от левого верхнего входа через все 16 узлов.", function () {});
}

CircuitGame.prototype = Object.create(GameBase.prototype);
CircuitGame.prototype.constructor = CircuitGame;

CircuitGame.prototype.directionBetween = function (a, b) {
  var ar = Math.floor(a / this.size), ac = a % this.size;
  var br = Math.floor(b / this.size), bc = b % this.size;
  if (br < ar) return 0;
  if (bc > ac) return 1;
  if (br > ar) return 2;
  return 3;
};

CircuitGame.prototype.buildCircuit = function () {
  var pathIndex = {};
  CIRCUIT_PATH.forEach(function (cell, i) { pathIndex[cell] = i; });
  var self = this;
  for (var cell = 0; cell < 16; cell++) {
    var pos = pathIndex[cell];
    var correct = [];
    if (pos === 0) correct.push(3);
    else correct.push(this.directionBetween(cell, CIRCUIT_PATH[pos - 1]));
    if (pos === CIRCUIT_PATH.length - 1) correct.push(3);
    else correct.push(this.directionBetween(cell, CIRCUIT_PATH[pos + 1]));
    var rotation = Math.floor(Math.random() * 4);
    var button = gameEl("button", "circuit-tile");
    button.setAttribute("aria-label", "Повернуть узел " + (cell + 1));
    button.addEventListener("click", (function (idx) { return function () { self.rotate(idx); }; })(cell));
    this.board.appendChild(button);
    this.tiles.push({ el: button, correct: correct, rotation: rotation });
  }
  if (this.tiles.every(function (tile) { return tile.rotation === 0; })) this.tiles[5].rotation = 1;
  this.renderTiles();
};

CircuitGame.prototype.connections = function (tile) {
  return tile.correct.map(function (dir) { return (dir + tile.rotation) % 4; });
};

CircuitGame.prototype.renderTiles = function () {
  var self = this;
  this.tiles.forEach(function (tile) {
    tile.el.innerHTML = "";
    self.connections(tile).forEach(function (dir) {
      tile.el.appendChild(gameEl("span", "wire d" + dir));
    });
    tile.el.appendChild(gameEl("i", "circuit-core"));
  });
};

CircuitGame.prototype.rotate = function (idx) {
  if (this.done) return;
  this.tiles[idx].rotation = (this.tiles[idx].rotation + 1) % 4;
  this.moves++;
  this.renderTiles();
  this.updatePower();
};

CircuitGame.prototype.updatePower = function () {
  var powered = {};
  var queue = [];
  var firstConnections = this.connections(this.tiles[0]);
  if (firstConnections.indexOf(3) !== -1) {
    powered[0] = true;
    queue.push(0);
  }
  while (queue.length) {
    var cell = queue.shift();
    var row = Math.floor(cell / this.size), col = cell % this.size;
    var current = this.connections(this.tiles[cell]);
    for (var i = 0; i < current.length; i++) {
      var dir = current[i];
      var nr = row + DIRS[dir][1], nc = col + DIRS[dir][0];
      if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) continue;
      var next = nr * this.size + nc;
      if (this.connections(this.tiles[next]).indexOf((dir + 2) % 4) === -1 || powered[next]) continue;
      powered[next] = true;
      queue.push(next);
    }
  }
  var count = Object.keys(powered).length;
  this.tiles.forEach(function (tile, i) { tile.el.classList.toggle("powered", !!powered[i]); });
  this.stats.textContent = count + " / 16";
  this.status.textContent = "Ходов: " + this.moves + ". Под напряжением: " + count + " узлов.";
  var last = this.tiles[CIRCUIT_PATH[CIRCUIT_PATH.length - 1]];
  if (count === 16 && this.connections(last).indexOf(3) !== -1) this.complete("Колесо снова под напряжением");
};

function FinaleGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.phase = 0;
  this.phaseScore = 0;
  this.arena.classList.add("finale-arena");
  this.phaseLabel = gameEl("div", "finale-phase", "ФАЗА 1 / 3");
  this.stage = gameEl("div", "finale-stage");
  this.arena.appendChild(this.phaseLabel);
  this.arena.appendChild(this.stage);
  this.stats.textContent = "0%";
  var self = this;
  this.gate("Начать финал", "Три фазы без перезапуска: запомни код, удержи баланс и нанеси три точных импульса.", function () {
    self.startEcho();
  });
}

FinaleGame.prototype = Object.create(GameBase.prototype);
FinaleGame.prototype.constructor = FinaleGame;

FinaleGame.prototype.setPhase = function (n, status) {
  this.phase = n;
  this.phaseLabel.textContent = "ФАЗА " + (n + 1) + " / 3";
  this.stats.textContent = Math.round(n / 3 * 100) + "%";
  this.status.textContent = status;
  this.stage.innerHTML = "";
};

FinaleGame.prototype.startEcho = function () {
  this.setPhase(0, "Запомни пятизначный код.");
  this.finalTiles = [];
  this.finalSequence = [];
  this.finalInput = 0;
  this.finalLocked = true;
  var grid = gameEl("div", "finale-code");
  var self = this;
  for (var i = 0; i < 6; i++) {
    var tile = gameEl("button", "finale-code-tile", String(i + 1));
    tile.addEventListener("click", (function (idx) { return function () { self.finalEchoPick(idx); }; })(i));
    grid.appendChild(tile);
    this.finalTiles.push(tile);
  }
  this.stage.appendChild(grid);
  while (this.finalSequence.length < 5) {
    var n = Math.floor(Math.random() * 6);
    if (this.finalSequence[this.finalSequence.length - 1] !== n) this.finalSequence.push(n);
  }
  this.showFinalCode();
};

FinaleGame.prototype.showFinalCode = function () {
  var self = this;
  this.finalLocked = true;
  this.finalInput = 0;
  this.finalSequence.forEach(function (idx, step) {
    self.later(function () {
      self.finalTiles[idx].classList.add("signal");
      self.later(function () { self.finalTiles[idx].classList.remove("signal"); }, 330);
    }, 300 + step * 520);
  });
  this.later(function () {
    self.finalLocked = false;
    self.status.textContent = "Повтори код.";
  }, 480 + this.finalSequence.length * 520);
};

FinaleGame.prototype.finalEchoPick = function (idx) {
  if (this.finalLocked || this.done) return;
  if (idx !== this.finalSequence[this.finalInput]) {
    this.status.textContent = "Код сбился. Смотри ещё раз.";
    this.showFinalCode();
    return;
  }
  this.finalTiles[idx].classList.add("correct");
  var tile = this.finalTiles[idx];
  this.later(function () { tile.classList.remove("correct"); }, 250);
  this.finalInput++;
  if (this.finalInput === this.finalSequence.length) {
    var self = this;
    this.finalLocked = true;
    this.stats.textContent = "33%";
    this.status.textContent = "Код принят.";
    this.later(function () { self.startBalance(); }, 650);
  }
};

FinaleGame.prototype.startBalance = function () {
  this.setPhase(1, "Направляй сигнал по стрелке. При инверсии — наоборот.");
  this.balanceScore = 0;
  this.balanceTurn = 0;
  this.balanceCue = gameEl("div", "balance-cue");
  var actions = gameEl("div", "balance-actions");
  var left = gameEl("button", "balance-button", "←");
  var right = gameEl("button", "balance-button", "→");
  actions.appendChild(left);
  actions.appendChild(right);
  this.stage.appendChild(this.balanceCue);
  this.stage.appendChild(actions);
  var self = this;
  left.addEventListener("click", function () { self.balancePick("left"); });
  right.addEventListener("click", function () { self.balancePick("right"); });
  this.nextBalance();
};

FinaleGame.prototype.nextBalance = function () {
  this.balanceTurn++;
  this.balanceExpected = Math.random() < 0.5 ? "left" : "right";
  this.balanceReverse = this.balanceTurn === 3 || this.balanceTurn === 7;
  this.balanceCue.className = "balance-cue" + (this.balanceReverse ? " reverse" : "");
  this.balanceCue.textContent = (this.balanceReverse ? "ИНВЕРСИЯ  " : "") + (this.balanceExpected === "left" ? "←" : "→");
  this.balanceActive = true;
};

FinaleGame.prototype.balancePick = function (side) {
  if (!this.balanceActive || this.done) return;
  var correct = this.balanceReverse ? side !== this.balanceExpected : side === this.balanceExpected;
  if (!correct) {
    this.status.textContent = "Баланс качнулся. Читай режим перед стрелкой.";
    this.balanceCue.classList.add("bad");
    return;
  }
  this.balanceActive = false;
  this.balanceScore++;
  this.balanceCue.classList.add("good");
  if (this.balanceScore >= 8) {
    var self = this;
    this.stats.textContent = "66%";
    this.status.textContent = "Баланс удержан.";
    this.later(function () { self.startPulse(); }, 600);
    return;
  }
  var selfNext = this;
  this.later(function () { selfNext.nextBalance(); }, 260);
};

FinaleGame.prototype.startPulse = function () {
  this.setPhase(2, "Три точных импульса. Коридор будет сужаться.");
  this.finalHits = 0;
  this.finalPulseRunning = true;
  this.finalPulse = gameEl("div", "final-pulse");
  this.finalPulseTarget = gameEl("span", "final-pulse-target");
  this.finalPulseCursor = gameEl("i", "final-pulse-cursor");
  this.finalPulse.appendChild(this.finalPulseTarget);
  this.finalPulse.appendChild(this.finalPulseCursor);
  this.finalPulseButton = gameEl("button", "pulse-lock", "ИМПУЛЬС");
  this.stage.appendChild(this.finalPulse);
  this.stage.appendChild(this.finalPulseButton);
  var self = this;
  this.finalPulseButton.addEventListener("click", function () { self.finalLock(); });
  this.newFinalPulse();
  this.finalPulseLoop(performance.now());
};

FinaleGame.prototype.newFinalPulse = function () {
  this.finalTargetWidth = 0.14 - this.finalHits * 0.025;
  this.finalTargetStart = 0.1 + Math.random() * (0.8 - this.finalTargetWidth);
  this.finalPulseTarget.style.left = this.finalTargetStart * 100 + "%";
  this.finalPulseTarget.style.width = this.finalTargetWidth * 100 + "%";
};

FinaleGame.prototype.finalPulseLoop = function (time) {
  if (!this.finalPulseRunning || this.done) return;
  this.finalPosition = (Math.sin(time * (0.0016 + this.finalHits * 0.0003)) + 1) / 2;
  this.finalPulseCursor.style.left = this.finalPosition * 100 + "%";
  var self = this;
  this.frame(function (next) { self.finalPulseLoop(next); });
};

FinaleGame.prototype.finalLock = function () {
  if (!this.finalPulseRunning || this.done) return;
  this.finalPulseRunning = false;
  var hit = this.finalPosition >= this.finalTargetStart && this.finalPosition <= this.finalTargetStart + this.finalTargetWidth;
  this.finalPulse.classList.add(hit ? "hit" : "miss");
  if (hit) {
    this.finalHits++;
    this.stats.textContent = 66 + this.finalHits * 11 + "%";
    this.status.textContent = "Попадание " + this.finalHits + " из 3.";
    if (this.finalHits >= 3) {
      this.stats.textContent = "100%";
      this.complete("Финальная форма разблокирована");
      return;
    }
  } else {
    this.status.textContent = "Мимо. Последний этап требует точности.";
  }
  var self = this;
  this.later(function () {
    self.finalPulse.classList.remove("hit", "miss");
    self.newFinalPulse();
    self.finalPulseRunning = true;
    self.finalPulseLoop(performance.now());
  }, 500);
};
