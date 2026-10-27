const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { Prisma, PrismaClient } = require("@prisma/client");

const root = path.resolve(__dirname, "..");

// Load the actual TS services with their @/ imports, without a new test dependency.
function sourceLoader() {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    });
    const localRequire = createRequire(filename);
    const requireSource = (name) => name.startsWith("@/")
      ? load(path.join(root, "src", `${name.slice(2)}.ts`))
      : localRequire(name);
    vm.runInThisContext(
      `(function(exports, require, module, __filename, __dirname) {${outputText}\n})`,
      { filename }
    )(module.exports, requireSource, module, filename, path.dirname(filename));
    return module.exports;
  }
  return (name) => load(path.join(root, name));
}

test("Situation document removal and exact source links on isolated SQLite", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bureaucat-document-removal-"));
  const databasePath = path.join(directory, "test.sqlite");
  writeFileSync(databasePath, "");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const previousPrisma = globalThis.prisma;
  try {
    const migrationEnvironment = { ...process.env, DATABASE_URL: databaseUrl };
    // Prisma is a CLI child, not a node:test worker.
    delete migrationEnvironment.NODE_TEST_CONTEXT;
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
        cwd: root, env: migrationEnvironment, stdio: ["ignore", "pipe", "pipe"]
      });
      let diagnostics = "";
      child.stdout.on("data", (chunk) => { diagnostics += chunk; });
      child.stderr.on("data", (chunk) => { diagnostics += chunk; });
      child.on("error", reject);
      child.on("close", (code) => {
        console.log(diagnostics);
        code === 0 ? resolve() : reject(new Error(`Temporary DB migration exited ${code}`));
      });
    });
    globalThis.prisma = prisma;
    const load = sourceLoader();
    const { DELETE } = load("src/app/api/situations/[situationId]/documents/[documentId]/route.ts");
    const { GET: getDocuments } = load("src/app/api/situations/[situationId]/documents/route.ts");
    const { GET: getJournal } = load("src/app/api/cases/[caseId]/journal/route.ts");
    const { createCase } = load("src/lib/services/cases.ts");
    const { createSituation } = load("src/lib/services/situations.ts");
    const { removeBookmarkLinksForPin } = load("src/lib/services/journal.ts");
    const { getSourceLinkDocumentId } = load("src/lib/documents/sourceLinks.ts");
    const models = ["case", "situation", "workflowStep", "document", "situationDocument", "journalItem", "documentPin", "documentInsight"];
    const snapshot = () => Promise.all(models.map((model) => prisma[model].findMany({ orderBy: { id: "asc" } })));
    const remove = (situationId, documentId) => DELETE(new Request("http://localhost/api/documents", { method: "DELETE" }), {
      params: Promise.resolve({ situationId, documentId })
    });
    async function fixture() {
      const caseItem = await createCase({ title: "Removal regression" });
      const first = await prisma.situation.findFirstOrThrow({ where: { case_id: caseItem.id } });
      const second = await createSituation(caseItem.id, { title: "Other situation" });
      const otherCase = await createCase({ title: "Other case" });
      const other = await prisma.situation.findFirstOrThrow({ where: { case_id: otherCase.id } });
      const document = await prisma.document.create({ data: {
        case_id: caseItem.id, filename: "source.txt", original_file: "not-a-real-upload", filetype: "txt"
      } });
      const unrelated = await prisma.document.create({ data: {
        case_id: caseItem.id, filename: "unrelated.txt", original_file: "not-a-real-upload", filetype: "txt"
      } });
      const analysis = await prisma.document.create({ data: {
        case_id: caseItem.id, filename: "analysis.md", original_file: "", filetype: "md",
        document_type: "analysis", parent_document_id: document.id
      } });
      await prisma.situationDocument.createMany({ data: [
        { situation_id: first.id, document_id: document.id },
        { situation_id: first.id, document_id: unrelated.id }
      ] });
      const pin = await prisma.documentPin.create({ data: {
        document_id: document.id, selected_text: "Source", start_offset: 0, end_offset: 6
      } });
      const unrelatedPin = await prisma.documentPin.create({ data: {
        document_id: unrelated.id, selected_text: "Other", start_offset: 0, end_offset: 5
      } });
      const item = (situationId, links, extra = {}) => prisma.journalItem.create({ data: {
        case_id: situationId === other.id ? otherCase.id : caseItem.id, situation_id: situationId,
        section: "description", item_type: "FACT", title: "User-edited finding",
        source_links_json: typeof links === "string" ? links : JSON.stringify(links), ...extra
      } });
      const insight = (journalItemId, extra = {}) => prisma.documentInsight.create({ data: {
        document_id: analysis.id, source_document_id: document.id, source_pin_id: pin.id,
        insight_type: "fact", target_section: "description", target_item_type: "FACT", title: "Finding",
        status: "journalized", journal_item_id: journalItemId, ...extra
      } });
      return { caseItem, first, second, other, document, unrelated, analysis, pin, unrelatedPin, item, insight };
    }

    await t.test("deletes all related findings regardless of edits; exact IDs preserve unrelated content and other situations", async () => {
      const f = await fixture();
      await prisma.situationDocument.create({ data: { situation_id: f.second.id, document_id: f.document.id } });
      const direct = await f.item(f.first.id, []);
      const ownInsight = await f.insight(direct.id);
      const related = [direct];
      for (const links of [
        [{ documentId: f.document.id }],
        [{ pinId: f.pin.id }],
        [{ insightId: ownInsight.id }],
        [{ analysisDocumentId: f.analysis.id }],
        [{ document_id: f.document.id }],
        [{ docId: f.document.id }],
        [{ document: { id: f.document.id } }],
        [{ type: "document", id: f.document.id }],
        [{ documentId: f.document.id }, { documentId: f.unrelated.id, pinId: f.unrelatedPin.id }]
      ]) related.push(await f.item(f.first.id, links));
      const preserved = [];
      for (const links of [
        [], [{ documentId: f.unrelated.id, pinId: f.unrelatedPin.id }],
        [{ documentId: `${f.document.id}-longer`, pinId: `${f.pin.id}-longer` }],
        [{ label: f.document.id }], [null, 3, "text"], "invalid JSON", '{"documentId":"not-an-array"}'
      ]) preserved.push(await f.item(f.first.id, links));
      const otherSituationItem = await f.item(f.second.id, [{ documentId: f.document.id, pinId: f.pin.id }]);
      const otherInsight = await f.insight(otherSituationItem.id);
      preserved.push(otherSituationItem);
      preserved.push(await f.item(f.other.id, [{ documentId: f.document.id, pinId: f.pin.id }]));
      preserved.push(await f.item(null, [{ documentId: f.document.id }]));
      const stepsBefore = await prisma.workflowStep.findMany({ orderBy: { id: "asc" } });
      const documentsBefore = await prisma.document.findMany({ orderBy: { id: "asc" } });
      const pinsBefore = await prisma.documentPin.findMany({ orderBy: { id: "asc" } });
      assert.equal((await remove(f.first.id, f.document.id)).status, 200);
      assert.equal(await prisma.journalItem.count({ where: { id: { in: related.map((row) => row.id) } } }), 0);
      for (const row of preserved) assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: row.id } }), row);
      assert.deepEqual(await prisma.documentInsight.findUnique({ where: { id: otherInsight.id } }), otherInsight);
      const resetInsight = await prisma.documentInsight.findUniqueOrThrow({ where: { id: ownInsight.id } });
      assert.equal(resetInsight.journal_item_id, null);
      assert.equal(resetInsight.status, "approved");
      assert.deepEqual(await prisma.document.findMany({ orderBy: { id: "asc" } }), documentsBefore);
      assert.deepEqual(await prisma.documentPin.findMany({ orderBy: { id: "asc" } }), pinsBefore);
      assert.deepEqual(await prisma.workflowStep.findMany({ orderBy: { id: "asc" } }), stepsBefore);
      const documentResponse = await getDocuments(new Request("http://localhost/api/documents"), {
        params: Promise.resolve({ situationId: f.first.id })
      });
      assert.deepEqual((await documentResponse.json()).documents.map((row) => row.id), [f.unrelated.id]);
      const journalResponse = await getJournal(new Request(`http://localhost/api/journal?situationId=${f.first.id}`), {
        params: Promise.resolve({ caseId: f.caseItem.id })
      });
      assert.deepEqual(new Set((await journalResponse.json()).journal.map((row) => row.id)),
        new Set(preserved.filter((row) => row.situation_id === f.first.id).map((row) => row.id)));
      // Fresh client: this is persisted state after reconnect, not optimistic UI state.
      const reloaded = new PrismaClient({ datasourceUrl: databaseUrl });
      try {
        assert.equal(await reloaded.situationDocument.count({ where: { situation_id: f.first.id, document_id: f.document.id } }), 0);
        assert.equal(await reloaded.situationDocument.count({ where: { situation_id: f.second.id, document_id: f.document.id } }), 1);
        assert.equal(await reloaded.journalItem.count({ where: { id: { in: related.map((row) => row.id) } } }), 0);
        assert.deepEqual(await reloaded.journalItem.findUnique({ where: { id: otherSituationItem.id } }), otherSituationItem);
      } finally { await reloaded.$disconnect(); }
      const after = await snapshot();
      assert.equal((await remove(f.first.id, f.document.id)).status, 200);
      assert.deepEqual(await snapshot(), after, "repeated removal is idempotent");
    });

    await t.test("removes unshared document bookmarks and clears insight pointers without deleting unrelated bookmarks", async () => {
      const f = await fixture();
      const row = await f.item(f.first.id, [{ documentId: f.document.id }, { pinId: f.unrelatedPin.id }]);
      const insight = await f.insight(row.id);
      assert.equal((await remove(f.first.id, f.document.id)).status, 200);
      assert.equal(await prisma.documentPin.findUnique({ where: { id: f.pin.id } }), null);
      assert.deepEqual(await prisma.documentPin.findUnique({ where: { id: f.unrelatedPin.id } }), f.unrelatedPin);
      const reset = await prisma.documentInsight.findUniqueOrThrow({ where: { id: insight.id } });
      assert.equal(reset.journal_item_id, null);
      assert.equal(reset.source_pin_id, null);
      assert.ok(await prisma.document.findUnique({ where: { id: f.document.id } }));
    });

    await t.test("retains a bookmark referenced elsewhere even without another SituationDocument link", async () => {
      const f = await fixture();
      await f.item(f.first.id, [{ pinId: f.pin.id }]);
      const other = await f.item(f.second.id, [{ pinId: f.pin.id }]);
      assert.equal((await remove(f.first.id, f.document.id)).status, 200);
      assert.deepEqual(await prisma.documentPin.findUnique({ where: { id: f.pin.id } }), f.pin);
      assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: other.id } }), other);
    });

    await t.test("retains bookmarks used by analysis in another situation without a journal projection", async () => {
      const f = await fixture();
      await f.item(f.first.id, [{ pinId: f.pin.id }]);
      const insight = await f.insight(null, { status: "approved" });
      await prisma.situationDocument.create({ data: { situation_id: f.second.id, document_id: f.analysis.id } });
      assert.equal((await remove(f.first.id, f.document.id)).status, 200);
      assert.deepEqual(await prisma.documentPin.findUnique({ where: { id: f.pin.id } }), f.pin);
      assert.deepEqual(await prisma.documentInsight.findUnique({ where: { id: insight.id } }), insight);
    });

    await t.test("analysis references use exact IDs and preserve unrelated findings and the source document link", async () => {
      const f = await fixture();
      const related = await f.item(f.first.id, [{ analysisDocumentId: f.analysis.id }]);
      await f.insight(related.id);
      const preserved = await f.item(f.first.id, [{ analysisDocumentId: `${f.analysis.id}-longer` }]);
      const sourceReference = await f.item(f.first.id, [{ pinId: f.pin.id, documentId: f.document.id }]);
      await prisma.situationDocument.create({ data: { situation_id: f.first.id, document_id: f.analysis.id } });
      assert.equal((await remove(f.first.id, f.analysis.id)).status, 200);
      // The source bookmark is also related through its insight, so its finding is removed.
      assert.equal(await prisma.journalItem.findUnique({ where: { id: sourceReference.id } }), null);
      assert.equal(await prisma.journalItem.findUnique({ where: { id: related.id } }), null);
      assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: preserved.id } }), preserved);
      assert.ok(await prisma.situationDocument.findUnique({ where: {
        situation_id_document_id: { situation_id: f.first.id, document_id: f.document.id }
      } }));
    });

    await t.test("late unlink failure rolls back journal deletion, bookmarks, insight updates and the document link", async () => {
      const f = await fixture();
      const row = await f.item(f.first.id, [{ documentId: f.document.id, pinId: f.pin.id }]);
      await f.insight(row.id);
      const before = await snapshot();
      await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_document_unlink BEFORE DELETE ON "SituationDocument"
        WHEN OLD."document_id" = '${f.document.id}' BEGIN SELECT RAISE(ABORT, 'injected unlink failure'); END`);
      try {
        await assert.rejects(() => remove(f.first.id, f.document.id), (error) => {
          assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
          console.log(`EXPECTED ROLLBACK FAILURE ${error.code}: ${error.message}`);
          return true;
        });
        assert.deepEqual(await snapshot(), before);
      } finally { await prisma.$executeRawUnsafe('DROP TRIGGER "fail_document_unlink"'); }
    });

    await t.test("missing entities and cross-case requests are rejected without changing data", async () => {
      const f = await fixture();
      const before = await snapshot();
      assert.equal((await remove("missing", f.document.id)).status, 404);
      assert.equal((await remove(f.first.id, "missing")).status, 404);
      assert.equal((await remove(f.other.id, f.document.id)).status, 409);
      assert.deepEqual(await snapshot(), before);
    });

    await t.test("pin unlinking removes only the exact pin ID and preserves other JSON entries", async () => {
      const f = await fixture();
      const links = [{ pinId: f.pin.id }, { pinId: `${f.pin.id}-longer` }, null, { note: f.pin.id }, { pinId: f.unrelatedPin.id }];
      const row = await f.item(f.first.id, links);
      const malformed = await f.item(f.first.id, "invalid JSON");
      await removeBookmarkLinksForPin(f.pin.id);
      const updated = await prisma.journalItem.findUniqueOrThrow({ where: { id: row.id } });
      assert.deepEqual(JSON.parse(updated.source_links_json), links.slice(1));
      assert.deepEqual(await prisma.journalItem.findUnique({ where: { id: malformed.id } }), malformed);
    });

    await t.test("UI source references and deletion resolve the same supported document ID formats", () => {
      for (const link of [
        { documentId: "doc-1" }, { document_id: "doc-1" }, { documentID: "doc-1" },
        { doc_id: "doc-1" }, { docId: "doc-1" }, { "document-id": "doc-1" },
        { document: "doc-1" }, { document: { id: "doc-1" } },
        { document: { document_id: "doc-1" } }, { type: "document", id: "doc-1" }
      ]) assert.equal(getSourceLinkDocumentId(link), "doc-1");
      for (const link of [null, [], "doc-1", { id: "doc-1" }, { title: "doc-1" }]) {
        assert.equal(getSourceLinkDocumentId(link), null);
      }
    });
  } finally {
    globalThis.prisma = previousPrisma;
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
