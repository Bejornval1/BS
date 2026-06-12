/* ============================================================
   NIVALIS — interaction engine
   ============================================================ */
(() => {
  "use strict";

  /* ---- Config: swap media here ---- */
  const MEDIA = {
    // Set once the AI hero video has rendered. Falls back to poster image if empty.
    heroVideo: "https://cdn.creativeclaw.co/u/ec43cdf1/videos/1ef80587-bef9-46a6-a04e-795215e3e485.mp4",
  };

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, n) => (1 - n) * a + n * b;

  /* =========================================================
     1. PRELOADER
     ========================================================= */
  function runLoader(done) {
    const fill   = $("[data-loader-fill]");
    const count  = $("[data-loader-count]");
    const status = $("[data-loader-status]");
    const loader = $("#loader");
    const phases = ["ESTABLISHING UPLINK", "MAPPING THE VOID", "THAWING THE ARCHIVE", "ALIGNING THE MONOLITH", "ENTERING NIVALIS"];
    let p = 0;

    const tick = () => {
      p += Math.max(0.6, (100 - p) * 0.07);
      if (p > 100) p = 100;
      const v = Math.floor(p);
      if (count) count.textContent = v;
      if (fill) fill.style.width = p + "%";
      if (status) status.textContent = phases[Math.min(phases.length - 1, Math.floor(v / 20))];
      if (p < 100) {
        setTimeout(tick, prefersReduced ? 5 : 90 + Math.random() * 80);
      } else {
        setTimeout(() => revealLoader(loader, done), 350);
      }
    };
    tick();
  }

  function revealLoader(loader, done) {
    document.body.classList.remove("is-loading");
    if (!loader) { done(); return; }
    if (prefersReduced || !window.gsap) {
      loader.style.transition = "opacity .6s ease";
      loader.style.opacity = "0";
      setTimeout(() => { loader.remove(); done(); }, 620);
      return;
    }
    gsap.timeline({ onComplete: () => { loader.remove(); done(); } })
      .to("#loader .loader__inner, #loader .loader__coords", { y: -30, opacity: 0, duration: 0.6, ease: "power3.in" })
      .to(loader, { yPercent: -100, duration: 1.0, ease: "expo.inOut" }, "-=0.2");
  }

  /* =========================================================
     2. CANVAS PARTICLE FIELD (stars + drifting snow)
     ========================================================= */
  function startField() {
    const canvas = $("#field");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr, stars = [], flakes = [];
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      const starCount = Math.round((innerWidth * innerHeight) / 5200);
      const flakeCount = Math.round((innerWidth * innerHeight) / 26000);
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1, r: Math.random() * 1.1 + 0.2,
        tw: Math.random() * Math.PI * 2, ts: Math.random() * 0.02 + 0.004,
        hue: Math.random() < 0.18 ? "182,157,255" : (Math.random() < 0.4 ? "143,216,255" : "238,244,255"),
      }));
      flakes = Array.from({ length: flakeCount }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: (Math.random() * 1.6 + 0.6) * dpr, sp: (Math.random() * 0.4 + 0.15) * dpr,
        drift: Math.random() * Math.PI * 2, ds: Math.random() * 0.01 + 0.003,
        o: Math.random() * 0.5 + 0.2,
      }));
    }

    function frame() {
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      const px = (mouse.x - 0.5), py = (mouse.y - 0.5);
      ctx.clearRect(0, 0, w, h);

      // stars
      for (const s of stars) {
        s.tw += s.ts;
        const tw = (Math.sin(s.tw) + 1) * 0.5;
        const x = s.x + px * 40 * dpr * s.z;
        const y = s.y + py * 40 * dpr * s.z;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.hue},${(0.25 + tw * 0.6) * s.z})`;
        ctx.arc(x, y, s.r * dpr * (0.6 + tw * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      // snow
      for (const f of flakes) {
        f.drift += f.ds;
        f.y += f.sp;
        f.x += Math.sin(f.drift) * 0.4 * dpr;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(220,235,255,${f.o})`;
        ctx.arc(f.x + px * 18 * dpr, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    addEventListener("resize", resize);
    addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth; mouse.ty = e.clientY / innerHeight; });
    resize();
    if (!prefersReduced) frame();
    else { // single static paint
      for (const s of stars) { ctx.beginPath(); ctx.fillStyle = `rgba(${s.hue},${0.5*s.z})`; ctx.arc(s.x,s.y,s.r*dpr,0,Math.PI*2); ctx.fill(); }
    }
  }

  /* =========================================================
     3. CUSTOM CURSOR + MAGNETIC
     ========================================================= */
  function startCursor() {
    if (isTouch) return;
    const cur = $("#cursor");
    if (!cur) return;
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });
    document.addEventListener("mouseleave", () => cur.classList.add("is-hidden"));
    document.addEventListener("mouseenter", () => cur.classList.remove("is-hidden"));
    (function loop() {
      x = lerp(x, tx, 0.2); y = lerp(y, ty, 0.2);
      cur.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(loop);
    })();
    $$("[data-cursor='link'], a, button, input").forEach((el) => {
      el.addEventListener("mouseenter", () => cur.classList.add("is-link"));
      el.addEventListener("mouseleave", () => cur.classList.remove("is-link"));
    });
    // magnetic
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform .1s linear";
        el.style.transform = `translate(${mx * 0.3}px, ${my * 0.4}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .5s cubic-bezier(.6,.01,.05,1)";
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* =========================================================
     4. TEXT SPLITTING helpers
     ========================================================= */
  function splitChars(el) {
    const text = el.textContent.trim();
    el.textContent = "";
    return [...text].map((ch) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch === " " ? " " : ch;
      el.appendChild(span);
      return span;
    });
  }
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    return words.map((wd, i) => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = wd;
      el.appendChild(span);
      el.appendChild(document.createTextNode(" "));
      return span;
    });
  }

  /* =========================================================
     5. HERO video swap
     ========================================================= */
  function startHeroVideo() {
    const v = $("[data-hero-video]");
    if (!v || !MEDIA.heroVideo || MEDIA.heroVideo.indexOf("__") === 0) return;
    const src = document.createElement("source");
    src.src = MEDIA.heroVideo; src.type = "video/mp4";
    v.appendChild(src);
    v.load();
    v.addEventListener("canplay", () => { v.classList.add("is-ready"); v.play().catch(() => {}); }, { once: true });
  }

  /* =========================================================
     6. GSAP SCROLL CHOREOGRAPHY
     ========================================================= */
  function startScroll() {
    const lenis = (!prefersReduced && window.Lenis)
      ? new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true })
      : null;

    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      if (lenis) {
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }
    } else if (lenis) {
      requestAnimationFrame(function raf(t){ lenis.raf(t); requestAnimationFrame(raf); });
    }

    // scroll progress bar
    const bar = $("[data-scroll-bar]");
    const updateBar = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    };
    addEventListener("scroll", updateBar, { passive: true });
    if (lenis) lenis.on("scroll", updateBar);
    updateBar();

    if (!window.gsap) return;

    // ---- HERO title chars rise in ----
    const heroChars = splitChars($(".hero__title"));
    gsap.set(heroChars, { yPercent: 120, opacity: 0 });
    gsap.to(heroChars, {
      yPercent: 0, opacity: 1, duration: 1.4, ease: "expo.out",
      stagger: 0.05, delay: 0.15,
    });

    // ---- reveal-line elements ----
    $$(".reveal-line").forEach((line) => {
      const inner = line.querySelector("span") || line;
      gsap.set(inner, { yPercent: 110, opacity: 0 });
      ScrollTrigger.create({
        trigger: line, start: "top 88%",
        onEnter: () => gsap.to(inner, { yPercent: 0, opacity: 1, duration: 1.1, ease: "expo.out" }),
      });
    });

    // ---- hero intro extras ----
    gsap.from(".hero__footer", { opacity: 0, y: 30, duration: 1, delay: 0.8, ease: "power2.out" });

    if (prefersReduced) return; // keep it simple beyond reveals

    // ---- generic parallax ----
    $$("[data-parallax]").forEach((el) => {
      const depth = parseFloat(el.dataset.parallax) || 0.15;
      gsap.to(el, {
        yPercent: depth * 100, ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // ---- manifesto: words brighten as you scroll through ----
    const mWords = splitWords($("#manifesto .manifesto__text"));
    mWords.forEach((wd) => wd.classList.add("is-dim"));
    gsap.to(mWords, {
      onUpdate: function () {
        const prog = this.progress();
        const lit = Math.floor(prog * mWords.length);
        mWords.forEach((wd, i) => wd.classList.toggle("is-dim", i > lit));
      },
      scrollTrigger: { trigger: "#manifesto", start: "top 70%", end: "bottom 70%", scrub: true },
    });

    // ---- other [data-split-words] simple fade-up ----
    $$("[data-split-words]").forEach((el) => {
      if (el.closest("#manifesto")) return;
      const words = splitWords(el);
      gsap.set(words, { yPercent: 120, opacity: 0 });
      ScrollTrigger.create({
        trigger: el, start: "top 85%",
        onEnter: () => gsap.to(words, { yPercent: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.04 }),
      });
    });

    // ---- chapter: image scale + caption parallax ----
    const chapterImg = $("[data-scale-on-scroll]");
    if (chapterImg) {
      gsap.fromTo(chapterImg, { scale: 1.25, yPercent: -6 }, {
        scale: 1, yPercent: 6, ease: "none",
        scrollTrigger: { trigger: "#monolith", start: "top bottom", end: "bottom top", scrub: true },
      });
    }
    gsap.from("#monolith .chapter__num", {
      scrollTrigger: { trigger: "#monolith", start: "top 70%" },
      opacity: 0, x: -20, duration: 0.8, ease: "power2.out",
    });

    // ---- chapter title lines ----
    $$("#monolith .chapter__title span").forEach((s) => {
      const inner = s;
      gsap.set(inner, { yPercent: 110 });
      ScrollTrigger.create({ trigger: "#monolith", start: "top 65%",
        onEnter: () => gsap.to(inner, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.1 }) });
    });

    // ---- FRONTIER horizontal scroll ----
    const track = $("[data-gallery-track]");
    if (track && innerWidth > 720) {
      gsap.to(track, {
        x: () => -(track.scrollWidth - innerWidth + 80),
        ease: "none",
        scrollTrigger: {
          trigger: "#frontier .gallery", start: "center center",
          end: () => "+=" + (track.scrollWidth - innerWidth + 200),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
    }

    // ---- codex rows reveal ----
    $$(".codex__row").forEach((row, i) => {
      gsap.from(row, {
        scrollTrigger: { trigger: row, start: "top 90%" },
        opacity: 0, y: 40, duration: 0.9, ease: "power3.out", delay: (i % 4) * 0.04,
      });
    });

    // ---- gateway title chars ----
    $$(".gateway__title").forEach((t) => {
      const chars = splitChars(t);
      gsap.set(chars, { yPercent: 120, opacity: 0 });
      ScrollTrigger.create({ trigger: t, start: "top 82%",
        onEnter: () => gsap.to(chars, { yPercent: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.03 }) });
    });

    // ---- footer wordmark drift ----
    gsap.to(".footer__marquee .marquee__track", {
      xPercent: -6, ease: "none",
      scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true },
    });

    ScrollTrigger.refresh();
    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  /* =========================================================
     7. MARQUEE (infinite, JS-driven for seamless loop)
     ========================================================= */
  function startMarquees() {
    if (prefersReduced) return;
    $$("[data-marquee]").forEach((m, idx) => {
      const track = m.querySelector(".marquee__track");
      if (!track) return;
      const dir = m.classList.contains("footer__marquee") ? -1 : (idx % 2 ? -1 : 1);
      let x = 0, last = performance.now();
      const speed = m.classList.contains("footer__marquee") ? 14 : 26;
      const half = () => track.scrollWidth / 2;
      function step(now) {
        const dt = (now - last) / 1000; last = now;
        x += dir * speed * dt;
        const hw = half();
        if (x <= -hw) x += hw; if (x >= 0 && dir > 0) x -= hw;
        track.style.transform = `translateX(${x}px)`;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* =========================================================
     8. CLOCK + signup
     ========================================================= */
  function startClock() {
    const els = $$("[data-clock]");
    if (!els.length) return;
    const tick = () => {
      const t = new Date().toISOString().substr(11, 8) + " UTC";
      els.forEach((e) => (e.textContent = t));
    };
    tick(); setInterval(tick, 1000);
  }
  function startSignup() {
    const form = $("[data-signup]"); if (!form) return;
    const note = $("[data-signup-note]");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      note.textContent = "✦ Signal received — listen for us at the next solstice.";
      input.value = ""; input.blur();
    });
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function init() {
    startClock();
    startSignup();
    startHeroVideo();
    runLoader(() => {
      startField();
      startCursor();
      startMarquees();
      startScroll();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
