/* NIVALIS preview — dependency-free effects (no GSAP/Lenis) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, n) => (1 - n) * a + n * b;
  const isTouch = matchMedia("(hover:none)").matches;

  /* particle field */
  const canvas = $("#field");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let w, h, dpr, stars = [], flakes = [];
    const m = { x: .5, y: .5, tx: .5, ty: .5 };
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
      stars = Array.from({ length: Math.round(innerWidth * innerHeight / 5200) }, () => ({
        x: Math.random() * w, y: Math.random() * h, z: Math.random() * .9 + .1, r: Math.random() * 1.1 + .2,
        tw: Math.random() * 6.28, ts: Math.random() * .02 + .004,
        hue: Math.random() < .18 ? "182,157,255" : (Math.random() < .4 ? "143,216,255" : "238,244,255"),
      }));
      flakes = Array.from({ length: Math.round(innerWidth * innerHeight / 26000) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.6 + .6) * dpr,
        sp: (Math.random() * .4 + .15) * dpr, drift: Math.random() * 6.28, ds: Math.random() * .01 + .003, o: Math.random() * .5 + .2,
      }));
    }
    function frame() {
      m.x = lerp(m.x, m.tx, .05); m.y = lerp(m.y, m.ty, .05);
      const px = m.x - .5, py = m.y - .5;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += s.ts; const tw = (Math.sin(s.tw) + 1) * .5;
        ctx.beginPath(); ctx.fillStyle = `rgba(${s.hue},${(.25 + tw * .6) * s.z})`;
        ctx.arc(s.x + px * 40 * dpr * s.z, s.y + py * 40 * dpr * s.z, s.r * dpr * (.6 + tw * .6), 0, 6.28); ctx.fill();
      }
      for (const f of flakes) {
        f.drift += f.ds; f.y += f.sp; f.x += Math.sin(f.drift) * .4 * dpr;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.fillStyle = `rgba(220,235,255,${f.o})`;
        ctx.arc(f.x + px * 18 * dpr, f.y, f.r, 0, 6.28); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    addEventListener("resize", resize);
    addEventListener("pointermove", e => { m.tx = e.clientX / innerWidth; m.ty = e.clientY / innerHeight; });
    resize(); frame();
  }

  /* cursor + magnetic */
  if (!isTouch) {
    const cur = $("#cursor");
    if (cur) {
      let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
      addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; });
      (function loop(){ x = lerp(x, tx, .2); y = lerp(y, ty, .2); cur.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(loop); })();
      $$("a,button,input,[data-cursor='link']").forEach(el => {
        el.addEventListener("mouseenter", () => cur.classList.add("is-link"));
        el.addEventListener("mouseleave", () => cur.classList.remove("is-link"));
      });
    }
    $$("[data-magnetic]").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        el.style.transition = "transform .1s linear";
        el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * .3}px,${(e.clientY - (r.top + r.height / 2)) * .4}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transition = "transform .5s cubic-bezier(.6,.01,.05,1)"; el.style.transform = "translate(0,0)"; });
    });
  }

  /* hero video */
  const v = $("[data-hero-video]");
  if (v) {
    const src = document.createElement("source");
    src.src = "https://cdn.creativeclaw.co/u/ec43cdf1/videos/1ef80587-bef9-46a6-a04e-795215e3e485.mp4"; src.type = "video/mp4";
    v.appendChild(src); v.load();
    v.addEventListener("canplay", () => { v.classList.add("is-ready"); v.play().catch(() => {}); }, { once: true });
  }

  /* marquees */
  $$("[data-marquee]").forEach((mq, idx) => {
    const track = mq.querySelector(".marquee__track"); if (!track) return;
    const dir = mq.classList.contains("footer__marquee") ? -1 : (idx % 2 ? -1 : 1);
    const speed = mq.classList.contains("footer__marquee") ? 14 : 26;
    let x = 0, last = performance.now();
    (function step(now){ const dt = (now - last) / 1000; last = now; x += dir * speed * dt; const hw = track.scrollWidth / 2;
      if (x <= -hw) x += hw; if (x >= 0 && dir > 0) x -= hw; track.style.transform = `translateX(${x}px)`; requestAnimationFrame(step); })(last);
  });

  /* scroll progress */
  const bar = $("[data-scroll-bar]");
  if (bar) {
    const upd = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.width = (max > 0 ? scrollY / max * 100 : 0) + "%"; };
    addEventListener("scroll", upd, { passive: true }); upd();
  }

  /* clock + signup */
  const clocks = $$("[data-clock]");
  const tick = () => { const t = new Date().toISOString().substr(11, 8) + " UTC"; clocks.forEach(e => e.textContent = t); };
  if (clocks.length) { tick(); setInterval(tick, 1000); }
  const form = $("[data-signup]");
  if (form) form.addEventListener("submit", e => { e.preventDefault(); $("[data-signup-note]").textContent = "✦ Signal received — listen for us at the next solstice."; form.querySelector("input").value = ""; });
})();
