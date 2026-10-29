const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { tmpdir } = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { PrismaClient } = require("@prisma/client");
const { hookRenderer, elements, byClass, environment } = require("./insight-hover-bookmark-positions.test.cjs");
const root = path.resolve(__dirname, "..");

function loader() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const external = createRequire(file);
    const requireSource = (name) => {
      if (!name.startsWith("@/")) return external(name);
      const base = path.join(root, "src", name.slice(2));
      return load(existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
    };
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(requireSource, module, module.exports);
    return module.exports;
  }
  return (name) => load(path.join(root, name));
}
const load = loader();
const { resolveAnalysisReferences, groupAnalysisReferences } = load("src/lib/analysis/references.ts");
const { classifyAnalysisInsight } = load("src/lib/analysis/presentation.ts");
const text = "Alpha beta gamma delta\n" + "x".repeat(700);
const document = (id) => ({ id, case_id: "case", filename: `${id}.txt`, filetype: "txt", created_at: "2026-10-29T00:00:00Z", processed_text: text });
const pin = (id, number, start, end) => ({ id, document_id: "A", case_bookmark_number: number, color: "green", start_offset: start, end_offset: end,
  selected_text: text.slice(start, end), visual_offset: null, created_at: "2026-10-29T00:00:00Z" });
function fixture() {
  const pins = [pin("p1", 7, 0, 5), pin("p2", 12, 6, 10), pin("p3", 22, 6, 16), pin("manual", 99, 17, 22)];
  const insights = pins.slice(0, 3).map((p, i) => ({ id: `i${i}`, document_id: "analysis-A", source_document_id: "A", source_pin_id: p.id,
    title: `Poznatek ${i}`, content: `Uložené sdělení ${i}`, insight_type: "fact", status: "pending", source_text: p.selected_text,
    source_start_offset: p.start_offset, source_end_offset: p.end_offset }));
  insights.push({ ...insights[1], id: "shared", title: "Druhý poznatek téže pasáže" });
  return { pins, insights, documents: [{ id: "A", text }] };
}

test("reference validation distinguishes links, numbering, overlap, shared passages and missing evidence", async (t) => {
  const f = fixture(); const before = JSON.stringify(f);
  await t.test("actual pin numbers survive same-line, same-start and overlapping passages without renumbering", () => {
    const result = resolveAnalysisReferences(f.insights, f.pins, f.documents);
    assert.deepEqual(result.references.map((r) => r.number), [7, 12, 22, 12]); assert.deepEqual(result.issues, []);
    const groups = groupAnalysisReferences(result.references);
    assert.deepEqual(groups.map((g) => [g.pinId, g.startOffset]), [["p1", 0], ["p2", 6], ["p3", 6]]);
    assert.equal(groups[1].references.length, 2, "only a real shared pin and passage shares an index");
    assert.equal(groupAnalysisReferences(result.references.filter((r) => r.pinId !== "p1"))[0].number, 12);
  });
  await t.test("duplicate stored numbers on different pins are diagnosed, never merged or reassigned", () => {
    const pins = f.pins.map((p) => ({ ...p, case_bookmark_number: p.id === "p3" ? 7 : p.case_bookmark_number }));
    const result = resolveAnalysisReferences(f.insights, pins, f.documents);
    assert.ok(result.issues.some((issue) => issue.code === "duplicate-number"));
    assert.ok(result.references.every((r) => r.number !== 7));
  });
  await t.test("identical words at distinct offsets stay distinct; sharing a pin cannot hide a different occurrence", () => {
    const repeatedText = "Alpha Alpha";
    const pins = [pin("first", 7, 0, 5), { ...pin("second", 12, 6, 11), selected_text: "Alpha" }];
    const insights = pins.map((p, index) => ({ ...f.insights[0], id: `repeat-${index}`, source_pin_id: p.id,
      source_start_offset: p.start_offset, source_end_offset: p.end_offset }));
    const result = resolveAnalysisReferences(insights, pins, [{ id: "A", text: repeatedText }]);
    assert.deepEqual(result.references.map((reference) => [reference.number, reference.startOffset]), [[7, 0], [12, 6]]);
    const mismatched = resolveAnalysisReferences([{ ...insights[1], source_pin_id: "first" }], pins, [{ id: "A", text: repeatedText }]);
    assert.equal(mismatched.references.length, 0); assert.equal(mismatched.issues[0].code, "passage-mismatch");
  });
  await t.test("wrong pin/document/passage, missing pin, missing number and unresolvable quotes have no invented index", () => {
    for (const [change, code] of [
      [{ source_pin_id: "missing" }, "missing-pin"], [{ source_document_id: "B" }, "document-mismatch"],
      [{ source_pin_id: "p2" }, "passage-mismatch"], [{ source_text: "not present" }, "unresolved-range"]
    ]) {
      const result = resolveAnalysisReferences([{ ...f.insights[0], ...change }], f.pins, f.documents);
      assert.equal(result.references.length, 0); assert.equal(result.issues[0].code, code);
    }
    assert.equal(resolveAnalysisReferences(f.insights, f.pins.map((p) => ({ ...p, case_bookmark_number: null })), f.documents).references.length, 0);
    const recovered = resolveAnalysisReferences([{ ...f.insights[0], source_start_offset: 100, source_end_offset: 105 }], f.pins, f.documents);
    assert.equal(recovered.references[0].startOffset, 0, "a unique exact quote recovers display only");
    assert.equal(JSON.stringify(f), before);
  });
});

test("derived categories preserve role, attachment/date and deadline/risk distinctions", () => {
  const classify = (title, content, insight_type = "fact") => classifyAnalysisInsight({ title, content, insight_type, source_text: null });
  assert.equal(classify("Odesílatel", "Úřad", "identifier").role, "Odesílatel");
  assert.equal(classify("Adresát", "Jan Novák", "identifier").role, "Adresát");
  assert.equal(classify("Odesílatel a adresát", "Neurčené role", "identifier").role, "Další identifikační údaje");
  assert.equal(classify("E-mail", "a@example.test", "identifier").role, "Kontakty");
  assert.equal(classify("Spisová značka", "SP/1", "identifier").role, "Spisová značka");
  assert.equal(classify("Datum přiloženého náčrtu", "25. srpna 2026", "identifier").category, "Podklady a přílohy");
  assert.equal(classify("Souhlas vlastníka", "Přiložen.").category, "Podklady a přílohy");
  assert.equal(classify("Co dokument obsahuje", "V příloze je náčrt z 25. srpna 2026.").category, "Podklady a přílohy");
  assert.equal(classify("Souhlas vlastníka", "Doložte jej nejpozději do 11. září.").time, "Termín reakce");
  assert.equal(classify("Chybějící souhlas", "Hrozí zastavení řízení.", "risk").category, "Rizika a rozpory");
  assert.equal(classify("Datum podání", "28. srpna 2026", "identifier").time, "Podání");
  assert.equal(classify("Datum doručení", "29. srpna 2026", "term").time, "Doručení");
  assert.equal(classify("Datum vyhotovení", "25. srpna 2026", "risk").time, "Vyhotovení");
  assert.equal(classify("Lhůta dodání podkladů k jednání", "Doplňte do 11. září.", "term").time, "Termín reakce");
  assert.equal(classify("Termín jednání", "15. září 2026", "term").time, "Plánovaná událost");
  assert.equal(classify("Nedodržení lhůty", "Hrozí zastavení řízení.", "risk").category, "Rizika a rozpory");
  assert.equal(classify("Neurčené datum", "11. září 2026", "risk").category, "Data, lhůty a události");
  assert.equal(classify("Kapacita", "Do 10 osob.", "term").category, "Klíčové skutečnosti");
  assert.equal(classify("Chybějící souhlas", "Kdo jej dodá?", "question").category, "Otázky");
});

test("actual panel callbacks keep references distinct and source text clean (controlled geometry, not browser acceptance)", async (t) => {
  const env = environment();
  const globals = { window: env.window, document: env.document, ResizeObserver: env.ResizeObserver, NodeFilter: { SHOW_TEXT: 4 } };
  const previous = new Map([...Object.keys(globals), "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  const f = fixture(); let before = JSON.stringify(f); const calls = [], events = [], renderers = [], pendingReferences = [];
  let enableReferences = false, deferReferences = false, sequence = 0;
  const source = document("A"), analysis = { ...document("analysis-A"), document_type: "analysis", parent_document_id: "A" };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/references") && deferReferences) return new Promise((resolve) => pendingReferences.push({ url, resolve }));
    if (url.endsWith("/pins")) {
      if (options.method === "POST") return { ok: true, json: async () => ({ pin: { ...f.pins[3], id: "selected" } }) };
      return { ok: true, json: async () => ({ pins: f.pins }) };
    }
    if (url.endsWith("/references")) return { ok: true, json: async () => ({ insights: f.insights,
      ...(enableReferences ? resolveAnalysisReferences(f.insights, f.pins, f.documents) : { references: [], issues: [] }) }) };
    return { ok: true, json: async () => ({ insights: [], annotations: [
      { id: "highlight", annotation_type: "highlight", highlight_color: "yellow", start_offset: 6, end_offset: 10, selected_text: "beta" },
      { id: "note", annotation_type: "note", highlight_color: "yellow", start_offset: 0, end_offset: 5, selected_text: "Alpha", note_text: "Uložená anotace" }
    ], messages: [] }) };
  };
  env.window.addEventListener("bureaucat:open-analysis-reference", (event) => events.push(event.detail));
  const panel = hookRenderer("src/components/documents/DocumentViewPanel.tsx", "DocumentViewPanel", {
    document: source, activeAnalysisInsights: [], selectedSituationId: "s1", onDocumentRemoved() {}
  }, env.commit); renderers.push(panel);
  const focusLog = [];
  const chat = hookRenderer("src/components/chat/ChatPanel.tsx", "ChatPanel", {
    caseItem: { id: "case", title: "Case" }, selectedSituationId: "s1", activeAnalysisDocument: analysis,
    onJournalRefreshRequested() {}, onActiveAnalysisInsightsChange: (active) => panel.update({ activeAnalysisInsights: active }),
    onOpenAnalysisSourceReference: async (reference) => {
      panel.update({ targetPinId: reference.pinId, targetSourceRange: { documentId: reference.sourceDocumentId,
        startOffset: reference.startOffset, endOffset: reference.endOffset, quote: reference.quote, token: ++sequence } });
      return true;
    }
  }, (tree) => {
    const content = byClass(tree, "analysis-floating-content")[0];
    if (content) content.props.ref.current = { querySelectorAll: () => elements(tree, (element) => element.props["data-insight-id"]).map((element) => ({
      dataset: { insightId: element.props["data-insight-id"] }, scrollIntoView() { focusLog.push(this.dataset.insightId); }, querySelector: () => ({ focus() {} })
    })) };
  }); renderers.push(chat);
  async function settle() {
    for (let pass = 0; pass < 20; pass++) { for (const renderer of renderers) if (!renderer.disposed) renderer.render(); await Promise.resolve(); await Promise.resolve(); env.frame(); }
    assert.ok(renderers.every((renderer) => !renderer.dirty || renderer.disposed), "panel updates settled");
  }
  const indices = () => byClass(panel.tree, "document-analysis-reference");
  const numbers = (tree) => byClass(tree, "analysis-reference-index").map((element) => element.props["data-reference-number"]);
  try {
    await settle();
    await t.test("legacy sidebar geometry reproduces same-line overlap with correct distinct data links", () => {
      const marks = byClass(panel.tree, "document-pin-marker").slice(0, 3);
      assert.equal(marks.length, 3); assert.equal(new Set(marks.map((mark) => mark.props.style.top)).size, 1);
      assert.equal(new Set(f.insights.slice(0, 3).map((insight) => insight.source_pin_id)).size, 3);
    });
    // Prepare a persisted visual drag away from the evidence before enabling
    // reference presentation; subsequent presentation must leave it untouched.
    f.pins[0].visual_offset = 500; before = JSON.stringify(f);
    enableReferences = true; env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh")); await settle();
    await t.test("both panels use real case numbers; all inline indices remain separate, with no competing analytical sidebar", () => {
      assert.deepEqual(numbers(panel.tree), [7, 12, 22]); assert.deepEqual(numbers(chat.tree), [7, 12, 22, 12]);
      assert.deepEqual(byClass(panel.tree, "document-pin-marker").map((mark) => mark.key), ["manual"]);
      assert.equal(indices()[1].props["data-pin-id"], "p2"); assert.equal(indices()[2].props["data-pin-id"], "p3");
      assert.ok(indices().every((index) => index.props.children === undefined), "visible numbers are CSS annotations, not source text nodes");
      assert.ok(byClass(panel.tree, "document-inline-highlight").length > 0, "stored text highlights remain available alongside indices");
      assert.equal(byClass(panel.tree, "document-note-marker")[0].props["data-note-number"], 1);
      assert.equal(env.text.nodes.map((node) => node.textContent).join(""), text, "DOM text/copy model retains the source exactly");
    });
    await t.test("hover/focus link panels; shared-source click offers each insight; verified navigation ignores visual drag offsets", async () => {
      for (const card of byClass(chat.tree, "analysis-inline-insight")) card.props.onClick(); await settle();
      assert.equal(byClass(chat.tree, "analysis-inline-insight-bookmark-hover").length, 0);
      indices()[1].props.onFocus(); await settle();
      assert.equal(byClass(chat.tree, "analysis-reference-matched").length, 2);
      assert.ok(byClass(panel.tree, "document-reference-range-focused").length > 0);
      assert.deepEqual(byClass(chat.tree, "analysis-inline-insight-bookmark-hover").map((card) => card.props.title), ["Poznatek 1", "Druhý poznatek téže pasáže"]);
      indices()[1].props.onBlur(); await settle();
      indices()[1].props.onClick({ stopPropagation() {} }); await settle();
      const chooser = byClass(panel.tree, "analysis-reference-choice")[0];
      const choices = elements(chooser, (element) => element.type === "button"); assert.equal(choices.length, 3);
      choices[1].props.onClick(); await settle(); assert.equal(events.at(-1).insightId, "shared");
      chat.update({ targetAnalysisInsight: { analysisDocumentId: "analysis-A", insightId: "shared", token: 1 } }); await settle();
      assert.equal(focusLog.at(-1), "shared");
      const first = byClass(chat.tree, "analysis-reference-index")[0]; first.props.onFocus(); await settle();
      assert.ok(indices()[0].props.className.includes("is-highlighted")); first.props.onBlur(); await settle();
      await first.props.onClick(); await settle();
      assert.equal(panel.props.targetSourceRange.startOffset, 0); assert.equal(panel.props.targetSourceRange.quote, "Alpha");
      env.text.scrollTop += 25; env.text.onScroll(); env.resize(); await settle(); assert.equal(indices().length, 3);
      assert.ok(calls.every((call) => !call.options.method));
    });
    await t.test("late reference refresh responses cannot overwrite a newer snapshot", async () => {
      deferReferences = true;
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh"));
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh")); await settle();
      const snapshot = { insights: f.insights, ...resolveAnalysisReferences(f.insights, f.pins, f.documents) };
      for (const url of ["/api/documents/A/references", "/api/documents/analysis-A/references"]) {
        const requests = pendingReferences.filter((request) => request.url === url); assert.equal(requests.length, 2);
        requests[1].resolve({ ok: true, json: async () => snapshot }); await settle();
        requests[0].resolve({ ok: true, json: async () => ({ insights: [], references: [], issues: [] }) }); await settle();
      }
      pendingReferences.length = 0; deferReferences = false;
      assert.deepEqual(numbers(panel.tree), [7, 12, 22]); assert.deepEqual(numbers(chat.tree), [7, 12, 22, 12]);
    });
    await t.test("selection offsets and plain-text copy exclude indices; manual bookmark drag still persists only an explicit move", async () => {
      assert.equal(env.text.nodes.map((node) => node.textContent).join(""), text);
      panel.update({ isBookmarkLinkMode: true }); await settle();
      const betaNode = env.text.nodes.find((node) => node.start === 6);
      assert.ok(betaNode);
      env.window.getSelection = () => ({ rangeCount: 1, isCollapsed: false, toString: () => "beta", removeAllRanges() {},
        getRangeAt: () => ({ commonAncestorContainer: betaNode, startContainer: betaNode, startOffset: 0, getBoundingClientRect: () => ({ left: 0, top: 100 }) }) });
      const copied = []; let prevented = false;
      byClass(panel.tree, "document-extracted-text")[0].props.onCopy({ clipboardData: { setData: (type, value) => copied.push([type, value]) }, preventDefault() { prevented = true; } });
      assert.deepEqual(copied, [["text/plain", "beta"]]); assert.equal(prevented, true, "native copy receives only selected source text");
      byClass(panel.tree, "document-extracted-text")[0].props.onMouseUp(); env.tick(0); await settle();
      const created = calls.find((call) => call.options.method === "POST");
      assert.deepEqual(JSON.parse(created.options.body), { selected_text: "beta", start_offset: 6, end_offset: 10, color: "red", note_text: "" });
      panel.update({ isBookmarkLinkMode: false }); await settle();
      const marker = byClass(panel.tree, "document-pin-marker").find((element) => element.key === "manual");
      const button = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, getBoundingClientRect: () => ({ right: 20, left: 0, bottom: 100 }) };
      const event = { stopPropagation() {}, currentTarget: button, pointerId: 1, clientX: 56, clientY: 200 };
      marker.props.onPointerDown(event); await settle(); marker.props.onPointerMove(event); await settle();
      await byClass(panel.tree, "document-pin-marker").find((element) => element.key === "manual").props.onPointerUp(event); await settle();
      const drag = calls.find((call) => call.options.method === "PATCH"); assert.equal(drag.url, "/api/document-pins/manual");
      assert.deepEqual(JSON.parse(drag.options.body), { visual_offset: 120 });
      assert.equal(JSON.stringify(f), before, "source fixture and persisted pin offsets were never rewritten by presentation");
    });
    await t.test("switching documents removes old indices and cancels queued source hover work", async () => {
      deferReferences = true;
      env.window.dispatchEvent(new Event("bureaucat:document-pins-refresh")); await settle();
      const old = pendingReferences.splice(0);
      const card = byClass(chat.tree, "analysis-inline-insight")[0]; card.props.onMouseEnter();
      panel.update({ document: { ...document("B"), processed_text: "Different document" }, activeAnalysisInsights: [] });
      chat.update({ activeAnalysisDocument: null }); await settle(); env.tick(350); await settle();
      for (const request of old) request.resolve({ ok: true, json: async () => ({ insights: f.insights, ...resolveAnalysisReferences(f.insights, f.pins, f.documents) }) });
      await settle();
      assert.equal(indices().length, 0); assert.equal(numbers(chat.tree).length, 0);
      assert.equal(env.text.nodes.map((node) => node.textContent).join(""), "Different document");
    });
  } finally {
    for (const renderer of renderers) renderer.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test("workspace reference clicks open the right panels and reject late navigation after a Situation switch", async () => {
  const env = environment(), previous = new Map(["window", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = env.window;
  const reference = resolveAnalysisReferences(fixture().insights, fixture().pins, fixture().documents).references[0];
  const calls = [], pending = []; let deferred = false;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (deferred) return new Promise((resolve) => pending.push(resolve));
    const id = url.split("/").at(-1);
    return { ok: true, json: async () => ({ document: { ...document(id), document_type: id.startsWith("analysis") ? "analysis" : "source" } }) };
  };
  const workspace = hookRenderer("src/components/ThreePanelWorkspace.tsx", "ThreePanelWorkspace", { caseItem: { id: "case", title: "Reference test", icon: "folder", icon_color: "blue" } });
  const step = () => elements(workspace.tree, (element) => typeof element.props.onOpenAnalysisSourceReference === "function")[0].props;
  const right = () => elements(workspace.tree, (element) => element.type?.name === "RightContextPanel")[0].props;
  async function settle() { for (let i = 0; i < 15; i++) { workspace.render(); await Promise.resolve(); await Promise.resolve(); env.frame(); } }
  try {
    await settle(); step().onSelectSituation("s1"); await settle();
    assert.equal(await step().onOpenAnalysisSourceReference(reference), true); await settle();
    assert.equal(right().selectedDocument.id, "A");
    assert.equal(right().targetSourceRange.startOffset, 0); assert.equal(right().targetSourceRange.quote, "Alpha");
    env.window.dispatchEvent(new CustomEvent("bureaucat:open-analysis-reference", { detail: reference })); await settle();
    assert.equal(step().activeAnalysisDocument.id, "analysis-A");
    assert.equal(step().targetAnalysisInsight.insightId, "i0"); assert.equal(step().selectedStepKey, "ANALYSIS");
    deferred = true;
    env.window.dispatchEvent(new CustomEvent("bureaucat:open-analysis-reference", { detail: { ...reference, analysisDocumentId: "analysis-B" } }));
    step().onSelectSituation("s2"); await settle();
    pending.shift()({ ok: true, json: async () => ({ document: { ...document("analysis-B"), document_type: "analysis" } }) }); await settle();
    assert.notEqual(step().activeAnalysisDocument?.id, "analysis-B"); assert.equal(step().targetAnalysisInsight, null);
    assert.ok(calls.every((call) => !call.options.method), "reference navigation performs GET only");
  } finally {
    workspace.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test("reference GETs are read-only, case-scoped and consistent for source and analysis on disposable SQLite", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bureaucat-references-"));
  const file = path.join(directory, "test.sqlite"); writeFileSync(file, "");
  const datasourceUrl = `file:${file.replaceAll("\\", "/")}`;
  const prisma = new PrismaClient({ datasourceUrl, log: [{ emit: "event", level: "query" }] });
  const queries = []; prisma.$on("query", ({ query }) => queries.push(query));
  const previous = globalThis.prisma;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: datasourceUrl }, stdio: "pipe" });
      let output = ""; child.stdout.on("data", (data) => output += data); child.stderr.on("data", (data) => output += data);
      child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Temporary migration exit ${code}: ${output}`)));
    });
    globalThis.prisma = prisma;
    const load = loader(), { createCase } = load("src/lib/services/cases.ts");
    const { GET } = load("src/app/api/documents/[documentId]/references/route.ts");
    const caseItem = await createCase({ title: "Reference fixture" });
    const source = await prisma.document.create({ data: { case_id: caseItem.id, filename: "source.txt", filetype: "txt", original_file: "", processed_text: text } });
    const analysis = await prisma.document.create({ data: { case_id: caseItem.id, filename: "analysis.md", filetype: "md", original_file: "", document_type: "analysis", parent_document_id: source.id } });
    const pin = await prisma.documentPin.create({ data: { document_id: source.id, case_bookmark_number: 7, start_offset: 0, end_offset: 5, selected_text: "Alpha" } });
    await prisma.documentInsight.create({ data: { document_id: analysis.id, source_document_id: source.id, source_pin_id: pin.id, insight_type: "fact", target_section: "description", target_item_type: "FACT", title: "Alpha", source_text: "Alpha", source_start_offset: 0, source_end_offset: 5 } });
    const otherCase = await createCase({ title: "Other case" });
    const other = await prisma.document.create({ data: { case_id: otherCase.id, filename: "other", filetype: "txt", original_file: "" } });
    await prisma.documentPin.create({ data: { document_id: other.id, case_bookmark_number: 7, start_offset: 0, end_offset: 1, selected_text: "x" } });
    const snapshot = () => Promise.all(["document", "documentPin", "documentInsight", "journalItem", "workflowStep"].map((model) => prisma[model].findMany({ orderBy: { id: "asc" } })));
    const before = await snapshot(); queries.length = 0;
    const read = async (id) => { const response = await GET(new Request("http://localhost/references"), { params: Promise.resolve({ documentId: id }) }); assert.equal(response.status, 200); return response.json(); };
    const a = await read(analysis.id), b = await read(source.id);
    assert.deepEqual(a.references, b.references); assert.equal(a.references[0].number, 7); assert.deepEqual(a.issues, []);
    assert.ok(!queries.some((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i.test(query)));
    assert.deepEqual(await snapshot(), before);
    await prisma.documentPin.create({ data: { document_id: source.id, case_bookmark_number: 7, start_offset: 6, end_offset: 10, selected_text: "beta" } });
    const duplicateBefore = await snapshot(); queries.length = 0;
    const duplicate = await read(analysis.id);
    assert.equal(duplicate.references.length, 0); assert.equal(duplicate.issues[0].code, "duplicate-number");
    assert.ok(!queries.some((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(query)));
    assert.deepEqual(await snapshot(), duplicateBefore, "duplicate numbers are diagnosed without an automatic repair");
    const auditSql = readFileSync(path.join(root, "docs/analysis-document-reference-audit.sql"), "utf8");
    for (const statement of auditSql.replace(/^--.*$/gm, "").split(";").map((sql) => sql.trim()).filter(Boolean)) {
      assert.match(statement, /^SELECT\b/);
      const rows = await prisma.$queryRawUnsafe(statement.replaceAll("@analysis_document_id", "?"), analysis.id);
      assert.ok(Array.isArray(rows));
    }
    assert.deepEqual(await snapshot(), duplicateBefore, "the published read-only audit leaves stored records unchanged");
  } finally { globalThis.prisma = previous; await prisma.$disconnect(); rmSync(directory, { recursive: true, force: true }); }
});
