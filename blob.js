// Akışkan form: WebGL ile çizilen, yavaşça şekil değiştiren parlak damla
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Dokunmatik ve küçük ekranlı cihazlar
  const lowPower = matchMedia("(pointer: coarse), (max-width: 900px)").matches;

  // Kosinüs paletleri: renk = a + b * cos(2π(c·t + d))
  const PALETTES = {
    ember: { a: [0.55, 0.3, 0.4], b: [0.45, 0.35, 0.45], c: [1, 1, 1], d: [0.02, 0.18, 0.55] },
    violet: { a: [0.6, 0.3, 0.85], b: [0.4, 0.15, 0.2], c: [1, 1, 1], d: [0.0, 0.5, 0.5] },
  };

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uRot;
    uniform float uSeed;
    uniform vec3 uA, uB, uC, uD;

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }
    mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

    float map(vec3 p) {
      p.xz *= rot(uRot.x);
      p.yz *= rot(uRot.y);
      float t = uTime * 0.32 + uSeed;
      vec3 c1 = vec3(sin(t) * 0.42, cos(t * 0.8) * 0.32, sin(t * 0.6) * 0.3);
      vec3 c2 = vec3(cos(t * 0.7 + 2.0) * 0.55, sin(t * 0.9 + 1.0) * 0.42, cos(t * 0.5) * 0.35);
      vec3 c3 = vec3(sin(t * 0.5 + 4.0) * 0.4, cos(t * 0.6 + 3.0) * 0.5, sin(t * 0.8 + 2.0) * 0.3);
      float d = length(p - c1) - 0.74;
      d = smin(d, length(p - c2) - 0.56, 0.6);
      d = smin(d, length(p - c3) - 0.5, 0.6);
      d += 0.055 * sin(2.6 * p.x + t * 1.3) * sin(2.2 * p.y - t) * sin(2.4 * p.z + t * 0.7);
      return d;
    }

    vec3 calcNormal(vec3 p) {
      vec2 e = vec2(0.0025, 0.0);
      return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)));
    }

    vec3 pal(float t) { return uA + uB * cos(6.28318 * (uC * t + uD)); }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      vec3 ro = vec3(0.0, 0.0, 3.6);
      vec3 rd = normalize(vec3(uv * 0.6, -1.0));

      // Sınır küresi dışındaki ışınları hemen atla
      float b = dot(ro, rd);
      float c = dot(ro, ro) - 3.2;
      float h = b * b - c;
      if (h < 0.0) { gl_FragColor = vec4(0.0); return; }
      float t = max(-b - sqrt(h), 0.0);
      float tMax = -b + sqrt(h);

      float minD = 10.0;
      bool hit = false;
      for (int i = 0; i < 72; i++) {
        float d = map(ro + rd * t);
        minD = min(minD, d);
        if (d < 0.0015) { hit = true; break; }
        t += d * 0.9;
        if (t > tMax) break;
      }

      if (!hit) {
        // Kenarda yumuşak ışıma
        float glow = exp(-minD * 14.0) * 0.32;
        vec3 g = pal(0.12 + uv.y * 0.15) * glow;
        gl_FragColor = vec4(g, glow);
        return;
      }

      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.2);
      vec3 L1 = normalize(vec3(-0.6, 0.7, 0.5));
      vec3 L2 = normalize(vec3(0.7, -0.45, 0.4));
      float spec = pow(max(dot(reflect(rd, n), L1), 0.0), 48.0);
      float spec2 = pow(max(dot(reflect(rd, n), L2), 0.0), 16.0);

      float k = clamp(0.05 + n.y * 0.2 + n.x * 0.12 + fres * 0.38 + sin(uTime * 0.2) * 0.05, 0.0, 0.62);
      vec3 iri = pal(k);
      vec3 col = iri * (0.03 + 1.3 * fres);
      col += iri * 0.16 * max(dot(n, L2), 0.0);
      // Ortada hafif renkli parıltı, yüzey düz siyah görünmesin
      col += pal(k + 0.15) * 0.12 * pow(max(n.z, 0.0), 3.0);
      col += vec3(1.0) * spec * 0.85 + pal(k + 0.28) * spec2 * 0.5;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function mount(canvas) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { canvas.classList.add("blob-fallback"); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.classList.add("blob-fallback"); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name) => gl.getUniformLocation(prog, name);
    const uRes = u("uRes"), uTime = u("uTime"), uRot = u("uRot"), uSeed = u("uSeed");
    const pal = PALETTES[canvas.dataset.palette] || PALETTES.ember;
    gl.uniform3fv(u("uA"), pal.a);
    gl.uniform3fv(u("uB"), pal.b);
    gl.uniform3fv(u("uC"), pal.c);
    gl.uniform3fv(u("uD"), pal.d);
    gl.uniform1f(uSeed, Number(canvas.dataset.seed || 0));

    const rotNow = { x: 0, y: 0 };
    const rotTarget = { x: 0, y: 0 };
    let running = false, visible = true, raf = 0;
    const start = performance.now() - Number(canvas.dataset.seed || 0) * 1000;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      let scale = Math.min(window.devicePixelRatio || 1, 1.5);
      if (rect.width < 600) scale *= 0.8;
      // Piksel sayısını sınırla: telefonda çok daha düşük tutulur, yoksa
      // zayıf cihazlarda sayfa donabilir ya da tarayıcı sekmeyi kapatabilir
      const maxPixels = lowPower ? 2.2e5 : 1.1e6;
      const px = rect.width * rect.height * scale * scale;
      if (px > maxPixels) scale *= Math.sqrt(maxPixels / px);
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (!running) draw(reduceMotion ? 2000 : performance.now() - start);
    }

    function draw(ms) {
      rotNow.x += (rotTarget.x - rotNow.x) * 0.04;
      rotNow.y += (rotTarget.y - rotNow.y) * 0.04;
      gl.uniform1f(uTime, ms / 1000);
      gl.uniform2f(uRot, rotNow.x + ms / 9000, rotNow.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Telefonda saniyede 30 kare yeterli, pil ve işlemciyi yormaz
    let lastFrame = 0;
    function loop(now) {
      if (!lowPower || now - lastFrame > 31) {
        lastFrame = now;
        draw(now - start);
      }
      raf = requestAnimationFrame(loop);
    }

    // Grafik bağlamı kaybolursa (zayıf cihazlarda olabilir) yedek görünüme geç
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      stop();
      canvas.classList.add("blob-fallback");
    });
    function play() {
      if (running || !visible || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    // İmlece göre hafif yön değiştirir
    window.addEventListener("pointermove", (e) => {
      rotTarget.x = (e.clientX / window.innerWidth - 0.5) * 0.9;
      rotTarget.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
    }, { passive: true });

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? play() : stop();
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
    new ResizeObserver(resize).observe(canvas);
    resize();
    play();
  }

  document.querySelectorAll("canvas[data-blob]").forEach(mount);
})();
