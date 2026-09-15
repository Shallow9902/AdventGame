(function () {
  "use strict";

  var KEY = "giftPoolAdvent_v1";
  var DAYS = SITE_CONFIG.days || 6;
  var DAY_MS = 86400000;
  var wheelRot = 0;
  var wheelSpinDay = 0;
  var currentGame = null;

  var state = loadState();
  if (typeof window !== "undefined") {
    window.__appState = state;
  }
  forceReset();
  forceDayIndex();

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return defaultState();
  }

  function defaultState() {
    return {
      start: null,
      started: false,
      introSeen: false,
      grootPlanted: false,
      venomInfected: false,
      venomControlled: false,
      finalForm: false,
      choices: {},
      speechSeen: [],
      won: [],
      givenDay: [],
      given: [],
      givenLog: []
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { }
    if (typeof window !== "undefined") {
      window.__appState = state;
    }
  }

  function forceReset() {
    var q = new URLSearchParams(location.search);
    if (q.has("reset")) {
      localStorage.removeItem(KEY);
      state = defaultState();
      if (typeof window !== "undefined") {
        window.__appState = state;
      }
    }
  }

  function forceDayIndex() {
    var q = new URLSearchParams(location.search);
    if (q.has("test") || q.has("debug") || q.has("skip")) {
      window.__testMode = true;
    }
    if (q.has("day")) {
      var d = parseInt(q.get("day"), 10);
      if (!isNaN(d) && d >= 1 && d <= DAYS) {
        window.__simulatedDay = d - 1;
        state.started = true;
        if (d === 1 && q.has("reset")) {
          // let intro run
        } else {
          state.introSeen = true;
          state.grootPlanted = true;
        }
        if (d >= 4) state.venomInfected = true;
        if (d >= 5) state.venomControlled = true;
        // Clean speechSeen, won, givenDay for this simulated day so the full storyline experience plays
        state.speechSeen = state.speechSeen.filter(function (x) { return x !== (d - 1); });
        state.won = state.won.filter(function (x) { return x !== (d - 1); });
        state.givenDay = state.givenDay.filter(function (x) { return x !== (d - 1); });
        save();
      }
    }
    if (q.has("preview")) {
      var n = parseInt(q.get("preview"), 10);
      window.__previewDay = Math.max(0, Math.min(DAYS - 1, (isNaN(n) ? 1 : n) - 1));
    }
    if (q.has("stage")) {
      var st = parseInt(q.get("stage"), 10);
      window.__stageForce = isNaN(st) ? null : st;
    }
    if (q.has("sleep")) {
      window.__forceSleeping = true;
    }
  }

  function isTestMode() {
    if (typeof window === "undefined") return true;
    if (window.__testMode) return true;
    if (window.__simulatedDay != null || window.__previewDay != null) return true;
    try {
      if (typeof location !== "undefined") {
        var q = new URLSearchParams(location.search);
        if (q.has("test") || q.has("debug") || q.has("dev") || q.has("day") || q.has("preview") || q.has("skip")) {
          return true;
        }
        if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:") {
          return true;
        }
      }
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("advent_test") === "1" || localStorage.getItem("advent_debug") === "1") {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }
  if (typeof window !== "undefined") {
    window.isTestMode = isTestMode;
  }

  function $(id) { return document.getElementById(id); }

  function todayMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function nextMidnight() {
    var d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  function parseStartDate() {
    if (SITE_CONFIG.startDate) {
      var parts = SITE_CONFIG.startDate.split("-");
      if (parts.length === 3) {
        var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }
    }
    return todayMidnight();
  }

  function getBaseStartDate() {
    if (SITE_CONFIG.startDate) return parseStartDate();
    if (!state.start) {
      state.start = todayMidnight();
      save();
    }
    return state.start;
  }

  function currentDayIdx() {
    if (window.__simulatedDay != null) return window.__simulatedDay;
    if (window.__previewDay != null) return window.__previewDay;
    if (!state.started) {
      state.started = true;
      if (!state.start) state.start = getBaseStartDate();
      save();
    }
    var base = getBaseStartDate();
    var diff = Math.floor((todayMidnight() - base) / DAY_MS);
    if (diff < 0) return 0;
    return Math.min(DAYS - 1, diff);
  }

  function normalizeGift(g, i) {
    var num = g.num != null ? g.num : (parseInt(String(g.id).replace(/\D/g, ""), 10) || (i + 1));
    return {
      id: g.id != null ? String(g.id) : "auto" + i,
      num: num,
      title: g.title || "Подарок #" + num,
      text: g.text || "",
      photo: g.photo || "",
      link: g.link || "",
      active: g.active !== false,
      specialDay: g.specialDay
    };
  }

  function pool() {
    return GIFT_POOL.map(normalizeGift).filter(function (g) {
      return g.active;
    });
  }

  function remainingPool(dayIdx) {
    var d = dayIdx != null ? dayIdx : activePlayDay();
    return pool().filter(function (g) {
      if (state.given.indexOf(g.id) !== -1) return false;
      if (g.specialDay != null) {
        return d >= g.specialDay;
      }
      return true;
    });
  }

  function getPendingSpinDay() {
    var cur = currentDayIdx();
    for (var d = 0; d <= cur; d++) {
      if (state.won.indexOf(d) !== -1 && state.givenDay.indexOf(d) === -1) return d;
    }
    return null;
  }

  function activePlayDay() {
    var pending = getPendingSpinDay();
    return pending != null ? pending : currentDayIdx();
  }

  function makeEl(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var dayGames = [
    { type: "memory", mark: "01", icon: "🌸", badge: "Память", desc: "12 пар наших фотографий", kicker: "ДЕНЬ 01 · ПАМЯТЬ", title: "Наши моменты", instruction: "Найди двенадцать пар фотографий.", photos: SITE_CONFIG.memoryPhotos, centerPhoto: SITE_CONFIG.memoryCenterPhoto },
    { type: "blockblast", mark: "02", icon: "🌿", badge: "Тактика", desc: "Бесконечный режим на рекорд", kicker: "ДЕНЬ 02 · ТАКТИКА", title: "Block Blast: корни", instruction: "Перетаскивай фигуры и открывай нашу фотографию.", lines: 7, photo: "photos/blockblast.jpg" },
    { type: "echo", mark: "03", icon: "✦", badge: "Головоломка", desc: "4 космических сектора", kicker: "ДЕНЬ 03 · ГОЛОВОЛОМКА", title: "Звёздные нити", instruction: "Перетаскивай звёзды так, чтобы нити не пересекались.", relationship: SITE_CONFIG.relationship },
    { type: "photoPuzzle", mark: "04", icon: "🧩", badge: "Пазл", desc: "Фотопазл из 16 кусочков", kicker: "ДЕНЬ 04 · ПАМЯТЬ", title: "Собери нашу фотографию", instruction: "Соедини шестнадцать фигурных деталей.", photo: SITE_CONFIG.couplePhoto, size: 4 },
    { type: "circuit", mark: "05", icon: "💡", badge: "Логика", desc: "Восстановление цепи питания", kicker: "ДЕНЬ 05 · ЛОГИКА", title: "Живая схема", instruction: "Верни питание колесу." },
    { type: "finale", mark: "06", icon: "🚀", badge: "Финал", desc: "3 фазы протокола SONECHKA", kicker: "ДЕНЬ 06 · ФИНАЛ", title: "Протокол SONECHKA", instruction: "Три фазы. Один финальный запуск." }
  ];


  function L(who, text, trans) { return { t: "line", who: who, text: text, trans: trans }; }
  function B(text, cb) { return { t: "btn", text: text, cb: cb }; }
  function W(ms) { return { t: "wait", ms: ms }; }
  function S(st) { return { t: "stage", stage: st }; }
  function F(fx, wait) { return { t: "fx", fx: fx, wait: wait || 0 }; }
  function FN(fn) { return { t: "fn", fn: fn }; }
  function C(key, prompt, options) { return { t: "choice", key: key, prompt: prompt, options: options }; }

  var storyQueue = [];
  var storyCB = null;
  var storyBusy = false;
  var storyMode = "line";

  function playStory(steps, cb) {
    storyQueue = steps.slice();
    storyCB = cb;
    storyBusy = true;
    storyMode = "line";
    hideScreens();
    setCompanionVisible(false);
    $("confettiLayer").innerHTML = "";
    $("screenStory").classList.add("active");
    $("storyLine").textContent = "";
    $("storySpeaker").textContent = "";
    $("storyNext").classList.remove("hidden");
    $("storyBtn").classList.add("hidden");
    $("storyChoices").classList.add("hidden");
    $("storyChoices").innerHTML = "";
    fxClear();
    storyAdvance();
  }

  function storyAdvance() {
    var s = storyQueue.shift();
    if (!s) { finishStory(); return; }
    switch (s.t) {
      case "wait":
        storyMode = "busy";
        setTimeout(storyAdvance, s.ms || 1000);
        break;
      case "stage":
        storyMode = "busy";
        drawStoryStage(s.stage);
        storyAdvance();
        break;
      case "line":
        renderLine(s);
        break;
      case "btn":
        renderBtn(s);
        break;
      case "choice":
        renderChoice(s);
        break;
      case "fx":
        storyMode = "busy";
        runFx(s.fx);
        if (s.wait) setTimeout(storyAdvance, s.wait);
        else storyAdvance();
        break;
      case "fn":
        storyMode = "busy";
        if (s.fn) s.fn();
        storyAdvance();
        break;
      default:
        storyAdvance();
    }
  }

  function finishStory() {
    storyBusy = false;
    $("storyLine").textContent = "";
    $("storySpeaker").textContent = "";
    $("storyNext").classList.add("hidden");
    $("storyBtn").classList.add("hidden");
    $("storyChoices").classList.add("hidden");
    $("storyChoices").innerHTML = "";
    fxClear();
    var cb = storyCB;
    storyCB = null;
    if (cb) cb();
  }

  var SPEAKERS = {
    gru: "Грутик",
    venom: "ВЕНОМ",
    sonechka: "Сонечка",
    whisper: "Шёпот из темноты",
    nar: "",
    raw: "…"
  };

  function renderLine(s) {
    storyMode = "line";
    $("storyBtn").classList.add("hidden");
    $("storyChoices").classList.add("hidden");
    $("storyNext").classList.remove("hidden");
    var sp = SPEAKERS[s.who] || "";
    $("storySpeaker").textContent = sp;
    $("storySpeaker").className = "story-speaker sp-" + (s.who || "nar");
    
    var lineEl = $("storyLine");
    if (s.who === "raw") {
      lineEl.className = "story-line raw";
      lineEl.textContent = s.text;
    } else if (s.who === "whisper") {
      lineEl.className = "story-line whisper";
      lineEl.textContent = s.text;
    } else if (s.trans) {
      lineEl.className = "story-line has-trans";
      lineEl.innerHTML = '<span class="groot-voice">' + escapeHtml(s.text) + '</span><span class="groot-trans">(' + escapeHtml(s.trans) + ')</span>';
    } else {
      lineEl.className = "story-line";
      lineEl.textContent = s.text;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderBtn(s) {
    storyMode = "btn";
    $("storySpeaker").textContent = "";
    $("storyLine").textContent = "";
    $("storyNext").classList.add("hidden");
    $("storyChoices").classList.add("hidden");
    var btn = $("storyBtn");
    btn.classList.remove("hidden");
    btn.textContent = s.text;
    btn.onclick = function (e) {
      e.stopPropagation();
      if (!storyBusy) return;
      if (s.cb) s.cb();
      storyAdvance();
    };
  }

  function renderChoice(s) {
    storyMode = "choice";
    $("storyNext").classList.add("hidden");
    $("storyBtn").classList.add("hidden");
    $("storySpeaker").className = "story-speaker sp-nar";
    $("storySpeaker").textContent = "";
    $("storyLine").textContent = s.prompt || "";
    var box = $("storyChoices");
    box.innerHTML = "";
    box.classList.remove("hidden");
    for (var i = 0; i < s.options.length; i++) {
      (function (opt, idx) {
        var b = document.createElement("button");
        b.className = "story-choice-btn";
        b.textContent = opt.text;
        b.onclick = function (e) {
          e.stopPropagation();
          if (!storyBusy) return;
          box.classList.add("hidden");
          box.innerHTML = "";
          if (s.key) {
            if (!state.choices) state.choices = {};
            state.choices[s.key] = idx;
            save();
          }
          if (opt.cb) opt.cb();
          if (opt.steps && opt.steps.length) {
            storyQueue = opt.steps.concat(storyQueue);
          }
          storyAdvance();
        };
        box.appendChild(b);
      })(s.options[i], i);
    }
  }

  function storyTap() {
    if (!storyBusy) return;
    if (storyMode === "line") storyAdvance();
  }

  function drawStoryStage(n) {
    try { drawGrutik($("storyCanvas"), n); } catch (e) { }
  }


  function fxClear() {
    var layer = $("fxLayer");
    if (layer) layer.innerHTML = "";
    if ($("storyStage")) $("storyStage").classList.remove("has-wheel");
  }

  function runFx(name) {
    var layer = $("fxLayer");
    if (!layer || name === "none") return;

    if (name === "flash") {
      var d1 = makeEl("div", "fx-flash");
      layer.appendChild(d1);
      setTimeout(function () { d1.remove(); }, 420);
    } else if (name === "boom") {
      var d2 = makeEl("div", "fx-boom", "БУМ!");
      layer.appendChild(d2);
      $("storyStage").classList.add("shake");
      setTimeout(function () { d2.remove(); $("storyStage").classList.remove("shake"); }, 800);
    } else if (name === "shake") {
      $("storyStage").classList.add("shake");
      setTimeout(function () { $("storyStage").classList.remove("shake"); }, 560);
    } else if (name === "blackout") {
      var d3 = makeEl("div", "fx-blackout");
      var eyes = makeEl("canvas");
      eyes.width = 440; eyes.height = 240;
      d3.appendChild(eyes);
      layer.appendChild(d3);
      try {
        var c = eyes.getContext("2d");
        c.fillStyle = "#04060a";
        c.fillRect(0, 0, 440, 240);
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.ellipse(150, 120, 74, 40, -0.2, 0, Math.PI * 2);
        c.ellipse(290, 120, 74, 40, 0.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#0a0c12";
        c.beginPath();
        c.ellipse(158, 122, 28, 32, 0, 0, Math.PI * 2);
        c.ellipse(282, 122, 28, 32, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#0c0f15";
        c.lineWidth = 12;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(90, 78); c.lineTo(216, 86);
        c.moveTo(224, 86); c.lineTo(350, 78);
        c.stroke();
        c.fillStyle = "#b31836";
        c.beginPath();
        c.moveTo(150, 180);
        c.quadraticCurveTo(160, 205, 187, 212);
        c.quadraticCurveTo(160, 195, 176, 180);
        c.closePath();
        c.fill();
      } catch (e) { }
      setTimeout(function () { d3.remove(); }, 1300);
    } else if (name === "venomLurk") {
      var dLurk = makeEl("div", "fx-venom-lurk");
      var cvs = makeEl("canvas");
      cvs.width = 600; cvs.height = 520;
      dLurk.appendChild(cvs);
      layer.appendChild(dLurk);
      try {
        var cLurk = cvs.getContext("2d");
        cLurk.fillStyle = "#030408";
        cLurk.fillRect(0, 0, 600, 520);

        // Ceiling mass / tentacles
        cLurk.fillStyle = "#070a12";
        cLurk.beginPath();
        cLurk.ellipse(300, 0, 340, 180, 0, 0, Math.PI * 2);
        cLurk.fill();

        // Predatory white eyes of Venom
        cLurk.save();
        cLurk.shadowColor = "rgba(255, 255, 255, 0.6)";
        cLurk.shadowBlur = 20;
        cLurk.fillStyle = "#ffffff";

        // Left eye
        cLurk.beginPath();
        cLurk.moveTo(170, 195);
        cLurk.quadraticCurveTo(200, 120, 275, 160);
        cLurk.quadraticCurveTo(240, 210, 170, 195);
        cLurk.fill();

        // Right eye
        cLurk.beginPath();
        cLurk.moveTo(430, 195);
        cLurk.quadraticCurveTo(400, 120, 325, 160);
        cLurk.quadraticCurveTo(360, 210, 430, 195);
        cLurk.fill();
        cLurk.restore();

        // Dark inner pupils
        cLurk.fillStyle = "#06080e";
        cLurk.beginPath();
        cLurk.ellipse(225, 172, 26, 18, 0.3, 0, Math.PI * 2);
        cLurk.ellipse(375, 172, 26, 18, -0.3, 0, Math.PI * 2);
        cLurk.fill();

        // Brow ridges
        cLurk.strokeStyle = "#080b12";
        cLurk.lineWidth = 14;
        cLurk.lineCap = "round";
        cLurk.beginPath();
        cLurk.moveTo(145, 140); cLurk.lineTo(285, 155);
        cLurk.moveTo(455, 140); cLurk.lineTo(315, 155);
        cLurk.stroke();

        // Subtle jagged smirk in darkness
        cLurk.strokeStyle = "rgba(255, 255, 255, 0.85)";
        cLurk.lineWidth = 2.5;
        cLurk.lineCap = "round";
        cLurk.beginPath();
        cLurk.moveTo(210, 260);
        cLurk.quadraticCurveTo(300, 305, 390, 260);
        cLurk.stroke();
        cLurk.fillStyle = "#f8fafc";
        for (var t = 225; t <= 375; t += 18) {
          var yMid = 260 + Math.sin((t - 210) / 180 * Math.PI) * 35;
          cLurk.beginPath();
          cLurk.moveTo(t - 6, yMid - 2);
          cLurk.lineTo(t, yMid + 12);
          cLurk.lineTo(t + 6, yMid - 2);
          cLurk.closePath();
          cLurk.fill();
        }
      } catch (e) { }
    } else if (name === "peekBlack") {
      var d4 = makeEl("div", "fx-blob peek");
      d4.appendChild(makeEl("span", "b-eye"));
      d4.appendChild(makeEl("span", "b-eye"));
      layer.appendChild(d4);
      setTimeout(function () { d4.remove(); }, 1200);
    } else if (name === "blobIn") {
      var d5 = makeEl("div", "fx-blob fall");
      d5.appendChild(makeEl("span", "b-eye"));
      d5.appendChild(makeEl("span", "b-eye"));
      layer.appendChild(d5);
      setTimeout(function () { d5.remove(); }, 1000);
    } else if (name === "heartsIn") {
      for (var i = 0; i < 3; i++) {
        var d6 = makeEl("div", "fx-heart-in");
        d6.style.left = (12 + i * 26) + "%";
        layer.appendChild(d6);
        setTimeout(function (el) { el.remove(); }, 1500, d6);
      }
    } else if (name === "pop") {
      $("storyCanvas").classList.add("groot-pop");
      setTimeout(function () { $("storyCanvas").classList.remove("groot-pop"); }, 550);
    } else if (name === "bounce") {
      $("storyCanvas").classList.add("bounce");
      setTimeout(function () { $("storyCanvas").classList.remove("bounce"); }, 600);
    } else if (name === "glow") {
      var d7 = makeEl("div", "fx-glow");
      layer.appendChild(d7);
      setTimeout(function () { d7.remove(); }, 1300);
    } else if (name === "merge") {
      var d8 = makeEl("div", "fx-flash soft");
      layer.appendChild(d8);
      $("storyCanvas").classList.add("groot-pop");
      setTimeout(function () { d8.remove(); $("storyCanvas").classList.remove("groot-pop"); }, 700);
    } else if (name === "icons") {
      var icons = ["SEED", "PULSE", "CODE", "VENOM", "SYNC", "GIFT"];
      var row = makeEl("div", "fx-icons");
      icons.forEach(function (ic, idx) {
        var sp = makeEl("span", "i", ic);
        sp.style.animationDelay = (idx * 0.12) + "s";
        row.appendChild(sp);
      });
      layer.appendChild(row);
      setTimeout(function () { row.remove(); }, 3000);
    } else if (name === "wheelIn" || name === "wheelBroken") {
      $("storyStage").classList.add("has-wheel");
      var wheelFx = makeEl("div", "fx-story-wheel" + (name === "wheelBroken" ? " broken" : ""));
      wheelFx.appendChild(makeEl("div", "fx-wheel-pointer"));
      wheelFx.appendChild(makeEl("div", "fx-wheel-disc"));
      wheelFx.appendChild(makeEl("div", "fx-wheel-stand"));
      layer.appendChild(wheelFx);
    }
  }


  function grutikStage() {
    if (window.__stageForce != null) return window.__stageForce;
    if (window.__previewDay != null) return dayToStage(window.__previewDay);
    if (!state.grootPlanted) return -1;
    return dayToStage(currentDayIdx());
  }

  function dayToStage(d) {
    if (window.__previewDay != null) {
      if (d === 0) return 1;
      if (d === 1) return 2;
      if (d === 2) return 3;
      if (d === 3) return 5;
      if (d === 4) return 7;
      return state.finalForm ? 8 : 7;
    }
    if (state.venomInfected) {
      if (state.finalForm) return 8;
      if (!state.venomControlled) return 5;
      if (d === 3) return 6;
      if (d === 4) return 7;
      return 7;
    }
    if (d === 0) return 1;
    if (d === 1) return 2;
    if (d === 2) return 3;
    return 4;
  }

  function lineForDay(d) {
    if (window.__previewDay != null) {
      if (d === 4) return "Я есть Грутик!\n(...А МЫ — ВЕНОМ.)";
      if (d === 5) return "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)";
      if (d >= 6) return state.finalForm ? "Я есть Грутик.\n(Мы всё ещё здесь.)" : "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)";
    }
    if (state.venomInfected) {
      if (!state.venomControlled) return "Я есть Грутик!\n(...А МЫ — ВЕНОМ.)";
      if (d === 4) return "Я есть Грутик.\n(Мы есть Грутик. Мы ещё не решили.)";
      if (d === 5) return "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)";
      return state.finalForm ? "Я есть Грутик.\n(Мы всё ещё здесь.)" : "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)";
    }
    return GRUTIK_LINES[Math.min(d, GRUTIK_LINES.length - 1)];
  }

  function isSleeping() {
    if (typeof window !== "undefined" && window.__forceSleeping != null) return !!window.__forceSleeping;
    var waitScreen = $("screenWait");
    if (waitScreen && waitScreen.classList.contains("active")) return true;
    if (state && state.givenDay) {
      if (state.givenDay.length >= DAYS) return true;
      var cur = currentDayIdx();
      if (state.givenDay.indexOf(cur) !== -1) return true;
    }
    return false;
  }
  if (typeof window !== "undefined") {
    window.__isGrutikSleeping = isSleeping;
    window.isGrutikSleeping = isSleeping;
  }

  function grutikLine() {
    var cur = currentDayIdx();
    var isDone = state.givenDay && state.givenDay.indexOf(cur) !== -1;
    var isAllDone = state.givenDay && state.givenDay.length >= DAYS;

    // All days completed
    if (isAllDone) {
      return state.finalForm
        ? "Я есть Грутик.\n(Мы всё ещё здесь. Спасибо тебе за всё!)"
        : "Я есть Грутик!\n(Мы прошли все испытания! Ты самая лучшая.)";
    }

    // A spin on the wheel is pending
    if (getPendingSpinDay() != null) {
      return "Я есть Грутик!\n(Колесо ждёт! Крути скорее!)";
    }

    // Today's day is already completed and gift is claimed (waiting for tomorrow)
    if (isDone) {
      if (state.venomInfected) {
        return "Я есть Грутик.\n(На сегодня всё. Отдыхаем до завтра.)";
      }
      return "Я есть Грутик...\n(Сегодня мы отлично справились. Буду ждать тебя завтра!)";
    }

    if (window.__previewDay != null) {
      return lineForDay(window.__previewDay + 1);
    }
    if (!state.grootPlanted) return GRUTIK_LINES[0];

    return lineForDay(cur + 1);
  }

  function setCompanionVisible(visible) {
    $("grutikBar").classList.toggle("companion-hidden", !visible);
    document.querySelector("main").classList.toggle("without-companion", !visible);
  }

  function updateGrutikBar() {
    var companionVisible = window.__previewDay != null || state.introSeen && state.grootPlanted;
    setCompanionVisible(companionVisible);
    var sleeping = isSleeping();
    try {
      var nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      drawGrutik($("grutikCanvas"), grutikStage(), sleeping ? { time: nowTime, sleeping: true, tilt: 0.16, arm: -12, y: 0 } : null);
    } catch (e) { }
    if (sleeping && typeof runGrutikSleep === "function") {
      if (!grutikSleeping) {
        grutikSleeping = true;
        grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
      }
    }
    var line = grutikLine();
    var sayEl = $("grutikSay");
    if (sayEl) {
      if (line.includes("\n")) {
        var parts = line.split("\n");
        sayEl.innerHTML = '<span class="groot-voice">' + escapeHtml(parts[0]) + '</span><span class="groot-trans">' + escapeHtml(parts.slice(1).join(" ")) + '</span>';
      } else {
        sayEl.textContent = line;
      }
    }
  }


  var INTRO = [
    S(-1),
    L("nar", "Сонечка, кажется, для тебя кое-что оставили..."),
    B("Посмотреть"),
    L("nar", "На столе лежит маленькая коробочка. Внутри — совершенно обычное семечко."),
    L("nar", "Хотя... почему оно слегка шевелится?"),
    C("seed", "Что делать с семечком?", [
      { text: "🌱 Посадить семечко", steps: [
        L("nar", "Ты осторожно опускаешь семечко в горшочек и присыпаешь землёй.")
      ]},
      { text: "🤔 Подождать и понаблюдать", steps: [
        L("nar", "Ты кладёшь семечко на ладонь. Оно подпрыгивает и само ныряет в горшок!"),
        L("nar", "Ладно. Видимо, у него свои планы.")
      ]}
    ]),
    W(300),
    S(0),
    F("bounce"),
    W(700),
    L("nar", "Из земли пробивается крохотный зелёный росток. Он тянется к свету..."),
    F("flash"),
    S(1),
    F("pop"),
    W(500),
    L("gru", "Я есть Грутик.", "Привет!"),
    W(900),
    L("gru", "...Я есть Грутик?", "Кажется... я проснулся."),
    W(600),
    L("nar", "Росток раскрывает крохотные ладошки и смотрит на тебя круглыми глазами."),
    L("gru", "Я есть Грутик!", "Я так рад тебя видеть!"),
    L("nar", "Кажется, теперь он живёт здесь. И кажется, он уже к тебе привязался."),
    C("intro_react", "Как отреагируешь?", [
      { text: "👋 Привет, Грутик!", steps: [
        L("gru", "Я есть Грутик!!!", "Ура-а-а! Мы подружились!"),
        F("heartsIn", 400),
        L("nar", "Он подпрыгивает от радости и чуть не вываливается из горшка.")
      ]},
      { text: "🌿 Погладить по листикам", steps: [
        L("nar", "Ты осторожно проводишь пальцем по маленькому листику."),
        L("gru", "Я есть... Грутик.", "М-м-м, щекотно... приятно..."),
        F("heartsIn", 400),
        L("nar", "Он закрывает глаза и довольно шелестит.")
      ]},
      { text: "😲 Семечко... заговорило?!", steps: [
        L("gru", "Я есть Грутик?", "А что такого? Деревья тоже умеют говорить!"),
        L("nar", "Он наклоняет голову, будто не понимает, почему ты удивлена."),
        L("gru", "Я есть Грутик!", "Привыкай, теперь я твой спутник!"),
        L("nar", "Ладно. Говорящее дерево. Нормально. Идём дальше.")
      ]}
    ]),
    B("Ладно, Грутик. Пойдём", introDone)
  ];

  function introDone() {
    state.introSeen = true;
    state.grootPlanted = true;
    state.started = true;
    if (!state.start) state.start = todayMidnight();
    save();
  }

  var GREET = [
    [
      S(1),
      L("gru", "Я есть Грутик!", "С добрым утром! Новый день!"),
      W(600),
      L("nar", "Кажется, он очень рад тебя видеть. Листики дрожат от волнения."),
      F("heartsIn", 400),
      W(700),
      L("nar", "Но что-то не так. Вокруг горшочка рассыпались карточки с вашими воспоминаниями."),
      L("gru", "Я есть Грутик...", "Ой-ой, я всё уронил..."),
      L("nar", "Грутик переворачивает одну карточку — на ней ваша фотография. Он тянется ко второй... и забывает, где пара."),
      L("gru", "...Я есть Грутик?", "Куда же делась вторая половинка?"),
      L("nar", "Он расстроенно складывает ладошки. Похоже, одному ему не справиться."),
      C("day1_react", "Что скажешь Грутику?", [
        { text: "🤗 Не переживай, мы вместе найдём!", steps: [
          L("gru", "Я есть Грутик!", "Точно? Вместе мы всё соберём!"),
          F("heartsIn", 400),
          L("nar", "Его глаза загораются. Он с энтузиазмом переворачивает первую пару — неправильно. Но не сдаётся.")
        ]},
        { text: "🧐 Покажи, что запомнил", steps: [
          L("nar", "Грутик гордо переворачивает две карточки. Они не совпадают."),
          L("gru", "...Я есть Грутик.", "Эх... память подвела."),
          L("nar", "Грустный вздох. Но он верит, что ты разберёшься.")
        ]}
      ]),
      L("nar", "Похоже, собрать все памятные моменты воедино придётся тебе."),
      B("Помочь Грутику", markSeen(0))
    ],
    [
      S(2),
      L("nar", "Грутик?"),
      W(800),
      L("gru", "Я есть Грутик!", "Смотри, что я приготовил!"),
      L("nar", "Он сидит перед чем-то вроде экрана из переплетённых корней. На нём — поле из древесных блоков."),
      L("gru", "Я есть Грутик!", "Если собрать ряд — место освободится для корней!"),
      L("nar", "Грутик складывает три блока в ряд, и они рассыпаются, освобождая пространство. Он довольно кивает."),
      L("nar", "Похоже, он предлагает расчистить место для новых корней."),
      C("day2_style", "Как начнём расчистку?", [
        { text: "💪 Я разнесу тут всё!", steps: [
          L("gru", "Я есть Грутик!", "Вот это боевой настрой! Вперёд!"),
          L("nar", "Грутик одобрительно стучит по горшку. Это дух!")
        ]},
        { text: "🤓 Давай аккуратно, по плану", steps: [
          L("nar", "Грутик задумчиво смотрит на поле. Потом кивает."),
          L("gru", "Я есть Грутик.", "Мудро. Лишние блоки нам не нужны."),
          L("nar", "Он уважает стратегический подход.")
        ]}
      ]),
      B("Ну, показывай", markSeen(1))
    ],
    [
      S(3),
      L("nar", "За ночь Грутик заметно вытянулся. На макушке шелестит новый побег — он ловит едва уловимые вибрации воздуха."),
      L("gru", "Я есть Грутик!", "Я расту! И чувствую далёкие сигналы!"),
      L("nar", "Как дитя космической расы, Грутик чутко слышит эхо звёзд. Но вдруг он тревожно замирает."),
      W(500),
      L("raw", "ТУК.  ТУК-ТУК."),
      W(600),
      L("nar", "Этот ритм пришёл не из комнаты. Он отдаётся в корнях странным эхом — будто волна из тёмного сектора космоса."),
      L("gru", "Я есть... Грутик?", "Это зов... из далёкого космоса."),
      F("peekBlack", 500),
      L("nar", "По краю горшка бесшумно скользит капля смолянисто-чёрной материи. Она поглощает свет, словно осколок межзвёздной пустоты."),
      L("raw", "ТУК.  ТУК-ТУК."),
      L("nar", "Она пульсирует тем же ритмом. Словно космический странник, столетиями дрейфовавший сквозь звёзды и нашедший живое тепло."),
      C("day3_drop", "Как поступишь?", [
        { text: "🛡️ Заслонить Грутика", steps: [
          L("nar", "Ты прикрываешь горшок ладонью. Капля замирает у кончиков пальцев."),
          L("nar", "На её вязкой поверхности на миг проступает белое пятнышко — хищный разрез глаза симбиота."),
          L("gru", "Я есть Грутик...", "Она прилетела из звёздной тьмы... Она наблюдает."),
          L("nar", "Капля отступает в тень, но космический зов в корнях только нарастает.")
        ]},
        { text: "🔍 Прислушаться к космическому сигналу", steps: [
          L("nar", "Ты наклоняешься ближе. Капля чутко пульсирует в такт звёздным волнам."),
          L("nar", "Грутик отвечает осторожным щелчком ветви — на языке далёких планет. Капля вздрагивает, признавая в нём космического собрата."),
          L("gru", "Я есть Грутик?", "Ты скиталась меж звёзд? Ты искала нас?"),
          L("nar", "Капля вытягивается в тонкий жгут и скользит под горшок, оставляя след звёздной пыли.")
        ]}
      ]),
      L("nar", "На коре горшка вспыхивает проекция звёздного сектора. Но чёрная симбиотическая материя запутала звёздные нити в тугие узлы, искажая координаты."),
      L("gru", "Я есть Грутик...", "Сигнал сбит! Нити созвездий перепутались в темноте..."),
      L("nar", "Чтобы очистить космический канал связи и понять, кто послал этот сигнал, нужно расставить звёзды так, чтобы ни одна линия не пересекалась."),
      B("Распутать звёздные нити", markSeen(2))
    ],
    [
      S(4),
      L("sonechka", "Странно..."),
      L("sonechka", "Обычно Грутик уже ждёт здесь. А сегодня горшок пустой."),
      W(600),
      L("nar", "Тишина. Только лёгкое потрескивание откуда-то сверху."),
      L("raw", "ШЛЁП"),
      W(500),
      L("gru", "Я ЕСТЬ ГРУТИК!!!", "СПАСИТЕ-ПОМОГИТЕ!!!"),
      L("nar", "Грутик падает откуда-то сверху и приземляется в горшок. Но за ним тянется что-то тёмное."),
      L("nar", "Чёрная субстанция ползёт по ветвям. Грутик пытается стряхнуть её, закрывается ветками."),
      F("blobIn", 300),
      FN(infect),
      F("blackout", 1100),
      W(600),
      L("nar", "Тишина."),
      W(700),
      S(5),
      L("gru", "Я...", "Я..."),
      W(500),
      L("gru", "Есть...", "Есть..."),
      L("venom", "ВЕНОМ."),
      W(600),
      L("nar", "На лице Грутика проступает зубастая пасть. Белые глаза. Чёрные щупальца."),
      L("nar", "Грутик ударяет себя по голове. Пасть исчезает."),
      L("gru", "Я есть Грутик!", "Я здесь главный!"),
      L("venom", "Мы — Веном."),
      L("gru", "Я есть Грутик!", "Отстань от меня, чёрный слизень!"),
      L("venom", "Мы. Уже. Здесь."),
      C("day4_venom", "Что скажешь?", [
        { text: "😰 Грутик, с тобой всё хорошо?!", steps: [
          L("gru", "Я есть Грутик!", "Вроде держусь!"),
          L("venom", "ОН В ПОРЯДКЕ. МЫ ПРОСТО ПОЗНАКОМИЛИСЬ."),
          L("nar", "Грутик неуверенно кивает.")
        ]},
        { text: "😤 Эй, чёрное нечто, отпусти его!", steps: [
          L("venom", "ОТПУСТИТЬ? МЫ ТОЛЬКО ПРИШЛИ."),
          L("gru", "Я есть Грутик...", "Он слишком крепко прилип..."),
          L("venom", "ОН СОГЛАСЕН. ПОЧТИ."),
          L("nar", "Грутик не выглядит «согласным», но Веном его не слушает.")
        ]}
      ]),
      L("nar", "В суматохе ваша общая фотография рассыпалась на кусочки пазла."),
      L("nar", "Грутик тянется к ней, но Веном перехватывает ветку."),
      L("gru", "Я есть Грутик...", "Отдай, это наше памятное фото!"),
      L("venom", "МЫ СОБЕРЁМ ЕЁ ПЕРВЫМИ."),
      L("nar", "Сонечка, кажется, собрать фотографию придётся тебе — пока они не растащили кусочки."),
      B("Собрать фото", markSeen(3))
    ],
    [
      S(7),
      L("gru", "Я есть Грутик!", "Мы научились работать вместе!"),
      L("venom", "Мы есть Грутик."),
      L("nar", "Они стоят рядом — ветви и щупальца переплелись. Кажется, они научились сосуществовать."),
      W(600),
      L("nar", "Грутик указывает на колесо. Оно тёмное — энергия не поступает."),
      L("venom", "Питание не идёт. Контур разомкнут."),
      L("nar", "Ветви и чёрные щупальца тянутся к проводам, но искрят — схема повреждена."),
      L("gru", "Я есть Грутик...", "Колесо сломалось, подарки не крутятся..."),
      C("day5_repair", "Как будем чинить?", [
        { text: "🔧 Покажите мне схему", steps: [
          L("venom", "ЛОГИЧНЫЙ ПОДХОД. ПОКАЗЫВАЕМ."),
          L("nar", "На экране проступает живая электрическая схема. Узлы светятся, но некоторые повёрнуты неправильно.")
        ]},
        { text: "⚡ Просто подайте питание!", steps: [
          L("nar", "Грутик пропускает энергию через ветку. Искра. Щелчок."),
          L("venom", "ПЛОХАЯ ИДЕЯ. НУЖНА СХЕМА."),
          L("gru", "Я есть Грутик...", "Ой... кажется, замкнуло..."),
          L("nar", "Ладно, сначала починим — потом подадим.")
        ]}
      ]),
      L("nar", "Сонечка, помоги им замкнуть живую схему и вернуть колесу питание."),
      B("Починить схему", markSeen(4))
    ],
    [
      S(7),
      L("nar", "День 6."),
      W(800),
      L("nar", "Последний день."),
      W(600),
      L("gru", "Я есть Грутик.", "Сегодня решающий момент."),
      L("venom", "А мы — Веном."),
      L("nar", "Они стоят плечом к плечу. Точнее, веткой к щупальцу. Они прошли долгий путь вместе."),
      L("venom", "Кажется, сегодня последний день."),
      L("gru", "Я есть Грутик...", "Даже немного грустно, что финал..."),
      W(500),
      L("nar", "Грутик осторожно касается колеса. Оно гудит, но не крутится."),
      F("wheelBroken"),
      L("nar", "Колесо заблокировано! Вчера питание восстановили, но для главного подарка обычной мощности мало."),
      L("venom", "Сработала защита. Требуется «Протокол SONECHKA»."),
      L("gru", "Я есть Грутик!", "Мы снимем блокировку вместе!"),
      L("venom", "Протокол активируется только для того, кто прошёл все испытания."),
      C("day6_ready", "Готова к финалу?", [
        { text: "🚀 Готова! Запускаем!", steps: [
          L("gru", "Я ЕСТЬ ГРУТИК!", "НА ПОЛНУЮ МОЩНОСТЬ!"),
          L("venom", "ВМЕСТЕ."),
          L("nar", "Энергия пульсирует. Все системы на максимуме.")
        ]},
        { text: "😬 Немного страшно...", steps: [
          L("gru", "Я есть Грутик.", "Я с тобой. Не бойся."),
          L("nar", "Грутик протягивает маленькую ветку и кладёт её тебе на ладонь."),
          L("venom", "Не бойся. Мы будем рядом."),
          L("nar", "Ладно. Вместе — не страшно.")
        ]}
      ]),
      L("nar", "Нужно пройти трёхфазную синхронизацию, чтобы снять блокировку и раскрутить колесо на максимум."),
      B("Запустить протокол", markSeen(5))
    ]
  ];

  function markSeen(day) {
    return function () {
      if (state.speechSeen.indexOf(day) === -1) state.speechSeen.push(day);
      save();
    };
  }

  function infect() {
    state.venomInfected = true;
    save();
    updateGrutikBar();
  }

  var POSTWIN = [
    [
      S(1),
      F("wheelIn"),
      L("nar", "Все пары найдены! Карточки мерцают и складываются в стопку."),
      L("nar", "Из горшка вытягивается тонкая ветка и осторожно касается колеса."),
      W(600),
      L("nar", "Грутик упирается корнями и тянет сильнее — колесо начинает крутиться!"),
      F("flash"),
      W(600),
      L("gru", "Я есть Грутик!", "Получилось! Колесо ожило!"),
      L("nar", "Похоже, Грутик нашёл способ доставать отсюда подарки."),
      L("gru", "Я есть Грутик!", "Давай крутить!"),
      L("nar", "Он явно гордится собой."),
      B("Крутить вместе")
    ],
    [
      S(2),
      F("wheelIn"),
      L("gru", "Я есть Грутик!", "Все ряды очищены!"),
      L("nar", "Последняя собранная линия вспыхивает. Блоки превращаются в свет."),
      F("glow", 300),
      L("nar", "Энергия проходит по корням к колесу. Грутик довольно шелестит листьями."),
      L("gru", "Я есть Грутик!", "Мы отличная команда!"),
      L("nar", "Кажется, это означает: «Я всё починил. Ну, мы. Вместе починили»."),
      B("Крутить колесо")
    ],
    [
      S(3),
      F("wheelIn"),
      L("nar", "Последний узел распутан! Четыре звёздных сектора очищены от помех, и космические нити вспыхивают чистым сиянием."),
      F("glow", 300),
      L("nar", "Звёздные линии сходятся в идеальную форму сердца — персонального созвездия."),
      L("gru", "Я есть Грутик!", "Никаких помех! Сигнал чистый, как далёкие звёзды!"),
      L("nar", "В узлах созвездия сияют две путеводные звезды: «В» и «С». А в центре сияет дата — 24.07.24."),
      L("gru", "Я есть Грутик!", "Вот координаты нашей связи. Вадим и Сонечка!"),
      L("nar", "Нити сплетаются в единое слово: «МЫ». Гармоничный космический импульс пробегает по корням и будит колесо подарков."),
      W(500),
      L("raw", "МЫ..."),
      L("nar", "Из-под горшка доносится вкрадчивый шёпот. Существо из звёздной тьмы повторяет это слово, впитывая свет."),
      F("peekBlack", 400),
      L("nar", "Чёрная материя на мгновение тянется к Грутику, пробуя его тепло, и бесшумно скрывается в тени."),
      L("gru", "Я есть Грутик?", "Оно учится... Оно теперь знает это слово?"),
      B("Крутить колесо")
    ],
    [
      S(6),
      F("wheelIn"),
      FN(controlVenom),
      L("gru", "Я есть Грутик.", "Фото собрано."),
      L("venom", "Мы есть Грутик."),
      W(600),
      L("nar", "Фотография собрана. Они оба смотрят на неё. Потом друг на друга."),
      L("nar", "Кажется, они договорились. Хотя бы на сегодня."),
      L("nar", "Из руки Грутика вылетает чёрное щупальце и раскручивает колесо."),
      L("gru", "Я есть Грутик?", "Ого, как быстро завертелось!"),
      L("venom", "УДОБНО."),
      L("gru", "Я есть Грутик!", "Крути скорее!"),
      B("Крутить колесо")
    ],
    [
      S(7),
      F("wheelIn"),
      L("gru", "Я есть Грутик!", "Ток пошёл! Схема работает!"),
      L("venom", "Схема замкнута. Командная работа."),
      L("nar", "Колесо загорается ровным зелёным светом. Энергия течёт стабильно."),
      L("gru", "Я есть Грутик!", "Мы молодцы!"),
      L("venom", "Неплохо для дерева и слизня."),
      L("gru", "Я есть Грутик...", "Эй, и для Сонечки тоже!"),
      L("venom", "Ладно. Для дерева, слизня и Сонечки."),
      B("Крутить колесо")
    ],
    [
      FN(unlockFinal),
      F("glow", 400),
      L("nar", "Последний импульс превращается в свет и проходит сквозь Грутика."),
      W(900),
      L("nar", "На секунду симбиот отделяется. С одной стороны — чёрная масса. С другой — обычный Грутик. Маленький. Живой."),
      L("venom", "Мы можем уйти."),
      L("gru", "Я есть Грутик.", "Но... ты не обязан уходить."),
      L("venom", "Ты уверен?"),
      L("gru", "Я есть Грутик.", "Мы привыкли быть вместе."),
      C("venom_stay", "Что скажешь Веному?", [
        { text: "🤝 Оставайся. Вы — команда.", steps: [
          L("venom", "...Услышано."),
          L("nar", "Веном медленно возвращается. Щупальца обнимают ветки. Аккуратно."),
          L("gru", "Я есть Грутик.", "Вот и отлично."),
          L("venom", "Мы остаёмся.")
        ]},
        { text: "💚 Грутик сам решит", steps: [
          L("gru", "Я есть Грутик.", "Оставайся, вместе веселее!"),
          L("venom", "Он сказал, что мы остаёмся."),
          L("nar", "Грутик кивает. Веном кивает. Все кивают.")
        ]}
      ]),
      L("nar", "Симбиот снова соединяется. Форма теперь гармоничная."),
      F("merge", 300),
      L("nar", "Грутик + Веном. Вместе — как и должно быть."),
      F("wheelIn"),
      B("Крутить вместе")
    ]
  ];

  function controlVenom() {
    state.venomControlled = true;
    save();
    updateGrutikBar();
  }

  function unlockFinal() {
    state.finalForm = true;
    save();
    updateGrutikBar();
  }

  var AFTERGIFT = [
    [
      S(1),
      L("gru", "Я есть Грутик.", "Подарок открыт!"),
      L("nar", "Первый подарок найден. Грутик осторожно трогает коробочку листиком."),
      L("gru", "Я есть Грутик?", "А мне листик не перепадёт?"),
      L("nar", "Нет, Грутик, это не тебе. Но он так старался помочь!"),
      C("day1_bye", "Что ответишь малышу?", [
        { text: "🌿 «Ты сегодня заслужил самую вкусную водичку!»", steps: [
          L("gru", "Я есть Грутик!", "Ура-а-а!"),
          L("nar", "Грутик радостно расправляет веточки. Кажется, он безумно горд собой."),
          L("gru", "Я есть Грутик.", "Я отличный помощник!")
        ]},
        { text: "🤗 Погладить по листикам: «Ты настоящий герой!»", steps: [
          L("gru", "Я есть Грутик...", "Ой, щекотно..."),
          L("nar", "Он жмурится от удовольствия и нежно прижимается листиком к твоей руке."),
          L("gru", "Я есть Грутик!", "Буду ждать тебя завтра!")
        ]}
      ]),
      B("До завтра!")
    ],
    [
      S(2),
      L("nar", "Грутик садится рядом с коробочкой и внимательно смотрит на неё."),
      W(700),
      L("gru", "Я есть Грутик?", "Красивая коробочка. А что внутри?"),
      L("nar", "Нет, Грутик. Этот подарок не тебе."),
      L("gru", "Я есть Грутик...", "Понял-понял, не трогаю."),
      L("nar", "Он грустно вздыхает. Потом смотрит на игровое поле — кажется, хочет ещё поиграть."),
      L("gru", "Я есть Грутик!", "Но блоки я классно разбивал!"),
      L("nar", "Ладно, может быть, позже."),
      B("До завтра!")
    ],
    [
      S(3),
      L("nar", "Подарок открыт, но Грутик не может оторвать взгляда от стены. Его побеги взволнованно подрагивают."),
      L("gru", "Я есть Грутик...", "Космический гость не ушёл. Я чувствую холод звёздной бездны прямо здесь..."),
      F("peekBlack", 500),
      W(600),
      L("nar", "Тень за горшком становится неестественно плотной и начинает медленно подниматься вверх по стене."),
      C("day3_night", "Что скажешь Грутику на ночь?", [
        { text: "🤝 Мы готовы к любым космическим гостям!", steps: [
          L("gru", "Я есть Грутик.", "С тобой мне ничего не страшно. Даже чужие из глубин космоса."),
          L("nar", "Грутик храбро расправляет веточки, стараясь казаться грозным Стражем Галактики.")
        ]},
        { text: "🌙 Ложись спать, малыш. Утро вечера мудренее", steps: [
          L("gru", "Я есть Грутик...", "Хорошо. Закрою глазки..."),
          L("nar", "Он сворачивается клубочком в горшке, но побеги чутко приподняты.")
        ]}
      ]),
      L("nar", "Грутик уютно устраивается в горшочке и тихо засыпает."),
      L("nar", "Свет в комнате гаснет. Смоляная материя бесшумно уползает вверх по стене — к самому потолку..."),
      F("venomLurk", 600),
      L("nar", "В темноте под потолком медленно раскрываются два огромных, хищных белых глаза..."),
      W(400),
      L("whisper", "«Мы... нашли наш новый дом...»"),
      W(300),
      L("nar", "Шелест щупалец. Тень затаилась наверху, прямо над спящим Грутиком... готовясь к прыжку."),
      B("До завтра!")
    ],
    [
      S(6),
      L("nar", "Грутик и Веном рассматривают подарок — фигурку Веномизированного Грута! Затем смотрят на собранное фото."),
      L("gru", "Я есть Грутик?!", "Это же мы! Мы правда так круто смотримся?"),
      L("venom", "МЫ КРАСИВЫ."),
      L("gru", "Я есть Грутик!", "И фото замечательное, и фигурка точь-в-точь!"),
      L("venom", "Очень красивы. Симбиоз в миниатюре."),
      L("nar", "Веном осторожно поправляет щупальцем фигурку и рамку фотографии. Грутик одобрительно кивает."),
      L("venom", "Мы умеем ценить искусство."),
      B("До завтра!")
    ],
    [
      S(7),
      L("venom", "Хороший день."),
      L("gru", "Я есть Грутик!", "Лучший день!"),
      L("venom", "Очень хороший."),
      L("nar", "Грутик и Веном сидят рядом. Щупальца и ветки слегка покачиваются в такт."),
      L("gru", "Я есть Грутик.", "Завтра финал..."),
      L("venom", "Завтра — последний день."),
      L("nar", "Грутик тихо кивает."),
      B("До завтра!")
    ]
  ];

  var FINAL_SCENE = [
    S(8),
    L("nar", "Всё закончено. Все подарки найдены. Все испытания пройдены."),
    W(600),
    L("nar", "Грутик касается края того самого горшка, с которого всё началось."),
    W(800),
    L("venom", "Всё началось с этой штуки?"),
    L("gru", "Я есть Грутик.", "Да, я тут родился."),
    L("venom", "Ты был очень маленький."),
    L("nar", "Грутик недовольно смотрит на Венома. Ветки скрещены."),
    L("venom", "Очень. Маленький."),
    L("gru", "Я есть Грутик!", "Зато теперь вон какой большой!"),
    L("venom", "Ладно, ладно. Ты вырос."),
    W(700),
    L("nar", "Грутик тянется к экрану и рисует что-то корнями. Получается кривое сердечко."),
    F("heartsIn", 400),
    W(500),
    L("gru", "Я есть Грутик.", "Это тебе, от всего сердца."),
    L("venom", "Он говорит, что это было его лучшее приключение."),
    L("gru", "Я есть Грутик!", "Без тебя ничего бы не вышло!"),
    L("venom", "И что он не смог бы без тебя."),
    W(600),
    F("icons", 500),
    W(600),
    L("nar", "Грутик подходит к экрану так близко, как только может."),
    L("gru", "Я есть Грутик.", "Спасибо, что помогала мне расти."),
    L("nar", "«Спасибо, что помогала мне расти»."),
    C("final_words", "Что скажешь на прощание?", [
      { text: "💚 Спасибо, Грутик. Ты лучший.", steps: [
        L("gru", "Я есть Грутик...", "Ой, я сейчас растаю..."),
        F("heartsIn", 400),
        L("nar", "Его листочки краснеют. Веном деликатно отворачивается."),
        L("venom", "Кажется, ему понравилось.")
      ]},
      { text: "🤗 Обнимашки!", steps: [
        L("nar", "Ты прижимаешь ладони к экрану. Грутик прижимает ветки с другой стороны."),
        L("gru", "Я есть Грутик!", "Тепло-о-о!"),
        F("heartsIn", 400),
        L("venom", "...Хватит. Мы тоже хотим."),
        L("nar", "Чёрные щупальца обнимают Грутика. Семейная обнимашка.")
      ]},
      { text: "🌱 Я буду за тобой ухаживать", steps: [
        L("gru", "Я есть Грутик!", "Ура! Я буду самым счастливым деревом!"),
        L("nar", "Он расправляет ветки во всю ширину. Это самый счастливый Грутик, которого ты видела."),
        L("venom", "Значит, мы остаёмся навсегда?"),
        L("gru", "Я есть Грутик!", "Да-да-да!"),
        L("venom", "Он говорит «да».")
      ]}
    ]),
    L("venom", "Он ещё сказал, что все подарки твои."),
    L("gru", "Я есть Грутик!", "До единого!"),
    L("venom", "Да-да. Именно это."),
    B("Открыть письмо")
  ];

  var DAY4_AFTER = [
    S(6),
    L("nar", "Грутик и Веном внимательно рассматривают случайный выбор колеса."),
    L("gru", "Я есть Грутик.", "Хороший выбор!"),
    L("venom", "Одобряем."),
    L("nar", "Веном протягивает щупальце к подарку и аккуратно пододвигает его ближе."),
    L("venom", "Бери. Заслужила."),
    B("До завтра!")
  ];

  function afterGiftScene(day, isLast) {
    if (isLast) return FINAL_SCENE;
    if (day === 3) return AFTERGIFT[3];
    if (day >= 0 && day < 5) return AFTERGIFT[day];
    return [];
  }


  function setTitle() {
    $("siteTitle").textContent = SITE_CONFIG.title || "Подарки для тебя";
  }

  function renderProgress() {
    var count = state.givenDay.length;
    var bar = $("progress");
    bar.innerHTML = "";
    for (var i = 0; i < DAYS; i++) {
      var h = makeEl("span", "hb " + (i < count ? "on" : "off"));
      bar.appendChild(h);
    }
  }

  function renderDayTitle() {
    if (state.givenDay.length >= DAYS) {
      $("dayTitle").textContent = "Все дни пройдены";
    } else if (getPendingSpinDay() != null) {
      $("dayTitle").textContent = "День " + (getPendingSpinDay() + 1) + " — крути колесо! 🎡";
    } else {
      $("dayTitle").textContent = "День " + (currentDayIdx() + 1) + " из " + DAYS;
    }
  }

  function render() {
    updateGrutikBar();

    if (window.__previewDay == null && !state.introSeen) {
      playStory(INTRO, function () { render(); });
      return;
    }

    setTitle();
    renderProgress();
    renderDayTitle();
    hideScreens();

    if (window.__previewDay == null) {
      var greetDay = activePlayDay();
      if (state.speechSeen.indexOf(greetDay) === -1) {
        playStory(GREET[greetDay], function () { render(); });
        return;
      }
    }

    if (state.givenDay.length >= DAYS) {
      renderFinal();
      return;
    }

    var pending = getPendingSpinDay();
    if (pending != null) {
      renderWheel(pending);
      return;
    }

    if (state.givenDay.indexOf(currentDayIdx()) !== -1) {
      renderWait();
      return;
    }

    renderGame(currentDayIdx());
  }

  function hideScreens() {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    var topNav = $("gameTopNav");
    if (topNav) topNav.classList.add("hidden");
    ["screenGame", "screenWheel", "screenWait", "screenFinal", "screenStory"].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.remove("active");
    });
    // Do not keep redrawing a canvas from a screen that is no longer visible.
    if (typeof window !== "undefined") window.__waitCanvas = null;
  }

  function isDayCompleted(i) {
    if (!state) return false;
    if (state.givenDay && state.givenDay.indexOf(i) !== -1) return true;
    if (state.won && state.won.indexOf(i) !== -1) return true;
    if (window.__simulatedDay != null && i < window.__simulatedDay) return true;
    if (window.__previewDay != null && i < window.__previewDay) return true;
    return false;
  }

  function renderReplayCards(containerId) {
    var container = $(containerId);
    if (!container) return 0;
    container.innerHTML = "";
    var count = 0;
    dayGames.forEach(function (cfg, idx) {
      if (!isDayCompleted(idx)) return;
      count++;
      var card = makeEl("button", "replay-game-card");
      card.type = "button";
      card.setAttribute("data-day", String(idx));

      var iconEl = makeEl("div", "replay-game-icon", cfg.icon || "🎮");
      card.appendChild(iconEl);

      var infoEl = makeEl("div", "replay-game-info");
      var topEl = makeEl("div", "replay-game-top");
      topEl.appendChild(makeEl("span", "replay-game-day", "ДЕНЬ " + cfg.mark));
      topEl.appendChild(makeEl("span", "replay-game-badge", cfg.badge || "ИГРА"));
      infoEl.appendChild(topEl);

      infoEl.appendChild(makeEl("div", "replay-game-title", cfg.title));

      var descText = cfg.desc || "";
      if (cfg.type === "blockblast") {
        try {
          var best = localStorage.getItem("advent_blockblast_best");
          if (best) {
            descText = "Бесконечный режим · Рекорд: " + best;
          }
        } catch (e) {}
      }
      infoEl.appendChild(makeEl("div", "replay-game-desc", descText));
      card.appendChild(infoEl);

      var playBtn = makeEl("div", "replay-game-arrow", "▶");
      card.appendChild(playBtn);

      card.onclick = function () {
        launchReplayGame(idx);
      };
      container.appendChild(card);
    });
    return count;
  }

  function skipCurrentGame() {
    if (!currentGame) return;
    if (currentGame.done) return;
    currentGame.done = true;
    if (typeof currentGame.clearAsync === "function") {
      currentGame.clearAsync();
    }
    if (typeof currentGame.onWin === "function") {
      var win = currentGame.onWin;
      win();
    } else if (typeof currentGame.complete === "function") {
      currentGame.complete("Испытание пропущено");
    }
  }

  function launchReplayGame(dayIdx) {
    hideScreens();
    $("screenGame").classList.add("active");
    var topNav = $("gameTopNav");
    var exitBtn = $("gameExitBtn");
    var skipBtn = $("gameSkipBtn");
    if (topNav) {
      topNav.classList.remove("hidden");
      if (exitBtn) exitBtn.classList.remove("hidden");
      if (skipBtn) {
        if (isTestMode()) skipBtn.classList.remove("hidden");
        else skipBtn.classList.add("hidden");
      }
    }

    if (exitBtn) {
      exitBtn.onclick = function () {
        if (currentGame) {
          currentGame.destroy();
          currentGame = null;
        }
        hideScreens();
        render();
      };
    }

    var cfg = dayGames[dayIdx % dayGames.length];
    var copy = {};
    for (var k in cfg) copy[k] = cfg[k];
    copy.stage = grutikStage();
    copy.isReplay = true;
    copy.isTest = isTestMode();
    if (cfg.type === "blockblast") {
      copy.endless = true;
    }
    copy.onExit = function () {
      if (currentGame) {
        currentGame.destroy();
        currentGame = null;
      }
      hideScreens();
      render();
    };

    var area = $("gameArea");
    area.innerHTML = "";
    currentGame = Games.create(cfg.type, area, copy, function () {
      showReplayWin(cfg, dayIdx);
    });
  }

  function showReplayWin(cfg, dayIdx) {
    var area = $("gameArea");
    if (!area) return;
    var overlay = makeEl("div", "replay-win-overlay");
    var card = makeEl("div", "replay-win-card");
    card.appendChild(makeEl("div", "replay-win-icon", cfg.icon || "🌸"));
    card.appendChild(makeEl("h3", "replay-win-title", "Отлично сыграно!"));
    card.appendChild(makeEl("p", "replay-win-desc", "Испытание «" + cfg.title + "» успешно пройдено!"));

    var actions = makeEl("div", "replay-win-actions");
    var restartBtn = makeEl("button", "btn big", "Сыграть заново ↺");
    restartBtn.onclick = function () {
      launchReplayGame(dayIdx);
    };

    var backBtn = makeEl("button", "btn btn-primary big", "Вернуться к Грутику 💤");
    backBtn.onclick = function () {
      if (currentGame) {
        currentGame.destroy();
        currentGame = null;
      }
      hideScreens();
      render();
    };

    actions.appendChild(restartBtn);
    actions.appendChild(backBtn);
    card.appendChild(actions);
    overlay.appendChild(card);
    try { confetti(); } catch (e) {}
  }

  function renderGame(dayIdx) {
    $("screenGame").classList.add("active");
    var topNav = $("gameTopNav");
    var exitBtn = $("gameExitBtn");
    var skipBtn = $("gameSkipBtn");
    if (topNav) {
      if (isTestMode()) {
        topNav.classList.remove("hidden");
        if (skipBtn) skipBtn.classList.remove("hidden");
        if (exitBtn) exitBtn.classList.add("hidden");
      } else {
        topNav.classList.add("hidden");
        if (skipBtn) skipBtn.classList.add("hidden");
      }
    }
    var cfg = dayGames[dayIdx % dayGames.length];
    var copy = {};
    for (var k in cfg) copy[k] = cfg[k];
    copy.stage = grutikStage();
    copy.isTest = isTestMode();
    var area = $("gameArea");
    area.innerHTML = "";
    currentGame = Games.create(cfg.type, area, copy, function () {
      if (state.won.indexOf(dayIdx) === -1) state.won.push(dayIdx);
      save();
      var scene = POSTWIN[dayIdx] || [];
      if (scene.length) playStory(scene, function () {
        render();
        try { confetti(); } catch (e) { }
      });
      else {
        render();
        try { confetti(); } catch (e) { }
      }
    });
  }

  function renderWait() {
    $("screenWait").classList.add("active");
    $("waitEmoji").textContent = "💤 ТИХИЙ ЧАС";
    $("waitTitle").textContent = "На сегодня всё";
    $("waitText").textContent = "Грутик сладко спит и набирается сил. Следующий подарок откроется завтра!";
    var ms = nextMidnight() - Date.now();
    var hh = Math.floor(ms / 3600000);
    var mm = Math.floor((ms % 3600000) / 60000);
    $("waitCount").textContent = "Следующее открытие через " + hh + " ч " + mm + " мин";

    updateGrutikBar();

    var waitCanvas = $("waitGrutikCanvas");
    if (waitCanvas) {
      window.__waitCanvas = waitCanvas;
      var stage = grutikStage();
      try {
        var nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        drawGrutik(waitCanvas, stage, { time: nowTime, sleeping: true, tilt: 0.16, arm: -12, y: 0 });
      } catch (e) {}

      if (typeof runGrutikSleep === "function") {
        // A prior screen may have left a stale animation state; restart for this canvas.
        cancelAnimationFrame(grutikSleepRaf);
        grutikSleeping = true;
        grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
      }
      waitCanvas.onclick = function () {
        var sayEl = $("grutikSay");
        if (sayEl) {
          sayEl.innerHTML = '<span class="groot-voice">Я есть Грутик...</span><span class="groot-trans">(Тсс... Малыш сладко спит до завтра 💤)</span>';
        }
      };
    }

    var replayCount = renderReplayCards("waitGamesList");
    var waitReplaySec = $("waitReplaySection");
    if (waitReplaySec) {
      waitReplaySec.classList.toggle("hidden", replayCount === 0);
    }
  }

  function renderFinal() {
    $("screenFinal").classList.add("active");
    $("finalText").textContent = state.givenLog.length
      ? "SEED → PULSE → CODE → VENOM → SYNC → GIFT"
      : "";
    $("finalLetter").textContent = SITE_CONFIG.finalMessage || "";

    var grid = $("finalGrid");
    grid.innerHTML = "";
    state.givenLog.forEach(function (g) {
      var num = g.num || parseInt(String(g.id).replace(/\D/g, ""), 10) || "?";
      var item = makeEl("div", "final-item secret");
      if (g.photo) {
        var img = makeEl("img");
        img.src = g.photo;
        img.onerror = function () { img.remove(); };
        item.appendChild(img);
      } else {
        item.appendChild(makeEl("div", "fin-noimg", "№ " + num));
      }
      item.appendChild(makeEl("div", "fin-secret-badge", "№ " + num));
      item.appendChild(makeEl("div", "fin-t", "Подарок №" + num));
      grid.appendChild(item);
    });

    try { drawGrutik($("finalGrutik"), 8); } catch (e) { }
    finalGrootSay(0);
    $("finalGrutik").onclick = function () {
      var n = $("finalGrutik").__say || 0;
      n = (n + 1) % 2;
      finalGrootSay(n);
    };

    renderReplayCards("finalGamesList");
  }

  var FINAL_LINES = [
    "Я есть Грутик.\n(Спасибо за заботу!)",
    "Я есть Грутик.\n(Мы всегда рядом.)"
  ];

  function finalGrootSay(n) {
    $("finalGrutik").__say = n;
    var line = FINAL_LINES[n];
    var el = $("finalGrootSay");
    if (line.includes("\n")) {
      var parts = line.split("\n");
      el.innerHTML = '<span class="groot-voice">' + parts[0] + '</span><span class="groot-trans">' + parts.slice(1).join(" ") + '</span>';
    } else {
      el.textContent = line;
    }
  }


  var WHEEL_COLORS = ["#8d315b", "#48223a", "#7045ad", "#273a31", "#b44570", "#35263c", "#625091", "#1c2b25"];

  function renderWheel(dayIdx) {
    $("screenWheel").classList.add("active");

    var rem = remainingPool(dayIdx);
    $("wheelHint").textContent = "Колесо выберет один из ещё не открытых подарков.";

    var btn = $("spinBtn");
    btn.disabled = false;
    btn.textContent = "Крутить колесо";
    btn.onclick = function () { spinWheel(rem, dayIdx); };

    drawWheel(rem);
  }

  function drawWheel(pool) {
    var canvas = $("wheel");
    var ctx = canvas.getContext("2d");
    var size = canvas.width;
    var cx = size / 2, cy = size / 2, r = size / 2 - 14;
    ctx.clearRect(0, 0, size, size);

    var n = pool.length;
    var da = (Math.PI * 2) / n;
    var start = -Math.PI / 2;

    for (var i = 0; i < n; i++) {
      var a0 = start + i * da;
      var a1 = a0 + da;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 6;
      ctx.stroke();

      var mid = a0 + da / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 6;
      ctx.fillText("?", r * 0.62, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.fillStyle = "#b93f73";
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.strokeRect(cx - 15, cy - 10, 30, 24);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 14);
    ctx.moveTo(cx - 18, cy - 10); ctx.lineTo(cx + 18, cy - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 17, 7, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 17, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function pickResult(pool, dayIdx) {
    if (dayIdx === 3) {
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].id === "g6") return pool[i];
      }
    }
    var regular = pool.filter(function (g) {
      return g.id !== "g6" || dayIdx === 3;
    });
    if (!regular.length) regular = pool;
    return regular[Math.floor(Math.random() * regular.length)];
  }

  var wheelStateDisable = false;

  function spinWheel(pool, dayIdx) {
    if (wheelStateDisable) return;
    wheelStateDisable = true;
    wheelSpinDay = dayIdx;

    var canvas = $("wheel");
    var btn = $("spinBtn");
    btn.disabled = true;

    var result = pickResult(pool, dayIdx);
    var n = pool.length;
    var idx = pool.indexOf(result);
    var daDeg = 360 / n;
    var centerDeg = -90 + idx * daDeg + daDeg / 2;
    var targetMod = ((-90 - centerDeg) % 360 + 360) % 360;

    wheelRot += 360 * 6 + targetMod;
    canvas.style.transition = "transform 4.4s cubic-bezier(.15, .7, .1, 1)";
    canvas.style.transform = "rotate(" + wheelRot + "deg)";

    canvas.addEventListener("transitionend", function handler() {
      canvas.removeEventListener("transitionend", handler);
      setTimeout(function () {
        wheelStateDisable = false;
        showGiftModal(result, dayIdx);
      }, 150);
    });
  }

  function showGiftModal(gift, dayIdx) {
    $("modalDay").textContent = "ДЕНЬ " + (dayIdx + 1);
    var giftNum = gift.num || parseInt(String(gift.id).replace(/\D/g, ""), 10) || (dayIdx + 1);

    $("modalTitle").textContent = "Секретный подарок №" + giftNum;
    $("modalText").textContent = "Содержимое засекречено, чтобы сохранить сюрприз!\nНазови номер №" + giftNum + ", чтобы забрать подарок в реальности 🎁";

    var photoBox = $("modalPhoto");
    photoBox.className = "modal-photo secret";
    photoBox.innerHTML = "";
    if (gift.photo) {
      var img = makeEl("img");
      img.src = gift.photo;
      img.alt = "Секретный подарок";
      img.onerror = function () {
        photoBox.innerHTML = "";
        photoBox.appendChild(makeEl("div", "ph-fallback", "№ " + giftNum));
      };
      photoBox.appendChild(img);
    } else {
      photoBox.appendChild(makeEl("div", "ph-fallback", "№ " + giftNum));
    }

    var badge = makeEl("div", "gift-secret-badge");
    badge.appendChild(makeEl("span", "gift-secret-icon", "🔒"));
    badge.appendChild(makeEl("span", "gift-secret-number", "№ " + giftNum));
    badge.appendChild(makeEl("span", "gift-secret-tag", "ЗАСЕКРЕЧЕНО"));
    photoBox.appendChild(badge);

    var link = $("modalLink");
    link.classList.add("hidden");
    link.removeAttribute("href");

    var modal = $("modal");
    modal.classList.remove("hidden");
    $("modalClose").onclick = onClose;
    modal.onclick = function (e) { if (e.target === modal) onClose(); };

    var granted = false;
    function onClose() {
      if (granted) return;
      granted = true;
      modal.classList.add("hidden");
      grant(gift, dayIdx);
    }
  }

  function grant(gift, dayIdx) {
    var giftNum = gift.num || parseInt(String(gift.id).replace(/\D/g, ""), 10) || (dayIdx + 1);
    if (state.given.indexOf(gift.id) === -1) state.given.push(gift.id);
    if (state.givenDay.indexOf(dayIdx) === -1) state.givenDay.push(dayIdx);
    state.givenLog.push({ id: gift.id, num: giftNum, title: "Подарок №" + giftNum, originalTitle: gift.title, photo: gift.photo });
    state.won = state.won.filter(function (d) { return d !== dayIdx; });
    save();
    updateGrutikBar();

    var isLast = state.givenDay.length >= DAYS;
    var scene = (gift.id === "g6" || dayIdx === 3) && !isLast ? AFTERGIFT[3] : afterGiftScene(dayIdx, isLast);
    if (scene && scene.length) playStory(scene, function () { render(); });
    else render();
  }


  function confetti() {
    try {
      var layer = $("confettiLayer");
      layer.innerHTML = "";
      var colors = ["#ff4d88", "#ffa2c6", "#ff8ac1", "#c14491", "#ffc4e1", "#7dd07f", "#ffd166"];
      for (var i = 0; i < 90; i++) {
        var p = document.createElement("div");
        p.style.cssText = "position:fixed;z-index:60;pointer-events:none;left:50%;top:50%;";
        p.style.width = (8 + Math.random() * 10) + "px";
        p.style.height = (10 + Math.random() * 14) + "px";
        p.style.borderRadius = Math.random() < 0.5 ? "50%" : "3px";
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        var angle = Math.random() * Math.PI * 2;
        var dist = 120 + Math.random() * 380;
        var vx = Math.cos(angle) * dist;
        var vy = Math.sin(angle) * dist - 120;
        var rot = Math.random() * 720 - 360;
        layer.appendChild(p);
        if (typeof p.animate === "function") {
          var anim = p.animate([
            { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
            { transform: "translate(calc(-50% + " + vx + "px), calc(-50% + " + vy + "px)) rotate(" + rot + "deg)", opacity: 0.9 }
          ], { duration: 1200 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.4,1)" });
          anim.onfinish = (function (piece) {
            return function () { piece.remove(); };
          })(p);
          setTimeout(function (el) { el.remove(); }, 2300, p);
        } else {
          setTimeout(function (el) { el.remove(); }, 2200, p);
        }
      }
    } catch (e) { }
  }


  function init() {
    $("screenStory").addEventListener("click", function (e) {
      if (e.target && e.target.closest("#storyBtn")) return;
      storyTap();
    });

    var skipBtn = $("gameSkipBtn");
    if (skipBtn) {
      skipBtn.onclick = function () {
        skipCurrentGame();
      };
    }

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", function (e) {
        if ((e.shiftKey && (e.key === "S" || e.key === "s" || e.key === "Ы" || e.key === "ы")) || e.key === "F2") {
          if ($("screenGame") && $("screenGame").classList.contains("active")) {
            e.preventDefault();
            skipCurrentGame();
          }
        }
      });

      window.skipCurrentGame = skipCurrentGame;
      window.skipGame = skipCurrentGame;
      if (!window.Advent) window.Advent = {};
      window.Advent.skipGame = skipCurrentGame;
      window.Advent.isTestMode = isTestMode;
      window.Advent.enableTestMode = function () {
        window.__testMode = true;
        try { localStorage.setItem("advent_test", "1"); } catch (e) {}
        render();
      };
      window.Advent.disableTestMode = function () {
        window.__testMode = false;
        try { localStorage.removeItem("advent_test"); } catch (e) {}
        render();
      };
    }

    var compCanvas = $("grutikCanvas");
    if (compCanvas) {
      compCanvas.onclick = function () {
        var sayEl = $("grutikSay");
        if (!sayEl) return;
        if (isSleeping()) {
          sayEl.innerHTML = '<span class="groot-voice">Я есть Грутик...</span><span class="groot-trans">(Тсс... Малыш сладко спит до завтра 💤)</span>';
        }
      };
    }

    startGrutikIdle($("grutikCanvas"), grutikStage);

    render();

    window.__app = {
      render: render,
      state: state,
      currentDayIdx: currentDayIdx,
      days: DAYS,
      grant: grant,
      confetti: confetti,
      stage: grutikStage,
      isSleeping: isSleeping,
      game: function () { return currentGame; },
      skipGame: skipCurrentGame,
      isTestMode: isTestMode,
      storyTap: storyTap
    };
  }

  function domReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  domReady(init);
})();
