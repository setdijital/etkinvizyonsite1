// Ayarlar: gerçek bilgilerle değiştirin
const CONFIG = {
  // Ülke koduyla, boşluksuz (ör. 905321234567)
  whatsappNumber: "905000000000",
  whatsappMessage: "Merhaba, Etkin Vizyon hakkında bilgi almak istiyorum.",
  // Form verisinin gönderileceği adres (ör. Formspree). Boşsa talep WhatsApp ile iletilir.
  formEndpoint: "",
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const waLink = (text) =>
  `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;

$$("[data-wa]").forEach((a) => (a.href = waLink(CONFIG.whatsappMessage)));
$("#year").textContent = new Date().getFullYear();

/* Açılıştaki kadran: 270 derecelik 0–100 ölçeği */
const SVG_NS = "http://www.w3.org/2000/svg";
const gaugeTicks = $("#gauge-ticks");
if (gaugeTicks) {
  for (let v = 0; v <= 100; v += 5) {
    const ang = ((135 + v * 2.7) * Math.PI) / 180;
    const major = v % 25 === 0;
    const r1 = major ? 29 : 30.5;
    const r2 = 32.5;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", 50 + Math.cos(ang) * r1);
    line.setAttribute("y1", 50 + Math.sin(ang) * r1);
    line.setAttribute("x2", 50 + Math.cos(ang) * r2);
    line.setAttribute("y2", 50 + Math.sin(ang) * r2);
    line.setAttribute("class", major ? "tick tick-major" : "tick");
    gaugeTicks.appendChild(line);
  }
}

function setGauge(score) {
  const fill = $("#gauge-fill");
  if (!fill) return;
  fill.style.strokeDasharray = `${score * 0.75} 100`;
  $("#gauge-value").textContent = score;
  $("#gauge-note").textContent = "/100";
  $("#gauge-cta").setAttribute("aria-label", `Hazırlık skorunuz ${score}/100. Sonucunuzu bir uzmanla konuşun`);
}

/* Mobil menü */
const navToggle = $(".nav-toggle");
const nav = $("#main-nav");
navToggle.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!open));
  nav.classList.toggle("open", !open);
});
$$("a", nav).forEach((a) =>
  a.addEventListener("click", () => {
    navToggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
  })
);

/* Check-up */
const quiz = $("#quiz");
const questions = $$(".question", quiz);
const bar = $("#quiz-bar");
const count = $("#quiz-count");
const backBtn = $("#quiz-back");
const result = $("#result");
const booking = $("#booking");
const confirmBox = $("#confirm");

const state = { step: 0, answers: [], score: null, pkg: null };

const LEVELS = [
  {
    max: 39,
    title: "Başlangıç aşamasındasınız",
    desc: "Yapay zekâdan verim almak için önce süreçlerinizi ve verilerinizi netleştirmeniz gerekiyor. Doğru ilk adımı seçmek, sonraki tüm yatırımların değerini belirler.",
    pkg: "Keşif",
  },
  {
    max: 69,
    title: "Gelişme aşamasındasınız",
    desc: "Temeliniz hazır. Bir ya da iki süreçte yapılacak bir pilot otomasyon, ekibinize ve yönetime somut kazancı hızla gösterebilir.",
    pkg: "Dönüşüm",
  },
  {
    max: 100,
    title: "Ölçeklemeye hazırsınız",
    desc: "Verileriniz ve ekibiniz yapay zekâyı daha geniş alanlara taşımaya uygun. Sürekli geliştirme ve düzenli ölçüm sizi rakiplerinizden ayırır.",
    pkg: "Ortaklık",
  },
];

function show(el) {
  [quiz, result, booking, confirmBox].forEach((x) => (x.hidden = x !== el));
}

function renderStep() {
  questions.forEach((q, i) => (q.hidden = i !== state.step));
  bar.style.width = `${((state.step + 1) / questions.length) * 100}%`;
  count.textContent = `Soru ${state.step + 1} / ${questions.length}`;
  backBtn.hidden = state.step === 0;
}

quiz.addEventListener("change", (e) => {
  if (e.target.type !== "radio") return;
  state.answers[state.step] = Number(e.target.value);
  // Seçimin görünmesi için kısa bir bekleme
  setTimeout(() => {
    if (state.step < questions.length - 1) {
      state.step++;
      renderStep();
      $("input", questions[state.step]).focus({ preventScroll: true });
    } else {
      showResult();
    }
  }, 220);
});

backBtn.addEventListener("click", () => {
  state.step = Math.max(0, state.step - 1);
  renderStep();
});

function showResult() {
  const total = state.answers.reduce((a, b) => a + b, 0);
  const score = Math.round((total / (questions.length * 3)) * 100);
  const level = LEVELS.find((l) => score <= l.max);
  state.score = score;
  state.pkg = level.pkg;

  setGauge(score);
  $("#result-level").textContent = level.title;
  $("#result-desc").textContent = level.desc;
  $("#result-pack").innerHTML = `Size uygun başlangıç: <strong>${level.pkg} paketi</strong>`;

  show(result);
  result.focus({ preventScroll: true });

  const fill = $("#score-fill");
  const circumference = 2 * Math.PI * 52;
  const num = $("#score-num");
  requestAnimationFrame(() => {
    fill.style.strokeDashoffset = circumference * (1 - score / 100);
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { num.textContent = score; return; }
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / 1100);
    num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

$("#quiz-restart").addEventListener("click", () => {
  state.step = 0;
  state.answers = [];
  state.score = null;
  quiz.reset();
  $("#score-fill").style.strokeDashoffset = "";
  renderStep();
  show(quiz);
});

/* Görüşme formunu açan bağlantılar */
function openBooking(pkg) {
  if (pkg) state.pkg = pkg;
  const note = $("#booking-note");
  if (state.score !== null) {
    note.textContent = `Hazırlık skorunuz ${state.score}/100. Görüşmede bu sonucu ve size uygun adımları birlikte konuşacağız.`;
  } else if (pkg) {
    note.textContent = `${pkg} hakkında konuşmak için bilgilerinizi bırakın. Size en geç bir iş günü içinde dönüyoruz.`;
  }
  show(booking);
  $("#name").focus({ preventScroll: true });
}

// Check-up bağlantıları, form açıksa ve test çözülmediyse soruları geri getirir
$$('a[href="#checkup"]:not([data-open-form])').forEach((el) =>
  el.addEventListener("click", () => {
    if (state.score === null && booking.hidden === false) show(quiz);
  })
);

// Test çözüldüyse açılıştaki kadran butonu doğrudan görüşme formunu açar
$("#gauge-cta").addEventListener("click", () => {
  if (state.score !== null) openBooking();
});

$$("[data-open-form]").forEach((el) =>
  el.addEventListener("click", () => openBooking(el.dataset.package))
);

/* Sayfa içi bağlantılar: sabit menünün altında, doğru noktada durur.
   Görüşme butonları doğrudan forma, check-up bağlantıları telefonda doğrudan sorulara gider. */
const header = $(".site-header");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToEl(el) {
  const top = el.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
}

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id === "#") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    const section = $(id);
    if (!section) return;
    e.preventDefault();
    let target = $(".section-head, .checkup-intro, .outline-title", section) || section;
    if (id === "#checkup" && (a.hasAttribute("data-open-form") || window.innerWidth <= 900)) {
      target = $(".checkup-panel");
    }
    // Form açılması gibi içerik değişiklikleri yerleştikten sonra kaydır
    requestAnimationFrame(() => scrollToEl(target));
    history.replaceState(null, "", id);
  })
);

/* Form doğrulama ve gönderim */
function normalizePhone(v) {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? `+90${d}` : null;
}

function setError(input, errorEl, bad) {
  errorEl.hidden = !bad;
  if (input) input.setAttribute("aria-invalid", String(bad));
}

booking.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nameInput = $("#name");
  const phoneInput = $("#phone");
  const consent = $("#consent");

  const name = nameInput.value.trim();
  const phone = normalizePhone(phoneInput.value);
  const nameBad = name.split(/\s+/).length < 2 || name.length < 5;

  setError(nameInput, $("#name-error"), nameBad);
  setError(phoneInput, $("#phone-error"), !phone);
  setError(null, $("#consent-error"), !consent.checked);

  if (nameBad) return nameInput.focus();
  if (!phone) return phoneInput.focus();
  if (!consent.checked) return consent.focus();

  const payload = {
    adSoyad: name,
    telefon: phone,
    skor: state.score,
    paket: state.pkg,
    cevaplar: state.answers,
  };

  const lines = [
    "Merhaba, 45 dakikalık görüşme talep etmek istiyorum.",
    `Ad soyad: ${name}`,
    `Telefon: ${phone}`,
  ];
  if (state.score !== null) lines.push(`Yapay zekâ hazırlık skorum: ${state.score}/100`);
  if (state.pkg) lines.push(`İlgilendiğim paket: ${state.pkg}`);
  const message = lines.join("\n");

  const submitBtn = $("button[type=submit]", booking);
  submitBtn.disabled = true;

  let sent = false;
  if (CONFIG.formEndpoint) {
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      sent = res.ok;
    } catch (_) {
      sent = false;
    }
  }

  submitBtn.disabled = false;
  const confirmLink = $("[data-wa]", confirmBox);
  confirmLink.href = waLink(message);

  if (sent) {
    $("#confirm-title").textContent = "Görüşme talebiniz alındı";
    $("#confirm-text").textContent = `Teşekkürler ${name.split(" ")[0]}. En geç bir iş günü içinde ${phone} numarasından sizi arayıp görüşme saatini belirleyeceğiz.`;
    confirmLink.textContent = "Beklemeden WhatsApp'tan yazın";
  } else {
    // Form servisi yoksa ya da hata verdiyse talep WhatsApp ile iletilir
    window.open(waLink(message), "_blank", "noopener");
    $("#confirm-title").textContent = "Son adım: mesajı WhatsApp'tan gönderin";
    $("#confirm-text").textContent = "Talebiniz WhatsApp'ta hazır bir mesaj olarak açıldı. Göndermek için WhatsApp'ta gönder tuşuna basın. Pencere açılmadıysa aşağıdaki butonu kullanın.";
    confirmLink.textContent = "Talebi WhatsApp ile gönder";
  }
  show(confirmBox);
  confirmBox.focus({ preventScroll: true });
});

renderStep();
