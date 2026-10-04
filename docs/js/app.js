/* Electricity Network Planner: GUI for the CMPE 212 MST project.
 * Network editing, drawing, and a step-by-step replay of Kruskal's algorithm.
 * The algorithm itself lives in kruskal.js (a port of src/main.cpp). */
(function () {
  "use strict";
  const { kruskal, toNetworkTxt, fromNetworkTxt } = window.Kruskal;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STORE_KEY = "electricity-network-mst:v1";
  const W = 1000, H = 700;

  // ---------- Example networks ----------
  // City positions roughly follow the map of Pakistan, spread out for readability.
  const EXAMPLES = {
    report: {
      cities: [
        { name: "Lahore", x: 720, y: 300 },
        { name: "Karachi", x: 300, y: 610 },
        { name: "Islamabad", x: 560, y: 110 },
        { name: "Peshawar", x: 300, y: 140 },
      ],
      edges: [
        ["Lahore", "Karachi", 10], ["Lahore", "Islamabad", 6], ["Lahore", "Peshawar", 5],
        ["Karachi", "Islamabad", 15], ["Islamabad", "Peshawar", 4],
      ],
    },
    punjab: {
      cities: [
        { name: "Islamabad", x: 430, y: 80 }, { name: "Jhelum", x: 580, y: 190 },
        { name: "Sialkot", x: 910, y: 230 }, { name: "Gujranwala", x: 770, y: 320 },
        { name: "Sargodha", x: 320, y: 320 }, { name: "Lahore", x: 860, y: 460 },
        { name: "Faisalabad", x: 470, y: 450 }, { name: "Sahiwal", x: 590, y: 590 },
        { name: "Multan", x: 150, y: 545 }, { name: "Bahawalpur", x: 250, y: 640 },
      ],
      edges: [
        ["Islamabad", "Jhelum", 11], ["Islamabad", "Sargodha", 22], ["Jhelum", "Gujranwala", 13],
        ["Jhelum", "Sargodha", 17], ["Sialkot", "Gujranwala", 6], ["Gujranwala", "Lahore", 7],
        ["Sialkot", "Lahore", 12], ["Lahore", "Faisalabad", 18], ["Lahore", "Sahiwal", 17],
        ["Faisalabad", "Sargodha", 9], ["Faisalabad", "Gujranwala", 15], ["Faisalabad", "Sahiwal", 10],
        ["Faisalabad", "Multan", 23], ["Sahiwal", "Multan", 19], ["Multan", "Bahawalpur", 9],
        ["Sahiwal", "Bahawalpur", 21],
      ],
    },
    empty: { cities: [], edges: [] },
  };

  // ---------- State ----------
  let net = { cities: [], edges: [] };   // cities: {name,x,y}; edges: {city1,city2,cost}
  let run = null;                        // { result, cursor }
  let selected = [];                     // city names clicked for a new power line
  let playTimer = null;
  let animateStep = -1;                  // step index whose line should "energise" on next draw
  let activeTab = "build";

  const $ = (id) => document.getElementById(id);
  const els = {
    board: $("board"), edgesLayer: $("edges-layer"), nodesLayer: $("nodes-layer"),
    empty: $("board-empty"), readout: $("readout"),
    cityForm: $("city-form"), cityName: $("city-name"), cityMsg: $("city-msg"), cityList: $("city-list"),
    edgeForm: $("edge-form"), edgeA: $("edge-a"), edgeB: $("edge-b"), edgeCost: $("edge-cost"),
    edgeMsg: $("edge-msg"), edgeBody: document.querySelector("#edge-table tbody"),
    tabBuild: $("tab-build"), tabRun: $("tab-run"), paneBuild: $("pane-build"), paneRun: $("pane-run"),
    play: $("play-btn"), back: $("back-btn"), step: $("step-btn"), end: $("end-btn"), reset: $("reset-btn"),
    speed: $("speed"), narration: $("narration"), sorted: $("sorted-list"),
    ufBody: document.querySelector("#uf-table tbody"),
    example: $("example-select"), importBtn: $("import-btn"), importFile: $("import-file"), exportBtn: $("export-btn"),
  };

  // ---------- Persistence (best effort; the page works without it) ----------
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(net)); } catch (_) { /* storage unavailable */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.cities) || !Array.isArray(data.edges)) return false;
      net = data;
      return true;
    } catch (_) { return false; }
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    net = {
      cities: ex.cities.map((c) => ({ ...c })),
      edges: ex.edges.map(([city1, city2, cost]) => ({ city1, city2, cost })),
    };
    networkChanged();
  }

  // ---------- Helpers ----------
  const cityNames = () => net.cities.map((c) => c.name);
  const cityByName = (name) => net.cities.find((c) => c.name === name);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pairLabel = (e) => `${e.city1}–${e.city2}`;

  function freeSpot() {
    // Try random spots and keep the one furthest from existing cities
    let best = { x: W / 2, y: H / 2 }, bestD = -1;
    for (let i = 0; i < 80; i++) {
      const p = { x: 90 + Math.random() * (W - 180), y: 90 + Math.random() * (H - 200) };
      const d = net.cities.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.y - p.y)), Infinity);
      if (d > bestD) { bestD = d; best = p; }
    }
    return { x: Math.round(best.x), y: Math.round(best.y) };
  }

  function circleLayout(names, keep = {}) {
    const n = names.length, r = Math.min(W, H) * 0.36;
    return names.map((name, i) => keep[name] ? { name, ...keep[name] } : {
      name,
      x: Math.round(W / 2 + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2)),
      y: Math.round(H / 2 - 20 + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)),
    });
  }

  function networkChanged() {
    stopPlaying();
    run = null;
    selected = selected.filter((n) => cityByName(n));
    if (activeTab === "run") startRun();
    save();
    renderAll();
  }

  // ---------- Kruskal replay ----------
  function startRun() {
    run = { result: kruskal(cityNames(), net.edges), cursor: -1 };
  }

  function edgeStatus() {
    // Map each edge object to "built" | "skipped" | "current" | undefined for the current cursor
    const map = new Map();
    if (!run) return map;
    const { steps } = run.result;
    for (let i = 0; i <= run.cursor && i < steps.length; i++) {
      map.set(steps[i].edge, steps[i].status === "accepted" ? "built" : "skipped");
    }
    return map;
  }

  function parentAt(cursor) {
    if (!run) return [];
    if (cursor < 0) return cityNames().map((_, i) => i);
    return run.result.steps[cursor].parent;
  }
  function rootOf(parent, i) { while (parent[i] !== i) i = parent[i]; return i; }

  // ---------- Drawing the board ----------
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // On narrow screens the 1000-unit-wide board shrinks a lot, so scale up
  // labels and city markers to keep them readable.
  function boardScale() {
    const w = els.board.clientWidth || W;
    return Math.min(2.2, Math.max(1, 620 / w));
  }

  function renderBoard() {
    const k = boardScale();
    els.edgesLayer.textContent = "";
    els.nodesLayer.textContent = "";
    els.empty.hidden = net.cities.length > 0;

    const status = edgeStatus();
    const lastStep = run && run.cursor >= 0 ? run.result.steps[run.cursor] : null;
    const rank = { undefined: 0, skipped: 1, built: 2 };
    const ordered = net.edges.slice().sort((a, b) => rank[status.get(a)] - rank[status.get(b)]);

    for (const e of ordered) {
      const a = cityByName(e.city1), b = cityByName(e.city2);
      if (!a || !b) continue;
      const st = status.get(e);
      const cls = ["edge"];
      if (st === "built") cls.push("built");
      if (st === "skipped") cls.push("skipped");
      if (lastStep && lastStep.edge === e) cls.push("current");
      if (run && !st && run.cursor >= 0) cls.push("dim");
      const isFresh = lastStep && lastStep.edge === e && st === "built" && animateStep === run.cursor;
      if (isFresh) cls.push("energise");

      const g = svg("g", { class: cls.join(" ") }, els.edgesLayer);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      g.style.setProperty("--len", len.toFixed(1));
      svg("line", { class: "casing", x1: a.x, y1: a.y, x2: b.x, y2: b.y }, g);
      svg("line", { class: "wire", x1: a.x, y1: a.y, x2: b.x, y2: b.y }, g);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const w = (16 + String(e.cost).length * 9) * k, h = 24 * k;
      svg("rect", { class: "cost-bg", x: mx - w / 2, y: my - h / 2, width: w, height: h, rx: 3 }, g);
      const t = svg("text", { class: "cost-text", x: mx, y: my + 1, style: `font-size:${17 * k}px` }, g);
      t.textContent = e.cost;
      const title = svg("title", {}, g);
      title.textContent = `${pairLabel(e)}, cost ${e.cost}`;
    }
    animateStep = -1;

    // Cities touched by a built line are "powered"
    const powered = new Set();
    for (const [e, st] of status) if (st === "built") { powered.add(e.city1); powered.add(e.city2); }

    for (const c of net.cities) {
      const cls = ["node"];
      if (powered.has(c.name)) cls.push("powered");
      if (selected.includes(c.name)) cls.push("selected");
      const g = svg("g", { class: cls.join(" "), transform: `translate(${c.x} ${c.y})`, tabindex: 0, role: "button",
        "aria-label": `${c.name}. Press Enter to pick it for a new power line.` }, els.nodesLayer);
      g.dataset.name = c.name;
      svg("circle", { class: "halo", r: 26 * k }, g);
      svg("circle", { class: "dot", r: 14 * k }, g);
      svg("circle", { class: "core", r: 4 * k }, g);
      const label = svg("text", { class: "label", y: -24 * k, style: `font-size:${19 * k}px` }, g);
      label.textContent = c.name;
    }
  }

  function renderReadout() {
    if (!run || !net.cities.length) { els.readout.textContent = ""; return; }
    const { result, cursor } = run;
    const done = cursor >= result.steps.length - 1;
    const built = result.steps.slice(0, cursor + 1).filter((s) => s.status === "accepted");
    const cost = built.reduce((s, x) => s + x.edge.cost, 0);
    const need = Math.max(net.cities.length - 1, 0);
    let status = `${built.length} of ${need} lines built`;
    let warn = false;
    if (done && result.steps.length) {
      if (result.connected) status = `All ${net.cities.length} cities have power.`;
      else { status = `${result.components} separate groups. Some cities can't be reached.`; warn = true; }
    }
    els.readout.innerHTML =
      `<div class="total-label">${done ? "Minimum total cost" : "Cost so far"}</div>` +
      `<div class="total">${cost}</div>` +
      `<div class="status${warn ? " warn" : ""}">${esc(status)}</div>`;
  }

  // ---------- Build tab ----------
  function renderBuild() {
    els.cityList.textContent = "";
    net.cities.forEach((c, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="idx">${i}</span>${esc(c.name)}` +
        `<button type="button" class="x-btn" aria-label="Remove ${esc(c.name)}" data-remove-city="${esc(c.name)}">×</button>`;
      els.cityList.appendChild(li);
    });

    for (const sel of [els.edgeA, els.edgeB]) {
      const prev = sel.value;
      sel.innerHTML = net.cities.length
        ? net.cities.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("")
        : `<option value="">Add cities first</option>`;
      if (cityByName(prev)) sel.value = prev;
    }
    if (els.edgeA.value === els.edgeB.value && net.cities.length > 1) {
      els.edgeB.value = net.cities.find((c) => c.name !== els.edgeA.value).name;
    }

    els.edgeBody.textContent = "";
    net.edges.forEach((e, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(pairLabel(e))}</td><td class="num">${e.cost}</td>` +
        `<td><button type="button" class="x-btn" aria-label="Remove line ${esc(pairLabel(e))}" data-remove-edge="${i}">×</button></td>`;
      els.edgeBody.appendChild(tr);
    });
  }

  // ---------- Run tab ----------
  function renderRun() {
    if (!run) { els.sorted.textContent = ""; els.ufBody.textContent = ""; return; }
    const { result, cursor } = run;
    const steps = result.steps;
    const names = cityNames();
    const atEnd = cursor >= steps.length - 1;

    els.back.disabled = cursor < 0;
    els.step.disabled = atEnd;
    els.end.disabled = atEnd;
    els.play.textContent = playTimer ? "Pause" : atEnd && steps.length ? "Replay" : "Play";
    els.play.disabled = !steps.length;

    // Narration
    let html = "", tone = "";
    if (!net.cities.length) html = "Add some cities and power lines on the Build network tab first.";
    else if (!steps.length) html = "There are no power lines yet. Add at least one on the Build network tab.";
    else if (cursor < 0) {
      html = `Merge sort has put the ${steps.length} power line${steps.length > 1 ? "s" : ""} in order of cost, cheapest first. ` +
        `Every city starts as its own group (each one is its own parent). Press <b>Step</b> to check the cheapest line.`;
    } else {
      const s = steps[cursor];
      const nm = (i) => esc(names[i]);
      const path = (p) => p.length > 1 ? ` (${p.map(nm).join(" → ")})` : "";
      if (s.status === "accepted") {
        tone = "built";
        html = `<b>${esc(pairLabel(s.edge))}</b>, cost ${s.edge.cost}. ` +
          `Root of ${nm(s.a)} is ${nm(s.bossA)}${path(s.pathA)}; root of ${nm(s.b)} is ${nm(s.bossB)}${path(s.pathB)}. ` +
          `The roots are different, so this line is built and the groups merge: parent[${nm(s.bossB)}] = ${nm(s.bossA)}.`;
      } else if (s.status === "cycle") {
        tone = "skipped";
        html = s.a === s.b
          ? `<b>${esc(pairLabel(s.edge))}</b> starts and ends at the same city, so it is skipped.`
          : `<b>${esc(pairLabel(s.edge))}</b>, cost ${s.edge.cost}. Both cities already have root ${nm(s.bossA)}, so they are connected. ` +
            `Building this line would make a loop, so it is skipped.`;
      } else {
        tone = "skipped";
        html = `<b>${esc(pairLabel(s.edge))}</b> mentions a city that isn't in the list, so it is skipped.`;
      }
      if (atEnd) {
        const built = steps.filter((x) => x.status === "accepted").length;
        html += result.connected
          ? `<br><br>Done. ${built} line${built !== 1 ? "s" : ""} connect all ${names.length} cities for a total cost of <b>${result.totalCost}</b>. ` +
            `${steps.length - built} line${steps.length - built !== 1 ? "s were" : " was"} left out.`
          : `<br><br>Done, but the cities are still split into ${result.components} separate groups, so no single network reaches all of them. ` +
            `Add power lines between the groups and run again.`;
      }
    }
    els.narration.innerHTML = html;
    els.narration.className = "narration" + (tone ? " " + tone : "");

    // Sorted list
    els.sorted.textContent = "";
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      let tag = "";
      if (i <= cursor) {
        li.className = s.status === "accepted" ? "built" : "skipped";
        tag = s.status === "accepted" ? "Built" : "Skipped: loop";
        if (s.status === "missing") tag = "Skipped";
      }
      if (i === cursor) li.classList.add("current");
      li.innerHTML = `<span class="pair">${esc(pairLabel(s.edge))}</span><span class="num">${s.edge.cost}</span><span class="tag">${tag}</span>`;
      els.sorted.appendChild(li);
    });
    const cur = els.sorted.children[cursor];
    if (cur && window.matchMedia("(min-width: 901px)").matches) cur.scrollIntoView({ block: "nearest" });

    // Union-Find table
    const parent = parentAt(cursor);
    const prev = parentAt(cursor - 1);
    els.ufBody.textContent = "";
    names.forEach((n, i) => {
      const tr = document.createElement("tr");
      const changed = cursor >= 0 && parent[i] !== prev[i];
      if (parent[i] === i) tr.className = "root";
      tr.innerHTML = `<td class="num">${i}</td><td>${esc(n)}</td>` +
        `<td class="${changed ? "changed" : ""}">${parent[i]} (${esc(names[parent[i]])})</td>` +
        `<td>${esc(names[rootOf(parent, i)])}</td>`;
      els.ufBody.appendChild(tr);
    });
  }

  function renderAll() {
    renderBoard();
    renderReadout();
    renderBuild();
    renderRun();
  }

  // ---------- Player ----------
  const DELAYS = [1700, 1150, 800, 500, 280];
  function goTo(cursor, animate) {
    if (!run) return;
    run.cursor = Math.max(-1, Math.min(cursor, run.result.steps.length - 1));
    if (animate) animateStep = run.cursor;
    renderBoard(); renderReadout(); renderRun();
  }
  function stopPlaying() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }
  function togglePlay() {
    if (!run) startRun();
    if (playTimer) { stopPlaying(); renderRun(); return; }
    if (run.cursor >= run.result.steps.length - 1) run.cursor = -1;
    const tick = () => {
      if (run.cursor >= run.result.steps.length - 1) { stopPlaying(); renderRun(); return; }
      goTo(run.cursor + 1, true);
    };
    playTimer = setInterval(tick, DELAYS[els.speed.value - 1]);
    tick();
  }

  function showTab(name) {
    activeTab = name;
    const isRun = name === "run";
    els.tabBuild.setAttribute("aria-selected", String(!isRun));
    els.tabRun.setAttribute("aria-selected", String(isRun));
    els.tabBuild.tabIndex = isRun ? -1 : 0;
    els.tabRun.tabIndex = isRun ? 0 : -1;
    els.paneBuild.hidden = isRun;
    els.paneRun.hidden = !isRun;
    if (isRun) { if (!run) startRun(); }
    else { stopPlaying(); run = null; }
    renderAll();
  }

  // ---------- Events ----------
  function setMsg(el, text, ok) { el.textContent = text; el.classList.toggle("ok", !!ok); }

  els.cityForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = els.cityName.value.trim();
    if (!name) return setMsg(els.cityMsg, "Type a city name first.");
    if (/\s/.test(name)) return setMsg(els.cityMsg, "Use one word, e.g. Rahim_Yar_Khan. The C++ program reads names word by word, so network.txt can't hold spaces.");
    const dup = net.cities.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (dup) return setMsg(els.cityMsg, `${dup.name} has already been added.`);
    net.cities.push({ name, ...freeSpot() });
    els.cityName.value = "";
    setMsg(els.cityMsg, `${name} added.`, true);
    networkChanged();
  });

  els.edgeForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const city1 = els.edgeA.value, city2 = els.edgeB.value;
    const raw = els.edgeCost.value.trim();
    if (net.cities.length < 2) return setMsg(els.edgeMsg, "Add at least two cities first.");
    if (city1 === city2) return setMsg(els.edgeMsg, "Pick two different cities.");
    if (raw === "" || !/^-?\d+$/.test(raw)) return setMsg(els.edgeMsg, "Cost must be a whole number.");
    const cost = parseInt(raw, 10);
    if (cost < 0) return setMsg(els.edgeMsg, "Cost cannot be negative.");
    const dup = net.edges.find((e) => (e.city1 === city1 && e.city2 === city2) || (e.city1 === city2 && e.city2 === city1));
    if (dup) return setMsg(els.edgeMsg, `There is already a line between ${city1} and ${city2} (cost ${dup.cost}). Remove it first to change the cost.`);
    net.edges.push({ city1, city2, cost });
    els.edgeCost.value = "";
    selected = [];
    setMsg(els.edgeMsg, `Line ${city1}–${city2} added.`, true);
    networkChanged();
  });

  els.cityList.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-remove-city]");
    if (!btn) return;
    const name = btn.dataset.removeCity;
    const lines = net.edges.filter((e) => e.city1 === name || e.city2 === name).length;
    net.cities = net.cities.filter((c) => c.name !== name);
    net.edges = net.edges.filter((e) => e.city1 !== name && e.city2 !== name);
    setMsg(els.cityMsg, `${name} removed${lines ? ` with its ${lines} line${lines > 1 ? "s" : ""}` : ""}.`, true);
    networkChanged();
  });

  els.edgeBody.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-remove-edge]");
    if (!btn) return;
    const [e] = net.edges.splice(Number(btn.dataset.removeEdge), 1);
    setMsg(els.edgeMsg, `Line ${pairLabel(e)} removed.`, true);
    networkChanged();
  });

  els.tabBuild.addEventListener("click", () => showTab("build"));
  els.tabRun.addEventListener("click", () => showTab("run"));
  document.querySelector(".tabs").addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const next = activeTab === "build" ? "run" : "build";
    showTab(next);
    (next === "run" ? els.tabRun : els.tabBuild).focus();
  });

  els.play.addEventListener("click", togglePlay);
  els.step.addEventListener("click", () => { stopPlaying(); goTo(run.cursor + 1, true); });
  els.back.addEventListener("click", () => { stopPlaying(); goTo(run.cursor - 1, false); });
  els.end.addEventListener("click", () => { stopPlaying(); goTo(Infinity, false); });
  els.reset.addEventListener("click", () => { stopPlaying(); goTo(-1, false); });
  els.speed.addEventListener("input", () => { if (playTimer) { stopPlaying(); togglePlay(); } });

  els.example.addEventListener("change", () => {
    const key = els.example.value;
    if (key) loadExample(key);
    els.example.value = "";
  });

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([toNetworkTxt(cityNames(), net.edges)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "network.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    els.importFile.value = "";
    if (!file) return;
    showTab("build");
    try {
      const data = fromNetworkTxt(await file.text());
      const known = new Set(data.cities);
      const bad = data.edges.find((e) => !known.has(e.city1) || !known.has(e.city2));
      if (bad) throw new Error(`The line ${bad.city1} ${bad.city2} uses a city that isn't in the city list.`);
      const keep = {};
      for (const c of net.cities) keep[c.name] = { x: c.x, y: c.y };
      net = { cities: circleLayout(data.cities, keep), edges: data.edges };
      setMsg(els.cityMsg, `Imported ${data.cities.length} cities and ${data.edges.length} lines from ${file.name}.`, true);
      networkChanged();
    } catch (err) {
      setMsg(els.cityMsg, `Couldn't import ${file.name}. ${err.message}`);
    }
  });

  // Dragging and clicking cities on the board
  let drag = null;
  function toBoard(ev) {
    const pt = els.board.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(els.board.getScreenCTM().inverse());
  }
  els.nodesLayer.addEventListener("pointerdown", (ev) => {
    const g = ev.target.closest(".node");
    if (!g) return;
    const c = cityByName(g.dataset.name);
    const p = toBoard(ev);
    drag = { city: c, dx: c.x - p.x, dy: c.y - p.y, startX: ev.clientX, startY: ev.clientY, moved: false };
    els.board.setPointerCapture(ev.pointerId);
    g.classList.add("dragging");
  });
  els.board.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 5) return;
    drag.moved = true;
    const p = toBoard(ev);
    drag.city.x = Math.round(Math.max(30, Math.min(W - 30, p.x + drag.dx)));
    drag.city.y = Math.round(Math.max(40, Math.min(H - 20, p.y + drag.dy)));
    renderBoard();
  });
  els.board.addEventListener("pointerup", () => {
    if (!drag) return;
    const { city, moved } = drag;
    drag = null;
    if (moved) { save(); renderBoard(); }
    else pickCity(city.name);
  });
  els.board.addEventListener("pointercancel", () => { drag = null; renderBoard(); });
  els.nodesLayer.addEventListener("keydown", (ev) => {
    const g = ev.target.closest(".node");
    if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); pickCity(g.dataset.name); }
  });

  function pickCity(name) {
    if (selected.includes(name)) selected = selected.filter((n) => n !== name);
    else selected = [...selected, name].slice(-2);
    if (selected.length === 2) {
      if (activeTab !== "build") showTab("build");
      els.edgeA.value = selected[0];
      els.edgeB.value = selected[1];
      setMsg(els.edgeMsg, `Enter a cost for ${selected[0]}–${selected[1]}.`, true);
      renderBoard();
      els.edgeCost.focus();
      return;
    }
    if (selected.length === 1) setMsg(els.edgeMsg, `${name} picked. Click another city to connect it.`, true);
    renderBoard();
  }

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderBoard, 120); });

  // ---------- Start ----------
  if (!restore()) loadExample("punjab");
  renderAll();
})();
