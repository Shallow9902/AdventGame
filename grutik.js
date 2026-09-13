var GRUTIK_LINES = [
  "Я есть Грутик...\n(Сигнал едва заметен. Внутри точно что-то есть.)",
  "Я есть Грутик.\n(Начнём?)",
  "Я есть Грутик!\n(Блоки готовы. Расчистим место для корней!)",
  "Я есть... Грутик?\n(Этот чёрный сигнал здесь раньше не появлялся...)",
  "Я есть Грутик!\n(...А МЫ — ВЕНОМ.)",
  "Я есть Грутик.\n(Два голоса. Одна задача. Пока работает.)",
  "Я есть Грутик.\n(Мы всё ещё здесь.)"
];

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function leaf(ctx, x, y, angle, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  var gradient = ctx.createLinearGradient(0, -size / 2, size, size / 2);
  gradient.addColorStop(0, color || "#8bd39a");
  gradient.addColorStop(1, "#3e8054");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * .24, -size * .42, size * .82, -size * .35, size, 0);
  ctx.bezierCurveTo(size * .72, size * .34, size * .24, size * .36, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,55,31,.45)";
  ctx.lineWidth = Math.max(1, size * .055);
  ctx.beginPath();
  ctx.moveTo(size * .08, 0);
  ctx.lineTo(size * .8, 0);
  ctx.stroke();
  ctx.restore();
}

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * .3);
  ctx.bezierCurveTo(x - size, y - size * .34, x - size * .62, y - size, x, y - size * .42);
  ctx.bezierCurveTo(x + size * .62, y - size, x + size, y - size * .34, x, y + size * .3);
  ctx.closePath();
}

var GRUTIK_STAGES = {
  "-1": { growth: 0, seed: -1, leaves: 0, venom: 0, chaos: 0, heroic: 0 },
  "0": { growth: 0, seed: 1, leaves: 0, venom: 0, chaos: 0, heroic: 0 },
  "1": { growth: .43, seed: 0, leaves: 3, venom: 0, chaos: 0, heroic: 0 },
  "2": { growth: .58, seed: 0, leaves: 5, venom: 0, chaos: 0, heroic: 0 },
  "3": { growth: .78, seed: 0, leaves: 8, venom: 0, chaos: 0, heroic: 0 },
  "4": { growth: .9, seed: 0, leaves: 9, venom: .08, chaos: .2, heroic: 0 },
  "5": { growth: .98, seed: 0, leaves: 7, venom: .68, chaos: 1, heroic: 0 },
  "6": { growth: 1, seed: 0, leaves: 8, venom: .52, chaos: .35, heroic: .18 },
  "7": { growth: 1.08, seed: 0, leaves: 10, venom: .61, chaos: .18, heroic: .48 },
  "8": { growth: 1.15, seed: 0, leaves: 13, venom: .7, chaos: 0, heroic: 1 }
};

function getGrutikStage(stage) {
  return GRUTIK_STAGES[String(stage)] || GRUTIK_STAGES[1];
}

function drawAtmosphere(ctx, W, H, traits, time) {
  var glow = ctx.createRadialGradient(W * .62, H * .46, 0, W * .62, H * .46, W * .42);
  glow.addColorStop(0, traits.venom ? "rgba(142,101,235,.12)" : "rgba(94,181,115,.1)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  var count = traits.heroic ? 16 : traits.growth ? 7 : 3;
  for (var i = 0; i < count; i++) {
    var px = W * (.13 + ((i * 37) % 79) / 100);
    var py = H * (.12 + ((i * 53) % 67) / 100);
    var pulse = .35 + .3 * Math.sin(time * .0014 + i);
    ctx.globalAlpha = Math.max(.08, pulse);
    ctx.fillStyle = traits.venom && i % 2 ? "#a079ff" : "#8bd39a";
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.4, W * .004), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function potGeometry(W, H, stage) {
  var mature = stage >= 3;
  var width = W * (mature ? .3 : .34);
  var height = H * (mature ? .18 : .25);
  var x = (W - width) / 2;
  var ground = H * .88;
  return { x: x, y: ground - height, w: width, h: height, ground: ground };
}

function drawGround(ctx, W, H, pot, traits) {
  var shadow = ctx.createRadialGradient(W * .52, pot.ground + 4, 0, W * .52, pot.ground + 4, W * .42);
  shadow.addColorStop(0, "rgba(0,0,0,.34)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(W * .52, pot.ground + H * .02, W * .4, H * .045, 0, 0, Math.PI * 2);
  ctx.fill();

  if (traits.heroic) {
    ctx.strokeStyle = "rgba(157,107,255,.18)";
    ctx.lineWidth = Math.max(1, W * .004);
    ctx.beginPath();
    ctx.ellipse(W * .61, pot.ground, W * .29, H * .035, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPotRear(ctx, pot) {
  var ceramic = ctx.createLinearGradient(pot.x, pot.y, pot.x + pot.w, pot.ground);
  ceramic.addColorStop(0, "#a65043");
  ceramic.addColorStop(.48, "#d0795e");
  ceramic.addColorStop(1, "#69372f");
  ctx.fillStyle = ceramic;
  ctx.beginPath();
  ctx.moveTo(pot.x + pot.w * .08, pot.y + pot.h * .08);
  ctx.lineTo(pot.x + pot.w * .92, pot.y + pot.h * .08);
  ctx.lineTo(pot.x + pot.w * .8, pot.ground);
  ctx.quadraticCurveTo(pot.x + pot.w * .5, pot.ground + pot.h * .06, pot.x + pot.w * .2, pot.ground);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4a3328";
  ctx.beginPath();
  ctx.ellipse(pot.x + pot.w / 2, pot.y + pot.h * .08, pot.w * .43, pot.h * .1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPotFront(ctx, pot) {
  var rim = ctx.createLinearGradient(pot.x, pot.y, pot.x + pot.w, pot.y);
  rim.addColorStop(0, "#7f4036");
  rim.addColorStop(.45, "#dc8266");
  rim.addColorStop(1, "#71382f");
  ctx.fillStyle = rim;
  roundRectPath(ctx, pot.x - pot.w * .035, pot.y + pot.h * .04, pot.w * 1.07, pot.h * .13, pot.h * .04);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,210,183,.16)";
  ctx.lineWidth = Math.max(1, pot.h * .015);
  ctx.beginPath();
  ctx.moveTo(pot.x + pot.w * .1, pot.y + pot.h * .075);
  ctx.quadraticCurveTo(pot.x + pot.w * .48, pot.y + pot.h * .12, pot.x + pot.w * .84, pot.y + pot.h * .07);
  ctx.stroke();
}

function drawSeed(ctx, pot, state) {
  var x = state < 0 ? pot.x + pot.w * 1.13 : pot.x + pot.w * .5;
  var y = state < 0 ? pot.y + pot.h * .16 : pot.y + pot.h * .07;
  ctx.save();
  ctx.shadowColor = "rgba(157,107,255,.75)";
  ctx.shadowBlur = pot.w * .13;
  ctx.fillStyle = "#7f5a3c";
  ctx.beginPath();
  ctx.ellipse(x, y, pot.w * .035, pot.w * .055, -.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7c19f";
  ctx.beginPath();
  ctx.ellipse(x - pot.w * .012, y - pot.w * .018, pot.w * .008, pot.w * .014, -.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(157,107,255,.52)";
  ctx.lineWidth = Math.max(1, pot.w * .012);
  ctx.beginPath();
  ctx.arc(x, y, pot.w * .09, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRoots(ctx, x, ground, scale, pot, venom) {
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(105,72,45,.85)";
  ctx.lineWidth = 7 * scale;
  var targets = [pot.x + pot.w * .55, x - 54 * scale, x + 54 * scale];
  for (var i = 0; i < targets.length; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (i - 1) * 7 * scale, ground - 8 * scale);
    ctx.bezierCurveTo(x + (i - 1) * 30 * scale, ground + 4 * scale, targets[i], ground - 8 * scale, targets[i], ground + 3 * scale);
    ctx.stroke();
  }
  if (venom) {
    ctx.strokeStyle = "rgba(20,24,31,.95)";
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 8 * scale, ground - 9 * scale);
    ctx.bezierCurveTo(x + 48 * scale, ground - 4 * scale, x + 74 * scale, ground - 18 * scale, x + 96 * scale, ground + 2 * scale);
    ctx.stroke();
  }
}

function drawRearTendrils(ctx, x, y, scale, traits, time) {
  if (!traits.venom) return;
  var count = traits.chaos > .5 ? 4 : traits.heroic ? 3 : 2;
  ctx.lineCap = "round";
  for (var i = 0; i < count; i++) {
    var side = i % 2 ? 1 : -1;
    var sway = Math.sin(time * .002 + i * 1.8) * 12 * scale * traits.chaos;
    ctx.strokeStyle = i % 2 ? "#080b0f" : "#151a22";
    ctx.lineWidth = (10 - i) * scale;
    ctx.beginPath();
    ctx.moveTo(x + side * 16 * scale, y + 45 * scale);
    ctx.bezierCurveTo(x + side * (54 + i * 8) * scale, y + sway, x + side * (72 + i * 11) * scale, y - (45 + i * 7) * scale, x + side * (55 + i * 17) * scale, y - (80 + i * 6) * scale);
    ctx.stroke();
  }
}

function woodGradient(ctx, x, top, bottom) {
  var gradient = ctx.createLinearGradient(x - 50, top, x + 45, bottom);
  gradient.addColorStop(0, "#65452f");
  gradient.addColorStop(.28, "#a8794d");
  gradient.addColorStop(.62, "#80573b");
  gradient.addColorStop(1, "#422e25");
  return gradient;
}

function branchStroke(ctx, points, width, scale) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#3d2a22";
  ctx.lineWidth = (width + 5) * scale;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  ctx.bezierCurveTo(points[1][0], points[1][1], points[2][0], points[2][1], points[3][0], points[3][1]);
  ctx.stroke();
  ctx.strokeStyle = "#8b6040";
  ctx.lineWidth = width * scale;
  ctx.stroke();
  ctx.strokeStyle = "rgba(218,163,102,.2)";
  ctx.lineWidth = Math.max(1, width * scale * .16);
  ctx.stroke();
}

function drawSprout(ctx, x, ground, scale, stage, traits, pose) {
  var bodyH = (stage === 1 ? 58 : 82) * scale;
  var bodyW = (stage === 1 ? 24 : 31) * scale;
  var top = ground - bodyH;
  var headScale = scale * (stage === 1 ? .78 : .92);
  var headY = top - 24 * headScale;
  var armLift = (pose && pose.sleeping) ? -14 : (pose.arm || 0);

  branchStroke(ctx, [
    [x - bodyW * .35, top + bodyH * .35],
    [x - 25 * scale, top + bodyH * .25],
    [x - 31 * scale, top + 9 * scale - armLift * .35],
    [x - 40 * scale, top + 2 * scale - armLift * .35]
  ], 5, scale);
  branchStroke(ctx, [
    [x + bodyW * .35, top + bodyH * .38],
    [x + 25 * scale, top + bodyH * .3],
    [x + 31 * scale, top + 14 * scale],
    [x + 38 * scale, top + 7 * scale]
  ], 5, scale);

  ctx.fillStyle = woodGradient(ctx, x, top, ground);
  ctx.beginPath();
  ctx.moveTo(x - bodyW * .42, ground);
  ctx.bezierCurveTo(x - bodyW * .58, top + bodyH * .55, x - bodyW * .5, top + bodyH * .12, x - bodyW * .27, top);
  ctx.quadraticCurveTo(x, top - 4 * scale, x + bodyW * .3, top);
  ctx.bezierCurveTo(x + bodyW * .52, top + bodyH * .22, x + bodyW * .5, top + bodyH * .64, x + bodyW * .42, ground);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3d2a22";
  ctx.lineWidth = 3 * scale;
  ctx.stroke();

  ctx.strokeStyle = "rgba(218,163,102,.28)";
  ctx.lineWidth = Math.max(1, 1.7 * scale);
  ctx.beginPath();
  ctx.moveTo(x - bodyW * .12, ground - 4 * scale);
  ctx.quadraticCurveTo(x + bodyW * .12, top + bodyH * .5, x - bodyW * .03, top + 5 * scale);
  ctx.stroke();

  var body = { top: top, width: bodyW, shoulder: top + bodyH * .35 };
  drawHead(ctx, x, headY, headScale, traits, pose);
  return { body: body, headY: headY, leafScale: headScale };
}

function drawBody(ctx, x, ground, scale, traits, pose) {
  var bodyH = 122 * scale;
  var bodyW = 48 * scale * (1 + traits.heroic * .2);
  var top = ground - bodyH;
  var shoulder = top + 33 * scale;
  var armLift = (pose && pose.sleeping) ? -18 : (pose.arm || 0);

  branchStroke(ctx, [
    [x - bodyW * .38, shoulder],
    [x - 64 * scale, shoulder - 6 * scale],
    [x - 69 * scale, top - 8 * scale - armLift],
    [x - 88 * scale, top - 24 * scale - armLift]
  ], 12, scale);
  branchStroke(ctx, [
    [x + bodyW * .38, shoulder + 2 * scale],
    [x + 61 * scale, shoulder + 9 * scale],
    [x + 72 * scale, top - 4 * scale + armLift],
    [x + 88 * scale, top - 12 * scale + armLift]
  ], 13, scale);

  ctx.fillStyle = woodGradient(ctx, x, top, ground);
  ctx.beginPath();
  ctx.moveTo(x - bodyW * .46, ground - 10 * scale);
  ctx.bezierCurveTo(x - bodyW * .62, ground - 54 * scale, x - bodyW * .58, top + 18 * scale, x - bodyW * .32, top);
  ctx.quadraticCurveTo(x, top - 8 * scale, x + bodyW * .36, top + 2 * scale);
  ctx.bezierCurveTo(x + bodyW * .62, top + 35 * scale, x + bodyW * .54, ground - 45 * scale, x + bodyW * .44, ground - 8 * scale);
  ctx.lineTo(x + bodyW * .15, ground);
  ctx.lineTo(x + bodyW * .02, ground - 28 * scale);
  ctx.lineTo(x - bodyW * .12, ground);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3d2a22";
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  var ridges = [-.27, -.08, .13, .3];
  ctx.lineCap = "round";
  ridges.forEach(function (offset, i) {
    ctx.strokeStyle = i % 2 ? "rgba(49,32,25,.52)" : "rgba(214,158,96,.24)";
    ctx.lineWidth = (i % 2 ? 3 : 2) * scale;
    ctx.beginPath();
    ctx.moveTo(x + bodyW * offset, ground - 9 * scale);
    ctx.bezierCurveTo(x + bodyW * (offset - .2), ground - 50 * scale, x + bodyW * (offset + .2), top + 40 * scale, x + bodyW * offset, top + 8 * scale);
    ctx.stroke();
  });

  ctx.fillStyle = "#452f26";
  ctx.beginPath();
  ctx.ellipse(x - 12 * scale, top + 59 * scale, 7 * scale, 10 * scale, -.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(208,154,94,.25)";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  return { top: top, width: bodyW, shoulder: shoulder };
}

function drawHead(ctx, x, y, scale, traits, pose) {
  var w = 73 * scale * (1 + traits.heroic * .08);
  var h = 69 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pose.tilt || 0);
  ctx.fillStyle = woodGradient(ctx, 0, -h / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(-w * .44, h * .35);
  ctx.bezierCurveTo(-w * .57, h * .05, -w * .49, -h * .35, -w * .27, -h * .43);
  ctx.lineTo(-w * .38, -h * .68);
  ctx.lineTo(-w * .12, -h * .5);
  ctx.lineTo(0, -h * .78);
  ctx.lineTo(w * .14, -h * .5);
  ctx.lineTo(w * .39, -h * .68);
  ctx.lineTo(w * .31, -h * .39);
  ctx.bezierCurveTo(w * .53, -h * .25, w * .55, h * .13, w * .42, h * .35);
  ctx.quadraticCurveTo(0, h * .58, -w * .44, h * .35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3d2a22";
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  ctx.strokeStyle = "rgba(54,35,26,.46)";
  ctx.lineWidth = 2.5 * scale;
  [-.3, -.1, .15, .32].forEach(function (offset) {
    ctx.beginPath();
    ctx.moveTo(w * offset, -h * .46);
    ctx.quadraticCurveTo(w * (offset - .08), -h * .08, w * (offset + .04), h * .33);
    ctx.stroke();
  });

  if (pose && pose.sleeping) {
    ctx.strokeStyle = "#2b1b14";
    ctx.lineWidth = 3.2 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-w * .2, -h * .01, 7.5 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * .2, -h * .01, 7.5 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "rgba(243, 93, 145, 0.24)";
    ctx.beginPath();
    ctx.ellipse(-w * .25, h * .09, 7 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(w * .25, h * .09, 7 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#39261d";
    ctx.lineWidth = 2.6 * scale;
    ctx.beginPath();
    ctx.arc(0, h * .18, 6.5 * scale, Math.PI * .2, Math.PI * .8);
    ctx.stroke();
  } else {
    var blink = pose.blink || 0;
    var eyeH = Math.max(1.5 * scale, 9 * scale * (1 - blink));
    ctx.fillStyle = "#17100c";
    ctx.beginPath();
    ctx.ellipse(-w * .2, -h * .02, 10 * scale, eyeH, 0, 0, Math.PI * 2);
    ctx.ellipse(w * .2, -h * .02, 10 * scale, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < .75) {
      ctx.fillStyle = "#e6d4bb";
      ctx.beginPath();
      ctx.arc(-w * .17, -h * .055, 2.8 * scale, 0, Math.PI * 2);
      ctx.arc(w * .23, -h * .055, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#39261d";
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (traits.chaos > .6) ctx.arc(0, h * .2, 13 * scale, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, h * .17, 13 * scale, Math.PI * .15, Math.PI * .85);
    ctx.stroke();
  }
  ctx.restore();
  return { w: w, h: h };
}

function drawLeafClusters(ctx, x, headY, scale, count, traits, time) {
  var slots = [
    [-39, -45, -2.5], [-25, -61, -1.7], [-7, -69, -1.35], [13, -66, -.8], [31, -57, -.35], [42, -39, .25],
    [-55, 15, 2.7], [53, 13, .4], [-67, -3, 2.9], [68, -1, .2], [-18, -79, -1.5], [24, -78, -1.1], [0, -88, -1.3]
  ];
  for (var i = 0; i < Math.min(count, slots.length); i++) {
    var slot = slots[i];
    var sway = Math.sin(time * .0015 + i * .8) * .08;
    var color = i % 3 === 0 ? "#9adea2" : i % 3 === 1 ? "#70bd82" : "#4f9664";
    if (traits.venom && i % 4 === 1) color = "#627a72";
    leaf(ctx, x + slot[0] * scale, headY + slot[1] * scale, slot[2] + sway, (17 + (i % 3) * 3) * scale, color);
  }
}

function drawVenom(ctx, x, ground, scale, body, headY, traits, time) {
  if (!traits.venom) return;
  var coverage = traits.venom;
  var black = ctx.createLinearGradient(x, headY - 50 * scale, x + 75 * scale, ground);
  black.addColorStop(0, "#252c36");
  black.addColorStop(.35, "#090c11");
  black.addColorStop(1, "#151a22");

  ctx.save();
  ctx.globalAlpha = Math.min(1, coverage * 1.35);
  ctx.fillStyle = black;
  ctx.beginPath();
  ctx.moveTo(x + 3 * scale, ground - 5 * scale);
  ctx.bezierCurveTo(x + 28 * scale, ground - 36 * scale, x + 15 * scale, body.top + 56 * scale, x + 7 * scale, body.top + 8 * scale);
  ctx.bezierCurveTo(x + 38 * scale, body.top - 10 * scale, x + 53 * scale, headY - 42 * scale, x + 50 * scale, headY - 9 * scale);
  ctx.bezierCurveTo(x + 64 * scale, headY + 26 * scale, x + 35 * scale, headY + 45 * scale, x + 28 * scale, body.top + 42 * scale);
  ctx.bezierCurveTo(x + 62 * scale, body.top + 66 * scale, x + 44 * scale, ground - 24 * scale, x + 34 * scale, ground);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(151,172,196,.28)";
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = "round";
  for (var i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (17 + i * 5) * scale, ground - (13 + i * 19) * scale);
    ctx.quadraticCurveTo(x + (36 + i * 3) * scale, ground - (30 + i * 20) * scale, x + (23 + i * 7) * scale, ground - (49 + i * 21) * scale);
    ctx.stroke();
  }

  ctx.fillStyle = "#f4f6f8";
  ctx.beginPath();
  ctx.moveTo(x + 9 * scale, headY - 11 * scale);
  ctx.bezierCurveTo(x + 23 * scale, headY - 20 * scale, x + 47 * scale, headY - 17 * scale, x + 51 * scale, headY - 7 * scale);
  ctx.bezierCurveTo(x + 37 * scale, headY - 10 * scale, x + 21 * scale, headY + 1 * scale, x + 9 * scale, headY - 11 * scale);
  ctx.fill();

  if (traits.chaos > .55) {
    ctx.fillStyle = "#05070a";
    ctx.beginPath();
    ctx.ellipse(x + 32 * scale, headY + 23 * scale, 25 * scale, 15 * scale, .1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7e8e9";
    for (var tooth = 0; tooth < 5; tooth++) {
      ctx.beginPath();
      ctx.moveTo(x + (13 + tooth * 9) * scale, headY + 16 * scale);
      ctx.lineTo(x + (17 + tooth * 9) * scale, headY + 27 * scale);
      ctx.lineTo(x + (21 + tooth * 9) * scale, headY + 16 * scale);
      ctx.fill();
    }
    ctx.strokeStyle = "#a3294b";
    ctx.lineWidth = 7 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 37 * scale, headY + 28 * scale);
    ctx.quadraticCurveTo(x + 57 * scale, headY + 49 * scale, x + 45 * scale, headY + 68 * scale);
    ctx.stroke();
  }

  if (traits.heroic) {
    ctx.strokeStyle = "rgba(224,91,154,.72)";
    ctx.shadowColor = "rgba(224,91,154,.5)";
    ctx.shadowBlur = 10 * scale;
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 6 * scale, body.top + 38 * scale);
    ctx.lineTo(x + 25 * scale, body.top + 57 * scale);
    ctx.lineTo(x + 13 * scale, body.top + 79 * scale);
    ctx.lineTo(x + 34 * scale, body.top + 101 * scale);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawFinalAccents(ctx, x, y, scale, traits, time) {
  if (!traits.heroic) return;
  for (var i = 0; i < 5; i++) {
    var angle = time * .00025 + i * Math.PI * 2 / 5;
    var px = x + Math.cos(angle) * (86 + i * 3) * scale;
    var py = y - 76 * scale + Math.sin(angle) * 44 * scale;
    ctx.globalAlpha = .18 + traits.heroic * .28;
    ctx.fillStyle = i % 2 ? "#9d6bff" : "#f35d91";
    heartPath(ctx, px, py, 5 * scale);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSleepParticles(ctx, x, headY, scale, time) {
  ctx.save();
  var letters = ["z", "Z", "z"];
  for (var i = 0; i < letters.length; i++) {
    var cycle = ((time * 0.0006) + i * 0.333) % 1;
    var alpha = Math.sin(cycle * Math.PI);
    if (alpha <= 0.02) continue;
    var px = x + (24 + i * 14) * scale + Math.sin(cycle * 3.5) * 6 * scale;
    var py = headY - 16 * scale - cycle * 58 * scale;
    ctx.globalAlpha = alpha * 0.88;
    ctx.font = "bold " + Math.round((13 + i * 4) * scale) + "px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#f7b5d5";
    ctx.shadowColor = "rgba(243, 93, 145, 0.65)";
    ctx.shadowBlur = 9;
    ctx.fillText(letters[i], px, py);
  }
  ctx.restore();
}

function drawGrutik(canvas, stage, pose) {
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;
  var traits = getGrutikStage(stage);
  var now = pose && pose.time != null ? pose.time : performance.now();
  var motion = pose || {};
  var breathe = Math.sin(now * .0018) * .012;
  var pot = potGeometry(W, H, stage);
  ctx.clearRect(0, 0, W, H);
  drawAtmosphere(ctx, W, H, traits, now);
  drawGround(ctx, W, H, pot, traits);
  drawPotRear(ctx, pot);

  if (traits.seed) drawSeed(ctx, pot, traits.seed);

  if (traits.growth > 0) {
    var base = Math.min(W / 600, H / 520);
    var mature = stage >= 3;
    var scale = base * (mature ? 1.08 + traits.growth * .6 : stage === 1 ? 1 : 1.13) * (1 + breathe);
    var x = pot.x + pot.w * .5;
    var ground = pot.y + pot.h * .13;
    var headY;
    ctx.save();
    ctx.translate(0, motion.y || 0);
    if (mature) {
      headY = ground - 154 * scale;
      drawRearTendrils(ctx, x, headY + 30 * scale, scale, traits, now);
      var body = drawBody(ctx, x, ground, scale, traits, motion);
      drawHead(ctx, x, headY, scale, traits, motion);
      drawLeafClusters(ctx, x, headY, scale, traits.leaves, traits, now);
      drawVenom(ctx, x, ground, scale, body, headY, traits, now);
      drawFinalAccents(ctx, x, ground, scale, traits, now);
    } else {
      var sprout = drawSprout(ctx, x, ground, scale, stage, traits, motion);
      headY = sprout.headY;
      drawLeafClusters(ctx, x, headY, sprout.leafScale, traits.leaves, traits, now);
    }
    if (motion.sleeping) {
      drawSleepParticles(ctx, x, headY, mature ? scale : sprout.leafScale, now);
    }
    ctx.restore();
    canvas.__gru = { x: x, y: ground, s: scale, mode: traits.venom, happy: traits.heroic, baby: !mature, W: W, H: H };
  } else {
    canvas.__gru = { x: pot.x + pot.w * .5, y: pot.y, s: 0, mode: 0, happy: false, baby: true, W: W, H: H };
  }
  drawPotFront(ctx, pot);
  canvas.__stage = stage;
}

var grutikIdleCanvas = null;
var grutikIdleStage = null;
var grutikIdleTimer = 0;
var grutikIdleRaf = 0;
var grutikIdleAction = null;
var grutikSleeping = false;
var grutikSleepRaf = 0;

function isGrutikSleeping() {
  if (typeof window !== "undefined" && window.__forceSleeping != null) return window.__forceSleeping;
  if (typeof state !== "undefined" && state && state.givenDay && typeof currentDayIdx === "function") {
    var cur = currentDayIdx();
    if (state.givenDay.indexOf(cur) !== -1) return true;
    if (state.givenDay.length >= (typeof DAYS !== "undefined" ? DAYS : 6)) return true;
  }
  return false;
}

function runGrutikSleep(time) {
  if (!grutikIdleCanvas && !(typeof window !== "undefined" && window.__waitCanvas)) return;
  if (!isGrutikSleeping()) {
    grutikSleeping = false;
    cancelAnimationFrame(grutikSleepRaf);
    scheduleGrutikIdle();
    return;
  }
  var stage = grutikIdleStage ? grutikIdleStage() : 1;
  var breathe = Math.sin(time * 0.0018) * 2;
  var pose = {
    time: time,
    sleeping: true,
    tilt: 0.16 + Math.sin(time * 0.0014) * 0.025,
    arm: -12,
    y: breathe
  };
  if (grutikIdleCanvas) {
    drawGrutik(grutikIdleCanvas, stage, pose);
  }
  if (typeof window !== "undefined" && window.__waitCanvas) {
    drawGrutik(window.__waitCanvas, stage, pose);
  }
  grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
}

function startGrutikIdle(canvas, stageFn) {
  stopGrutikIdle();
  grutikIdleCanvas = canvas;
  grutikIdleStage = stageFn;
  if (isGrutikSleeping()) {
    grutikSleeping = true;
    grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
  } else {
    scheduleGrutikIdle();
  }
}

function stopGrutikIdle() {
  clearTimeout(grutikIdleTimer);
  cancelAnimationFrame(grutikIdleRaf);
  cancelAnimationFrame(grutikSleepRaf);
  grutikIdleCanvas = null;
  grutikIdleStage = null;
  grutikIdleAction = null;
  grutikSleeping = false;
}

function scheduleGrutikIdle() {
  clearTimeout(grutikIdleTimer);
  if (isGrutikSleeping()) {
    if (!grutikSleeping) {
      grutikSleeping = true;
      grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
    }
    return;
  }
  grutikIdleTimer = setTimeout(beginGrutikIdle, 2800 + Math.random() * 3200);
}

function beginGrutikIdle() {
  if (!grutikIdleCanvas || document.hidden) {
    scheduleGrutikIdle();
    return;
  }
  if (isGrutikSleeping()) {
    grutikSleeping = true;
    grutikSleepRaf = requestAnimationFrame(runGrutikSleep);
    return;
  }
  var stage = grutikIdleStage ? grutikIdleStage() : 1;
  var types = stage >= 5 ? ["look", "tendril", "blink"] : ["look", "wave", "blink"];
  grutikIdleAction = {
    type: types[Math.floor(Math.random() * types.length)],
    start: performance.now(),
    duration: 1700,
    stage: stage
  };
  grutikIdleRaf = requestAnimationFrame(runGrutikIdle);
}

function runGrutikIdle(time) {
  if (!grutikIdleCanvas || !grutikIdleAction) return;
  var progress = Math.min(1, (time - grutikIdleAction.start) / grutikIdleAction.duration);
  var wave = Math.sin(progress * Math.PI);
  var pose = { time: time };
  if (grutikIdleAction.type === "look") pose.tilt = Math.sin(progress * Math.PI * 2) * .09;
  if (grutikIdleAction.type === "wave") pose.arm = wave * 18;
  if (grutikIdleAction.type === "tendril") pose.tilt = -wave * .06;
  if (grutikIdleAction.type === "blink") pose.blink = Math.pow(Math.sin(progress * Math.PI), 12);
  drawGrutik(grutikIdleCanvas, grutikIdleStage ? grutikIdleStage() : grutikIdleAction.stage, pose);
  if (progress < 1) {
    grutikIdleRaf = requestAnimationFrame(runGrutikIdle);
  } else {
    grutikIdleAction = null;
    scheduleGrutikIdle();
  }
}
