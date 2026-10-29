// Nokta küresi: sürükleyerek döndürülür, tıklayınca yüzeyde dalga yayılır
(() => {
  const canvas = document.getElementById("sphere");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = {
    dot: [234, 240, 244],   // açık sis
    teal: [60, 196, 180],   // odak yeşili, koyu zemin için açık ton
    amber: [232, 163, 23],  // süreç düğümleri
  };

  const AUTO_SPIN = 0.0016;
  const TILT = -0.32;

  let width = 0, height = 0, dpr = 1, radius = 0, cx = 0, cy = 0;
  let points = [];
  let rotY = 0.6, rotX = TILT;
  let velY = AUTO_SPIN, velX = 0;
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
  let pointer = null;
  const ripples = [];
  const start = performance.now();
  let running = false, visible = true, raf = 0;

  // Basit, tekrarlanabilir rastgele sayı üreteci
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // Yüzeyde bölgeler oluşturan yumuşak dalgalanma
  const field = (x, y, z) =>
    Math.sin(2.6 * x + 1.3) * Math.sin(2.9 * y + 0.4) * Math.sin(2.3 * z + 2.2) +
    0.45 * Math.sin(5.1 * x - 3.7 * z + 0.8) * Math.cos(4.3 * y + 1.1);

  function buildPoints(count) {
    seed = 7;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const list = [];
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const f = field(x, y, z);
      // Yoğun bölgeler tamamen, seyrek bölgeler kısmen noktalanır
      if (f < -0.15 && rand() > 0.28) continue;
      list.push({
        x, y, z,
        tone: f > 0.55 ? "teal" : "dot",
        weight: Math.min(1, Math.max(0.35, 0.6 + f * 0.5)),
        // Başlangıçta dağınık konum
        sx: (rand() - 0.5) * 4.2,
        sy: (rand() - 0.5) * 4.2,
        sz: (rand() - 0.5) * 4.2,
        delay: rand() * 450,
      });
    }
    // Birkaç kehribar düğüm
    const nodeCount = 14;
    for (let n = 0; n < nodeCount; n++) {
      const p = list[Math.floor(rand() * list.length)];
      p.tone = "amber";
      p.weight = 1;
    }
    return list;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Çevresindeki ölçek halkasına yer bırakır
    radius = Math.min(width, height) * 0.36;
    cx = width / 2;
    cy = height / 2;
    const count = width < 420 ? 2600 : width < 560 ? 4200 : 6000;
    if (points.length === 0 || Math.abs(points.count - count) > 0) {
      points = buildPoints(count);
      points.count = count;
    }
    if (!running) draw(performance.now());
  }

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function draw(now) {
    const elapsed = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    // Süresi dolan dalgaları temizle
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (now - ripples[i].t0 > 1800) ripples.splice(i, 1);
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      // Dalga: tıklanan noktadan açısal uzaklığa göre yarıçap artar
      let scale = 1;
      for (const r of ripples) {
        const age = (now - r.t0) / 1800;
        const front = age * 2.6;
        const dot = p.x * r.x + p.y * r.y + p.z * r.z;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
        const d = ang - front;
        scale += Math.exp(-(d * d) / 0.035) * 0.11 * (1 - age);
      }

      let x = p.x * scale, y = p.y * scale, z = p.z * scale;

      // Açılış: dağınık noktalar küreye toplanır
      if (!reduceMotion) {
        const k = easeOut(Math.min(1, Math.max(0, (elapsed - p.delay) / 1300)));
        if (k < 1) {
          x = p.sx + (x - p.sx) * k;
          y = p.sy + (y - p.sy) * k;
          z = p.sz + (z - p.sz) * k;
        }
      }

      // Döndürme
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const persp = 1 / (1 - z2 * 0.22);
      let sx = cx + x1 * radius * persp;
      let sy = cy + y2 * radius * persp;
      const depth = (z2 + 1) / 2; // 0 arka, 1 ön

      // Fare yaklaşınca öndeki noktalar kenara itilir
      if (pointer && z2 > 0) {
        const dx = sx - pointer.x, dy = sy - pointer.y;
        const dist = Math.hypot(dx, dy);
        const reach = radius * 0.32;
        if (dist < reach && dist > 0.01) {
          const push = Math.pow(1 - dist / reach, 2) * 16;
          sx += (dx / dist) * push;
          sy += (dy / dist) * push;
        }
      }

      const isAmber = p.tone === "amber";
      const size = (isAmber ? 2.4 : 0.8 + depth * 1.2) * persp;
      const alpha = (0.1 + Math.pow(depth, 1.6) * 0.85) * p.weight;
      const c = COLORS[p.tone];
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
      if (isAmber) {
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    }
  }

  function tick(now) {
    if (!dragging) {
      // Bırakıldıktan sonra hız yavaşça otomatik dönüşe iner
      velY += ((reduceMotion ? 0 : AUTO_SPIN) - velY) * 0.03;
      velX += (0 - velX) * 0.05;
      rotX += velX;
      rotX += (TILT - rotX) * 0.01;
      rotY += velY;
    }
    draw(now);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (running || !visible) return;
    if (reduceMotion && !dragging && ripples.length === 0) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Hareketi azalt açıksa sadece etkileşim sırasında çiz
  let idleTimer = 0;
  function wakeForInteraction() {
    if (!reduceMotion) return;
    play();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!dragging) stop(); }, 2000);
  }

  // Etkileşim
  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    velY = velX = 0;
    canvas.classList.add("is-dragging");
    wakeForInteraction();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") pointer = local(e);
    if (!dragging) { if (reduceMotion) wakeForInteraction(); return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = dx * 0.006;
    velX = dy * 0.004;
    rotY += velY;
    rotX = Math.max(-1.2, Math.min(1.2, rotX + velX));
    wakeForInteraction();
  });

  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("is-dragging");
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6) addRipple(local(e));
    wakeForInteraction();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", (e) => { dragging = false; canvas.classList.remove("is-dragging"); });
  canvas.addEventListener("pointerleave", () => (pointer = null));

  // Tıklanan ekran noktasını küre üzerindeki bir yöne çevir
  function addRipple(pt) {
    const nx = (pt.x - cx) / radius;
    const ny = (pt.y - cy) / radius;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return;
    const nz = Math.sqrt(1 - d2);
    // Döndürmenin tersini uygula
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y = ny * cosX + nz * sinX;
    const z1 = -ny * sinX + nz * cosX;
    const x = nx * cosY - z1 * sinY;
    const z = nx * sinY + z1 * cosY;
    ripples.push({ x, y, z, t0: performance.now() });
    if (ripples.length > 4) ripples.shift();
  }

  // Görünür değilse durdur
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? play() : stop();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else play();
  });

  new ResizeObserver(resize).observe(canvas);
  resize();
  play();
})();
