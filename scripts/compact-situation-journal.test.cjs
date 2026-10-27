const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { tmpdir } = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { PrismaClient } = require("@prisma/client");
const root = path.resolve(__dirname, "..");

function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }
    });
    const localRequire = createRequire(filename);
    const requireSource = (name) => {
      if (name in overrides) return overrides[name];
      if (!name.startsWith("@/")) return localRequire(name);
      const base = path.join(root, "src", name.slice(2));
      return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
    };
    vm.runInThisContext(`(function(exports,require,module){${outputText}\n})`, { filename })(module.exports, requireSource, module);
    return module.exports;
  }
  return (name) => load(path.join(root, name));
}

const load = sourceLoader();
const { buildJournalOverview, contextualJournalPinIds, resolveSourceRange } = load("src/lib/journal/overview.ts");
const timestamp = "2026-10-27T00:00:00.000Z";
function sample(id, title, value, type, documentId, quote = value) {
  const insight = { id: `insight-${id}`, document_id: `analysis-${documentId}`, source_document_id: documentId,
    source_pin_id: `pin-${id}`, journal_item_id: id, title, content: value, source_text: quote,
    source_start_offset: 10, source_end_offset: 10 + quote.length, insight_type: type };
  const item = { id, case_id: "case", situation_id: "s1", title, value,
    explanation: quote, item_type: type === "term" || type === "risk" ? "RISK" : type === "identifier" ? "CLAIM" : "FACT",
    section: "description", evidence_state: "inferred", status: "active", display_order: 0,
    source_links_json: JSON.stringify([{ type: "bookmark", documentId, pinId: insight.source_pin_id, insightId: insight.id }]),
    created_at: timestamp, updated_at: timestamp };
  const pin = { id: insight.source_pin_id, document_id: documentId, selected_text: quote, start_offset: 10, end_offset: 10 + quote.length };
  return { item, insight, pin };
}
function fixture(samples) {
  return { items: samples.map((s) => s.item), evidence: {
    documents: [...new Set(samples.map((s) => s.insight.source_document_id))].map((id) => ({ id, filename: `${id}.txt`, display_name: null })),
    insights: samples.map((s) => s.insight), pins: samples.map((s) => s.pin)
  } };
}
function freeze(value) { Object.freeze(value); for (const entry of Object.values(value)) if (entry && typeof entry === "object") freeze(entry); return value; }

test("compact derived Journal content, identity, variants, sources and time", async (t) => {
  await t.test("P0: a concrete request and 11 September deadline stay separate from issue date before any Goal/Plan", () => {
    const f = fixture([
      sample("request", "Požadavek", "Doložte souhlas vlastníka k žádosti.", "fact", "výzva"),
      sample("deadline", "Lhůta pro doplnění", "Doplňte podklady nejpozději do 11. září.", "term", "výzva"),
      sample("issued", "Datum vyhotovení výzvy", "25. srpna 2026", "term", "výzva")
    ]);
    const result = buildJournalOverview(f.items, f.evidence, "s1");
    assert.match(result.find((g) => g.id === "request").variants[0].text, /Doložte souhlas vlastníka/);
    const deadline = result.find((g) => g.id === "deadline");
    assert.equal(deadline.category, "time"); assert.equal(deadline.time, "response");
    assert.match(deadline.variants[0].text, /11\. září/);
    const issued = result.find((g) => g.id === "issued");
    assert.equal(issued.category, "parameters"); assert.equal(issued.time, "document");
    assert.equal(result.filter((g) => g.category === "risks").length, 0);
  });
  await t.test("legacy null values recover saved content or passages without persistence or a new analysis", () => {
    const content = sample("legacy", "Odesílatel", "Městský úřad Lipová, IČO 12345678", "identifier", "A");
    content.item.value = null;
    content.item.updated_at = "2026-10-28T00:00:00.000Z"; // A bookmark edit is not proof that null was an intentional content edit.
    const passage = sample("quote", "Požadavek", "Doložte výkres šířky průchodu.", "fact", "B");
    passage.item.value = null; passage.insight.content = null;
    const f = fixture([content, passage]);
    const before = JSON.stringify(f); freeze(f);
    const result = buildJournalOverview(f.items, f.evidence, "s1");
    assert.match(result[0].variants[0].text, /Městský úřad Lipová/);
    assert.match(result[1].variants[0].text, /Doložte výkres/);
    assert.equal(JSON.stringify(f), before);
  });
  await t.test("document date, delivery, reaction deadline and scheduled event retain distinct meanings", () => {
    const f = fixture([
      sample("date", "Datum dokumentu", "25. srpna", "term", "A"),
      sample("delivery", "Doručení výzvy", "29. srpna", "term", "A"),
      sample("reply", "Termín reakce", "11. září", "term", "A"),
      sample("event", "Místní šetření", "15. září", "term", "A")
    ]);
    assert.deepEqual(buildJournalOverview(f.items, f.evidence, "s1").map((group) => group.time), ["document", "delivery", "response", "event"]);
  });
  await t.test("a deadline for hearing materials is a response deadline, not the hearing date", () => {
    const f = fixture([
      sample("materials", "Lhůta dodání podkladů k jednání", "Podklady dodejte do 11. září.", "term", "A"),
      sample("relative", "Dodání podkladů k jednání", "Doložte podklady do 10 dnů od doručení.", "term", "A"),
      sample("hearing", "Datum jednání", "15. září", "term", "A")
    ]);
    const before = JSON.stringify(f); freeze(f);
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    assert.deepEqual(groups.map((group) => group.time), ["response", "response", "event"]);
    assert.ok(groups.every((group) => group.category === "time"));
    assert.equal(JSON.stringify(f), before);
  });
  await t.test("dated notice headings never collapse their request or response deadline into the issue date", () => {
    const f = fixture([
      sample("deadline-heading", "Výzva ze dne 25. srpna 2026", "Doložte souhlas nejpozději do 11. září.", "fact", "A"),
      sample("request-heading", "Výzva ze dne 25. srpna 2026", "Doložte souhlas vlastníka.", "fact", "B"),
      sample("mixed-field", "Datum vyhotovení výzvy", "25. srpna 2026. Doložte souhlas vlastníka.", "fact", "C"),
      sample("issue-field", "Datum vyhotovení výzvy", "25. srpna 2026", "term", "A")
    ]);
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    assert.equal(groups[0].time, "response"); assert.equal(groups[0].category, "time");
    for (const group of groups.slice(1, 3)) {
      assert.equal(group.category, "matter"); assert.equal(group.time, null);
      assert.match(group.variants[0].text, /Doložte souhlas vlastníka/);
    }
    assert.equal(groups[3].category, "parameters"); assert.equal(groups[3].time, "document");
  });
  await t.test("quantity limits are not dates and uncertain temporal wording remains visible without an invented meaning", () => {
    const f = fixture([
      sample("capacity", "Kapacita", "Do 10 osob.", "fact", "A"),
      sample("mislabelled", "Kapacita", "Do 10 osob.", "term", "B"),
      sample("uncertain", "Datum související s výzvou", "11. září – význam není v podkladu určen.", "term", "C"),
      sample("undated", "Další údaj", "Časový význam nelze určit.", "term", "D")
    ]);
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    for (const index of [0, 1, 3]) {
      assert.equal(groups[index].category, "matter"); assert.equal(groups[index].time, null);
    }
    assert.equal(groups[2].category, "time"); assert.equal(groups[2].time, "unspecified");
  });
  await t.test("repeated reliable identification appears once with every document's source", () => {
    const f = fixture([
      sample("a", "Odesílatel", "Městský úřad Lipová, IČO 12345678", "identifier", "A"),
      sample("b", "Odesílatel", "Městský úřad Lipová, IČO 12345678", "identifier", "B")
    ]);
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    assert.equal(groups.length, 1); assert.equal(groups[0].variants.length, 1);
    assert.equal(groups[0].items.length, 2);
    assert.deepEqual(groups[0].sources.map((s) => s.documentId), ["A", "B"]);
  });
  await t.test("1,80 and 1,20 m remain sourced variants of the same explicit subject/attribute/context; newest never wins", () => {
    const f = fixture([
      sample("wide", "Průchod A — šířka — měření 2026", "1,80 m", "fact", "A", "Č.j. SP/2026/1: Průchod A má šířku 1,80 m."),
      sample("narrow", "Průchod A — šířka — měření 2026", "1,20 m", "fact", "B", "Č.j. SP/2026/1: Průchod A má šířku 1,20 m.")
    ]);
    f.items[1].created_at = f.items[1].updated_at = "2026-10-28T00:00:00.000Z";
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    assert.equal(groups.length, 1); assert.equal(groups[0].variants.length, 2);
    assert.equal(groups[0].category, "questions");
    assert.match(groups[0].variants[0].text, /1,80 m/); assert.match(groups[0].variants[1].text, /1,20 m/);
    assert.equal(groups[0].variants[0].sources[0].documentId, "A");
    assert.equal(groups[0].variants[1].sources[0].documentId, "B");
  });
  await t.test("ambiguous names, attributes and contexts stay separate", () => {
    const f = fixture([
      sample("a", "Odesílatel", "Jan Novák", "identifier", "A"),
      sample("b", "Odesílatel", "Jan Novák", "identifier", "B"),
      sample("c", "Průchod A — šířka", "1,20 m", "fact", "C", "Č.j. JINA/2: šířka"),
      sample("d", "Průchod A — šířka", "1,20 m", "fact", "D", "Č.j. SP/1: šířka"),
      sample("e", "Průchod B — šířka", "1,20 m", "fact", "D", "Č.j. SP/1: šířka")
    ]);
    assert.equal(buildJournalOverview(f.items, f.evidence, "s1").length, 5);
  });
  await t.test("manual/edited text, intentionally empty values and Situation isolation are preserved", () => {
    const edited = sample("edited", "Odesílatel", "AI hodnota", "identifier", "A");
    edited.item.title = "Moje opravené tvrzení"; edited.item.value = "Uživatelská hodnota";
    const cleared = sample("cleared", "Požadavek", "AI hodnota", "fact", "B"); cleared.item.value = "";
    const f = fixture([edited, cleared]);
    f.items.push({ ...edited.item, id: "note", title: "Moje poznámka", value: null, source_links_json: "[]" });
    f.items.push({ ...edited.item, id: "other", situation_id: "s2" });
    const groups = buildJournalOverview(f.items, f.evidence, "s1");
    assert.equal(groups.length, 3);
    assert.equal(groups[0].variants[0].text, "Moje opravené tvrzení: Uživatelská hodnota");
    assert.equal(groups[1].variants[0].text, "Požadavek");
    assert.equal(groups[2].category, "notes");
    assert.ok(!groups.some((g) => g.id === "other"));
    const question = { ...f.items[2], id: "question", item_type: "QUESTION", title: "Kdo musí dodat souhlas?" };
    assert.equal(buildJournalOverview([question], f.evidence, "s1")[0].category, "questions");
  });
  await t.test("document filtering only changes visible groups/sources; contextual pins and stored records stay unchanged", () => {
    const f = fixture([
      sample("a", "Odesílatel", "Úřad, IČO 12345678", "identifier", "A"),
      sample("b", "Odesílatel", "Úřad, IČO 12345678", "identifier", "B")
    ]);
    const before = JSON.stringify(f); freeze(f);
    const pinsBefore = contextualJournalPinIds(f.items, f.evidence, "s1");
    const filtered = buildJournalOverview(f.items, f.evidence, "s1", "B");
    assert.deepEqual(filtered[0].sources.map((source) => source.documentId), ["B"]);
    assert.deepEqual(contextualJournalPinIds(f.items, f.evidence, "s1"), pinsBefore);
    assert.equal(JSON.stringify(f), before);
    assert.equal(buildJournalOverview(f.items, f.evidence, "s2").length, 0);
  });
  await t.test("source offsets must match the saved quote; recovery is exact, unique and read-only", () => {
    assert.deepEqual(resolveSourceRange("first quoted last", { startOffset: null, endOffset: null, quote: "quoted" }), { start: 6, end: 12 });
    assert.deepEqual(resolveSourceRange("abc", { startOffset: 0, endOffset: 2, quote: "ab" }), { start: 0, end: 2 });
    assert.equal(resolveSourceRange("x x", { startOffset: null, endOffset: null, quote: "x" }), null);
    const stale = freeze({ startOffset: 0, endOffset: 6, quote: "quoted" });
    const before = JSON.stringify(stale);
    assert.deepEqual(resolveSourceRange("first quoted last", stale), { start: 6, end: 12 });
    assert.equal(JSON.stringify(stale), before, "navigation does not repair saved offsets");
    assert.equal(resolveSourceRange("wrong text", { startOffset: 0, endOffset: 5, quote: "missing" }), null);
    assert.equal(resolveSourceRange("wrong quoted quoted", stale), null);
    assert.equal(resolveSourceRange("wrong aaa", { startOffset: 0, endOffset: 2, quote: "aa" }), null, "overlapping matches are ambiguous too");
    assert.deepEqual(resolveSourceRange("quoted quoted", { startOffset: 7, endOffset: 13, quote: "quoted" }), { start: 7, end: 13 }, "matching saved offsets disambiguate repeated quotes");
    assert.deepEqual(resolveSourceRange("prefix quoted suffix", { startOffset: 0, endOffset: 8, quote: " quoted " }), { start: 6, end: 14 }, "the exact saved quote includes its whitespace");
    assert.deepEqual(resolveSourceRange("abc", { startOffset: 0, endOffset: 2, quote: "" }), { start: 0, end: 2 }, "offset-only legacy sources remain supported");
    assert.equal(resolveSourceRange("abc", { startOffset: null, endOffset: null, quote: "" }), null);
  });
  await t.test("server-rendered overview has compact sources, collapsed identification and no empty categories", () => {
    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { CompactJournal } = load("src/components/journal/CompactJournal.tsx");
    const f = fixture([sample("a", "Odesílatel", "Úřad, IČO 12345678", "identifier", "A"), sample("b", "Odesílatel", "Úřad, IČO 12345678", "identifier", "B")]);
    const html = renderToStaticMarkup(createElement(CompactJournal, { ...f, situationId: "s1", onOpenSource: async () => true, onSave() {}, onArchive() {}, onCreate() {}, onStartBookmarkLink() {} }));
    assert.match(html, /<summary>Identifikace \(1\)<\/summary>/);
    assert.match(html, /<summary>2 zdrojů<\/summary>/);
    assert.ok(html.includes("A.txt") && html.includes("B.txt"));
    assert.ok(!html.includes("Nejasnosti a rozpory"));
    assert.ok(!html.includes("journal-linked-bookmark-marker"));
  });
  await t.test("actual filter and source chooser callbacks keep view changes local and open each chosen passage", async () => {
    const { hookRenderer, elements } = require("./insight-hover-bookmark-positions.test.cjs");
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    globalThis.window = new EventTarget();
    const f = fixture([sample("a", "Odesílatel", "Úřad, IČO 12345678", "identifier", "A"), sample("b", "Odesílatel", "Úřad, IČO 12345678", "identifier", "B")]);
    const before = JSON.stringify(f), calls = [];
    const overview = hookRenderer("src/components/journal/CompactJournal.tsx", "CompactJournal", {
      ...f, situationId: "s1", onOpenSource: async (source) => { calls.push(source); return true; },
      onSave() { throw new Error("Filter must not save"); }, onArchive() { throw new Error("Filter must not delete"); }, onCreate() {}, onStartBookmarkLink() {}
    });
    let chooser;
    let editor;
    try {
      overview.render();
      const select = elements(overview.tree, (element) => element.type === "select")[0];
      assert.equal(select.props.value, "");
      select.props.onChange({ target: { value: "B" } }); overview.render();
      const menu = elements(overview.tree, (element) => element.type?.name === "JournalSources")[0];
      assert.deepEqual(menu.props.sources.map((source) => source.documentId), ["B"]);
      const groups = buildJournalOverview(f.items, f.evidence, "s1");
      chooser = hookRenderer("src/components/journal/CompactJournal.tsx", "JournalSources", { sources: groups[0].sources, onOpenSource: async (source) => { calls.push(source); return true; } });
      chooser.render();
      for (const button of elements(chooser.tree, (element) => element.type === "button")) await button.props.onClick();
      assert.deepEqual(calls.map((source) => [source.documentId, source.pinId, source.startOffset]), [["A", "pin-a", 10], ["B", "pin-b", 10]]);
      const saves = [];
      editor = hookRenderer("src/components/journal/CompactJournal.tsx", "JournalRecordEditor", {
        item: { ...f.items[0], value: null }, onSave: async (id, fields) => saves.push({ id, fields }), onArchive() {}, onStartBookmarkLink() {}
      });
      editor.render();
      await elements(editor.tree, (element) => element.type === "form")[0].props.onSubmit({ preventDefault() {} }); editor.render();
      assert.equal(saves[0].fields.value, null, "saving an untouched legacy row does not persist the displayed fallback or an empty replacement");
      elements(editor.tree, (element) => element.type === "textarea")[0].props.onChange({ target: { value: "" } }); editor.render();
      await elements(editor.tree, (element) => element.type === "form")[0].props.onSubmit({ preventDefault() {} }); editor.render();
      assert.equal(saves[1].fields.value, "", "an explicit clear remains authoritative");
      assert.equal(JSON.stringify(f), before);
    } finally {
      overview.dispose(); chooser?.dispose(); editor?.dispose();
      if (previous) Object.defineProperty(globalThis, "window", previous); else delete globalThis.window;
    }
  });
});

test("actual persistence, read-only GET, edits, source append, isolation and document deletion", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bureaucat-compact-journal-"));
  const databasePath = path.join(directory, "test.sqlite"); writeFileSync(databasePath, "");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl, log: [{ emit: "event", level: "query" }] });
  const queries = []; prisma.$on("query", ({ query }) => queries.push(query));
  const previous = globalThis.prisma;
  let aiCalls = 0;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
      let output = ""; child.stdout.on("data", (chunk) => output += chunk); child.stderr.on("data", (chunk) => output += chunk);
      child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Temporary migration exited ${code}: ${output}`)));
    });
    globalThis.prisma = prisma;
    const load = sourceLoader({ "@/lib/ai/documentAnalysis": { analyzeDocumentWithAI: async () => {
      aiCalls++;
      return { summary: "Výzva k doplnění", insights: [
        { insight_type: "fact", title: "Požadavek", content: "Doložte souhlas vlastníka.", source_text: "Doložte souhlas vlastníka." },
        { insight_type: "term", title: "Lhůta", content: "Nejpozději do 11. září.", source_text: "Nejpozději do 11. září." },
        { insight_type: "term", title: "Datum vyhotovení výzvy", content: "25. srpna 2026", source_text: "25. srpna 2026" }
      ] };
    } } });
    const { createCase } = load("src/lib/services/cases.ts");
    const { createSituation } = load("src/lib/services/situations.ts");
    const { createAIAnalysisDocument, linkDocumentToSituation, unlinkDocumentFromSituation } = load("src/lib/services/documents.ts");
    const { journalizeDocumentInsight } = load("src/lib/services/documentInsights.ts");
    const { updateJournalItem, appendJournalBookmark } = load("src/lib/services/journal.ts");
    const { GET } = load("src/app/api/cases/[caseId]/journal/route.ts");
    const caseItem = await createCase({ title: "Compact Journal" });
    const first = await prisma.situation.findFirstOrThrow({ where: { case_id: caseItem.id } });
    const second = await createSituation(caseItem.id, { title: "Isolation control" });
    const doc = await prisma.document.create({ data: { case_id: caseItem.id, filename: "výzva.txt", original_file: "", filetype: "txt", processed_text: "Výzva ze dne 25. srpna 2026. Doložte souhlas vlastníka. Nejpozději do 11. září." } });
    await linkDocumentToSituation(first.id, doc.id); await linkDocumentToSituation(second.id, doc.id);
    const analysis = await createAIAnalysisDocument(doc.id, first.id);
    const insight = await prisma.documentInsight.findFirstOrThrow({ where: { document_id: analysis.id, title: "Požadavek" } });
    const read = async (situationId = first.id) => {
      const response = await GET(new Request(`http://localhost/api/journal?situationId=${situationId}`), { params: Promise.resolve({ caseId: caseItem.id }) });
      assert.equal(response.status, 200); return response.json();
    };
    const models = ["case", "situation", "goal", "workflowStep", "document", "documentInsight", "documentPin", "journalItem", "situationDocument"];
    const snapshot = () => Promise.all(models.map((name) => prisma[name].findMany({ orderBy: { id: "asc" } })));
    await t.test("the existing single AI result's content is saved and journalized instead of null", async () => {
      assert.equal(insight.content, "Doložte souhlas vlastníka.");
      const row = await prisma.journalItem.findUniqueOrThrow({ where: { id: insight.journal_item_id } });
      assert.equal(row.value, insight.content); assert.equal(aiCalls, 1);
      assert.equal(await prisma.goal.count(), 0);
    });
    await t.test("repeated GET, grouping and filtering perform no writes and no additional AI call", async () => {
      const before = await snapshot(); queries.length = 0;
      for (let repeat = 0; repeat < 2; repeat++) {
        const data = await read();
        const groups = buildJournalOverview(data.journal, data.evidence, first.id);
        assert.match(groups.find((group) => group.id === insight.journal_item_id).variants[0].text, /Doložte souhlas/);
        for (const source of groups.flatMap((group) => group.sources)) {
          assert.equal(source.documentId, doc.id);
          assert.equal(doc.processed_text.slice(source.startOffset, source.endOffset), source.quote, "every summary source resolves to its actual saved passage");
        }
        buildJournalOverview(data.journal, data.evidence, first.id, doc.id);
        assert.equal((await read(second.id)).journal.length, 0);
        assert.equal((await read(second.id)).evidence.insights.length, 0);
      }
      assert.ok(!queries.some((sql) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i.test(sql)));
      assert.deepEqual(await snapshot(), before); assert.equal(aiCalls, 1);
    });
    await t.test("reusing analysis or journalization preserves user edits", async () => {
      await updateJournalItem(insight.journal_item_id, { title: "Moje opravené sdělení", value: "Moje hodnota" });
      const before = await prisma.journalItem.findUniqueOrThrow({ where: { id: insight.journal_item_id } });
      await journalizeDocumentInsight(insight.id, first.id);
      await createAIAnalysisDocument(doc.id, first.id);
      assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: before.id } }), before); assert.equal(aiCalls, 1);
    });
    await t.test("manual notes remain editable and adding bookmarks preserves all prior source links", async () => {
      const note = await prisma.journalItem.create({ data: { case_id: caseItem.id, situation_id: first.id, section: "description", item_type: "FACT", title: "Ruční poznámka", source_links_json: '[{"type":"note","text":"ponechat"}]' } });
      await updateJournalItem(note.id, { title: "Upravená poznámka", value: "Uložená hodnota" });
      await appendJournalBookmark(note.id, insight.source_pin_id);
      await appendJournalBookmark(note.id, insight.source_pin_id);
      const row = await prisma.journalItem.findUniqueOrThrow({ where: { id: note.id } });
      assert.equal(row.title, "Upravená poznámka"); assert.equal(row.value, "Uložená hodnota");
      const links = JSON.parse(row.source_links_json); assert.equal(links.length, 2); assert.equal(links[0].text, "ponechat");
      const otherCase = await createCase({ title: "Other case" });
      const foreign = await prisma.document.create({ data: { case_id: otherCase.id, filename: "other", filetype: "txt", original_file: "" } });
      const foreignPin = await prisma.documentPin.create({ data: { document_id: foreign.id, selected_text: "x", start_offset: 0, end_offset: 1 } });
      await assert.rejects(() => appendJournalBookmark(note.id, foreignPin.id), /CASE_MISMATCH/);
    });
    await t.test("Situation document deletion still removes related findings and preserves the other Situation/source", async () => {
      const control = await prisma.journalItem.create({ data: { case_id: caseItem.id, situation_id: second.id, section: "description", item_type: "FACT", title: "Zachovat", source_links_json: JSON.stringify([{ documentId: doc.id, pinId: insight.source_pin_id }]) } });
      await unlinkDocumentFromSituation(first.id, doc.id);
      assert.equal((await read()).journal.length, 0);
      assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: control.id } }), control);
      assert.ok(await prisma.documentPin.findUnique({ where: { id: insight.source_pin_id } }));
      assert.ok(await prisma.document.findUnique({ where: { id: doc.id } }));
      assert.equal(aiCalls, 1);
    });
  } finally {
    globalThis.prisma = previous; await prisma.$disconnect(); rmSync(directory, { recursive: true, force: true });
  }
});
