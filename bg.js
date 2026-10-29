// Arka plan: derinliğe göre farklı hızda süzülen ince ışık çizgileri
(() => {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ANGLE = -0.16; // çizgilerin hafif çapraz yönü (radyan)
  const DIR_X = Math.cos(ANGLE), DIR_Y = Math.sin(ANGLE);

  let width = 0, height = 0, dpr = 1;
  let streaks = [];
  let motes = [];
  let raf = 0, last = 0, running = false;

  const rand = (a, b) => a + Math.random() * (b - a);

  function makeStreak(anywhere) {
    const depth = Math.pow(Math.random(), 1.8); // çoğu uzakta, azı yakında
    return {
      x: anywhere ? rand(-0.1, 1.1) * width : rand(-0.25, -0.05) * width,
      y: rand(-0.1, 1.1) * height,
      depth,
      len: 24 + depth * 150,
      speed: 6 + depth * 46,           // piksel / saniye
      alpha: 0.05 + depth * 0.32,
      wobble: rand(0, Math.PI * 2),
      life: anywhere ? rand(0, 1) : 0,
      lifeSpan: rand(9, 22),            // saniye
      tint: Math.random() < 0.18 ? "teal" : "mist",
    };
  }

  function makeMote() {
    return {
      x: rand(0, width), y: rand(0, height),
      r: rand(0.4, 1.3),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.3, 0.9),
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const area = width * height;
    const streakCount = Math.round(Math.min(260, Math.max(90, area / 6500)));
    const moteCount = Math.round(Math.min(140, Math.max(50, area / 14000)));
    streaks = Array.from({ length: streakCount }, () => makeStreak(true));
    motes = Array.from({ length: moteCount }, makeMote);
    draw(0, performance.now());
  }

  const COLORS = { mist: "200, 216, 240", teal: "60, 196, 180" };

  function draw(dt, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    const t = now / 1000;

    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      s.life += dt / s.lifeSpan;
      s.x += DIR_X * s.speed * dt;
      s.y += DIR_Y * s.speed * dt + Math.sin(t * 0.4 + s.wobble) * 0.08 * s.depth;

      if (s.life >= 1 || s.x - s.len > width * 1.05 || s.y < -s.len * 2) {
        streaks[i] = makeStreak(false);
        continue;
      }

      // Doğarken ve ölürken yumuşak geçiş
      const fade = Math.min(1, s.life * 6, (1 - s.life) * 6);
      const a = s.alpha * fade;
      if (a < 0.01) continue;

      const tx = s.x - DIR_X * s.len, ty = s.y - DIR_Y * s.len;
      const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
      grad.addColorStop(0, `rgba(${COLORS[s.tint]}, 0)`);
      grad.addColorStop(1, `rgba(${COLORS[s.tint]}, ${a.toFixed(3)})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.6 + s.depth * 0.9;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }

    // Yavaşça parlayıp sönen küçük toz noktaları
    for (const m of motes) {
      const a = 0.08 + 0.22 * (0.5 + 0.5 * Math.sin(t * m.speed + m.phase));
      ctx.fillStyle = `rgba(${COLORS.mist}, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(dt, now);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  play();
})();
