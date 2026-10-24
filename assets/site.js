// Sotto Voce site. The listening wave is adapted from the app's
// ListeningVisual.swift.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OCEAN = ["#1f70eb", "#21a0d6", "#35c6b0"];
  var INTENSITY = 0.5;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

  var voices = { backdrop: new Voice() };

  document.querySelectorAll("canvas[data-waves]").forEach(function (canvas) {
    var quiet = canvas.getAttribute("data-waves") === "quiet";
    scene(canvas, function (time, animates) {
      var s = setup(canvas);
      if (!s) return;
      var level = animates ? 0.55 + 0.35 * voices.backdrop.level : 0.8;
      drawBackdrop(s.ctx, s.w, s.h, animates ? time * 0.55 : 4, level, quiet);
    });
  });

  // ---- The hero's live demo: a recording of the app, played only while it is on screen ----
  var heroVideo = document.querySelector("[data-hero-video]");
  if (heroVideo && !reduce && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { var p = heroVideo.play(); if (p && p.catch) p.catch(function () {}); }
        else heroVideo.pause();
      });
    }, { threshold: 0.25 }).observe(heroVideo);
  }

  // ---- Running ----
  function renderStill() {
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
      voices.backdrop.step(t * 0.6 + 7, dt);
      if (!document.hidden) {
        scenes.forEach(function (s) { if (s.visible) s.draw(t, true); });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
