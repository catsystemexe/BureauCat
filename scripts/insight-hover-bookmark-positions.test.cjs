const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

// This narrow harness executes the actual TSX components, listeners, fetch
// continuations and pointer handlers. Geometry/hooks/clocks are deterministic
// test doubles; this is not evidence of browser layout or React DOM integration.
function hookRenderer(componentPath, exportName, props, commit) {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const layouts = [];
  const renderer = { dirty: true, props, tree: null, disposed: false };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  function effect(queue, callback, deps) {
    const index = cursor++;
    const old = slots[index];
    if (!old || !same(old.deps, deps)) {
      const slot = { deps, cleanup: old?.cleanup };
      slots[index] = slot;
      queue.push(() => { slot.cleanup?.(); slot.cleanup = callback(); });
    }
  }
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: typeof initial === "function" ? initial() : initial };
        slot.set = (next) => {
          assert.ok(!renderer.disposed, "a disposed component received a stale state update");
          const value = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(value, slot.value)) { slot.value = value; renderer.dirty = true; }
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useMemo(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: callback() };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(callback, deps) { effect(effects, callback, deps); },
    useLayoutEffect(callback, deps) { effect(layouts, callback, deps); }
  };
  const filename = path.join(root, componentPath);
  const localRequire = createRequire(filename);
  const sourceCache = new Map();
  function requireLibrary(name) {
    if (!name.startsWith("@/lib/")) return localRequire(name);
    if (sourceCache.has(name)) return sourceCache.get(name).exports;
    const file = path.join(root, "src", `${name.slice(2)}.ts`);
    const dependency = { exports: {} };
    sourceCache.set(name, dependency);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(requireLibrary, dependency, dependency.exports);
    return dependency.exports;
  }
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(
    (name) => name === "react" ? react : name.startsWith("@/components/")
      ? new Proxy({}, { get: () => () => null }) : requireLibrary(name), module, module.exports
  );
  renderer.render = () => {
    if (!renderer.dirty) return;
    renderer.dirty = false;
    cursor = 0;
    renderer.tree = module.exports[exportName](renderer.props);
    commit?.(renderer.tree);
    for (const run of layouts.splice(0)) run();
    for (const run of effects.splice(0)) run();
  };
  renderer.update = (next) => { renderer.props = { ...renderer.props, ...next }; renderer.dirty = true; };
  renderer.dispose = () => {
    for (const slot of slots) slot?.cleanup?.();
    renderer.disposed = true;
  };
  return renderer;
}

function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  if (!tree || typeof tree !== "object" || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
const byClass = (tree, name) => elements(tree, (element) => element.props.className?.split(" ").includes(name));

function environment() {
  let time = 0, sequence = 0;
  const frames = new Map(), timers = new Map();
  const window = new EventTarget();
  window.requestAnimationFrame = (callback) => { frames.set(++sequence, callback); return sequence; };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.setTimeout = (callback, delay) => { timers.set(++sequence, { callback, at: time + delay }); return sequence; };
  window.clearTimeout = (id) => timers.delete(id);
  window.getComputedStyle = () => ({ lineHeight: "22px" });
  window.getSelection = () => ({ removeAllRanges() {} });
  const events = [];
  for (const name of ["scroll-to-source-range", "analysis-insight-hover", "analysis-insight-leave", "bookmark-pin-hover", "bookmark-pin-leave"]) {
    window.addEventListener(`bureaucat:${name}`, (event) => events.push({ name, detail: event.detail }));
  }
  const text = { nodes: [], scrollTop: 0, clientHeight: 120, onScroll() {}, measurable: true };
  text.getBoundingClientRect = () => ({ top: 100, left: 0, right: 500, width: 500, height: 120 });
  text.contains = (node) => text.nodes.includes(node);
  text.scrollTo = ({ top }) => { text.scrollTop = top; text.onScroll(); };
  const shell = { getBoundingClientRect: text.getBoundingClientRect };
  const document = {
    createTreeWalker: (element) => { let index = 0; return { nextNode: () => element.nodes[index++] ?? null }; },
    createRange() {
      let start = 0, end = 0;
      return {
        setStart(node, offset) { start = node.start + offset; },
        setEnd(node, offset) { end = node.start + offset; },
        selectNodeContents() { start = 0; },
        toString: () => text.nodes.map((node) => node.textContent).join("").slice(start, end),
        getBoundingClientRect: () => text.measurable
          ? { top: 100 + Math.floor(start / 20) * 22 - text.scrollTop, width: 1, height: 22 }
          : { top: 0, width: 0, height: 0 }
      };
    },
    caretPositionFromPoint: () => ({ offsetNode: text.nodes[0], offset: 120 })
  };
  const observers = new Set();
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() {}
    disconnect() { observers.delete(this); }
  }
  function commit(tree) {
    let start = 0;
    text.nodes = [];
    function collect(child) {
      if (typeof child === "string") { text.nodes.push({ textContent: child, start }); start += child.length; }
      else if (Array.isArray(child)) child.forEach(collect);
      else if (child?.props) collect(child.props.children);
    }
    const pre = byClass(tree, "document-extracted-text")[0];
    if (pre) { collect(pre.props.children); pre.props.ref.current = text; text.onScroll = pre.props.onScroll; }
    const wrapper = byClass(tree, "document-text-pin-shell")[0];
    if (wrapper) wrapper.props.ref.current = shell;
  }
  return {
    window, document, ResizeObserver, commit, text, events, frames, timers,
    resize() { for (const observer of observers) observer.callback(); },
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); },
    tick(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
    }
  };
}

module.exports = { hookRenderer, elements, byClass, environment };

if (require.main === module) test("actual insight/pin callbacks keep current positions without incidental writes", async (t) => {
  const env = environment();
  const globals = { window: env.window, document: env.document, ResizeObserver: env.ResizeObserver, NodeFilter: { SHOW_TEXT: 4 } };
  const previous = new Map(Object.keys(globals).concat("fetch").map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  const calls = [], requests = [], renderers = [];
  const source = (id) => ({ id, filename: `${id}.txt`, filetype: "txt", created_at: "2026-10-27T00:00:00Z", processed_text: "x".repeat(600) + "CITACE" + "x".repeat(394) });
  const pin = (id, documentId, offset) => ({ id, document_id: documentId, start_offset: offset, end_offset: offset + 3,
    visual_offset: null, selected_text: "xxx", color: "green", created_at: "2026-10-27T00:00:00Z" });
  const pins = [pin("p1", "A", 10), pin("p2", "A", 210), pin("p3", "A", 410)];
  const insights = pins.map((p, i) => ({ id: `i${i}`, document_id: "analysis-A", title: `Insight ${i}`, insight_type: "fact", status: "pending",
    source_document_id: "A", source_pin_id: p.id, source_start_offset: p.start_offset, source_end_offset: p.end_offset, source_text: "xxx" }));
  globalThis.fetch = (url, options = {}) => {
    calls.push({ url, options });
    // This suite keeps the source pin feed in legacy/manual mode to isolate
    // bookmark measurement/drag. The reference suite covers matched snapshots.
    if (url === "/api/documents/analysis-A/references") return Promise.resolve({ ok: true, json: async () => ({ insights,
      references: insights.map((insight, i) => ({ insightId: insight.id, insightTitle: insight.title, analysisDocumentId: "analysis-A", sourceDocumentId: "A", pinId: pins[i].id,
        number: i + 7, color: "green", startOffset: insight.source_start_offset, endOffset: insight.source_end_offset, quote: "xxx" })), issues: [] }) });
    if (url.endsWith("/pins") && !options.method) return new Promise((resolve) => requests.push({ url, resolve }));
    return Promise.resolve({ ok: true, json: async () => ({ annotations: [], insights, messages: [] }) });
  };
  const panel = hookRenderer("src/components/documents/DocumentViewPanel.tsx", "DocumentViewPanel", {
    document: source("A"), activeAnalysisInsights: [], selectedSituationId: "s1", onDocumentRemoved() {}
  }, env.commit);
  renderers.push(panel);
  const chat = hookRenderer("src/components/chat/ChatPanel.tsx", "ChatPanel", {
    caseItem: { id: "case", title: "Case" }, selectedSituationId: "s1",
    activeAnalysisDocument: { ...source("analysis-A"), parent_document_id: "A", processed_text: "Analysis" },
    onJournalRefreshRequested() {}, onActiveAnalysisInsightsChange: (active) => panel.update({ activeAnalysisInsights: active })
  });
  renderers.push(chat);
  async function settle() {
    for (let pass = 0; pass < 15; pass++) {
      renderers.filter((renderer) => !renderer.disposed).forEach((renderer) => renderer.render());
      await Promise.resolve(); await Promise.resolve();
      env.frame();
    }
    assert.ok(renderers.every((renderer) => !renderer.dirty || renderer.disposed), "render loop settled");
    assert.equal(env.frames.size, 0, "measurement frames settled");
  }
  function respond(request, values) { request.resolve({ ok: true, json: async () => ({ pins: values }) }); }
  const markers = () => byClass(panel.tree, "document-pin-marker");
  const tops = () => markers().map((marker) => Number.parseFloat(marker.props.style.top));
  function assertPositions() {
    assert.equal(markers().length, 3);
    assert.ok(markers().every((marker) => marker.props.style.visibility === "visible"));
    const values = tops();
    assert.ok(values.every(Number.isFinite), `measured positions: ${values}`);
    assert.equal(values[1] - values[0], 220, `separate first/second pin: ${values}`);
    assert.equal(values[2] - values[1], 220, `separate second/third pin: ${values}`);
  }
  const cards = () => byClass(chat.tree, "analysis-inline-insight");
  try {
    await settle();
    await t.test("first pin load is measured after commit without clicking", async () => {
      respond(requests.shift(), pins);
      await settle();
      assertPositions();
      assert.equal(byClass(chat.tree, "analysis-inline-insight-detail").length, 3);
    });

    await t.test("multiple expanded insights survive repeated hover/leave beyond 280ms with source scroll and highlights", async () => {
      for (let repeat = 0; repeat < 3; repeat++) for (let i = 0; i < 3; i++) {
        cards()[i].props.onMouseEnter();
        await settle();
        env.tick(281); await settle();
        assertPositions();
        assert.ok(byClass(panel.tree, "document-insight-range").length > 0, "source highlighting remains rendered");
        cards()[i].props.onMouseLeave(); await settle();
        assertPositions();
      }
      assert.equal(env.events.filter((event) => event.name === "scroll-to-source-range").length, 9);
      assert.ok(env.text.scrollTop > 0, "the source actually scrolled");
      assert.ok(calls.every((call) => !call.options.method), "hover and layout made no write requests");
    });

    await t.test("leaving before the delay and moving between insights cancels obsolete scrolls", async () => {
      const before = env.events.filter((event) => event.name === "scroll-to-source-range").length;
      cards()[0].props.onMouseEnter(); await settle();
      env.tick(100); cards()[0].props.onMouseLeave(); await settle();
      env.tick(300); await settle();
      assert.equal(env.events.filter((event) => event.name === "scroll-to-source-range").length, before);
      cards()[0].props.onMouseEnter(); await settle();
      env.tick(100); cards()[1].props.onMouseEnter(); await settle();
      env.tick(281); await settle();
      const scrolls = env.events.filter((event) => event.name === "scroll-to-source-range");
      assert.equal(scrolls.length, before + 1);
      assert.equal(scrolls.at(-1).detail.insightId, "i1");
      cards()[1].props.onMouseLeave(); await settle();
      assertPositions();
    });

    await t.test("scroll, resize and temporarily missing geometry recover automatically", async () => {
      const before = tops();
      env.text.scrollTop += 33; env.text.onScroll(); await settle();
      assert.deepEqual(tops(), before.map((value) => value - 33));
      env.text.measurable = false; env.resize(); await settle();
      assertPositions();
      env.text.measurable = true; env.resize(); await settle();
      assertPositions();
    });

    await t.test("refresh uses the newest pin response and post-commit offsets, without writes", async () => {
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      const older = requests.shift(), newer = requests.shift();
      const changed = pins.map((p) => ({ ...p, visual_offset: p.start_offset + 40 }));
      respond(newer, changed); await settle();
      const updated = tops();
      assertPositions();
      respond(older, pins); await settle();
      assert.deepEqual(tops(), updated, "an older refresh did not overwrite the new offsets");
      assert.ok(calls.every((call) => !call.options.method));
    });

    await t.test("context/all bookmark display and an unbookmarked source range are read-only", async () => {
      const analysis = chat.props.activeAnalysisDocument;
      chat.update({ activeAnalysisDocument: null }); await settle();
      panel.update({ activeAnalysisInsights: [], contextualPinIds: ["p1"] }); await settle();
      const scopeButtons = () => elements(byClass(panel.tree, "document-bookmark-scope")[0], (element) => element.type === "button");
      const buttonText = (button) => [button.props.children].flat().join("");
      scopeButtons().find((button) => buttonText(button) === "Kontextové").props.onClick(); await settle();
      assert.deepEqual(markers().map((marker) => marker.key), ["p1"]);
      scopeButtons().find((button) => buttonText(button) === "Všechny (3)").props.onClick(); await settle();
      assertPositions();
      panel.update({ targetPinId: "p1", targetSourceRange: { documentId: "A", startOffset: 410, endOffset: 413, quote: "xxx", token: 1 } }); await settle();
      assertPositions();
      assert.equal(env.text.scrollTop, 398, "the source passage wins over the bookmark's different visual offset");
      assert.ok(byClass(panel.tree, "selected-journal-source").length > 0, "the selected evidence passage is visible in the source text");
      assert.ok(calls.every((call) => !call.options.method), "scope and source navigation made no writes");
      panel.update({ activeAnalysisInsights: insights, targetSourceRange: null, targetPinId: null }); await settle();
      chat.update({ activeAnalysisDocument: analysis }); await settle();
    });

    await t.test("stale source ranges recover only a unique quote; missing or ambiguous quotes report an error without highlighting or writes", async () => {
      const analysis = chat.props.activeAnalysisDocument;
      chat.update({ activeAnalysisDocument: null }); await settle();
      panel.update({ activeAnalysisInsights: [] }); await settle();
      const beforePins = JSON.stringify(pins);
      const target = Object.freeze({ documentId: "A", startOffset: 10, endOffset: 16, quote: "CITACE", token: 2 });
      panel.update({ targetPinId: "p1", targetSourceRange: target }); await settle();
      assert.equal(env.text.scrollTop, 618, "scroll uses the unique quote at 600, not stale offsets at 10");
      assert.ok(byClass(panel.tree, "selected-journal-source").length > 0);
      const beforeScroll = env.text.scrollTop;
      for (const quote of ["missing", "xxx"]) {
        panel.update({ targetSourceRange: { ...target, startOffset: 600, endOffset: 603, quote, token: quote } }); await settle();
        assert.equal(env.text.scrollTop, beforeScroll, "invalid source navigation must not scroll to the wrong passage or pin");
        assert.equal(byClass(panel.tree, "selected-journal-source").length, 0);
        assert.match(byClass(panel.tree, "document-review-error")[0]?.props.children ?? "", /pasáž nelze.*jednoznačně určit/);
      }
      panel.update({ targetSourceRange: { ...target, startOffset: 600, endOffset: 606, token: 3 } }); await settle();
      assert.equal(byClass(panel.tree, "document-review-error").length, 0, "a subsequent valid source clears only the source navigation error");
      assert.ok(byClass(panel.tree, "selected-journal-source").length > 0);
      assert.equal(JSON.stringify(pins), beforePins);
      assert.equal(target.startOffset, 10); assert.equal(target.endOffset, 16);
      assert.ok(calls.every((call) => !call.options.method), "range recovery never persists corrected offsets");
      panel.update({ activeAnalysisInsights: insights, targetSourceRange: null, targetPinId: null }); await settle();
      chat.update({ activeAnalysisDocument: analysis }); await settle();
    });

    await t.test("measurement during actual pointer drag preserves its position; only pointer-up persists the move", async () => {
      const button = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
        getBoundingClientRect: () => ({ right: 20, left: 0, bottom: 100 }) };
      const event = { stopPropagation() {}, currentTarget: button, pointerId: 1, clientX: 56, clientY: 200 };
      markers()[0].props.onPointerDown(event); await settle();
      markers()[0].props.onPointerMove(event); await settle();
      const draggedTop = tops()[0];
      env.text.onScroll(); await settle();
      assert.equal(tops()[0], draggedTop, "measurement retained the actively dragged marker");
      assert.ok(calls.every((call) => !call.options.method));
      await markers()[0].props.onPointerUp(event); await settle();
      const writes = calls.filter((call) => call.options.method);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].url, "/api/document-pins/p1");
      assert.equal(writes[0].options.method, "PATCH");
      assert.deepEqual(JSON.parse(writes[0].options.body), { visual_offset: 120 });
    });

    await t.test("document/analysis switch cancels queued scrolls and rejects late old-document pin responses", async () => {
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      const oldRequest = requests.shift();
      cards()[2].props.onMouseEnter();
      env.window.dispatchEvent(new CustomEvent("bureaucat:scroll-to-source-range", {
        detail: { documentId: "A", startOffset: 400, endOffset: 403 }
      }));
      const before = env.events.filter((event) => event.name === "scroll-to-source-range").length;
      panel.update({ document: source("B"), activeAnalysisInsights: [] });
      chat.update({ activeAnalysisDocument: null });
      await settle();
      env.tick(350); await settle();
      assert.equal(env.events.filter((event) => event.name === "scroll-to-source-range").length, before);
      const newPins = [pin("b1", "B", 10), pin("b2", "B", 210), pin("b3", "B", 410)];
      respond(requests.shift(), newPins); await settle();
      assertPositions();
      const positions = tops();
      respond(oldRequest, pins); await settle();
      assert.deepEqual(markers().map((marker) => marker.key), ["b1", "b2", "b3"]);
      assert.deepEqual(tops(), positions);
    });

    await t.test("unmeasured bookmarks stay hidden and recover on the next valid layout without drag", async () => {
      env.text.measurable = false;
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      const pending = requests.shift();
      respond(pending, [pin("unmeasured", "B", 100)]); await settle();
      assert.equal(markers()[0].props.style.visibility, "hidden");
      env.text.measurable = true; env.resize(); await settle();
      assert.equal(markers()[0].props.style.visibility, "visible");
      assert.ok(Number.isFinite(Number.parseFloat(markers()[0].props.style.top)));
    });

    await t.test("unmount cancels hover/measurement work and ignores outstanding pin fetches", async () => {
      chat.update({ activeAnalysisDocument: { ...source("analysis-A"), parent_document_id: "A" } });
      await settle();
      cards()[0].props.onMouseEnter();
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      const pending = requests.shift();
      env.text.onScroll();
      renderers.forEach((renderer) => renderer.dispose());
      respond(pending, pins);
      env.tick(350); await Promise.resolve(); await Promise.resolve(); env.frame();
      assert.equal(env.frames.size, 0);
      assert.equal(env.timers.size, 0);
    });
  } finally {
    for (const renderer of renderers) if (!renderer.disposed) renderer.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
