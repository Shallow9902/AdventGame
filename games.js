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
  var isTest = this.opts.isTest || (typeof isTestMode === "function" && isTestMode()) || (typeof window !== "undefined" && (window.__testMode || window.__simulatedDay != null || window.__previewDay != null));
  if (isTest) {
    var skipBtn = gameEl("button", "game-btn-skip", "⏩ Пропустить");
    skipBtn.type = "button";
    skipBtn.setAttribute("title", "Быстро завершить мини-игру и перейти к диалогам (тест)");
    var self = this;
    skipBtn.addEventListener("click", function () {
      if (typeof window !== "undefined" && typeof window.skipCurrentGame === "function") {
        window.skipCurrentGame();
      } else {
        self.complete("Испытание пропущено");
      }
    });
    head.appendChild(skipBtn);
  }

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
  if (typeof window !== "undefined") window.__currentGame = this;
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
  this.gateBtn = btn;
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
  this.completedMessage = text || "Испытание пройдено";
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
  canvas.height = 960;
  var ctx = canvas.getContext("2d");
  var gradient = ctx.createLinearGradient(0, 0, 720, 960);
  gradient.addColorStop(0, "#44253b");
  gradient.addColorStop(1, "#15111a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 960);
  ctx.strokeStyle = "rgba(243,93,145,.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(360, 430, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f7edf3";
  ctx.font = "700 42px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("ВАДИМ И СОНЕЧКА", 360, 430);
  ctx.fillStyle = "#bca8b3";
  ctx.font = "24px system-ui";
  ctx.fillText("photos/couple.webp", 360, 480);
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

function photoPieceEdges(index, rows, cols, allEdges) {
  var row = Math.floor(index / cols);
  var col = index % cols;
  var edges = {
    top: row === 0 ? 0 : -allEdges[index - cols].bottom,
    left: col === 0 ? 0 : -allEdges[index - 1].right,
    right: col === cols - 1 ? 0 : ((row * 3 + col) % 2 ? -1 : 1),
    bottom: row === rows - 1 ? 0 : ((row + col * 2) % 2 ? 1 : -1)
  };
  allEdges[index] = edges;
  return edges;
}

function PhotoPuzzleGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.root.classList.add("protocol-my-shell");
  this.rows = opts.rows || 4;
  this.cols = opts.cols || 3;
  this.moves = 0;
  this.selected = null;
  this.drag = null;
  this.unitX = 16;
  this.unitY = 16;
  this.photos = (opts.photos || (opts.photo ? [opts.photo] : [])).filter(function (photo) { return !!photo; }).slice(0, 3);
  if (!this.photos.length) this.photos.push("");
  this.currentPhotoIndex = 0;
  this.image = this.photos[0];
  this.clipPrefix = "photo-piece-" + (++photoClipCounter) + "-";
  this.manualConnections = 0;
  this.nextVenomChargeAt = 3;
  this.venomCharges = 0;
  this.dialogueSeen = {};
  this.pieces = [];
  this.solvedPhotos = [false, false, false];

  this.arena.classList.add("photo-puzzle-arena", "protocol-my-arena");
  this.phaseLabel = gameEl("div", "protocol-phase", "Пазл 1 из " + this.photos.length);
  this.stage = gameEl("div", "protocol-stage");
  this.arena.appendChild(this.phaseLabel);
  this.arena.appendChild(this.stage);

  var self = this;
  this.stats.textContent = "ПАЗЛ 1 / " + this.photos.length;
  this.gate("Начать", "Собери нашу фотографию из кусочков пазла.", function () {
    self.startPhotoPuzzle(0);
  });
}

PhotoPuzzleGame.prototype = Object.create(GameBase.prototype);
PhotoPuzzleGame.prototype.constructor = PhotoPuzzleGame;

PhotoPuzzleGame.prototype.unlockedPhotoCount = function () {
  return this.currentPhotoIndex + 1;
};

PhotoPuzzleGame.prototype.startRestorePhase = function () {
  this.startPhotoPuzzle(0);
};

PhotoPuzzleGame.prototype.startPhotoPuzzle = function (index) {
  this.currentPhotoIndex = index;
  this.image = this.photos[index];
  this.phaseLabel.textContent = "Пазл " + (index + 1) + " из " + this.photos.length;
  this.stage.innerHTML = "";
  this.edges = [];
  this.pieceStates = [];
  this.pieces = [];
  this.selected = null;
  this.manualConnections = 0;
  this.nextVenomChargeAt = 3;
  this.venomCharges = 0;
  this.dialogueSeen = {};

  this.slotsBar = gameEl("div", "protocol-puzzle-slots");
  var self = this;
  this.photos.forEach(function (photo, i) {
    var slot = gameEl("div", "puzzle-slot");
    if (self.solvedPhotos[i]) {
      slot.classList.add("completed");
      slot.innerHTML = '<span class="slot-num">✓</span><span class="slot-title">Фото ' + (i + 1) + '</span>';
    } else if (i === index) {
      slot.classList.add("active");
      slot.innerHTML = '<span class="slot-num">' + (i + 1) + '</span><span class="slot-title">Фото ' + (i + 1) + '</span>';
      slot.title = "Удерживай, чтобы увидеть оригинал фото";
      slot.addEventListener("pointerdown", function () { self.preview.classList.remove("hidden"); });
      slot.addEventListener("pointerup", function () { self.preview.classList.add("hidden"); });
      slot.addEventListener("pointercancel", function () { self.preview.classList.add("hidden"); });
      slot.addEventListener("pointerleave", function () { self.preview.classList.add("hidden"); });
    } else {
      slot.classList.add("locked");
      slot.innerHTML = '<span class="slot-num">🔒</span><span class="slot-title">Фото ' + (i + 1) + ' (скрыто)</span>';
    }
    self.slotsBar.appendChild(slot);
  });

  this.photoBoard = gameEl("div", "photo-workspace protocol-photo-workspace");
  this.assemblyFrame = gameEl("div", "photo-assembly-frame");
  this.assemblyFrame.innerHTML = '<span class="assembly-frame-hint">Область сборки</span>';
  this.photoBoard.appendChild(this.assemblyFrame);
  this.preview = gameEl("div", "photo-preview hidden");

  for (var pieceIndex = 0; pieceIndex < this.rows * this.cols; pieceIndex++) {
    photoPieceEdges(pieceIndex, this.rows, this.cols, this.edges);
    this.pieceStates.push({ x: 0, y: 0, group: pieceIndex, rotation: 0 });
    var piece = this.createPhotoPiece(pieceIndex);
    this.pieces[pieceIndex] = piece;
    this.photoBoard.appendChild(piece);
  }

  var initialDialogue = "Грутик: «Я есть Грутик». (Давай начнём с краёв!)";
  if (index === 1) {
    initialDialogue = "Веном: «Второй пазл! Мы поможем соединить». · Грутик: «Я есть Грутик». (Только аккуратно!)";
  } else if (index === 2) {
    initialDialogue = "Грутик: «Я есть Грутик!» (Финальное фото! Справимся вместе!) · Веном: «Мы соберём!»";
  }
  this.restoreDialogue = gameEl("div", "protocol-inline-dialogue", initialDialogue);

  var controls = gameEl("div", "protocol-photo-controls");
  this.liftPiecesButton = gameEl("button", "btn protocol-lift-btn", "⬆ Несобранные детали наверх");
  this.liftPiecesButton.addEventListener("click", function () { self.liftUnassembledPieces(); });
  controls.appendChild(this.liftPiecesButton);

  this.stage.appendChild(this.slotsBar);
  this.stage.appendChild(this.restoreDialogue);
  this.stage.appendChild(this.photoBoard);
  this.stage.appendChild(controls);
  this.stage.appendChild(this.preview);

  this.loadPhoto();
  this.scatterPhotoPieces();
  this.renderPhoto();
  this.status.textContent = "Соединяй подходящие кусочки пазла.";
};

PhotoPuzzleGame.prototype.loadPhoto = function () {
  var self = this;
  if (!this.image) {
    this.image = puzzleFallback();
    return;
  }
  if (typeof Image === "undefined") {
    this.renderPhoto();
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
  if (!button.dataset) button.dataset = {};
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
  image.setAttribute("x", -(index % this.cols) * 100);
  image.setAttribute("y", -Math.floor(index / this.cols) * 100);
  image.setAttribute("width", this.cols * 100);
  image.setAttribute("height", this.rows * 100);
  image.setAttribute("preserveAspectRatio", "none");
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
  var marginZones = [
    { x: 3, y: 3 }, { x: 4, y: 28 }, { x: 3, y: 52 }, { x: 5, y: 76 },
    { x: 79, y: 3 }, { x: 78, y: 28 }, { x: 80, y: 52 }, { x: 77, y: 76 },
    { x: 28, y: 1 }, { x: 54, y: 1 }, { x: 28, y: 83 }, { x: 54, y: 83 }
  ];
  gameShuffle(marginZones);
  for (var index = 0; index < this.pieceStates.length; index++) {
    var base = marginZones[index % marginZones.length];
    var jx = (Math.random() - 0.5) * 5;
    var jy = (Math.random() - 0.5) * 5;
    var rx = Math.max(1, Math.min(99 - this.unitX, base.x + jx));
    var ry = Math.max(1, Math.min(99 - this.unitY, base.y + jy));
    this.pieceStates[index].x = Math.round(rx * 10) / 10;
    this.pieceStates[index].y = Math.round(ry * 10) / 10;
    this.pieceStates[index].rotation = Math.round((Math.random() * 20 - 10) * 10) / 10;
  }
};

PhotoPuzzleGame.prototype.liftUnassembledPieces = function () {
  var self = this;
  var groupSizes = {};
  this.pieceStates.forEach(function (state) {
    groupSizes[state.group] = (groupSizes[state.group] || 0) + 1;
  });

  var maxGroupSize = 1;
  var mainGroup = null;
  Object.keys(groupSizes).forEach(function (grp) {
    if (groupSizes[grp] > maxGroupSize) {
      maxGroupSize = groupSizes[grp];
      mainGroup = Number(grp);
    }
  });

  var mainBounds = null;
  if (mainGroup !== null && maxGroupSize > 1) {
    var minX = 100, minY = 100, maxX = 0, maxY = 0;
    this.pieceStates.forEach(function (state) {
      if (state.group === mainGroup) {
        if (state.x < minX) minX = state.x;
        if (state.y < minY) minY = state.y;
        if (state.x + self.unitX > maxX) maxX = state.x + self.unitX;
        if (state.y + self.unitY > maxY) maxY = state.y + self.unitY;
      }
    });
    mainBounds = { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  var rescuedCount = 0;
  this.pieces.forEach(function (piece, index) {
    if (!piece) return;
    var state = self.pieceStates[index];
    var isUnassembled = (maxGroupSize > 1) ? (groupSizes[state.group] < maxGroupSize) : true;

    if (isUnassembled) {
      if (self.photoBoard && self.photoBoard.appendChild) {
        self.photoBoard.appendChild(piece);
      }
      piece.style.zIndex = "40";
      if (piece.classList) {
        piece.classList.add("lifted");
        piece.classList.remove("piece-pulse");
        if (piece.offsetWidth !== undefined) {
          try { void piece.offsetWidth; } catch (e) {}
        }
        piece.classList.add("piece-pulse");
      }

      if (mainBounds) {
        var pLeft = state.x;
        var pRight = state.x + self.unitX;
        var pTop = state.y;
        var pBottom = state.y + self.unitY;
        var overlaps = !(pRight <= mainBounds.minX || pLeft >= mainBounds.maxX || pBottom <= mainBounds.minY || pTop >= mainBounds.maxY);

        if (overlaps) {
          rescuedCount++;
          if (pLeft < 50) {
            state.x = Math.round((2 + Math.random() * 5) * 10) / 10;
          } else {
            state.x = Math.round((98 - self.unitX - Math.random() * 5) * 10) / 10;
          }
          state.y = Math.max(2, Math.min(98 - self.unitY, state.y));
        }
      }
    } else {
      piece.style.zIndex = "5";
      if (piece.classList) {
        piece.classList.remove("lifted");
      }
    }
  });

  this.renderPhoto();

  if (rescuedCount > 0) {
    this.status.textContent = "Несобранные детали подняты наверх и освобождены из-под собранной части!";
  } else {
    this.status.textContent = "Несобранные детали подняты на передний план!";
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
    piece.style.width = self.unitX + "%";
    piece.style.transform = "rotate(" + state.rotation + "deg)";
    piece.classList.toggle("selected", state.group === self.selected);
    piece.classList.toggle("connected", self.groupMembers(state.group).length > 1);
  });
  this.preview.style.backgroundImage = "url(\"" + this.image + "\")";
  var connections = this.connectionCount();
  this.stats.textContent = "Связей: " + connections + "/" + (this.rows * this.cols - 1);
  if (this.venomAssistButton) {
    this.venomAssistButton.textContent = "🖤 Соединить · " + this.venomCharges;
    this.venomAssistButton.disabled = this.venomCharges < 1;
  }
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

PhotoPuzzleGame.prototype.connectionCount = function () {
  return this.rows * this.cols - this.groupCount();
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
  var joins = 0;
  var searching = true;
  while (searching) {
    searching = false;
    var members = this.groupMembers(movingGroup);
    for (var m = 0; m < members.length && !searching; m++) {
      var current = members[m];
      var row = Math.floor(current / this.cols);
      var col = current % this.cols;
      var neighbors = [];
      if (col > 0) neighbors.push(current - 1);
      if (col < this.cols - 1) neighbors.push(current + 1);
      if (row > 0) neighbors.push(current - this.cols);
      if (row < this.rows - 1) neighbors.push(current + this.cols);
      for (var n = 0; n < neighbors.length; n++) {
        var neighbor = neighbors[n];
        var otherGroup = this.pieceStates[neighbor].group;
        if (otherGroup === movingGroup) continue;
        var dc = neighbor % this.cols - col;
        var dr = Math.floor(neighbor / this.cols) - row;
        var targetX = this.pieceStates[neighbor].x - dc * this.unitX;
        var targetY = this.pieceStates[neighbor].y - dr * this.unitY;
        if (Math.abs(this.pieceStates[current].x - targetX) > 6 || Math.abs(this.pieceStates[current].y - targetY) > 6) continue;
        this.shiftGroup(movingGroup, targetX - this.pieceStates[current].x, targetY - this.pieceStates[current].y);
        this.groupMembers(movingGroup).forEach(function (index) { this.pieceStates[index].group = otherGroup; }, this);
        movingGroup = otherGroup;
        this.groupMembers(movingGroup).forEach(function (index) { this.pieceStates[index].rotation = 0; }, this);
        snapped = true;
        joins++;
        searching = true;
        break;
      }
    }
  }
  this.selected = movingGroup;
  if (snapped) this.recordPhotoConnection(true, joins);
  this.clampPhotoGroup(movingGroup);
  this.renderPhoto();
  if (this.groupCount() === 1) {
    this.onPuzzleSolved();
  } else if (snapped) {
    this.status.textContent = "Края совпали. Осталось отдельных групп: " + this.groupCount() + ".";
  } else {
    this.status.textContent = "Края пока не совпадают.";
  }
  return snapped;
};

PhotoPuzzleGame.prototype.recordPhotoConnection = function (manual, joins) {
  var connections = this.connectionCount();
  this.lastConnectionHadDialogue = false;
  if (manual) {
    this.manualConnections += joins || 1;
    while (this.manualConnections >= this.nextVenomChargeAt) {
      this.venomCharges = Math.min(2, this.venomCharges + 1);
      this.nextVenomChargeAt += 3;
    }
  }
  var lines = {
    1: "Веном: «Мы поможем с краями». · Грутик: «Я есть Грутик». (Аккуратно, не помни!)",
    5: "Веном: «Можно посмотреть?» · Грутик: «Я есть Грутик!» (Собираем дальше!)",
    9: "Веном: «Красиво...» · Грутик: «Я есть Грутик!» (Почти готово!)"
  };
  var latestLine = "";
  [1, 5, 9].forEach(function (threshold) {
    if (connections >= threshold && !this.dialogueSeen[threshold]) {
      this.dialogueSeen[threshold] = true;
      latestLine = lines[threshold];
    }
  }, this);
  if (latestLine) {
    this.lastConnectionHadDialogue = true;
    if (this.restoreDialogue) this.restoreDialogue.textContent = latestLine;
  }
};

PhotoPuzzleGame.prototype.findHintPair = function () {
  for (var index = 0; index < this.pieceStates.length; index++) {
    var row = Math.floor(index / this.cols);
    var col = index % this.cols;
    var candidates = [];
    if (col < this.cols - 1) candidates.push(index + 1);
    if (row < this.rows - 1) candidates.push(index + this.cols);
    for (var i = 0; i < candidates.length; i++) {
      if (this.pieceStates[index].group !== this.pieceStates[candidates[i]].group) return [index, candidates[i]];
    }
  }
  return null;
};

PhotoPuzzleGame.prototype.showGrootHint = function () {
  if (!this.grootHintButton || this.grootHintButton.disabled) return;
  var pair = this.findHintPair();
  if (!pair) return;
  var self = this;
  pair.forEach(function (index) { self.pieces[index].classList.add("hinted"); });
  this.grootHintButton.disabled = true;
  this.status.textContent = "Грутик подсветил два соседних края.";
  this.later(function () {
    pair.forEach(function (index) { self.pieces[index].classList.remove("hinted"); });
  }, 3000);
  this.later(function () {
    if (self.grootHintButton) self.grootHintButton.disabled = false;
  }, 15000);
};

PhotoPuzzleGame.prototype.joinPhotoPair = function (current, neighbor, manual) {
  var movingGroup = this.pieceStates[current].group;
  var otherGroup = this.pieceStates[neighbor].group;
  if (movingGroup === otherGroup) return false;
  var col = current % this.cols;
  var row = Math.floor(current / this.cols);
  var dc = neighbor % this.cols - col;
  var dr = Math.floor(neighbor / this.cols) - row;
  var targetX = this.pieceStates[neighbor].x - dc * this.unitX;
  var targetY = this.pieceStates[neighbor].y - dr * this.unitY;
  this.shiftGroup(movingGroup, targetX - this.pieceStates[current].x, targetY - this.pieceStates[current].y);
  this.groupMembers(movingGroup).forEach(function (index) {
    this.pieceStates[index].group = otherGroup;
  }, this);
  this.groupMembers(otherGroup).forEach(function (index) {
    this.pieceStates[index].rotation = 0;
  }, this);
  this.selected = otherGroup;
  this.recordPhotoConnection(manual, 1);
  this.clampPhotoGroup(otherGroup);
  this.renderPhoto();
  if (this.groupCount() === 1) {
    this.onPuzzleSolved();
  }
  return true;
};

PhotoPuzzleGame.prototype.useVenomAssist = function () {
  if (this.venomCharges < 1) return false;
  var pair = this.findHintPair();
  if (!pair) return false;
  this.venomCharges--;
  var joined = this.joinPhotoPair(pair[0], pair[1], false);
  if (joined) {
    this.status.textContent = "Веном помог соединить кусочки пазла!";
    if (this.restoreDialogue && !this.lastConnectionHadDialogue) {
      this.restoreDialogue.textContent = "Веном: «Мы соединили!» · Грутик: «Я есть Грутик». (Молодец, подошло!)";
    }
  }
  return joined;
};

PhotoPuzzleGame.prototype.clampPhotoGroup = function (group) {
  var members = this.groupMembers(group);
  if (!members.length) return;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  members.forEach(function (index) {
    var state = this.pieceStates[index];
    minX = Math.min(minX, state.x);
    minY = Math.min(minY, state.y);
    maxX = Math.max(maxX, state.x + this.unitX);
    maxY = Math.max(maxY, state.y + this.unitY);
  }, this);
  var dx = minX < 1 ? 1 - minX : maxX > 99 ? 99 - maxX : 0;
  var dy = minY < 1 ? 1 - minY : maxY > 99 ? 99 - maxY : 0;
  if (dx || dy) this.shiftGroup(group, dx, dy);
};

PhotoPuzzleGame.prototype.resetPhotoLayout = function () {
  var groups = {};
  this.pieceStates.forEach(function (state) { groups[state.group] = true; });
  Object.keys(groups).forEach(function (group) { this.clampPhotoGroup(Number(group)); }, this);
  this.renderPhoto();
  this.status.textContent = "Все собранные группы возвращены в доступную область.";
};

PhotoPuzzleGame.prototype.startPhotoDrag = function (event, index) {
  if (this.done || (event.button != null && event.button !== 0)) return;
  var group = this.pieceStates[index].group;
  var members = this.groupMembers(group);
  var starts = {};
  var self = this;
  members.forEach(function (member) {
    starts[member] = { x: self.pieceStates[member].x, y: self.pieceStates[member].y };
    self.pieceStates[member].rotation = 0;
    self.pieces[member].classList.add("dragging");
    if (self.photoBoard && self.photoBoard.appendChild) {
      self.photoBoard.appendChild(self.pieces[member]);
    }
  });
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
  this.clampPhotoGroup(drag.group);
  this.tryPhotoSnap(drag.index);
};

PhotoPuzzleGame.prototype.onPuzzleSolved = function () {
  var index = this.currentPhotoIndex;
  this.solvedPhotos[index] = true;
  var originX = (100 - this.unitX * this.cols) / 2;
  var originY = (100 - this.unitY * this.rows) / 2;
  var anchor = this.pieceStates[0];
  this.shiftGroup(this.pieceStates[0].group, originX - anchor.x, originY - anchor.y);
  this.renderPhoto();
  this.photoBoard.classList.add("assembled");

  if (this.slotsBar && this.slotsBar.children[index]) {
    this.slotsBar.children[index].className = "puzzle-slot completed";
    this.slotsBar.children[index].innerHTML = '<span class="slot-num">✓</span><span class="slot-title">Фото ' + (index + 1) + '</span>';
  }

  this.showPuzzleCompletionCard(index);
};

PhotoPuzzleGame.prototype.showPuzzleCompletionCard = function (index) {
  var self = this;
  var hasNext = index + 1 < this.photos.length;

  var finalCard = gameEl("div", "protocol-final-card");
  var titleText = hasNext ? ("Фотография " + (index + 1) + " собрана! ✨") : "Все 3 фотографии собраны! 🏆";
  var subText = index === 0 ? "Вадим · Сонечка" : hasNext ? "Ещё одно тёплое воспоминание открыто!" : "Ваша коллекция воспоминаний полностью восстановлена!";

  finalCard.appendChild(gameEl("strong", null, titleText));
  finalCard.appendChild(gameEl("span", null, subText));

  var btnWrap = gameEl("div", "protocol-card-actions");

  var continueBtn = gameEl("button", "btn btn-primary big protocol-continue", "Продолжить к колесу ✦");
  continueBtn.addEventListener("click", function () {
    self.complete(hasNext ? "Фотография восстановлена!" : "Все фотографии собраны!");
  });
  btnWrap.appendChild(continueBtn);

  if (hasNext) {
    var nextIndex = index + 1;
    var nextBtn = gameEl("button", "btn big protocol-next-puzzle", "Собрать следующий пазл (" + (nextIndex + 1) + " из " + self.photos.length + ") 🧩");
    nextBtn.addEventListener("click", function () {
      self.startPhotoPuzzle(nextIndex);
    });
    btnWrap.appendChild(nextBtn);
  }

  finalCard.appendChild(btnWrap);
  this.stage.appendChild(finalCard);
  this.status.textContent = hasNext
    ? "Отлично! Можно пойти дальше к колесу или собрать следующий пазл."
    : "Потрясающе! Все 3 фотографии собраны!";
  this.stats.textContent = "СОБРАНО: " + (index + 1) + "/" + this.photos.length;
};

PhotoPuzzleGame.prototype.destroy = function () {
  GameBase.prototype.destroy.call(this);
};

var UNTANGLE_ROUNDS = [
  {
    name: "Дрейф в пустоте",
    hint: "Сигнал из глубокого космоса запутался в звёздном ветре. Разведи нити.",
    nodes: [
      { x: 50, y: 14, label: "✦" },
      { x: 84, y: 32, label: "✦" },
      { x: 84, y: 68, label: "✦" },
      { x: 50, y: 86, label: "✦" },
      { x: 16, y: 68, label: "✦" },
      { x: 16, y: 32, label: "✦" },
      { x: 50, y: 50, label: "●" }
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4], [1, 6]],
    scramble: [
      { x: 84, y: 68 },
      { x: 16, y: 32 },
      { x: 50, y: 14 },
      { x: 16, y: 68 },
      { x: 84, y: 32 },
      { x: 50, y: 86 },
      { x: 50, y: 50 }
    ]
  },
  {
    name: "Сигнал из Бездны",
    hint: "Чужой космический ритм пробивается сквозь тёмные помехи. Очисти каналы связи.",
    nodes: [
      { x: 18, y: 18, label: "✦" },
      { x: 82, y: 18, label: "✦" },
      { x: 82, y: 82, label: "✦" },
      { x: 18, y: 82, label: "✦" },
      { x: 36, y: 36, label: "✦" },
      { x: 64, y: 36, label: "✦" },
      { x: 64, y: 64, label: "✦" },
      { x: 36, y: 64, label: "✦" }
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [0, 5]
    ],
    scramble: [
      { x: 82, y: 82 },
      { x: 82, y: 18 },
      { x: 36, y: 64 },
      { x: 64, y: 64 },
      { x: 36, y: 36 },
      { x: 18, y: 82 },
      { x: 64, y: 36 },
      { x: 18, y: 18 }
    ]
  },
  {
    name: "Тёмный Клинтар",
    hint: "Симбиотическая сеть пытается замкнуть узлы. Распутай тёмную паутину.",
    nodes: [
      { x: 50, y: 14, label: "✦" },
      { x: 84, y: 28, label: "✦" },
      { x: 84, y: 72, label: "✦" },
      { x: 50, y: 86, label: "✦" },
      { x: 16, y: 72, label: "✦" },
      { x: 16, y: 28, label: "✦" },
      { x: 50, y: 36, label: "✦" },
      { x: 66, y: 64, label: "✦" },
      { x: 34, y: 64, label: "✦" }
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [6, 7], [7, 8], [8, 6],
      [0, 6], [1, 6], [2, 7], [3, 7], [4, 8]
    ],
    scramble: [
      { x: 66, y: 64 },
      { x: 16, y: 72 },
      { x: 50, y: 14 },
      { x: 84, y: 72 },
      { x: 34, y: 64 },
      { x: 84, y: 28 },
      { x: 50, y: 86 },
      { x: 16, y: 28 },
      { x: 50, y: 36 }
    ]
  },
  {
    name: "Созвездие «МЫ»",
    hint: "Финальный резонанс: восстанови истинную форму нашего созвездия.",
    nodes: [
      { x: 50, y: 34, label: "✦" },
      { x: 30, y: 16, label: "В", special: "vadim", name: "Вадим" },
      { x: 14, y: 40, label: "✦" },
      { x: 28, y: 68, label: "✦" },
      { x: 50, y: 88, label: "♥", special: "heart" },
      { x: 72, y: 68, label: "✦" },
      { x: 86, y: 40, label: "✦" },
      { x: 70, y: 16, label: "С", special: "sonya", name: "Соня" },
      { x: 50, y: 52, label: "24.07", special: "date", name: "24.07.24" }
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
      [8, 0], [8, 4], [8, 2], [8, 6]
    ],
    scramble: [
      { x: 28, y: 68 },
      { x: 70, y: 16 },
      { x: 72, y: 68 },
      { x: 50, y: 34 },
      { x: 86, y: 40 },
      { x: 30, y: 16 },
      { x: 50, y: 88 },
      { x: 14, y: 40 },
      { x: 50, y: 52 }
    ]
  }
];

function linesCross(p1, p2, p3, p4) {
  var d1 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
  var d2 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
  var d3 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  var d4 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);
  var eps = 0.0001;
  return (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
          ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps)));
}

function relationshipDays(dateString) {
  var parts = String(dateString || "").split("-");
  if (parts.length !== 3) return 0;
  var start = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var now = new Date();
  var current = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((current - start) / 86400000) + 1);
}

function relationshipDayWord(days) {
  var mod100 = days % 100;
  var mod10 = days % 10;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function EchoGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.relationship = opts.relationship || { him: "Вадим", her: "Сонечка", shortHer: "Соня", startDate: "2024-07-24", constellationCode: "VS-240724" };
  this.round = 0;
  this.totalRounds = UNTANGLE_ROUNDS.length;
  this.activeDrag = null;
  this.roundSolved = false;
  this.crossingsCount = 0;

  this.arena.classList.add("untangle-arena");

  this.sky = gameEl("div", "untangle-sky");
  this.sky.appendChild(gameEl("div", "untangle-nebula"));

  this.board = gameEl("div", "untangle-board");
  this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  this.svg.setAttribute("class", "untangle-svg");
  this.svg.setAttribute("viewBox", "0 0 100 100");
  this.svg.setAttribute("preserveAspectRatio", "none");
  this.board.appendChild(this.svg);

  this.starsContainer = gameEl("div", "untangle-stars");
  this.board.appendChild(this.starsContainer);
  this.sky.appendChild(this.board);

  var controls = gameEl("div", "untangle-controls");
  this.crossBadge = gameEl("div", "untangle-cross-badge");
  controls.appendChild(this.crossBadge);

  var resetBtn = gameEl("button", "untangle-reset-btn", "↺ Сброс");
  resetBtn.type = "button";
  resetBtn.setAttribute("title", "Сбросить звёзды в начало раунда");
  var self = this;
  resetBtn.addEventListener("click", function () {
    if (!self.roundSolved) self.resetRoundPositions();
  });
  controls.appendChild(resetBtn);
  this.sky.appendChild(controls);

  var days = relationshipDays(this.relationship.startDate);
  this.registry = gameEl("div", "astro-registry");
  this.registry.appendChild(gameEl("strong", null, this.relationship.constellationCode));
  this.registry.appendChild(gameEl("span", null, days + " " + relationshipDayWord(days) + " на одной орбите"));
  this.sky.appendChild(this.registry);

  this.arena.appendChild(this.sky);

  this.startRound(0);
  this.gate("Распутать нити", "Тёмная субстанция стянула звёздную карту в тугие узлы. Перетаскивай звёзды так, чтобы ни одна линия не пересекалась с другой.", function () {});
}

EchoGame.prototype = Object.create(GameBase.prototype);
EchoGame.prototype.constructor = EchoGame;

EchoGame.prototype.startRound = function (roundIdx) {
  this.round = roundIdx;
  this.roundSolved = false;
  var data = UNTANGLE_ROUNDS[this.round];
  this.currentData = data;

  this.positions = data.scramble.map(function (p) {
    return { x: p.x, y: p.y };
  });

  this.buildSvgLines();
  this.buildStarElements();
  this.updateCrossings();
  this.updateStats();
  this.status.textContent = data.hint;
};

EchoGame.prototype.resetRoundPositions = function () {
  var data = this.currentData;
  this.positions = data.scramble.map(function (p) {
    return { x: p.x, y: p.y };
  });
  this.updateElementsPosition();
  this.updateCrossings();
  this.playTone(180, 0.1, "sine");
};

EchoGame.prototype.buildSvgLines = function () {
  this.svg.innerHTML = "";
  this.lineElements = [];
  var edges = this.currentData.edges;
  for (var i = 0; i < edges.length; i++) {
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "untangle-line");
    this.svg.appendChild(line);
    this.lineElements.push(line);
  }
  this.updateLinesCoordinates();
};

EchoGame.prototype.buildStarElements = function () {
  this.starsContainer.innerHTML = "";
  this.starElements = [];
  var nodes = this.currentData.nodes;
  var self = this;

  for (var i = 0; i < nodes.length; i++) {
    (function (idx) {
      var n = nodes[idx];
      var star = gameEl("button", "untangle-star");
      star.type = "button";
      star.setAttribute("aria-label", n.name || ("Звезда " + (idx + 1)));

      if (n.special) star.classList.add("star-" + n.special);
      if (n.label) {
        var label = gameEl("span", "star-label", n.label);
        star.appendChild(label);
      }
      var core = gameEl("span", "star-core");
      star.appendChild(core);

      star.addEventListener("pointerdown", function (e) {
        self.onStarPointerDown(idx, star, e);
      });

      self.starsContainer.appendChild(star);
      self.starElements.push(star);
    })(i);
  }
  this.updateElementsPosition();
};

EchoGame.prototype.updateLinesCoordinates = function () {
  var edges = this.currentData.edges;
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var p1 = this.positions[e[0]];
    var p2 = this.positions[e[1]];
    var line = this.lineElements[i];
    if (line && p1 && p2) {
      line.setAttribute("x1", p1.x);
      line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x);
      line.setAttribute("y2", p2.y);
    }
  }
};

EchoGame.prototype.updateElementsPosition = function () {
  for (var i = 0; i < this.starElements.length; i++) {
    var el = this.starElements[i];
    var p = this.positions[i];
    if (el && p) {
      el.style.left = p.x + "%";
      el.style.top = p.y + "%";
    }
  }
  this.updateLinesCoordinates();
};

EchoGame.prototype.onStarPointerDown = function (idx, starEl, e) {
  if (this.roundSolved || this.done) return;
  e.preventDefault();
  this.activeDrag = {
    index: idx,
    pointerId: e.pointerId,
    element: starEl
  };
  starEl.classList.add("dragging");
  if (starEl.setPointerCapture) {
    try { starEl.setPointerCapture(e.pointerId); } catch (err) { }
  }
  this.playTone(280 + idx * 40, 0.05, "sine");

  var self = this;
  var onMove = function (moveEvent) {
    if (!self.activeDrag || self.activeDrag.index !== idx) return;
    moveEvent.preventDefault();
    var rect = self.board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var px = ((moveEvent.clientX - rect.left) / rect.width) * 100;
    var py = ((moveEvent.clientY - rect.top) / rect.height) * 100;

    px = Math.max(8, Math.min(92, px));
    py = Math.max(8, Math.min(92, py));

    self.positions[idx].x = px;
    self.positions[idx].y = py;
    starEl.style.left = px + "%";
    starEl.style.top = py + "%";

    self.updateLinesCoordinates();
    self.updateCrossings();
  };

  var onUp = function (upEvent) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (!self.activeDrag) return;
    starEl.classList.remove("dragging");
    self.activeDrag = null;
    self.checkSolved();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
};

EchoGame.prototype.updateCrossings = function () {
  var edges = this.currentData.edges;
  var crossedMap = {};
  var count = 0;

  for (var i = 0; i < edges.length; i++) {
    for (var j = i + 1; j < edges.length; j++) {
      var e1 = edges[i];
      var e2 = edges[j];
      // Adjacent edges sharing a vertex do not cross
      if (e1[0] === e2[0] || e1[0] === e2[1] || e1[1] === e2[0] || e1[1] === e2[1]) continue;

      if (linesCross(this.positions[e1[0]], this.positions[e1[1]], this.positions[e2[0]], this.positions[e2[1]])) {
        crossedMap[i] = true;
        crossedMap[j] = true;
        count++;
      }
    }
  }

  for (var k = 0; k < edges.length; k++) {
    var line = this.lineElements[k];
    if (line) {
      if (crossedMap[k]) {
        line.setAttribute("class", "untangle-line crossed");
      } else {
        line.setAttribute("class", "untangle-line clean");
      }
    }
  }

  this.crossingsCount = count;
  this.crossBadge.innerHTML = count === 0
    ? '<span class="zero">✓ 0 пересечений</span>'
    : '<span class="count">' + count + '</span> ' + (count === 1 ? 'пересечение' : (count < 5 ? 'пересечения' : 'пересечений'));

  if (count === 0 && !this.roundSolved) {
    this.onRoundClear();
  }
};

EchoGame.prototype.updateStats = function () {
  this.stats.innerHTML = '<span class="echo-round-name">' + this.currentData.name.toUpperCase() + '</span> ' + (this.round + 1) + ' / ' + this.totalRounds;
};

EchoGame.prototype.checkSolved = function () {
  if (this.crossingsCount === 0 && !this.roundSolved) {
    this.onRoundClear();
  }
};

EchoGame.prototype.onRoundClear = function () {
  this.roundSolved = true;
  var self = this;

  for (var i = 0; i < this.lineElements.length; i++) {
    this.lineElements[i].setAttribute("class", "untangle-line solved");
  }
  for (var j = 0; j < this.starElements.length; j++) {
    this.starElements[j].classList.add("solved");
  }

  this.playChord([523.25, 659.25, 783.99]); // C - E - G major chord

  if (this.round < this.totalRounds - 1) {
    this.status.textContent = "Узел распутан! Нити засияли чистым светом.";
    this.later(function () {
      self.startRound(self.round + 1);
    }, 1100);
  } else {
    this.finishGame();
  }
};

EchoGame.prototype.finishGame = function () {
  this.status.textContent = "Сонечка, моё небо начинается с тебя.";
  this.stats.innerHTML = '<span class="echo-round-name">СОЗВЕЗДИЕ СВЕТИТСЯ</span>';

  this.board.classList.add("constellation-revealed");

  var card = gameEl("div", "echo-final-card astro-final-card");
  card.appendChild(gameEl("span", "echo-final-kicker", this.relationship.constellationCode));
  card.appendChild(gameEl("strong", null, "Созвездие «24 июля»"));
  card.appendChild(gameEl("p", null, "Вадим · Соня"));
  card.appendChild(gameEl("em", null, "Нити сошлись. Все координаты на месте."));

  var continueBtn = gameEl("button", "echo-final-btn", "Продолжить ✦");
  continueBtn.type = "button";
  continueBtn.setAttribute("title", "Вернуться к Грутику");
  var self = this;
  var finished = false;
  var proceed = function () {
    if (finished) return;
    finished = true;
    continueBtn.disabled = true;
    self.complete("Звёздные нити распутаны");
  };

  continueBtn.addEventListener("click", proceed);
  card.appendChild(continueBtn);
  this.sky.appendChild(card);

  this.playChord([523.25, 659.25, 783.99, 1046.50]); // Full C major octave chord
};

EchoGame.prototype.playTone = function (freq, duration, type) {
  try {
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!this.audioContext) this.audioContext = new AudioCtor();
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    var osc = this.audioContext.createOscillator();
    var gain = this.audioContext.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, this.audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + (duration || 0.2));
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + (duration || 0.2) + 0.05);
  } catch (e) { }
};

EchoGame.prototype.playChord = function (freqs) {
  var self = this;
  freqs.forEach(function (f, i) {
    self.later(function () {
      self.playTone(f, 0.45, "triangle");
    }, i * 70);
  });
};

EchoGame.prototype.destroy = function () {
  GameBase.prototype.destroy.call(this);
  if (this.audioContext && this.audioContext.close) {
    try { this.audioContext.close(); } catch (e) { }
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

var CIRCUIT_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
var CIRCUIT_LEVELS = [
  { size: 3, pathLength: 7, name: "Запуск", copy: "Собери первый маршрут" },
  { size: 4, pathLength: 13, name: "Стабилизация", copy: "Найди путь среди ложных проводов" },
  { size: 5, pathLength: 21, name: "Полная мощность", copy: "Доведи импульс прямо до колеса" }
];

function circuitDirectionBetween(a, b, size) {
  var ar = Math.floor(a / size), ac = a % size;
  var br = Math.floor(b / size), bc = b % size;
  if (br < ar) return 0;
  if (bc > ac) return 1;
  if (br > ar) return 2;
  return 3;
}

function circuitSignature(directions, rotation) {
  return directions.map(function (dir) { return (dir + (rotation || 0)) % 4; }).sort().join(",");
}

function circuitNeighbors(cell, size) {
  var row = Math.floor(cell / size), col = cell % size;
  var neighbors = [];
  for (var dir = 0; dir < CIRCUIT_DIRS.length; dir++) {
    var nr = row + CIRCUIT_DIRS[dir][1], nc = col + CIRCUIT_DIRS[dir][0];
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    neighbors.push({ cell: nr * size + nc, dir: dir });
  }
  return neighbors;
}

function circuitExitDirection(cell, size) {
  var row = Math.floor(cell / size), col = cell % size;
  var sides = [];
  if (row === 0) sides.push(0);
  if (col === size - 1) sides.push(1);
  if (row === size - 1) sides.push(2);
  if (col === 0) sides.push(3);
  gameShuffle(sides);
  return sides[0];
}

function circuitPoweredCells(level, rotations) {
  var powered = {};
  var rotated = function (cell) {
    return level.connections[cell].map(function (dir) { return (dir + rotations[cell]) % 4; });
  };
  if (!level.path || !level.path.length || rotated(level.source).indexOf(level.sourceDir) === -1) return powered;
  powered[level.source] = true;
  for (var i = 1; i < level.path.length; i++) {
    var previous = level.path[i - 1];
    var cell = level.path[i];
    var dir = circuitDirectionBetween(previous, cell, level.size);
    if (rotated(previous).indexOf(dir) === -1 || rotated(cell).indexOf((dir + 2) % 4) === -1) break;
    powered[cell] = true;
  }
  return powered;
}

function circuitPoweredNetwork(level, rotations) {
  var powered = {};
  var rotated = function (cell) {
    return level.connections[cell].map(function (dir) { return (dir + rotations[cell]) % 4; });
  };
  if (rotated(level.source).indexOf(level.sourceDir) === -1) return powered;
  powered[level.source] = true;
  var queue = [level.source];
  while (queue.length) {
    var cell = queue.shift();
    var row = Math.floor(cell / level.size), col = cell % level.size;
    var directions = rotated(cell);
    for (var i = 0; i < directions.length; i++) {
      var dir = directions[i];
      var nextRow = row + CIRCUIT_DIRS[dir][1];
      var nextCol = col + CIRCUIT_DIRS[dir][0];
      if (nextRow < 0 || nextRow >= level.size || nextCol < 0 || nextCol >= level.size) continue;
      var next = nextRow * level.size + nextCol;
      if (powered[next] || rotated(next).indexOf((dir + 2) % 4) === -1) continue;
      powered[next] = true;
      queue.push(next);
    }
  }
  return powered;
}

function countCircuitSolutions(level, limit) {
  var maxSolutions = limit || 2;
  if (!level.path || level.path.length < 2 || level.path[0] !== level.source || level.path[level.path.length - 1] !== level.target) return 0;
  if (new Set(level.path).size !== level.path.length) return 0;
  var solutions = 1;
  for (var i = 0; i < level.path.length; i++) {
    var cell = level.path[i];
    if (i > 0 && circuitNeighbors(level.path[i - 1], level.size).every(function (neighbor) { return neighbor.cell !== cell; })) return 0;
    var correct = circuitSignature(level.connections[cell], 0);
    var turns = level.fixed.indexOf(cell) !== -1 ? [0] : [0, 1, 2, 3];
    var seen = {};
    var matching = 0;
    turns.forEach(function (rotation) {
      var signature = circuitSignature(level.connections[cell], rotation);
      if (seen[signature]) return;
      seen[signature] = true;
      if (signature === correct) matching++;
    });
    solutions *= matching;
    if (solutions === 0 || solutions >= maxSolutions) return Math.min(solutions, maxSolutions);
  }
  return solutions;
}

function scrambleCircuit(connections, level) {
  var rotations = connections.map(function () { return Math.floor(Math.random() * 4); });
  var rotatable = [];
  connections.forEach(function (directions, index) {
    if (level.fixed.indexOf(index) !== -1) {
      rotations[index] = 0;
      return;
    }
    var correct = circuitSignature(directions, 0);
    var wrongTurns = [];
    for (var turns = 1; turns < 4; turns++) {
      if (circuitSignature(directions, turns) !== correct) wrongTurns.push(turns);
    }
    if (wrongTurns.length) rotatable.push({ index: index, turns: wrongTurns });
  });
  gameShuffle(rotatable);
  var wrongGoal = Math.ceil(rotatable.length * 0.7);
  for (var i = 0; i < wrongGoal; i++) {
    var item = rotatable[i];
    item.turns = gameShuffle(item.turns);
    rotations[item.index] = item.turns[0];
  }

  var powered = circuitPoweredCells(level, rotations);
  var guard = 0;
  while (Object.keys(powered).length > 2 && guard++ < connections.length) {
    var poweredCells = Object.keys(powered).map(Number).filter(function (cell) { return level.fixed.indexOf(cell) === -1; });
    var changed = false;
    for (var p = poweredCells.length - 1; p >= 0; p--) {
      var poweredCell = poweredCells[p];
      var correctSignature = circuitSignature(connections[poweredCell], 0);
      var breakingTurns = [1, 2, 3].filter(function (turns) {
        return circuitSignature(connections[poweredCell], turns) !== correctSignature;
      });
      if (!breakingTurns.length) continue;
      rotations[poweredCell] = breakingTurns[0];
      changed = true;
      break;
    }
    if (!changed) break;
    powered = circuitPoweredCells(level, rotations);
  }
  return { rotations: rotations, initialPowered: Object.keys(powered).length };
}

function buildCircuitCandidate(size, levelIndex) {
  var total = size * size;
  var source = 0;
  var sourceDir = 3;
  var definition = CIRCUIT_LEVELS[levelIndex] || CIRCUIT_LEVELS[CIRCUIT_LEVELS.length - 1];
  var desiredLength = Math.min(total - 1, definition.pathLength);
  var path = [source];
  var visited = Array(total).fill(false);
  var searched = 0;
  visited[source] = true;

  function isBorder(cell) {
    var row = Math.floor(cell / size), col = cell % size;
    return row === 0 || row === size - 1 || col === 0 || col === size - 1;
  }

  function extendPath(cell) {
    if (++searched > 200000) return false;
    if (path.length === desiredLength) return cell !== source && isBorder(cell);
    var options = circuitNeighbors(cell, size).filter(function (neighbor) { return !visited[neighbor.cell]; });
    gameShuffle(options);
    for (var optionIndex = 0; optionIndex < options.length; optionIndex++) {
      var nextCell = options[optionIndex].cell;
      visited[nextCell] = true;
      path.push(nextCell);
      if (extendPath(nextCell)) return true;
      path.pop();
      visited[nextCell] = false;
    }
    return false;
  }

  if (!extendPath(source)) return null;

  var connections = Array.from({ length: total }, function () { return []; });
  connections[source].push(sourceDir);
  for (var i = 1; i < path.length; i++) {
    var previous = path[i - 1], current = path[i];
    var direction = circuitDirectionBetween(previous, current, size);
    connections[previous].push(direction);
    connections[current].push((direction + 2) % 4);
  }
  var target = path[path.length - 1];
  var targetDir = circuitExitDirection(target, size);
  connections[target].push(targetDir);

  var pathLookup = {};
  path.forEach(function (cell) { pathLookup[cell] = true; });
  var decoys = [];
  for (var cellIndex = 0; cellIndex < total; cellIndex++) {
    if (pathLookup[cellIndex]) continue;
    decoys.push(cellIndex);
    connections[cellIndex].push(Math.floor(Math.random() * 4));
  }

  var level = {
    size: size,
    levelIndex: levelIndex || 0,
    source: source,
    sourceDir: sourceDir,
    target: target,
    targetDir: targetDir,
    fixed: [source, target],
    path: path,
    decoys: decoys,
    connections: connections
  };
  return level;
}

function generateCircuitLevel(size, levelIndex) {
  for (var attempt = 0; attempt < 500; attempt++) {
    var level = buildCircuitCandidate(size, levelIndex);
    if (!level) continue;
    if (countCircuitSolutions(level, 2) !== 1) continue;
    var scrambled = scrambleCircuit(level.connections, level);
    if (scrambled.initialPowered > 2) continue;
    level.rotations = scrambled.rotations;
    level.initialPowered = scrambled.initialPowered;
    level.solutionCount = 1;
    return level;
  }
  throw new Error("Не удалось создать однозначную схему " + size + "×" + size);
}

function formatCircuitNodeCount(count) {
  var mod100 = count % 100;
  var mod10 = count % 10;
  var word = "узлов";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "узел";
    else if (mod10 >= 2 && mod10 <= 4) word = "узла";
  }
  return count + " " + word;
}

function CircuitGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.levels = CIRCUIT_LEVELS.slice();
  this.levelIndex = 0;
  this.started = false;
  this.levelSolved = false;
  this.moves = 0;
  this.arena.classList.add("circuit-arena");

  this.panel = gameEl("div", "circuit-panel");
  this.route = gameEl("div", "circuit-route");
  this.route.innerHTML = '<span class="circuit-route-source">🌿 ГРУТИК</span><i></i><span class="circuit-route-target">🎡 КОЛЕСО</span>';
  this.panel.appendChild(this.route);

  this.fuseBar = gameEl("div", "circuit-fuses");
  for (var fuse = 0; fuse < 4; fuse++) this.fuseBar.appendChild(gameEl("i", "circuit-fuse"));
  this.panel.appendChild(this.fuseBar);

  this.board = gameEl("div", "circuit-board");
  this.panel.appendChild(this.board);
  this.levelNote = gameEl("div", "circuit-level-note");
  this.panel.appendChild(this.levelNote);
  this.arena.appendChild(this.panel);
  this.tiles = [];
  this.startLevel(0, false);
  var self = this;
  this.gate("Подать питание", "Собери длинный путь от Грутика к колесу. Не каждый провод ведёт к цели.", function () {
    self.startCurrentLevel();
  });
}

CircuitGame.prototype = Object.create(GameBase.prototype);
CircuitGame.prototype.constructor = CircuitGame;

CircuitGame.prototype.startLevel = function (index, autoStart) {
  this.levelIndex = index;
  this.size = this.levels[index].size;
  this.level = generateCircuitLevel(this.size, index);
  this.started = !!autoStart;
  this.levelSolved = false;
  this.moves = 0;
  this.fuseStage = 0;
  this.board.innerHTML = "";
  this.board.style.gridTemplateColumns = "repeat(" + this.size + ", 1fr)";
  this.board.classList.toggle("is-live", this.started);
  this.levelNote.textContent = "КОНТУР " + (index + 1) + "/" + this.levels.length + " · " + this.levels[index].name + " — " + this.levels[index].copy;
  this.tiles = [];
  var self = this;
  for (var cell = 0; cell < this.size * this.size; cell++) {
    var button = gameEl("button", "circuit-tile");
    button.type = "button";
    button.disabled = !this.started || this.level.fixed.indexOf(cell) !== -1;
    button.setAttribute("aria-label", "Повернуть узел " + (cell + 1));
    button.addEventListener("click", (function (idx) { return function () { self.rotate(idx); }; })(cell));
    this.board.appendChild(button);
    this.tiles.push({
      el: button,
      correct: this.level.connections[cell].slice(),
      rotation: this.level.rotations[cell],
      source: cell === this.level.source,
      target: cell === this.level.target,
      fixed: this.level.fixed.indexOf(cell) !== -1,
      decoy: this.level.decoys.indexOf(cell) !== -1
    });
  }
  this.renderTiles();
  this.updatePower();
};

CircuitGame.prototype.startCurrentLevel = function () {
  if (this.done || this.levelSolved) return;
  this.started = true;
  this.board.classList.add("is-live");
  this.tiles.forEach(function (tile) { tile.el.disabled = tile.fixed; });
  this.updatePower();
  var firstInteractive = this.tiles.find(function (tile) { return !tile.fixed; });
  if (firstInteractive && typeof firstInteractive.el.focus === "function") firstInteractive.el.focus();
};

CircuitGame.prototype.connections = function (tile) {
  return tile.correct.map(function (dir) { return (dir + tile.rotation) % 4; });
};

CircuitGame.prototype.renderTiles = function () {
  var self = this;
  this.tiles.forEach(function (tile, index) {
    tile.el.innerHTML = "";
    self.connections(tile).forEach(function (dir) {
      tile.el.appendChild(gameEl("span", "wire d" + dir));
    });
    tile.el.appendChild(gameEl("i", "circuit-core"));
    tile.el.classList.toggle("source", tile.source);
    tile.el.classList.toggle("target", tile.target);
    tile.el.classList.toggle("fixed", tile.fixed);
    if (tile.source) tile.el.appendChild(gameEl("span", "circuit-terminal source-terminal", "🔒 ВХОД"));
    if (tile.target) tile.el.appendChild(gameEl("span", "circuit-terminal target-terminal", "🔒 ВЫХОД"));
    tile.el.setAttribute("aria-label", tile.fixed
      ? (tile.source ? "Закреплённый вход Грутика" : "Закреплённый выход к колесу")
      : "Повернуть узел " + (index + 1) + ", поворот " + tile.rotation + " из 3");
  });
};

CircuitGame.prototype.rotate = function (idx) {
  if (this.done || !this.started || this.levelSolved || this.level.fixed.indexOf(idx) !== -1) return;
  this.tiles[idx].rotation = (this.tiles[idx].rotation + 1) % 4;
  this.moves++;
  this.renderTiles();
  this.updatePower();
};

CircuitGame.prototype.updatePower = function () {
  var rotations = this.tiles.map(function (tile) { return tile.rotation; });
  var routePowered = circuitPoweredCells(this.level, rotations);
  var powered = circuitPoweredNetwork(this.level, rotations);
  var count = Object.keys(routePowered).length;
  var networkCount = Object.keys(powered).length;
  var visibleCount = this.started ? count : 0;
  var total = this.level.path.length;
  this.tiles.forEach(function (tile, i) {
    tile.el.classList.toggle("powered", this.started && !!powered[i]);
    tile.el.disabled = !this.started || this.levelSolved || tile.fixed;
  }, this);
  this.stats.textContent = "КОНТУР " + (this.levelIndex + 1) + "/" + this.levels.length + " · " + visibleCount + "/" + total;

  var reachedFuses = 0;
  for (var fuse = 0; fuse < this.fuseBar.children.length; fuse++) {
    var threshold = Math.ceil(total * (fuse + 1) / this.fuseBar.children.length);
    var active = visibleCount >= threshold;
    this.fuseBar.children[fuse].classList.toggle("active", active);
    if (active) reachedFuses++;
  }
  var pulse = "";
  if (this.started && reachedFuses > this.fuseStage) {
    this.fuseStage = reachedFuses;
    var pulses = ["Грутик: Первый участок ожил!", "Веном: Поток стабилизируется.", "Грутик: Почти получилось!", "Веном: Контур замкнут."];
    pulse = " " + pulses[Math.min(reachedFuses - 1, pulses.length - 1)];
    this.panel.classList.remove("power-pulse");
    void this.panel.offsetWidth;
    this.panel.classList.add("power-pulse");
  }
  this.status.textContent = this.started
    ? "Ходов: " + this.moves + ". Под напряжением: " + formatCircuitNodeCount(networkCount) + "." + pulse
    : "Схема обесточена. Нажми «Подать питание», чтобы начать.";

  var targetConnections = this.connections(this.tiles[this.level.target]);
  if (this.started && powered[this.level.target] && targetConnections.indexOf(this.level.targetDir) !== -1) this.finishLevel();
};

CircuitGame.prototype.finishLevel = function () {
  if (this.levelSolved || this.done) return;
  this.levelSolved = true;
  this.tiles.forEach(function (tile) { tile.el.disabled = true; });
  if (this.levelIndex === this.levels.length - 1) {
    this.complete("Все три маршрута ведут к колесу");
    return;
  }
  var result = gameEl("div", "game-result circuit-level-result");
  result.appendChild(gameEl("div", "result-mark", "⚡"));
  result.appendChild(gameEl("strong", null, "Контур «" + this.levels[this.levelIndex].name + "» восстановлен"));
  result.appendChild(gameEl("p", "gate-copy", "Мощность растёт. Следующая схема будет больше и сложнее."));
  var next = gameEl("button", "btn big", "Следующий контур →");
  var self = this;
  next.addEventListener("click", function () { self.advanceLevel(); });
  result.appendChild(next);
  this.arena.appendChild(result);
  this.levelOverlay = result;
};

CircuitGame.prototype.advanceLevel = function () {
  if (!this.levelSolved || this.levelIndex >= this.levels.length - 1) return;
  if (this.levelOverlay) this.levelOverlay.remove();
  this.levelOverlay = null;
  this.startLevel(this.levelIndex + 1, true);
};

function FinaleGame(container, opts, onWin) {
  GameBase.call(this, container, opts, onWin);
  this.phaseIndex = 0;
  this.solvedPhases = [false, false, false];
  this.lockIndex = 0; // backward compat
  this.solvedLocks = this.solvedPhases;

  this.arena.classList.add("finale-arena", "birthday-mechanism");

  this.phaseLabel = gameEl("div", "finale-phase birthday-phase", "СЮРПРИЗ 1 / 3 · ЛИСТЬЯ ГРУТИКА");

  this.dialogueBox = gameEl("div", "birthday-dialogue");
  this.dialogueSpeaker = gameEl("span", "birthday-dialogue-speaker sp-groot", "🌿 Грутик");
  this.dialogueLine = gameEl("p", "birthday-dialogue-text", "");
  this.dialogueBox.appendChild(this.dialogueSpeaker);
  this.dialogueBox.appendChild(this.dialogueLine);

  this.stage = gameEl("div", "finale-stage birthday-stage");

  this.nextPhaseWrap = gameEl("div", "birthday-nav hidden");
  this.nextPhaseBtn = gameEl("button", "btn-next-lock", "Дальше ➔");
  var self = this;
  this.nextPhaseBtn.addEventListener("click", function () { self.nextPhase(); });
  this.nextPhaseWrap.appendChild(this.nextPhaseBtn);
  this.nextLockWrap = this.nextPhaseWrap;
  this.nextLockBtn = this.nextPhaseBtn;

  this.arena.appendChild(this.phaseLabel);
  this.arena.appendChild(this.dialogueBox);
  this.arena.appendChild(this.stage);
  this.arena.appendChild(this.nextPhaseWrap);

  this.stats = gameEl("div", "hidden-stats", "0%"); // Keep for test compat
  this.arena.appendChild(this.stats);

  this.surprises = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG.finaleSurprises) || [
    { src: "", caption: "" }, { src: "", caption: "" }, { src: "", caption: "" }
  ];

  this.gate("Начать распаковку", "Грутик и Веном приготовили сюрпризы, но каждый упаковал их по-своему.", function () {
    self.startPhase(0);
  });
}

FinaleGame.prototype = Object.create(GameBase.prototype);
FinaleGame.prototype.constructor = FinaleGame;

FinaleGame.prototype.setDialogue = function (speaker, text, isVenom) {
  this.dialogueSpeaker.textContent = speaker;
  this.dialogueSpeaker.className = "birthday-dialogue-speaker " + (isVenom ? "sp-venom" : "sp-groot");
  this.dialogueLine.textContent = text;
};

FinaleGame.prototype.startPhase = function (index) {
  this.phaseIndex = index;
  this.lockIndex = index;
  this.nextPhaseWrap.classList.add("hidden");
  this.stage.innerHTML = "";
  this.stats.textContent = Math.round((index / 3) * 100) + "%";

  if (index === 0) {
    this.phaseLabel.textContent = "СЮРПРИЗ 1 / 3 · ЛИСТЬЯ ГРУТИКА";
    this.setDialogue("🌿 Грутик", "Я есть Грутик! (Я так старался украсить, что переборщил...)");
    this.buildLeaves();
  } else if (index === 1) {
    this.phaseLabel.textContent = "СЮРПРИЗ 2 / 3 · ЗАВЕСА ВЕНОМА";
    this.setDialogue("🖤 Веном", "Моя очередь. Очисти, если сможешь.", true);
    this.buildScratch();
  } else if (index === 2) {
    this.phaseLabel.textContent = "СЮРПРИЗ 3 / 3 · ГЛАВНЫЙ ПОДАРОК";
    this.setDialogue("🌿 Грутик", "Я ЕСТЬ ГРУТИК! (А это — мы вместе упаковывали!)");
    this.buildWrapper();
  }
};

FinaleGame.prototype.onPhaseSolved = function (idx, speaker, text, isVenom) {
  this.solvedPhases[idx] = true;
  this.solvedLocks[idx] = true;
  this.stats.textContent = Math.round(((idx + 1) / 3) * 100) + "%";
  this.setDialogue(speaker, text, isVenom);

  if (idx < 2) {
    this.nextPhaseWrap.classList.remove("hidden");
  } else {
    this.finishAll();
  }
};

FinaleGame.prototype.nextPhase = function () {
  this.nextLock();
};

FinaleGame.prototype.nextLock = function () {
  if (this.phaseIndex < 2) {
    this.startPhase(this.phaseIndex + 1);
  }
};

// ======================= PHASE 1: LEAVES =======================
FinaleGame.prototype.buildLeaves = function () {
  var self = this;
  var wrap = gameEl("div", "finale-unwrap-wrap");
  var photo = this.surprises[0];
  var img = gameEl("div", "unwrap-photo");
  img.style.backgroundImage = "url('" + encodeURI(photo.src) + "')";
  wrap.appendChild(img);

  var overlay = gameEl("div", "leaves-overlay");
  overlay.style.touchAction = "none"; // block scroll while swiping

  var cols = 8;
  var rows = 8;
  var totalLeaves = cols * rows;
  this.leafCount = totalLeaves;
  this.autoClearing = false;

  var popLeaf = function(el, force) {
    if (el.classList.contains("falling")) return;
    el.classList.add("falling");
    self.leafCount--;

    // Фишка: когда остается мало листиков, "ветер" сам сдувает остальные!
    if (self.leafCount <= totalLeaves * 0.25 && !self.autoClearing) {
      self.autoClearing = true;
      self.setDialogue("🌿 Грутик", "Я есть Грутик! (Ууу, ветер помогает!)");
      var remaining = overlay.querySelectorAll(".leaf:not(.falling)");
      remaining.forEach(function(l, i) {
        setTimeout(function() { popLeaf(l, true); }, Math.random() * 800 + i * 40);
      });
    }

    if (self.leafCount <= 0 && !self.solvedPhases[0]) {
      setTimeout(function() {
        self.onPhaseSolved(0, "🌿 Грутик", "Я есть Грутик! (" + (photo.caption || "Красиво получилось!") + ")");
      }, 500);
    }
  };

  // Generate dense grid with random offset, scale, and color
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var leaf = gameEl("div", "leaf");
      
      if (Math.random() < 0.15) {
        leaf.classList.add("flower");
      }

      var px = (c / (cols - 1) * 110) - 5 + (Math.random() * 10 - 5);
      var py = (r / (rows - 1) * 110) - 5 + (Math.random() * 10 - 5);
      
      leaf.style.left = px + "%";
      leaf.style.top = py + "%";
      
      var rot = Math.random() * 360;
      var scale = 0.8 + Math.random() * 1.2; 
      var hue = Math.random() * 100 - 40; 
      var br = 0.7 + Math.random() * 0.5;
      
      leaf.style.setProperty("--rot", rot + "deg");
      leaf.style.setProperty("--scale", scale);
      leaf.style.setProperty("--hue", hue + "deg");
      leaf.style.setProperty("--br", br);
      
      overlay.appendChild(leaf);
    }
  }

  // Swipe / wipe mechanics
  var handleMove = function(clientX, clientY) {
    var el = document.elementFromPoint(clientX, clientY);
    if (el && (el.classList.contains("leaf") || el.classList.contains("flower"))) {
      popLeaf(el);
    }
  };

  overlay.addEventListener("touchmove", function(e) {
    e.preventDefault();
    for (var i = 0; i < e.touches.length; i++) {
      handleMove(e.touches[i].clientX, e.touches[i].clientY);
    }
  });
  
  overlay.addEventListener("mousemove", function(e) {
    if (e.buttons > 0) {
      handleMove(e.clientX, e.clientY);
    }
  });
  
  overlay.addEventListener("pointerdown", function(e) {
    handleMove(e.clientX, e.clientY);
  });

  wrap.appendChild(overlay);
  this.stage.appendChild(wrap);
};

// ======================= PHASE 2: SCRATCH =======================
FinaleGame.prototype.buildScratch = function () {
  var self = this;
  var wrap = gameEl("div", "finale-unwrap-wrap");
  var photo = this.surprises[1];
  var img = gameEl("div", "unwrap-photo");
  img.style.backgroundImage = "url('" + photo.src + "')";
  wrap.appendChild(img);

  var cvs = document.createElement("canvas");
  cvs.width = 300;
  cvs.height = 300;
  cvs.className = "venom-scratch";
  wrap.appendChild(cvs);
  this.stage.appendChild(wrap);

  var ctx = cvs.getContext ? cvs.getContext("2d") : null;
  if (ctx) {
    ctx.fillStyle = "#16102b";
    ctx.fillRect(0,0,300,300);
    ctx.fillStyle = "#2d1b4e";
    for(var i=0; i<30; i++){
      ctx.beginPath();
      ctx.arc(Math.random()*300, Math.random()*300, Math.random()*40+10, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("✨ Очисти меня ✨", 150, 150);
  }

  var scratching = false;
  var lastPos = null;
  
  function getPos(e) {
    var rect = cvs.getBoundingClientRect();
    var touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  
  function erase(p1, p2) {
    if(!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.lineWidth = 55;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  cvs.addEventListener("pointerdown", function(e) {
    scratching = true;
    if (cvs.setPointerCapture) cvs.setPointerCapture(e.pointerId);
    lastPos = getPos(e);
    erase(lastPos, lastPos);
  });
  
  cvs.addEventListener("pointermove", function(e) {
    if (!scratching) return;
    var p = getPos(e);
    erase(lastPos, p);
    lastPos = p;
  });

  var checkReveal = function() {
    if (self.solvedPhases[1] || !ctx) return;
    var imageData = ctx.getImageData(0, 0, 300, 300);
    var transparent = 0;
    // Check sparse pixels for performance
    var step = 4 * 10; 
    for (var p = 3; p < imageData.data.length; p += step) {
      if (imageData.data[p] < 10) transparent++;
    }
    var totalChecked = (300*300) / 10;
    if (transparent / totalChecked > 0.6) {
      cvs.style.opacity = "0";
      cvs.style.pointerEvents = "none";
      self.onPhaseSolved(1, "🖤 Веном", photo.caption || "Неплохо.", true);
    }
  };

  function endScratch(e) {
    if (scratching) {
      scratching = false;
      if (cvs.releasePointerCapture) cvs.releasePointerCapture(e.pointerId);
      checkReveal();
    }
  }

  cvs.addEventListener("pointerup", endScratch);
  cvs.addEventListener("pointercancel", endScratch);
  cvs.addEventListener("touchstart", function(e){ e.preventDefault(); });
  cvs.addEventListener("touchmove", function(e){ e.preventDefault(); });
};

// ======================= PHASE 3: WRAPPER =======================
FinaleGame.prototype.buildWrapper = function () {
  var self = this;
  var wrap = gameEl("div", "finale-unwrap-wrap wrapper-container");
  var photo = this.surprises[2];
  var img = gameEl("div", "unwrap-photo");
  img.style.backgroundImage = "url('" + photo.src + "')";
  wrap.appendChild(img);

  var left = gameEl("div", "wrapper-left");
  var right = gameEl("div", "wrapper-right");
  var bow = gameEl("div", "wrapper-bow", "🎀 Разорвать");

  var opened = false;
  var openAction = function() {
    if (opened) return;
    opened = true;
    left.classList.add("open");
    right.classList.add("open");
    bow.style.opacity = "0";
    setTimeout(function() {
      self.onPhaseSolved(2, "🌿 Грутик", photo.caption || "Я ЕСТЬ ГРУТИК!!! (С ДНЁМ РОЖДЕНИЯ!!!)");
    }, 700);
  };
  wrap.addEventListener("pointerdown", openAction);

  wrap.appendChild(left);
  wrap.appendChild(right);
  wrap.appendChild(bow);
  this.stage.appendChild(wrap);
};

// ======================= FINISH =======================
FinaleGame.prototype.finishAll = function () {
  this.phaseLabel.textContent = "🎂 ПРАЗДНИК ЗАПУЩЕН!";
  this.stage.classList.add("celebrating");
  try { if (typeof confetti === "function") confetti(); } catch (e) {}
  this.complete("Праздничный механизм запущен");
};

// ======================= SOLVERS =======================
FinaleGame.prototype.solveLock = function (idx) {
  this.solvePhase(idx);
};

FinaleGame.prototype.solvePhase = function (idx) {
  if (idx === 0) {
    this.leafCount = 0;
    this.onPhaseSolved(0, "🌿 Грутик", "Я есть Грутик! (Тест пройден)");
  } else if (idx === 1) {
    var cvs = this.stage.querySelector('canvas');
    if (cvs) { cvs.style.opacity = "0"; cvs.style.pointerEvents = "none"; }
    this.onPhaseSolved(1, "🖤 Веном", "Тест пройден.", true);
  } else if (idx === 2) {
    this.onPhaseSolved(2, "🌿 Грутик", "Тест пройден.");
  }
};

FinaleGame.prototype.solveCurrentLock = function () {
  this.solvePhase(this.phaseIndex);
};
