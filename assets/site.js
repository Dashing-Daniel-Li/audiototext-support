// Sotto Voce site. The four listening looks are ported from the app's
// ListeningVisual.swift, so the page shows what the keyboard actually draws.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OCEAN = ["#1f70eb", "#21a0d6", "#35c6b0"];
  var RGB = { primary: [31, 112, 235], secondary: [33, 160, 214], accent: [53, 198, 176] };
  var INTENSITY = 0.5;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mixRGB(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }

  // A voice that talks in phrases: syllables while speaking, near-silence
  // between phrases. `speaking` can be forced by the typing demo.
  function Voice() {
    this.level = 0.2;
    this.forced = null;
  }
  Voice.prototype.step = function (t, dt) {
    var speaking = this.forced !== null ? this.forced : Math.sin(t * 0.9) > -0.35;
    var syll = 0.55 + 0.45 * Math.abs(Math.sin(t * 6.7)) * (0.7 + 0.3 * Math.sin(t * 2.3)) + 0.08 * Math.sin(t * 17.1);
    var target = speaking ? clamp(0.18 + 0.85 * syll, 0, 1.15) : 0.1;
    var rate = target > this.level ? 10 : 3.5;
    this.level += (target - this.level) * (1 - Math.exp(-rate * dt));
    return this.level;
  };

  function setup(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function oceanGradient(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, OCEAN[0]);
    g.addColorStop(0.5, OCEAN[1]);
    g.addColorStop(1, OCEAN[2]);
    return g;
  }

  function capsule(ctx, cx, cy, w, h) {
    h = Math.max(3, h);
    var r = w / 2;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.fill();
  }

  // ---- Wave (WaveShapes / WaveLine) ----
  var WAVE_LAYERS = [[3, 1, 3.2, 1], [4.5, 0.62, 2.3, 0.4], [2.2, 0.45, 1.4, 0.22]];
  var WAVE_STILL = [[3, 1, 2.6, 1], [4.5, 0.6, 2.6, 0.35]];

  function waveLine(ctx, w, h, midY, amplitudeCap, voice, spec, layer, time) {
    var amp = Math.min(h * 0.42, amplitudeCap) * voice * spec[1] * lerp(0.85, 1.25, INTENSITY);
    ctx.beginPath();
    for (var x = 0; x <= w; x += 3) {
      var u = x / w;
      var env = Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(u * 9 + time * 1.3 + layer));
      var y = midY + amp * env * Math.sin(u * spec[0] * 2 * Math.PI - time * spec[2] * 2);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  function drawWave(ctx, w, h, time, voice, animates) {
    var layers = animates ? WAVE_LAYERS : WAVE_STILL;
    var stroke = oceanGradient(ctx, 0, 0, w, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < layers.length; i++) {
      ctx.globalAlpha = layers[i][3];
      ctx.strokeStyle = stroke;
      ctx.lineWidth = i === 0 ? 3 : 2;
      waveLine(ctx, w, h, h / 2, 64, Math.min(voice, 1.2), layers[i], i, animates ? time : 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Glow ----
  var GLOW_WEIGHTS = [0.35, 0.55, 0.8, 1, 0.8, 0.55, 0.35];

  function drawGlow(ctx, w, h, time, level, animates) {
    var focusY = h * 0.5, barHeight = Math.min(58, h * 0.42);
    var drift = animates ? 0.5 + 0.5 * Math.sin(time * 0.35 * lerp(0.5, 1.5, INTENSITY)) : 0;
    var near = mixRGB(RGB.primary, RGB.accent, drift * 0.6);
    var far = mixRGB(RGB.secondary, RGB.primary, drift * 0.4);
    var reach = Math.min(w / 2, Math.hypot(w / 2, Math.max(focusY, h - focusY)));
    var wash = 0.65 + 0.35 * Math.min(level, 1);
    var bloom = (0.88 + 0.28 * Math.min(level, 1.2)) * lerp(0.9, 1.25, INTENSITY) * (barHeight / 58);

    var g = ctx.createRadialGradient(w / 2, focusY, 0, w / 2, focusY, reach);
    g.addColorStop(0, rgba(near, 0.38 * wash));
    g.addColorStop(0.55, rgba(far, 0.16 * wash));
    g.addColorStop(1, rgba(far, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, focusY);
    ctx.scale(1, 116 / 180);
    var r = 80 * bloom * 1.12;
    var b = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    b.addColorStop(0, rgba(near, (0.35 + 0.4 * Math.min(level, 1)) * 0.8));
    b.addColorStop(0.6, rgba(far, 0.15));
    b.addColorStop(1, rgba(far, 0));
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = OCEAN[0];
    var bw = 6, gap = 7, total = GLOW_WEIGHTS.length * bw + (GLOW_WEIGHTS.length - 1) * gap;
    for (var i = 0; i < GLOW_WEIGHTS.length; i++) {
      var jitter = animates
        ? 0.75 + 0.25 * Math.sin(time * lerp(5, 9, INTENSITY) + i * 1.7) + 0.08 * Math.sin(time * 13 + i)
        : 1;
      var hgt = 6 + (barHeight - 6) * Math.min(level, 1.15) * GLOW_WEIGHTS[i] * jitter;
      capsule(ctx, w / 2 - total / 2 + bw / 2 + i * (bw + gap), focusY, bw, hgt);
    }
  }

  // ---- Card (cardEdge + cardBars) ----
  var CARD_WEIGHTS = [];
  for (var ci = 0; ci < 21; ci++) {
    var ct = (ci - 10) / 6.5;
    CARD_WEIGHTS.push(Math.max(0.14, Math.exp(-ct * ct)));
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawCard(ctx, w, h, time, voice, animates, words) {
    var inset = 8, r = 18;
    var x = inset, y = inset, cw = w - inset * 2, chh = h - inset * 2;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundedRectPath(ctx, x, y, cw, chh, r);
    ctx.fill();

    var perimeter = Math.max(1, 2 * (cw + chh) - 8 * r + 2 * Math.PI * r);
    var segment = perimeter * lerp(0.08, 0.22, INTENSITY) * (0.5 + 0.9 * Math.min(voice, 1.2));
    var travel = (time * lerp(60, 160, INTENSITY)) % perimeter;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(RGB.primary, 0.25);
    roundedRectPath(ctx, x, y, cw, chh, r);
    ctx.stroke();
    if (animates && segment > 1) {
      var grad = oceanGradient(ctx, x, y, x + cw, y + chh);
      ctx.setLineDash([segment, Math.max(0, perimeter - segment)]);
      ctx.lineDashOffset = -travel;
      ctx.lineCap = "round";
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 7;
      roundedRectPath(ctx, x, y, cw, chh, r);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      roundedRectPath(ctx, x, y, cw, chh, r);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    var barsTop = y + 16, barsH = chh * 0.5;
    var count = CARD_WEIGHTS.length, gap = 4;
    var bw = Math.max(1, Math.min(4, (cw * 0.6 - gap * (count - 1)) / count));
    var total = count * bw + (count - 1) * gap;
    ctx.fillStyle = oceanGradient(ctx, w / 2 - total / 2, 0, w / 2 + total / 2, 0);
    for (var i = 0; i < count; i++) {
      var wob = animates ? 0.8 + 0.2 * Math.sin(time * 7 + i * 1.9) : 1;
      var hgt = 4 + (barsH - 4) * Math.min(voice, 1.1) * CARD_WEIGHTS[i] * wob;
      capsule(ctx, w / 2 - total / 2 + bw / 2 + i * (bw + gap), barsTop + barsH / 2, bw, hgt);
    }

    if (words) {
      ctx.fillStyle = "#5c6475";
      ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var line = words;
      while (ctx.measureText(line).width > cw - 36 && line.length > 4) line = "…" + line.slice(2);
      ctx.fillText(line, w / 2, y + chh - 22);
    }
  }

  // ---- Ring ----
  var RING_WEIGHTS = [0.45, 0.75, 1, 0.75, 0.45];

  function drawRing(ctx, w, h, time, voice, animates) {
    var r = Math.min(h * 0.26, 44);
    var level = Math.min(voice, 1.2);
    var breathe = animates ? 1 + 0.05 * level * lerp(0.6, 1.6, INTENSITY) : 1;
    var rotation = animates ? time * lerp(0.25, 0.9, INTENSITY) : 0;
    var lineWidth = animates ? 3 + 5 * level * lerp(0.6, 1.4, INTENSITY) : 4;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(breathe, breathe);

    if (animates) {
      var halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.6);
      halo.addColorStop(0, rgba(RGB.secondary, 0.22 * level));
      halo.addColorStop(1, rgba(RGB.secondary, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    var stroke;
    if (ctx.createConicGradient) {
      stroke = ctx.createConicGradient(rotation - Math.PI / 2, 0, 0);
      stroke.addColorStop(0, OCEAN[0]);
      stroke.addColorStop(0.33, OCEAN[1]);
      stroke.addColorStop(0.66, OCEAN[2]);
      stroke.addColorStop(1, OCEAN[0]);
    } else {
      stroke = oceanGradient(ctx, -r, -r, r, r);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = OCEAN[0];
    var bw = r * 0.11, gap = r * 0.13, total = RING_WEIGHTS.length * bw + (RING_WEIGHTS.length - 1) * gap;
    for (var i = 0; i < RING_WEIGHTS.length; i++) {
      var wob = animates ? 0.8 + 0.2 * Math.sin(time * 8 + i * 1.5) : 1;
      var hgt = Math.min(r * 1.3, r * 0.13 + r * 0.9 * level * RING_WEIGHTS[i] * wob);
      capsule(ctx, -total / 2 + bw / 2 + i * (bw + gap), 0, bw, hgt);
    }
    ctx.restore();
  }

  // ---- The big waves behind the hero and the closing section ----
  function drawBackdrop(ctx, w, h, time, voice, quiet) {
    var mid = h * 0.55;
    var cap = Math.min(h * 0.38, quiet ? 90 : 150);
    var stroke = oceanGradient(ctx, 0, 0, w, 0);
    var layers = [[2.2, 1, 0.55, 1], [3.1, 0.7, 0.42, 0.55], [1.6, 0.55, 0.3, 0.4], [4.2, 0.4, 0.62, 0.28]];
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < layers.length; i++) {
      var spec = layers[i];
      waveLine(ctx, w, h, mid, cap, voice, spec, i, time);
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = spec[3] * 0.16;
      ctx.lineWidth = i === 0 ? 14 : 9;
      ctx.stroke();
      ctx.globalAlpha = spec[3] * (quiet ? 0.5 : 0.85);
      ctx.lineWidth = i === 0 ? 2.2 : 1.4;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // ---- Scenes ----
  var scenes = [];

  function scene(el, draw) {
    var s = { el: el, draw: draw, visible: false };
    scenes.push(s);
    return s;
  }

  var voices = { hero: new Voice(), looks: new Voice(), backdrop: new Voice() };

  var heroWords = "";
  var looksWords = "…and save me a seat, and the popcorn";

  document.querySelectorAll("canvas[data-look]").forEach(function (canvas) {
    scene(canvas, function (time, animates) {
      var v = voices[canvas.getAttribute("data-voice")] || voices.looks;
      var s = setup(canvas);
      if (!s) return;
      var level = animates ? v.level : 0.85;
      var look = canvas.getAttribute("data-look");
      if (look === "glow") drawGlow(s.ctx, s.w, s.h, time, level, animates);
      else if (look === "card") drawCard(s.ctx, s.w, s.h, time, level, animates, canvas.getAttribute("data-voice") === "hero" ? heroWords : looksWords);
      else if (look === "ring") drawRing(s.ctx, s.w, s.h, time, level, animates);
      else drawWave(s.ctx, s.w, s.h, time, level, animates);
    });
  });

  document.querySelectorAll("canvas[data-waves]").forEach(function (canvas) {
    var quiet = canvas.getAttribute("data-waves") === "quiet";
    scene(canvas, function (time, animates) {
      var s = setup(canvas);
      if (!s) return;
      var level = animates ? 0.55 + 0.35 * voices.backdrop.level : 0.8;
      drawBackdrop(s.ctx, s.w, s.h, animates ? time * 0.55 : 4, level, quiet);
    });
  });

  // ---- The look switcher ----
  var captions = {
    glow: ["Glow", "Bars on a soft glow that brightens as you speak."],
    card: ["Card", "A card with a light that travels its edge, and the words it heard along the bottom."],
    wave: ["Wave", "Layered waves across the keyboard, in the gradient of your chosen colours."],
    ring: ["Ring", "A round control holding the waveform. The ring turns and thickens with your voice."]
  };
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-set-look]"));
  var lookCanvas = document.querySelector("[data-look-canvas]");
  var caption = document.querySelector("[data-look-caption]");
  var panel = document.getElementById("look-panel");

  function selectLook(tab, focus) {
    var look = tab.getAttribute("data-set-look");
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    if (lookCanvas) lookCanvas.setAttribute("data-look", look);
    if (panel) panel.setAttribute("aria-labelledby", tab.id);
    if (caption) caption.innerHTML = "<strong>" + captions[look][0] + "</strong>" + captions[look][1];
    if (focus) tab.focus();
    if (reduce) renderStill();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectLook(tab, false); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectLook(next, true); }
    });
  });

  // ---- The hero's typing demo ----
  var lines = [
    "Running five minutes late. Save me a seat, and the popcorn.",
    "Parking now. Get the big tub, I'll pay you back.",
    "Found you. Third row from the back?"
  ];
  var typed = document.querySelector("[data-typed]");
  var thread = document.querySelector("[data-thread]");

  function typingDemo() {
    if (!typed || !thread) return;
    var lineIndex = 0;
    function typeLine() {
      var words = lines[lineIndex % lines.length].split(" ");
      var n = 0;
      typed.textContent = "";
      heroWords = "";
      voices.hero.forced = true;
      function nextWord() {
        n++;
        typed.textContent = words.slice(0, n).join(" ");
        heroWords = typed.textContent;
        if (n < words.length) {
          var pause = /[.,?!]$/.test(words[n - 1]) ? 420 : 170 + Math.random() * 120;
          voices.hero.forced = !/[.,?!]$/.test(words[n - 1]);
          setTimeout(function () { voices.hero.forced = true; nextWord(); }, pause);
        } else {
          voices.hero.forced = false;
          setTimeout(send, 1300);
        }
      }
      setTimeout(nextWord, 500);
    }
    function send() {
      var bubble = document.createElement("div");
      bubble.className = "bubble out new";
      bubble.textContent = typed.textContent;
      thread.appendChild(bubble);
      typed.textContent = "";
      heroWords = "";
      while (thread.children.length > 7) thread.removeChild(thread.firstElementChild);
      lineIndex++;
      if (lineIndex % lines.length === 0) {
        setTimeout(function () {
          thread.innerHTML = '<div class="bubble in">still on for tonight?</div><div class="bubble out">yes!! leaving work now</div><div class="mock-stamp">Today 19:42</div><div class="bubble in">where are you?? the film starts at 8</div><div class="bubble out">omw!!</div><div class="bubble in">bring snacks. that\'s not optional</div>';
          typeLine();
        }, 2400);
      } else {
        setTimeout(typeLine, 1400);
      }
    }
    typeLine();
  }

  // ---- Running ----
  function renderStill() {
    heroWords = typed ? typed.textContent : "";
    scenes.forEach(function (s) { s.draw(0, false); });
  }

  if (reduce) {
    renderStill();
    window.addEventListener("resize", renderStill);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        scenes.forEach(function (s) { if (s.el === entry.target) s.visible = entry.isIntersecting; });
      });
    }, { rootMargin: "80px" });
    scenes.forEach(function (s) { io.observe(s.el); });

    var start = performance.now(), last = start;
    function frame(now) {
      var t = (now - start) / 1000;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      voices.hero.step(t, dt);
      voices.looks.step(t + 3.1, dt);
      voices.backdrop.step(t * 0.6 + 7, dt);
      if (!document.hidden) {
        scenes.forEach(function (s) { if (s.visible) s.draw(t, true); });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    typingDemo();
  }

  // ---- Reveal on scroll ----
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          ro.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 70 + "ms";
      ro.observe(el);
    });
  }
})();
