/* ============================================================
   FlowPitch — Sierra Public Overview
   Single shared renderer powers edit / present / thumbnail / pdf
   ============================================================ */
(function () {
  "use strict";

  /* ---------- state ---------- */
  var deck = null;
  var selected = 0;
  var present = { active: false, index: 0, prev: null };
  var storageOK = true;
  var uid = 0;
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ACCENTS = {
    coral:  { a: "#E0552E", soft: "#F6E5DA" },
    rose:   { a: "#DD4579", soft: "#F8E1EC" },
    violet: { a: "#7C5AD6", soft: "#ECE6FA" },
    teal:   { a: "#1F8E84", soft: "#DCEFEC" },
    amber:  { a: "#D98A1F", soft: "#FaecD6" }
  };

  /* ---------- tiny utils ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, c = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms);
    };
  }
  function getByPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setByPath(obj, path, val) {
    var ks = path.split("."), o = obj, i;
    for (i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  /* ---------- Sierra bloom mandala ---------- */
  function mandala() {
    var id = "bloom" + (uid++);
    var petals = 12, g = "", k, a;
    for (k = 0; k < petals; k++) {
      a = (360 / petals) * k;
      g += '<ellipse cx="100" cy="52" rx="15" ry="42" fill="url(#' + id + ')" ' +
           'transform="rotate(' + a + ' 100 100)" opacity="0.85"/>';
    }
    return '<svg class="bloom-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + '" cx="50%" cy="18%" r="85%">' +
      '<stop offset="0%" stop-color="#F0A23B"/><stop offset="42%" stop-color="#E85F36"/>' +
      '<stop offset="78%" stop-color="#DD4579"/><stop offset="100%" stop-color="#7C5AD6"/>' +
      '</radialGradient></defs><g>' + g + '</g>' +
      '<circle cx="100" cy="100" r="15" fill="#FAF8F3"/></svg>';
  }

  /* ============================================================
     SHARED RENDERER
     mode: "edit" | "present" | "thumb" | "pdf"
     ============================================================ */
  function E(mode, tag, path, content, cls, extra) {
    var editable = mode === "edit" ? ' contenteditable="true" spellcheck="true"' : "";
    return "<" + tag + ' class="' + (cls || "") + '" data-edit-path="' + path + '"' +
      editable + (extra ? " " + extra : "") + ">" + esc(content) + "</" + tag + ">";
  }
  function show(v, mode) { return (v !== undefined && (String(v) !== "" || mode === "edit")); }

  function headHTML(mode, i, s) {
    var h = "";
    if (show(s.eyebrow, mode))
      h += E(mode, "div", "slides." + i + ".eyebrow", s.eyebrow, "eyebrow", 'data-animate style="--d:0"');
    h += E(mode, "h1", "slides." + i + ".headline", s.headline, "headline", 'data-animate style="--d:90"');
    if (show(s.subheadline, mode))
      h += E(mode, "p", "slides." + i + ".subheadline", s.subheadline, "subhead", 'data-animate style="--d:180"');
    return h;
  }
  function footHTML(mode, i, s) {
    if (!show(s.note, mode)) return "";
    return E(mode, "div", "slides." + i + ".note", s.note, "foot-note", 'data-animate style="--d:520"');
  }

  function renderSlide(s, i, mode) {
    var el = document.createElement("div");
    var countClass = itemCountClass(s);
    el.className = "slide slide--" + s.type +
      (countClass ? " " + countClass : "") +
      (mode === "edit" ? " slide--edit" : "") +
      (mode === "thumb" ? " slide--thumb" : "");
    el.setAttribute("data-type", s.type);
    el.innerHTML = bodyHTML(s, i, mode);
    return el;
  }

  function itemCountClass(s) {
    var n = 0;
    if (s.type === "cards") n = (s.cards || []).length;
    else if (s.type === "process") n = (s.steps || []).length;
    else if (s.type === "proof") n = (s.metrics || []).length;
    else if (s.type === "content") n = (s.bullets || []).length;
    return n ? "slide--items-" + n : "";
  }

  function bodyHTML(s, i, mode) {
    switch (s.type) {
      case "title":   return titleHTML(s, i, mode);
      case "section": return sectionHTML(s, i, mode);
      case "visual":  return sectionHTML(s, i, mode);
      case "content": return contentHTML(s, i, mode);
      case "cards":   return cardsHTML(s, i, mode);
      case "proof":   return proofHTML(s, i, mode);
      case "process": return processHTML(s, i, mode);
      case "beforeAfter": return beforeAfterHTML(s, i, mode);
      case "closing": return closingHTML(s, i, mode);
      default:        return contentHTML(s, i, mode);
    }
  }

  function titleHTML(s, i, mode) {
    var cta = "";
    if (show(s.cta, mode))
      cta = '<div class="title-cta" data-animate style="--d:300">' +
        E(mode, "span", "slides." + i + ".cta", s.cta, "", "") + "</div>";
    return '<div class="slide__body">' + headHTML(mode, i, s) + cta + "</div>" +
      '<div class="title-bloom" aria-hidden="true">' + mandala() + "</div>" +
      footHTML(mode, i, s);
  }

  function sectionHTML(s, i, mode) {
    return '<div class="slide__body">' + headHTML(mode, i, s) + "</div>" +
      '<div class="title-bloom" aria-hidden="true" style="opacity:.5">' + mandala() + "</div>" +
      footHTML(mode, i, s);
  }

  function contentHTML(s, i, mode) {
    var b = s.bullets || [], li = "", k;
    for (k = 0; k < b.length; k++)
      li += E(mode, "li", "slides." + i + ".bullets." + k, b[k], "", 'data-animate style="--d:' + (240 + k * 70) + '"');
    return '<div class="slide__head">' + headHTML(mode, i, s) + "</div>" +
      '<div class="slide__body"><ul class="bullets">' + li + "</ul></div>" +
      footHTML(mode, i, s);
  }

  function cardsHTML(s, i, mode) {
    var c = s.cards || [], n = c.length, html = "", k;
    for (k = 0; k < n; k++) {
      html += '<div class="card" data-animate style="--d:' + (240 + k * 80) + '">' +
        E(mode, "h3", "slides." + i + ".cards." + k + ".title", c[k].title, "") +
        E(mode, "p", "slides." + i + ".cards." + k + ".body", c[k].body, "") +
        "</div>";
    }
    var ncls = n >= 6 ? "n6" : ("n" + Math.min(Math.max(n, 2), 4));
    return '<div class="slide__head">' + headHTML(mode, i, s) + "</div>" +
      '<div class="slide__body"><div class="cards ' + ncls + '">' + html + "</div></div>" +
      footHTML(mode, i, s);
  }

  function proofHTML(s, i, mode) {
    var m = s.metrics || [], n = m.length, html = "", k;
    for (k = 0; k < n; k++) {
      html += '<div class="metric" data-animate style="--d:' + (240 + k * 90) + '">' +
        E(mode, "div", "slides." + i + ".metrics." + k + ".value", m[k].value, "mval",
          'data-counter data-value="' + esc(m[k].value) + '"') +
        E(mode, "div", "slides." + i + ".metrics." + k + ".label", m[k].label, "mlabel") +
        "</div>";
    }
    var ncls = "n" + Math.min(Math.max(n, 2), 4);
    return '<div class="slide__head">' + headHTML(mode, i, s) + "</div>" +
      '<div class="slide__body"><div class="metrics ' + ncls + '">' + html + "</div></div>" +
      footHTML(mode, i, s);
  }

  function processHTML(s, i, mode) {
    var st = s.steps || [], n = st.length, html = "", k;
    for (k = 0; k < n; k++) {
      html += '<div class="step" data-animate style="--d:' + (240 + k * 110) + '">' +
        '<div class="snum" aria-hidden="true">' + (k + 1) + "</div>" +
        E(mode, "h3", "slides." + i + ".steps." + k + ".title", st[k].title, "") +
        E(mode, "p", "slides." + i + ".steps." + k + ".body", st[k].body, "") +
        '<span class="connector" aria-hidden="true"></span></div>';
    }
    var ncls = "n" + Math.min(Math.max(n, 2), 5);
    return '<div class="slide__head">' + headHTML(mode, i, s) + "</div>" +
      '<div class="slide__body"><div class="steps ' + ncls + '">' + html + "</div></div>" +
      footHTML(mode, i, s);
  }

  function colHTML(mode, i, side, col, baseD) {
    var b = (col && col.bullets) || [], li = "", k;
    for (k = 0; k < b.length; k++)
      li += E(mode, "li", "slides." + i + "." + side + ".bullets." + k, b[k], "",
        'data-animate style="--d:' + (baseD + k * 70) + '"');
    return '<div class="ba-col ' + (side === "left" ? "before" : "after") + '" ' +
      'data-animate style="--d:' + (baseD - 60) + '">' +
      E(mode, "h3", "slides." + i + "." + side + ".title", (col && col.title) || "", "") +
      "<ul>" + li + "</ul></div>";
  }

  function beforeAfterHTML(s, i, mode) {
    return '<div class="slide__head">' + headHTML(mode, i, s) + "</div>" +
      '<div class="slide__body"><div class="ba">' +
        colHTML(mode, i, "left", s.left, 300) +
        '<div class="ba-arrow" data-animate style="--d:430" aria-hidden="true">→</div>' +
        colHTML(mode, i, "right", s.right, 540) +
      "</div></div>" + footHTML(mode, i, s);
  }

  function closingHTML(s, i, mode) {
    var cta = "";
    if (show(s.cta, mode))
      cta = '<div class="cta-wrap" data-animate style="--d:280"><div class="cta-btn">' +
        E(mode, "span", "slides." + i + ".cta", s.cta, "", "") + "</div></div>";
    return '<div class="slide__body">' + headHTML(mode, i, s) + cta + "</div>" +
      '<div class="closing-bloom" aria-hidden="true">' + mandala() + "</div>" +
      footHTML(mode, i, s);
  }

  /* ============================================================
     EDITOR
     ============================================================ */
  function renderCanvas() {
    var c = $("editorCanvas");
    c.innerHTML = "";
    c.appendChild(renderSlide(deck.slides[selected], selected, "edit"));
  }

  function renderThumbs() {
    var wrap = $("thumbs");
    wrap.innerHTML = "";
    deck.slides.forEach(function (s, i) {
      var t = document.createElement("div");
      t.className = "thumb" + (i === selected ? " active" : "");
      t.setAttribute("role", "button");
      t.setAttribute("tabindex", "0");
      var num = document.createElement("span");
      num.className = "num"; num.textContent = i + 1;
      var frame = document.createElement("div");
      frame.className = "thumb-frame";
      frame.appendChild(renderSlide(s, i, "thumb"));
      t.appendChild(num); t.appendChild(frame);
      t.addEventListener("click", function () { selectSlide(i); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSlide(i); }
      });
      wrap.appendChild(t);
    });
  }
  var refreshThumbs = debounce(renderThumbs, 260);

  function selectSlide(i) {
    selected = Math.max(0, Math.min(deck.slides.length - 1, i));
    renderCanvas();
    renderThumbs();
    syncInspector();
  }

  function syncInspector() {
    var s = deck.slides[selected];
    $("typeSelect").value = s.type;
    $("noteField").value = s.note || "";
    document.querySelectorAll(".sw").forEach(function (sw) {
      sw.classList.toggle("sel", sw.dataset.key === (deck.meta.accentColor || "coral"));
    });
  }

  /* ---------- editable delegation ---------- */
  function wireEditing() {
    var canvas = $("editorCanvas");
    canvas.addEventListener("input", function (e) {
      var t = e.target.closest("[data-edit-path]");
      if (!t) return;
      setByPath(deck, t.dataset.editPath, t.textContent);
      scheduleSave();
      refreshThumbs();
    });
    canvas.addEventListener("paste", function (e) {
      var t = e.target.closest("[data-edit-path]");
      if (!t) return;
      e.preventDefault();
      var txt = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, txt);
    });
    canvas.addEventListener("keydown", function (e) {
      var t = e.target.closest("[data-edit-path]");
      if (t && e.key === "Enter") { e.preventDefault(); t.blur(); }
    });
  }

  /* ---------- slide operations ---------- */
  function placeholderSlide(type) {
    type = type || "content";
    var s = { type: type, eyebrow: "Label", headline: "New headline",
              subheadline: "Supporting subheadline.", note: "" };
    ensureFields(s);
    return s;
  }
  function ensureFields(s) {
    if (s.type === "cards" && !s.cards)
      s.cards = [{ title: "Card one", body: "Card detail." },
                 { title: "Card two", body: "Card detail." },
                 { title: "Card three", body: "Card detail." }];
    if (s.type === "proof" && !s.metrics)
      s.metrics = [{ value: "100%", label: "Metric: ___" },
                   { value: "10x", label: "Metric: ___" },
                   { value: "24/7", label: "Metric: ___" }];
    if (s.type === "process" && !s.steps)
      s.steps = [{ title: "Step one", body: "Describe this step." },
                 { title: "Step two", body: "Describe this step." },
                 { title: "Step three", body: "Describe this step." }];
    if (s.type === "beforeAfter") {
      if (!s.left) s.left = { title: "Before", bullets: ["Point one", "Point two"] };
      if (!s.right) s.right = { title: "After", bullets: ["Point one", "Point two"] };
    }
    if (s.type === "content" && !s.bullets)
      s.bullets = ["First point", "Second point", "Third point"];
    if ((s.type === "title" || s.type === "closing") && s.cta === undefined)
      s.cta = "Call to action";
  }

  function addSlide() {
    var s = placeholderSlide("content");
    deck.slides.splice(selected + 1, 0, s);
    selectSlide(selected + 1); scheduleSave();
  }
  function dupSlide() {
    var s = clone(deck.slides[selected]);
    deck.slides.splice(selected + 1, 0, s);
    selectSlide(selected + 1); scheduleSave();
  }
  function delSlide() {
    if (deck.slides.length <= 1) {
      deck.slides[0] = placeholderSlide("content");
      selectSlide(0); scheduleSave(); return;
    }
    deck.slides.splice(selected, 1);
    selectSlide(Math.min(selected, deck.slides.length - 1)); scheduleSave();
  }
  function moveSlide(dir) {
    var j = selected + dir;
    if (j < 0 || j >= deck.slides.length) return;
    var tmp = deck.slides[selected];
    deck.slides[selected] = deck.slides[j];
    deck.slides[j] = tmp;
    selectSlide(j); scheduleSave();
  }
  function changeType(type) {
    var s = deck.slides[selected];
    s.type = type;
    ensureFields(s);
    selectSlide(selected); scheduleSave();
  }

  /* ============================================================
     ACCENT
     ============================================================ */
  function applyAccent(key) {
    var a = ACCENTS[key] || ACCENTS.coral;
    document.documentElement.style.setProperty("--accent", a.a);
    document.documentElement.style.setProperty("--accent-soft", a.soft);
  }
  function buildSwatches() {
    var wrap = $("swatches");
    wrap.innerHTML = "";
    Object.keys(ACCENTS).forEach(function (key) {
      var b = document.createElement("button");
      b.className = "sw"; b.type = "button"; b.dataset.key = key;
      b.style.background = ACCENTS[key].a;
      b.setAttribute("aria-label", "Accent " + key);
      b.addEventListener("click", function () {
        deck.meta.accentColor = key; applyAccent(key);
        syncInspector(); scheduleSave();
      });
      wrap.appendChild(b);
    });
  }

  /* ============================================================
     STORAGE
     ============================================================ */
  function draftKey(id) { return "flowpitch:" + (id || "untitled") + ":draft"; }
  function loadDraft(id) {
    try {
      var raw = localStorage.getItem(draftKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { storageOK = false; return null; }
  }
  function saveDraft() {
    if (!storageOK) return;
    try { localStorage.setItem(draftKey(deck.meta.deckId), JSON.stringify(deck)); }
    catch (e) { storageOK = false; warnStorage(); }
  }
  var scheduleSave = debounce(saveDraft, 350);

  var warnedStorage = false;
  function warnStorage() {
    if (warnedStorage) return; warnedStorage = true;
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);" +
      "background:#1A1613;color:#FBF7EF;padding:10px 16px;border-radius:10px;font:13px sans-serif;z-index:2000;box-shadow:0 8px 30px rgba(0,0,0,.25)";
    d.textContent = "Local saving is unavailable — edits stay in memory for this session only.";
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 5200);
  }

  function downloadJson() {
    var blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "content.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 800);
  }

  function resetDeck() {
    try { localStorage.removeItem(draftKey(deck.meta.deckId)); } catch (e) {}
    fetch("content.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (base) {
        deck = base;
        applyAccent(deck.meta.accentColor);
        $("deckTitle").value = deck.meta.title || "";
        selectSlide(0);
      })
      .catch(function () {
        showFetchHint();
        alert("Couldn't reload content.json. Open this deck through a local server to reset it.");
      });
  }

  /* ---------- load ---------- */
  function placeholderDeck() {
    return { meta: { deckId: "untitled", title: "Untitled deck", theme: "sierra", accentColor: "coral" },
             slides: [placeholderSlide("title")] };
  }
  function loadDeck() {
    return fetch("content.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { showFetchHint(); return placeholderDeck(); })
      .then(function (base) {
        if (!base.meta) base.meta = { deckId: "untitled" };
        if (!base.meta.accentColor) base.meta.accentColor = "coral";
        var draft = loadDraft(base.meta.deckId);
        return draft || base;
      });
  }

  function showFetchHint() {
    if ($("fetchHint")) return;
    var o = document.createElement("div");
    o.id = "fetchHint";
    o.style.cssText = "position:fixed;inset:0;z-index:3000;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(26,22,19,.55);backdrop-filter:blur(4px);font-family:sans-serif";
    o.innerHTML =
      '<div style="max-width:430px;background:#FFF;border-radius:16px;padding:26px 28px;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<h2 style="margin:0 0 10px;font-size:18px;color:#1A1613">Run from a local server</h2>' +
      '<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#4C463D">' +
      'Your browser blocked loading <b>content.json</b> from the file system. ' +
      'Start a tiny local server in this folder, then reload:</p>' +
      '<pre style="background:#F4F1E9;border:1px solid #E8E1D3;border-radius:9px;padding:11px 13px;font-size:13px;margin:0 0 14px;overflow:auto">python3 -m http.server 8000</pre>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#8A8275">Then open <b>http://localhost:8000</b>. A blank placeholder deck is loaded meanwhile.</p>' +
      '<button id="fetchHintClose" style="border:none;background:#1A1613;color:#FBF7EF;padding:9px 16px;border-radius:9px;font-size:13px;cursor:pointer">Got it</button>' +
      "</div>";
    document.body.appendChild(o);
    $("fetchHintClose").addEventListener("click", function () { o.remove(); });
  }

  /* ============================================================
     PRESENT MODE
     ============================================================ */
  function buildPresentDeck() {
    var d = $("presentDeck");
    d.innerHTML = "";
    deck.slides.forEach(function (s, i) {
      d.appendChild(renderSlide(s, i, "present"));
    });
    buildDots();
  }
  function buildDots() {
    var wrap = $("pDots");
    wrap.innerHTML = "";
    deck.slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.className = "p-dot"; b.type = "button";
      b.setAttribute("aria-label", "Go to slide " + (i + 1));
      b.addEventListener("click", function () { goTo(i); });
      wrap.appendChild(b);
    });
  }

  function enterPresent() {
    buildPresentDeck();
    document.body.classList.add("present-active");
    $("presentStage").setAttribute("aria-hidden", "false");
    $("presentUI").hidden = false;
    present.active = true; present.prev = null;
    var stage = $("presentStage");
    if (stage.requestFullscreen) { stage.requestFullscreen().catch(function () {}); }
    goTo(selected);
  }
  function exitPresent() {
    present.active = false;
    document.body.classList.remove("present-active");
    $("presentStage").setAttribute("aria-hidden", "true");
    $("presentUI").hidden = true;
    if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); }
    selectSlide(present.index);
  }

  function goTo(i) {
    var slides = $("presentDeck").children;
    if (i < 0 || i >= slides.length) return;
    var from = present.index;
    var k;
    for (k = 0; k < slides.length; k++) slides[k].classList.remove("is-active", "leaving-left");
    if (from !== null && from !== i && i > from && slides[from]) slides[from].classList.add("leaving-left");
    slides[i].classList.add("is-active");
    present.prev = from; present.index = i;
    runCounters(slides[i]);
    // UI
    $("pCounter").textContent = (i + 1) + " / " + slides.length;
    $("pBar").style.width = ((i + 1) / slides.length * 100) + "%";
    var dots = $("pDots").children;
    for (k = 0; k < dots.length; k++) dots[k].classList.toggle("on", k === i);
  }
  function next() { goTo(Math.min(present.index + 1, deck.slides.length - 1)); }
  function prev() { goTo(Math.max(present.index - 1, 0)); }

  function runCounters(slideEl) {
    var els = slideEl.querySelectorAll("[data-counter]");
    els.forEach(function (el) { animateCounter(el); });
  }
  function animateCounter(el) {
    var raw = el.getAttribute("data-value") || el.textContent;
    var m = raw.match(/-?\d[\d,]*\.?\d*/);
    if (!m || prefersReduced) { el.textContent = raw; return; }
    var numStr = m[0].replace(/,/g, "");
    var target = parseFloat(numStr);
    var decimals = (numStr.split(".")[1] || "").length;
    var pre = raw.slice(0, m.index), post = raw.slice(m.index + m[0].length);
    var dur = 900, start = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      p = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + (target * p).toFixed(decimals) + post;
      if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
    }
    requestAnimationFrame(tick);
  }

  /* cursor-responsive glow in present */
  function onPresentMove(e) {
    if (!present.active) return;
    var g = $("cursorGlow");
    g.style.left = e.clientX + "px";
    g.style.top = e.clientY + "px";
  }

  /* ============================================================
     PDF EXPORT  (html2canvas + jsPDF via CDN, on demand)
     ============================================================ */
  var H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  var JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement("script");
      sc.src = src; sc.onload = resolve;
      sc.onerror = function () { reject(new Error("load failed: " + src)); };
      document.head.appendChild(sc);
    });
  }

  function exportPdf() {
    var btn = $("exportPdfBtn");
    btn.disabled = true; var label = btn.textContent; btn.textContent = "Exporting…";

    var ready = Promise.resolve();
    if (!window.html2canvas) ready = ready.then(function () { return loadScript(H2C); });
    if (!(window.jspdf && window.jspdf.jsPDF)) ready = ready.then(function () { return loadScript(JSPDF); });

    ready.then(function () {
      return runPdf();
    }).then(function () {
      cleanupPdf(btn, label);
    }).catch(function (err) {
      cleanupPdf(btn, label);
      alert("PDF export needs cdnjs.cloudflare.com to be reachable.\n\n" +
        "Allow that domain (or self-host html2canvas + jsPDF) and try again.\n\n" + (err && err.message ? err.message : ""));
    });
  }

  function cleanupPdf(btn, label) {
    document.body.classList.remove("exportingPdf");
    var st = $("pdfStage"); if (st) st.remove();
    btn.disabled = false; btn.textContent = label;
  }

  function nextFrame() {
    return new Promise(function (r) {
      requestAnimationFrame(function () { requestAnimationFrame(r); });
    });
  }

  function runPdf() {
    document.body.classList.add("exportingPdf");
    var jsPDF = window.jspdf.jsPDF;
    var pdf = null;
    var stage = document.createElement("div");
    stage.id = "pdfStage";
    document.body.appendChild(stage);

    var idx = 0;
    function step() {
      if (idx >= deck.slides.length) {
        pdf.save("FlowPitch.pdf");
        return Promise.resolve();
      }
      stage.innerHTML = "";
      var frame = document.createElement("div");
      frame.className = "present-frame";
      var slide = renderSlide(deck.slides[idx], idx, "pdf");
      slide.classList.add("is-active");
      frame.appendChild(slide);
      stage.appendChild(frame);

      return nextFrame().then(function () {
        return window.html2canvas(stage, {
          backgroundColor: "#FAF8F3",
          scale: Math.max(window.devicePixelRatio || 1, 2),
          useCORS: true,
          width: 1920, height: 1080,
          windowWidth: 1920, windowHeight: 1080
        });
      }).then(function (canvas) {
        var img = canvas.toDataURL("image/png");
        if (!pdf) pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1920, 1080] });
        else pdf.addPage([1920, 1080], "landscape");
        pdf.addImage(img, "PNG", 0, 0, 1920, 1080);
        idx++;
        return step();
      });
    }
    return step();
  }

  /* ============================================================
     LAYOUT / EVENTS / INIT
     ============================================================ */
  function measure() {
    var h = $("topbar").offsetHeight || 60;
    document.documentElement.style.setProperty("--topOffset", h + "px");
  }

  function wireEvents() {
    $("presentBtn").addEventListener("click", enterPresent);
    $("exportPdfBtn").addEventListener("click", exportPdf);
    $("downloadJsonBtn").addEventListener("click", downloadJson);
    $("resetDeckBtn").addEventListener("click", function () {
      if (confirm("Reset to the original content.json? This clears your saved edits.")) resetDeck();
    });

    $("addSlide").addEventListener("click", addSlide);
    $("dupSlide").addEventListener("click", dupSlide);
    $("delSlide").addEventListener("click", delSlide);
    $("upSlide").addEventListener("click", function () { moveSlide(-1); });
    $("downSlide").addEventListener("click", function () { moveSlide(1); });

    $("typeSelect").addEventListener("change", function (e) { changeType(e.target.value); });
    $("noteField").addEventListener("input", function (e) {
      deck.slides[selected].note = e.target.value; scheduleSave(); refreshThumbs();
    });
    $("deckTitle").addEventListener("input", function (e) {
      deck.meta.title = e.target.value; scheduleSave();
    });

    $("pNext").addEventListener("click", next);
    $("pPrev").addEventListener("click", prev);
    $("pExit").addEventListener("click", exitPresent);
    $("presentStage").addEventListener("mousemove", onPresentMove);

    document.addEventListener("keydown", function (e) {
      if (!present.active) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") { exitPresent(); }
    });
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && present.active) { /* stay in present, just windowed */ }
    });

    window.addEventListener("resize", measure);
    wireEditing();
  }

  function init() {
    measure();
    buildSwatches();
    loadDeck().then(function (d) {
      deck = d;
      if (!deck.meta.title) deck.meta.title = "Untitled deck";
      applyAccent(deck.meta.accentColor);
      $("deckTitle").value = deck.meta.title;
      wireEvents();
      selectSlide(0);
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

})();
