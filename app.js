/* ============================================================================
   CO3 Customer Portal — User Handbook · interactions
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const slug = (t) =>
    t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const THEME_KEY = "co3hb-theme";
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    $$(".js-theme-label").forEach((el) => (el.textContent = t === "dark" ? "Light" : "Dark"));
  }
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $$(".js-theme").forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    })
  );

  /* ---------- Ensure heading ids + anchor links ---------- */
  $$(".section h2, .section h3").forEach((h) => {
    if (!h.id) {
      const base = slug(h.textContent || "");
      let id = base, i = 2;
      while (id && document.getElementById(id)) id = base + "-" + i++;
      if (id) h.id = id;
    }
    if (h.tagName === "H2" && h.id && !h.querySelector(".anchor")) {
      const a = document.createElement("a");
      a.className = "anchor"; a.href = "#" + h.id; a.textContent = "#";
      a.setAttribute("aria-label", "Link to this section");
      h.appendChild(a);
    }
  });

  /* ---------- Build search index ---------- */
  const index = [];
  $$(".section").forEach((sec) => {
    const h2 = sec.querySelector("h2");
    if (!h2) return;
    const secTitle = (h2.childNodes[0] ? h2.childNodes[0].textContent : h2.textContent).trim();
    const intro = sec.querySelector(".intro");
    index.push({
      title: secTitle,
      crumb: "Section",
      href: "#" + h2.id,
      body: (intro ? intro.textContent : "").replace(/\s+/g, " ").trim(),
      el: sec,
    });
    $$("h3", sec).forEach((h3) => {
      // gather following paragraph text up to the next heading
      let body = "", n = h3.nextElementSibling;
      while (n && !/^H[2-4]$/.test(n.tagName)) {
        if (n.textContent) body += " " + n.textContent;
        n = n.nextElementSibling;
      }
      index.push({
        title: h3.textContent.trim(),
        crumb: secTitle,
        href: "#" + h3.id,
        body: body.replace(/\s+/g, " ").trim().slice(0, 600),
        el: h3,
      });
    });
  });

  function score(q, item) {
    q = q.toLowerCase();
    const t = item.title.toLowerCase(), b = item.body.toLowerCase(), c = item.crumb.toLowerCase();
    let s = 0;
    if (t === q) s += 100;
    if (t.startsWith(q)) s += 50;
    if (t.includes(q)) s += 30;
    if (c.includes(q)) s += 8;
    if (b.includes(q)) s += 10;
    // token match
    q.split(/\s+/).forEach((tok) => { if (tok && t.includes(tok)) s += 6; if (tok && b.includes(tok)) s += 2; });
    return s;
  }
  function hl(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return text.slice(0, i) + "<mark>" + text.slice(i, i + q.length) + "</mark>" + text.slice(i + q.length);
  }

  /* ---------- Command palette ---------- */
  const pal = $("#palette");
  const palInput = $("#palette-input");
  const palResults = $("#palette-results");
  let palSel = 0, palItems = [], palLastFocus = null;

  function openPalette() {
    palLastFocus = document.activeElement;
    pal.classList.add("open");
    pal.setAttribute("aria-hidden", "false");
    palInput.value = "";
    renderResults("");
    setTimeout(() => palInput.focus(), 30);
    document.body.style.overflow = "hidden";
  }
  function closePalette() {
    pal.classList.remove("open");
    pal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (palLastFocus && palLastFocus.focus) palLastFocus.focus();
  }
  function renderResults(q) {
    let list;
    if (!q.trim()) {
      list = index.filter((i) => i.crumb === "Section").slice(0, 9);
    } else {
      list = index
        .map((i) => ({ i, s: score(q, i) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 12)
        .map((x) => x.i);
    }
    palItems = list; palSel = 0;
    if (!list.length) {
      palResults.innerHTML = '<div class="palette__empty">No results for “' + q.replace(/</g, "&lt;") + '”. Try “invite”, “map”, “consent”, “branding”…</div>';
      return;
    }
    palResults.innerHTML = list
      .map((i, idx) => {
        const crumb = i.crumb === "Section" ? "Jump to section" : i.crumb;
        return (
          '<a class="presult' + (idx === 0 ? " sel" : "") + '" data-idx="' + idx + '" href="' + i.href + '">' +
          '<div class="pcrumb">' + crumb + "</div>" +
          '<div class="pt">' + hl(i.title, q) + "</div>" +
          (i.body ? '<div class="pc">' + hl(i.body.slice(0, 110), q) + (i.body.length > 110 ? "…" : "") + "</div>" : "") +
          "</a>"
        );
      })
      .join("");
    $$(".presult", palResults).forEach((el) => {
      el.addEventListener("click", (e) => { e.preventDefault(); go(el.getAttribute("href")); });
      el.addEventListener("mouseenter", () => setSel(+el.dataset.idx));
    });
  }
  function setSel(n) {
    palSel = (n + palItems.length) % palItems.length;
    $$(".presult", palResults).forEach((el, i) => el.classList.toggle("sel", i === palSel));
    const sel = $$(".presult", palResults)[palSel];
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function go(href) {
    closePalette();
    const target = $(href);
    if (target) {
      history.replaceState(null, "", href);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 1200);
    }
  }
  palInput && palInput.addEventListener("input", () => renderResults(palInput.value));
  palInput && palInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(palSel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(palSel - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (palItems[palSel]) go(palItems[palSel].href); }
    else if (e.key === "Escape") { closePalette(); }
  });
  pal && pal.addEventListener("click", (e) => { if (e.target === pal) closePalette(); });
  pal && pal.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); palInput.focus(); } });
  $$(".js-open-search").forEach((b) => b.addEventListener("click", openPalette));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.classList.contains("open") ? closePalette() : openPalette(); }
    else if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !pal.classList.contains("open")) { e.preventDefault(); openPalette(); }
  });

  /* ---------- Scroll-spy ---------- */
  const navLinks = $$(".nav-link[data-target]");
  const linkMap = {};
  navLinks.forEach((l) => (linkMap[l.dataset.target] = l));
  // Keep the hero "sections" stat honest — derive it from the real nav.
  const heroCount = $("#hero-section-count");
  if (heroCount) heroCount.textContent = navLinks.length;
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          navLinks.forEach((l) => l.classList.remove("active"));
          const l = linkMap[en.target.id];
          if (l) {
            l.classList.add("active");
            l.scrollIntoView({ block: "nearest" });
          }
        }
      });
    },
    { rootMargin: "-20% 0px -72% 0px", threshold: 0 }
  );
  $$(".section").forEach((s) => s.id && spy.observe(s));

  /* ---------- Reveal on scroll ---------- */
  const rev = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rev.unobserve(e.target); } }),
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  $$(".reveal").forEach((e) => rev.observe(e));

  /* ---------- Reading progress ---------- */
  const bar = $("#progress");
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? h.scrollTop / max : 0;
    if (bar) bar.style.transform = "scaleX(" + p + ")";
    const top = $("#totop");
    if (top) top.classList.toggle("show", h.scrollTop > 600);
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Back to top ---------- */
  const totop = $("#totop");
  totop && totop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- Mobile sidebar ---------- */
  const sb = $(".sidebar"), scrim = $(".scrim");
  function toggleSb(open) {
    sb.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
    $$(".js-menu").forEach((b) => b.setAttribute("aria-expanded", String(open)));
  }
  $$(".js-menu").forEach((b) => b.addEventListener("click", () => toggleSb(!sb.classList.contains("open"))));
  scrim && scrim.addEventListener("click", () => toggleSb(false));
  $$(".nav-link").forEach((l) => l.addEventListener("click", () => { if (innerWidth <= 1000) toggleSb(false); }));

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox"), lbImg = $("#lightbox-img"), lbCap = $("#lightbox-cap");
  const lbClose = $(".lightbox__close");
  let lbLastFocus = null;
  $$(".browserframe__img").forEach((fig) => {
    fig.setAttribute("role", "button");
    fig.setAttribute("tabindex", "0");
    fig.setAttribute("aria-label", "Enlarge screenshot");
    const openLb = () => {
      const img = fig.querySelector("img");
      lbImg.src = img.src;
      lbImg.alt = img.alt || "";
      lbCap.textContent = img.alt || "";
      lbLastFocus = document.activeElement;
      lb.classList.add("open");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (lbClose) lbClose.focus();
    };
    fig.addEventListener("click", openLb);
    fig.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLb(); } });
  });
  function closeLb() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
  }
  lb && lb.addEventListener("click", (e) => { if (e.target !== lbImg) closeLb(); });
  lb && lb.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); if (lbClose) lbClose.focus(); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lb.classList.contains("open")) closeLb(); });

  /* ---------- Flash highlight style (injected) ---------- */
  const st = document.createElement("style");
  st.textContent =
    "@keyframes hbflash{0%{background:color-mix(in srgb,var(--lime-soft) 80%,transparent)}100%{background:transparent}}" +
    ".flash{animation:hbflash 1.2s ease-out;border-radius:8px}";
  document.head.appendChild(st);
})();
