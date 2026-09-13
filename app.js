(function () {
  "use strict";

  var KEY = "giftPoolAdvent_v1";
  var DAYS = SITE_CONFIG.days || 6;
  var DAY_MS = 86400000;
  var wheelRot = 0;
  var wheelSpinDay = 0;
  var currentGame = null;

  var state = loadState();
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
  }

  function forceReset() {
    var q = new URLSearchParams(location.search);
    if (q.has("reset")) {
      localStorage.removeItem(KEY);
      state = defaultState();
    }
  }

  function forceDayIndex() {
    var q = new URLSearchParams(location.search);
    if (q.has("preview")) {
      var n = parseInt(q.get("preview"), 10);
      window.__previewDay = Math.max(0, Math.min(DAYS - 1, (isNaN(n) ? 1 : n) - 1));
    }
    if (q.has("stage")) {
      var st = parseInt(q.get("stage"), 10);
      window.__stageForce = isNaN(st) ? null : st;
    }
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

  function currentDayIdx() {
    if (window.__previewDay != null) return window.__previewDay;
    if (!state.started) {
      state.started = true;
      if (!state.start) state.start = todayMidnight();
      save();
    }
    if (!state.start) return 0;
    var diff = Math.floor((todayMidnight() - state.start) / DAY_MS);
    return Math.max(0, Math.min(DAYS - 1, diff));
  }

  function normalizeGift(g, i) {
    return {
      id: g.id != null ? String(g.id) : "auto" + i,
      title: g.title || "Подарок #" + (i + 1),
      text: g.text || "",
      photo: g.photo || "",
      link: g.link || ""
    };
  }

  function pool() {
    return GIFT_POOL.map(normalizeGift);
  }

  function remainingPool() {
    return pool().filter(function (g) {
      return state.given.indexOf(g.id) === -1;
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
    { type: "memory", mark: "01", kicker: "ДЕНЬ 01 · ПАМЯТЬ", title: "Наши моменты", instruction: "Найди двенадцать пар фотографий.", photos: SITE_CONFIG.memoryPhotos, centerPhoto: SITE_CONFIG.memoryCenterPhoto },
    { type: "blockblast", mark: "02", kicker: "ДЕНЬ 02 · ТАКТИКА", title: "Block Blast: корни", instruction: "Перетаскивай фигуры и собирай полные линии.", lines: 4 },
    { type: "echo", mark: "03", kicker: "ДЕНЬ 03 · ПАМЯТЬ", title: "Эхо сигнала", instruction: "Запомни код, который нашёл Грутик.", lengths: [3, 4, 5, 6] },
    { type: "photoPuzzle", mark: "04", kicker: "ДЕНЬ 04 · ПАМЯТЬ", title: "Собери нашу фотографию", instruction: "Соедини шестнадцать фигурных деталей.", photo: SITE_CONFIG.couplePhoto, size: 4 },
    { type: "circuit", mark: "05", kicker: "ДЕНЬ 05 · ЛОГИКА", title: "Живая схема", instruction: "Верни питание колесу." },
    { type: "finale", mark: "06", kicker: "ДЕНЬ 06 · ФИНАЛ", title: "Протокол SONECHKA", instruction: "Три фазы. Один финальный запуск." }
  ];


  function L(who, text) { return { t: "line", who: who, text: text }; }
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
    $("storyLine").textContent = s.text;
    if (s.who === "raw") $("storyLine").className = "story-line raw";
    else $("storyLine").className = "story-line";
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
      if (d === 4) return "Я есть Грутик! ...А МЫ — ВЕНОМ.";
      if (d === 5) return "Два голоса. Одна задача. Пока работает.";
      if (d >= 6) return state.finalForm ? "Я есть Грутик. Мы всё ещё здесь." : "Два голоса. Одна задача. Пока работает.";
    }
    if (state.venomInfected) {
      if (!state.venomControlled) return "Я есть Грутик! ...А МЫ — ВЕНОМ.";
      if (d === 4) return "Я есть Грутик. Мы есть Грутик. Мы ещё не решили.";
      if (d === 5) return "Два голоса. Одна задача. Пока работает.";
      return state.finalForm ? "Я есть Грутик. Мы всё ещё здесь." : "Два голоса. Одна задача. Пока работает.";
    }
    return GRUTIK_LINES[Math.min(d, GRUTIK_LINES.length - 1)];
  }

  function grutikLine() {
    if (!state.grootPlanted && window.__previewDay == null) return GRUTIK_LINES[0];
    return lineForDay(currentDayIdx() + 1);
  }

  function setCompanionVisible(visible) {
    $("grutikBar").classList.toggle("companion-hidden", !visible);
    document.querySelector("main").classList.toggle("without-companion", !visible);
  }

  function updateGrutikBar() {
    var companionVisible = window.__previewDay != null || state.introSeen && state.grootPlanted;
    setCompanionVisible(companionVisible);
    try { drawGrutik($("grutikCanvas"), grutikStage()); } catch (e) { }
    $("grutikSay").textContent = grutikLine();
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
    L("gru", "Я есть Грутик."),
    W(900),
    L("gru", "...кажется."),
    W(600),
    L("nar", "Росток раскрывает крохотные ладошки и смотрит на тебя круглыми глазами."),
    L("gru", "Я есть Грутик!"),
    L("nar", "Кажется, теперь он живёт здесь. И кажется, он уже к тебе привязался."),
    C("intro_react", "Как отреагируешь?", [
      { text: "👋 Привет, Грутик!", steps: [
        L("gru", "Я есть Грутик!!!"),
        F("heartsIn", 400),
        L("nar", "Он подпрыгивает от радости и чуть не вываливается из горшка.")
      ]},
      { text: "🌿 Погладить по листикам", steps: [
        L("nar", "Ты осторожно проводишь пальцем по маленькому листику."),
        L("gru", "Я есть... Грутик."),
        F("heartsIn", 400),
        L("nar", "Он закрывает глаза и довольно шелестит.")
      ]},
      { text: "😲 Семечко... заговорило?!", steps: [
        L("gru", "Я есть Грутик?"),
        L("nar", "Он наклоняет голову, будто не понимает, почему ты удивлена."),
        L("gru", "Я есть Грутик!"),
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
      L("gru", "Я есть Грутик!"),
      W(600),
      L("nar", "Кажется, он очень рад тебя видеть."),
      F("heartsIn", 400),
      W(700),
      L("nar", "Вокруг горшочка рассыпались карточки с вашими воспоминаниями. Грутик переворачивает одну, но тут же забывает, где пара."),
      L("gru", "...Я есть Грутик?"),
      L("nar", "Похоже, собрать все памятные моменты воедино придётся тебе."),
      B("Помочь Грутику", markSeen(0))
    ],
    [
      S(2),
      L("nar", "Грутик?"),
      W(800),
      L("gru", "Я есть Грутик!"),
      L("nar", "На экране появляется поле из древесных блоков. Грутик складывает три в ряд и довольно кивает."),
      L("nar", "Похоже, он предлагает расчистить место для новых корней."),
      B("Ну показывай", markSeen(1))
    ],
    [
      S(3),
      L("gru", "Я есть Грутик!"),
      F("flash"),
      F("boom", 400),
      W(900),
      L("nar", "Что-то маленькое чёрное упало рядом. Капля шевелится."),
      L("gru", "Я есть... Грутик?"),
      L("sonechka", "Лучше это не трогай."),
      L("nar", "Грутик кивает. Но всё равно тянет руку. Капля снова убегает и исчезает."),
      L("nar", "Это пока только намёк."),
      B("Играть", markSeen(2))
    ],
    [
      S(4),
      L("sonechka", "Странно..."),
      L("sonechka", "Обычно Грутик уже ждёт здесь."),
      L("raw", "ШЛЁП"),
      W(500),
      L("gru", "Я ЕСТЬ ГРУТИК!!!"),
      L("nar", "Следом ползёт чёрная субстанция. Грутик закрывается ветками."),
      F("blobIn", 300),
      FN(infect),
      F("blackout", 1100),
      W(600),
      L("nar", "Тишина."),
      W(700),
      S(5),
      L("gru", "Я..."),
      W(500),
      L("gru", "Есть..."),
      L("venom", "ВЕНОМ."),
      W(600),
      L("nar", "Грутик ударяет себя по голове. Пасть исчезает."),
      L("gru", "Я есть Грутик!"),
      L("venom", "Мы — Веном."),
      L("nar", "В суматохе ваша общая фотография рассыпалась на кусочки пазла. Грутик тянется к ней, но Веном перехватывает ветку."),
      L("gru", "Я есть Грутик..."),
      L("venom", "МЫ СОБЕРЁМ ЕЁ ПЕРВЫМИ."),
      L("nar", "Сонечка, кажется, собрать фотографию придётся тебе — пока они не растащили кусочки."),
      B("Собрать фото", markSeen(3))
    ],
    [
      S(7),
      L("gru", "Я есть Грутик!"),
      L("venom", "Мы есть Грутик."),
      L("nar", "Они пытаются подать энергию к колесу, но ветви и чёрные щупальца искрят."),
      L("gru", "Я есть Грутик..."),
      L("venom", "Питание не идёт. Контур разомкнут."),
      L("nar", "Сонечка, помоги им замкнуть живую схему и вернуть колесу питание."),
      B("Починить схему", markSeen(4))
    ],
    [
      S(7),
      L("nar", "День 6."),
      W(800),
      L("nar", "Последний подарок."),
      W(600),
      L("gru", "Я есть Грутик."),
      L("venom", "А мы — Веном."),
      L("venom", "Кажется, сегодня последний день."),
      L("gru", "Я есть Грутик..."),
      F("wheelBroken"),
      L("nar", "Колесо заблокировано! Вчера питание восстановили, но для главного подарка обычной мощности мало."),
      L("venom", "Сработала защита. Требуется «Протокол SONECHKA»."),
      L("gru", "Я есть Грутик!"),
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
      L("nar", "Из горшка вытягивается тонкая ветка и осторожно касается колеса."),
      W(600),
      L("nar", "Грутик упирается корнями и тянет сильнее — колесо начинает крутиться!"),
      F("flash"),
      W(600),
      L("gru", "Я есть Грутик!"),
      L("nar", "Похоже, Грутик нашёл способ доставать отсюда подарки."),
      B("Крутить вместе")
    ],
    [
      S(2),
      F("wheelIn"),
      L("gru", "Я есть Грутик!"),
      L("nar", "Последняя собранная линия вспыхивает. Энергия проходит по корням к колесу."),
      F("glow", 300),
      L("nar", "Кажется, это означает: «Я всё починил»."),
      B("Крутить колесо")
    ],
    [
      S(4),
      F("wheelIn"),
      L("nar", "Последняя ячейка сигнала вспыхивает — колесо снова работает."),
      F("peekBlack", 400),
      L("gru", "Я есть Грутик."),
      B("Крутить колесо")
    ],
    [
      S(6),
      F("wheelIn"),
      FN(controlVenom),
      L("gru", "Я есть Грутик."),
      L("venom", "Мы есть Грутик."),
      W(600),
      L("nar", "Кажется, они договорились."),
      L("nar", "Из руки Грутика вылетает чёрное щупальце и раскручивает колесо."),
      L("gru", "Я есть Грутик?"),
      L("venom", "УДОБНО."),
      B("Крутить колесо")
    ],
    [
      S(7),
      F("wheelIn"),
      L("gru", "Я есть Грутик!"),
      L("venom", "Схема замкнута. Командная работа."),
      B("Крутить колесо")
    ],
    [
      FN(unlockFinal),
      F("glow", 400),
      L("nar", "Последний импульс превращается в свет и проходит сквозь Грутика."),
      W(900),
      L("nar", "На секунду симбиот отделяется. С другой стороны — обычный Грутик."),
      L("venom", "Мы можем уйти."),
      L("gru", "Я есть Грутик."),
      L("venom", "Ты уверен?"),
      L("gru", "Я есть Грутик."),
      L("venom", "Он сказал, что мы остаёмся."),
      L("nar", "Симбиот снова соединяется. Форма теперь гармоничная."),
      F("merge", 300),
      L("nar", "Грутик + Веном."),
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
      L("gru", "Я есть Грутик."),
      L("nar", "Первый подарок найден. А Грутик, кажется, решил остаться."),
      B("До завтра!")
    ],
    [
      S(2),
      L("nar", "Грутик садится рядом с коробочкой и внимательно смотрит на неё."),
      W(700),
      L("gru", "Я есть Грутик?"),
      L("nar", "Нет, Грутик. Этот подарок не тебе."),
      L("gru", "Я есть Грутик..."),
      B("До завтра!")
    ],
    [
      S(4),
      L("gru", "Я есть Грутик."),
      F("peekBlack", 500),
      W(800),
      L("nar", "Из-за горшка на секунду появляется маленький чёрный отросток."),
      B("До завтра!")
    ],
    [
      S(6),
      L("nar", "Грутик смотрит на фотографию. Затем на себя."),
      L("gru", "Я есть Грутик?!"),
      L("venom", "МЫ КРАСИВЫ."),
      L("gru", "Я есть Грутик!"),
      L("venom", "Очень красивы."),
      B("До завтра!")
    ],
    [
      S(7),
      L("venom", "Хороший день."),
      L("gru", "Я есть Грутик!"),
      L("venom", "Очень хороший."),
      B("До завтра!")
    ]
  ];

  var FINAL_SCENE = [
    S(8),
    L("nar", "Грутик касается края того самого горшка, с которого всё началось."),
    W(800),
    L("venom", "Всё началось с этой штуки?"),
    L("gru", "Я есть Грутик."),
    L("venom", "Ты был очень маленький."),
    L("nar", "Грутик недовольно смотрит на него."),
    L("venom", "Очень. Маленький."),
    W(700),
    F("icons", 500),
    W(600),
    L("nar", "Грутик подходит к экрану так близко, как только может."),
    L("gru", "Я есть Грутик."),
    L("nar", "«Спасибо, что помогала мне расти»."),
    L("venom", "Он ещё сказал, что все подарки твои."),
    L("gru", "Я есть Грутик!"),
    L("venom", "Да-да. Именно это."),
    B("Открыть письмо")
  ];

  var DAY4_AFTER = [
    S(6),
    L("nar", "Грутик и Веном внимательно рассматривают случайный выбор колеса."),
    L("gru", "Я есть Грутик."),
    L("venom", "Одобряем."),
    B("До завтра!")
  ];

  function afterGiftScene(day, isLast) {
    if (isLast) return FINAL_SCENE;
    if (day === 3) return DAY4_AFTER;
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
    ["screenGame", "screenWheel", "screenWait", "screenFinal", "screenStory"].forEach(function (id) {
      $(id).classList.remove("active");
    });
  }

  function renderGame(dayIdx) {
    $("screenGame").classList.add("active");
    var cfg = dayGames[dayIdx % dayGames.length];
    var copy = {};
    for (var k in cfg) copy[k] = cfg[k];
    copy.stage = grutikStage();
    var area = $("gameArea");
    area.innerHTML = "";
    currentGame = Games.create(cfg.type, area, copy, function () {
      if (state.won.indexOf(dayIdx) === -1) state.won.push(dayIdx);
      save();
      if (window.__previewDay != null) {
        try { render(); } catch (e) { }
        try { confetti(); } catch (e) { }
        return;
      }
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
    $("waitTitle").textContent = "На сегодня всё";
    $("waitText").textContent = "Играй завтра — тебя ждёт ещё один подарок.";
    var ms = nextMidnight() - Date.now();
    var hh = Math.floor(ms / 3600000);
    var mm = Math.floor((ms % 3600000) / 60000);
    $("waitCount").textContent = "Следующее открытие через " + hh + " ч " + mm + " мин";

    var blockPlayBtn = $("waitPlayBlock");
    if (blockPlayBtn) {
      var canPlayBlock = state.givenDay.indexOf(1) !== -1 || state.won.indexOf(1) !== -1;
      blockPlayBtn.classList.toggle("hidden", !canPlayBlock);
      blockPlayBtn.onclick = function () {
        hideScreens();
        $("screenGame").classList.add("active");
        var cfg = dayGames[1];
        var copy = {};
        for (var k in cfg) copy[k] = cfg[k];
        copy.stage = grutikStage();
        copy.endless = true;
        currentGame = Games.create(cfg.type, $("gameArea"), copy, function () {
          render();
        });
      };
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
      var item = makeEl("div", "final-item");
      if (g.photo) {
        var img = makeEl("img");
        img.src = g.photo;
        img.onerror = function () { img.remove(); };
        item.appendChild(img);
      } else {
        item.appendChild(makeEl("div", "fin-noimg", "GIFT"));
      }
      item.appendChild(makeEl("div", "fin-t", g.title));
      grid.appendChild(item);
    });

    try { drawGrutik($("finalGrutik"), 8); } catch (e) { }
    finalGrootSay(0);
    $("finalGrutik").onclick = function () {
      var n = $("finalGrutik").__say || 0;
      n = (n + 1) % 2;
      finalGrootSay(n);
    };
  }

  var FINAL_LINES = [
    "Я есть Грутик.",
    "Мы всё ещё здесь."
  ];

  function finalGrootSay(n) {
    $("finalGrutik").__say = n;
    $("finalGrootSay").textContent = FINAL_LINES[n];
  }


  var WHEEL_COLORS = ["#8d315b", "#48223a", "#7045ad", "#273a31", "#b44570", "#35263c", "#625091", "#1c2b25"];

  function renderWheel(dayIdx) {
    $("screenWheel").classList.add("active");

    var rem = remainingPool();
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

  function pickResult(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  var wheelStateDisable = false;

  function spinWheel(pool, dayIdx) {
    if (wheelStateDisable) return;
    wheelStateDisable = true;
    wheelSpinDay = dayIdx;

    var canvas = $("wheel");
    var btn = $("spinBtn");
    btn.disabled = true;

    var result = pickResult(pool);
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
    $("modalTitle").textContent = gift.title;
    $("modalText").textContent = gift.text || "";

    var photoBox = $("modalPhoto");
    photoBox.innerHTML = "";
    if (gift.photo) {
      var img = makeEl("img");
      img.src = gift.photo;
      img.alt = "Подарок";
      img.onerror = function () {
        photoBox.innerHTML = "";
        photoBox.appendChild(makeEl("div", "ph-fallback", "GIFT"));
      };
      photoBox.appendChild(img);
    } else {
      photoBox.appendChild(makeEl("div", "ph-fallback", "GIFT"));
    }

    var link = $("modalLink");
    if (gift.link) {
      link.href = gift.link;
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
      link.removeAttribute("href");
    }

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
    if (state.given.indexOf(gift.id) === -1) state.given.push(gift.id);
    if (state.givenDay.indexOf(dayIdx) === -1) state.givenDay.push(dayIdx);
    state.givenLog.push({ id: gift.id, title: gift.title, photo: gift.photo });
    state.won = state.won.filter(function (d) { return d !== dayIdx; });
    save();
    updateGrutikBar();

    if (window.__previewDay != null) {
      render();
      return;
    }

    var isLast = state.givenDay.length >= DAYS;
    var scene = gift.id === "g4" && !isLast ? AFTERGIFT[3] : afterGiftScene(dayIdx, isLast);
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
      game: function () { return currentGame; },
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
