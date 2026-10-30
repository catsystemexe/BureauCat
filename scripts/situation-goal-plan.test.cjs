const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { tmpdir } = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { PrismaClient } = require("@prisma/client");
const { hookRenderer, elements, byClass, environment } = require("./insight-hover-bookmark-positions.test.cjs");
const root = path.resolve(__dirname, "..");
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const external = createRequire(file);
    const req = (name) => {
      if (name in overrides) return overrides[name];
      if (!name.startsWith("@/")) return external(name);
      const base = path.join(root, "src", name.slice(2)); return load(base + (existsSync(base + ".ts") ? ".ts" : ".tsx"));
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(req, module, module.exports);
    return module.exports;
  }
  return (file) => load(path.join(root, file));
}
async function deploy(schema, url) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", schema], { cwd: root, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    let output = ""; child.stdout.on("data", (data) => output += data); child.stderr.on("data", (data) => output += data);
    child.on("error", reject); child.on("close", (code, signal) => code === 0 ? resolve() : reject(new Error(`Migration exit ${code}, signal ${signal}: ${output}`)));
  });
}

test("Goal → Plan → Collection on migrated disposable SQLite, controlled AI only", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "bureaucat-goal-plan-"));
  writeFileSync(path.join(dir, "test.sqlite"), "");
  const url = `file:${path.join(dir, "test.sqlite")}`;
  const db = new PrismaClient({ datasourceUrl: url, log: [{ emit: "event", level: "query" }] });
  const queries = []; db.$on("query", ({ query }) => queries.push(query));
  const previous = globalThis.prisma; globalThis.prisma = db;
  let aiReply, aiCalls = 0, deferredAI = null;
  const load = loader({ "@/lib/ai/jsonResponse": { requestAIJson: async (_prompt, schema) => {
    aiCalls++; const result = deferredAI ? await deferredAI : aiReply; return schema.parse(result);
  } } });
  const { getSituationPlanning: read, executePlanningCommand: execute } = load("src/lib/services/situationPlanning.ts");
  const { createCase } = load("src/lib/services/cases.ts");
  const { createSituation } = load("src/lib/services/situations.ts");
  const { GET, POST } = load("src/app/api/situations/[situationId]/planning/route.ts");
  const content = { expectedOutput: "Připravit doloženou odpověď", procedure: ["Ověřit údaje", "Sestavit návrh odpovědi"], inputs: [
    { title: "Ověřené rozměry", description: "Dvě hodnoty a jejich zdroje", criteria: ["Doložená šířka", "Doložená hloubka"] }
  ] };
  let request = 0, caseId, sid;
  const command = (state, action) => ({ caseId, expectedRevision: state.revision, contextHash: state.contextHash, requestKey: `request-${++request}`, ...action });
  const send = async (body, target = sid) => {
    const response = await POST(new Request("http://localhost/planning", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ situationId: target }) });
    return { status: response.status, ...await response.json() };
  };
  const invariant = async (id = sid) => {
    assert.equal(await db.goal.count({ where: { situation_id: id, status: "active", confirmed_at: { not: null } } }), 1);
    assert.equal(await db.workflowStep.count({ where: { situation_id: id, status: "ACTIVE" } }), 1);
  };
  try {
    await t.test("additive migration preserves multiple legacy goals, inputs, criteria and steps", async () => {
      const baseline = path.join(dir, "baseline"); mkdirSync(baseline);
      const old = spawnSync("git", ["show", "5595ad8fab84eec6d9040b6d4111145a471f2997:prisma/schema.prisma"], { cwd: root, encoding: "utf8" });
      assert.equal(old.status, 0); writeFileSync(path.join(baseline, "schema.prisma"), old.stdout);
      mkdirSync(path.join(baseline, "migrations"));
      for (const name of ["0_baseline_20260818", "20260819234000_workflow_foundation_v01", "20260819234100_backfill_workflow_steps", "migration_lock.toml"]) cpSync(path.join(root, "prisma/migrations", name), path.join(baseline, "migrations", name), { recursive: true });
      await deploy(path.join(baseline, "schema.prisma"), url);
      await db.$executeRawUnsafe(`INSERT INTO "Case" (id,title,updated_at) VALUES ('legacy-case','Legacy',CURRENT_TIMESTAMP)`);
      await db.$executeRawUnsafe(`INSERT INTO Situation (id,case_id,title,updated_at) VALUES ('legacy','legacy-case','Legacy',CURRENT_TIMESTAMP)`);
      for (const id of ["legacy-a", "legacy-b"]) await db.$executeRawUnsafe(`INSERT INTO Goal (id,situation_id,title,updated_at) VALUES (?, 'legacy', ?, CURRENT_TIMESTAMP)`, id, id);
      await db.$executeRawUnsafe(`INSERT INTO RequiredInput (id,situation_id,title,updated_at) VALUES ('old-input','legacy','Original',CURRENT_TIMESTAMP)`);
      await db.$executeRawUnsafe(`INSERT INTO RequiredInputCriterion (id,required_input_id,requirement_text,updated_at) VALUES ('old-criterion','old-input','Original criterion',CURRENT_TIMESTAMP)`);
      for (const [index, key] of ["ANALYSIS", "PLAN", "COLLECTION", "INPUT_VALIDATION", "PRODUCTION", "OUTPUT_REVIEW", "EXECUTION"].entries()) {
        await db.$executeRawUnsafe(`INSERT INTO WorkflowStep (id,situation_id,step_key,status,display_order,updated_at) VALUES (?, 'legacy', ?, ?, ?, CURRENT_TIMESTAMP)`, `legacy-step-${index}`, key, index === 0 ? "ACTIVE" : "INACTIVE", index);
      }
      const tables = ["Goal", "RequiredInput", "RequiredInputCriterion", "WorkflowStep"];
      const before = await Promise.all(tables.map((table) => db.$queryRawUnsafe(`SELECT * FROM ${table}`)));
      await deploy(path.join(root, "prisma/schema.prisma"), url);
      for (let i = 0; i < tables.length; i++) {
        const after = await db.$queryRawUnsafe(`SELECT * FROM ${tables[i]}`);
        assert.deepEqual(after.map((row) => Object.fromEntries(Object.keys(before[i][0]).map((key) => [key, row[key]]))), before[i]);
      }
      const state = await read("legacy", "legacy-case"); assert.equal(state.goal, null); assert.equal(state.goalSelectionRequired, true);
      assert.equal(state.goals.filter((g) => g.status === "active").length, 2);
      assert.deepEqual(await db.$queryRawUnsafe("PRAGMA foreign_key_check"), []);
    });
    const created = await createCase({ title: "Planning test" }); caseId = created.id;
    sid = (await db.situation.findFirst({ where: { case_id: caseId } })).id;
    const other = await createSituation(caseId, { title: "Other situation" });
    const otherCase = await createCase({ title: "Other case" });
    const sourceText = "Šířka je 1,80 m. Jiný podklad uvádí 1,20 m. Hloubka není známa.";
    const doc = await db.document.create({ data: { case_id: caseId, filename: "measurements.txt", filetype: "txt", original_file: "", processed_text: sourceText } });
    await db.situationDocument.create({ data: { situation_id: sid, document_id: doc.id } });
    await db.situationDocument.create({ data: { situation_id: other.id, document_id: doc.id } });
    const analysis = await db.document.create({ data: { case_id: caseId, filename: "analysis.md", filetype: "md", original_file: "", document_type: "analysis", parent_document_id: doc.id } });
    const finding = async (title, quote, type = "fact", evidence_state = "verified") => db.documentInsight.create({ data: {
      document_id: analysis.id, source_document_id: doc.id, title, content: quote, source_text: quote, source_start_offset: sourceText.indexOf(quote), source_end_offset: sourceText.indexOf(quote) + quote.length,
      insight_type: type, evidence_state, target_section: "description", target_item_type: "FACT", status: "approved"
    } });
    const width = await finding("Šířka", "Šířka je 1,80 m.");
    const conflict = await finding("Rozpor šířky", "Jiný podklad uvádí 1,20 m.", "conflict", "conflict");
    let state;
    await t.test("manual Goal confirmation requires no AI and survives a fresh service read", async () => {
      const beforeAI = aiCalls; const own = await read(other.id, caseId);
      const result = await send(command(own, { action: "confirmGoal", title: "Vlastní cíl bez AI" }), other.id);
      assert.equal(result.status, 200); assert.equal(aiCalls, beforeAI);
      const fresh = await loader()("src/lib/services/situationPlanning.ts").getSituationPlanning(other.id, caseId);
      assert.equal(fresh.goal.title, "Vlastní cíl bez AI"); assert.equal(fresh.steps.find((step) => step.status === "ACTIVE").step_key, "PLAN");
      await invariant(other.id);
    });
    await t.test("AI candidates remain saved drafts, never authoritative or a Step transition", async () => {
      state = await read(sid, caseId);
      aiReply = { goals: [{ title: "Doložit rozměry pro vyjádření", reason: "Je vyžadován údaj", insightIds: [width.id] }, { title: "Vyjasnit rozpor měření", reason: "Podklady se rozcházejí", insightIds: [conflict.id] }] };
      const c = command(state, { action: "suggestGoals" }); const result = await send(c);
      assert.equal(result.status, 200); state = result.planning;
      assert.equal(state.goal, null); assert.equal(state.goals.length, 2); assert.ok(state.goals.every((g) => g.status === "draft"));
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "ANALYSIS");
      const calls = aiCalls; await send(c); assert.equal(aiCalls, calls, "completed request retry has no new AI call");
      assert.equal(await db.goal.count({ where: { situation_id: sid } }), 2);
    });
    await t.test("explicit edited goal confirmation is atomic, unique and idempotent under concurrent requests", async () => {
      const c = command(state, { action: "confirmGoal", goalId: state.goals[0].id, title: "Doložit skutečné rozměry a vypořádat rozdíl" });
      const results = await Promise.all([send(c), send(c)]);
      assert.ok(results.some((r) => r.status === 200)); assert.ok(results.every((r) => r.status === 200 || r.status === 409));
      state = await read(sid, caseId); assert.equal(state.goal.title, c.title); await invariant();
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "PLAN");
      const revision = state.revision; assert.equal((await send(c)).status, 200); assert.equal((await read(sid, caseId)).revision, revision);
      assert.equal((await send({ ...c, title: "Different payload" })).status, 409);
    });
    await t.test("manual plan works without AI; GET/navigation does not accept it", async () => {
      const beforeAI = aiCalls;
      state = (await send(command(state, { action: "savePlan", goalId: state.goal.id, content }))).planning;
      assert.equal(state.plan.status, "DRAFT"); assert.equal(state.inputs.length, 0); assert.equal(aiCalls, beforeAI);
      const get = await GET(new Request(`http://localhost/planning?caseId=${caseId}`), { params: Promise.resolve({ situationId: sid }) });
      assert.equal((await get.json()).planning.plan.status, "DRAFT");
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "PLAN");
    });
    await t.test("plan acceptance creates required information/criteria once and activates only Collection", async () => {
      const c = command(state, { action: "acceptPlan", planId: state.plan.id });
      state = (await send(c)).planning; assert.equal(state.plan.status, "ACCEPTED");
      assert.equal(state.inputs.length, 1); assert.equal(state.inputs[0].criteria.length, 2); assert.equal(state.inputs[0].status, "MISSING");
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "COLLECTION");
      await send(c); assert.equal(await db.requiredInput.count({ where: { plan_id: state.plan.id } }), 1); await invariant();
    });
    await t.test("AI matches expose conflicting variants, absent data is not a negative fact, no automatic SATISFIED", async () => {
      const [a, b] = state.inputs[0].criteria;
      aiReply = { matches: [{ criterionId: a.id, value: "1,80 m / 1,20 m", insightIds: [width.id, conflict.id], explanation: "Rozpor hodnot; nutné vyjasnit" }, { criterionId: b.id, value: "", insightIds: [], explanation: "Hloubka není doložena, nelze tvrdit nulovou hloubku" }] };
      state = (await send(command(state, { action: "matchInputs", planId: state.plan.id }))).planning;
      assert.equal(state.inputs[0].status, "INCOMPLETE"); assert.match(state.inputs[0].criteria[0].value, /1,80.*1,20/);
      assert.equal(state.inputs[0].criteria[1].value, "");
      const rejected = await send(command(state, { action: "reviewCriterion", planId: state.plan.id, criterionId: a.id, value: "1,80 m", insightIds: [conflict.id], sufficient: true, explanation: "test" }));
      assert.equal(rejected.status, 409);
      state = await read(sid, caseId);
    });
    await t.test("explicit evidence review persists value and sources; repeated AI preserves user edits", async () => {
      const c = command(state, { action: "reviewCriterion", planId: state.plan.id, criterionId: state.inputs[0].criteria[0].id,
        value: "Ověřeno: 1,80 m, rozpor je nutné dořešit", insightIds: [width.id], sufficient: false, explanation: "Moje ruční poznámka: porovnat měření" });
      state = (await send(c)).planning; await send(c);
      state = (await send(command(state, { action: "matchInputs", planId: state.plan.id }))).planning;
      assert.equal(state.inputs[0].criteria[0].value, c.value); assert.equal(state.inputs[0].criteria[0].explanation, c.explanation);
      assert.ok(state.reviewHistory.some((review) => review.changes.some((change) => change.after.value === c.value && change.after.explanation === c.explanation)), "manual review is retained in append-only history");
      // A separate uncontested value demonstrates explicit sufficiency, not AI approval.
      const clear = await finding("Potvrzená hloubka", "Hloubka není známa.");
      state = await read(sid, caseId);
      state = (await send(command(state, { action: "reviewCriterion", planId: state.plan.id, criterionId: state.inputs[0].criteria[1].id,
        value: "Výslovně uvedena jako neznámá — potřeba měření", insightIds: [clear.id], sufficient: false, explanation: "Zůstává neúplné" }))).planning;
      assert.equal(state.inputs[0].status, "INCOMPLETE");
    });
    await t.test("complete uncontested information can be explicitly reviewed as SATISFIED; source edits revoke it on read", async () => {
      const additional = await db.document.create({ data: { case_id: caseId, filename: "depth.txt", filetype: "txt", original_file: "", processed_text: "Hloubka je 0,60 m." } });
      await db.situationDocument.create({ data: { situation_id: sid, document_id: additional.id } });
      const depth = await db.documentInsight.create({ data: { document_id: additional.id, source_document_id: additional.id,
        title: "Hloubka", content: "0,60 m", source_text: "Hloubka je 0,60 m.", source_start_offset: 0, source_end_offset: "Hloubka je 0,60 m.".length,
        insight_type: "fact", evidence_state: "verified", target_section: "description", target_item_type: "FACT", status: "approved" } });
      state = await read(sid, caseId);
      for (const [index, source, value] of [[0, width, "1,80 m"], [1, depth, "0,60 m"]]) {
        state = (await send(command(state, { action: "reviewCriterion", planId: state.plan.id, criterionId: state.inputs[0].criteria[index].id,
          value, insightIds: [source.id], sufficient: true, explanation: "Výslovně zkontrolováno uživatelem" }))).planning;
      }
      assert.equal(state.inputs[0].status, "SATISFIED");
      await db.document.update({ where: { id: additional.id }, data: { processed_text: "Jiný text" } });
      state = await read(sid, caseId);
      assert.equal(state.inputs[0].status, "INCOMPLETE"); assert.equal(state.inputs[0].criteria[1].stale, true);
    });
    await t.test("stale evidence cannot remain satisfied; source unlink is Situation-local and GET stays read-only", async () => {
      // Use an independent uncontested criterion; conflict source is never accepted.
      const criterion = state.inputs[0].criteria[0];
      state = (await send(command(state, { action: "reviewCriterion", planId: state.plan.id, criterionId: criterion.id, value: "1,80 m", insightIds: [width.id], sufficient: true, explanation: "Ověření konkrétní pasáže" }))).planning;
      assert.equal(state.inputs[0].criteria[0].status, "SATISFIED");
      const { unlinkDocumentFromSituation } = load("src/lib/services/documents.ts");
      await unlinkDocumentFromSituation(sid, doc.id);
      const snapshot = async () => Promise.all([db.goal.findMany(), db.situationPlan.findMany(), db.requiredInput.findMany(), db.requiredInputCriterion.findMany(), db.workflowEvent.findMany()]);
      const before = await snapshot(); queries.length = 0;
      state = await read(sid, caseId); const stale = state.inputs[0].criteria[0];
      assert.equal(stale.status, "MISSING"); assert.equal(stale.stale, true); assert.equal(state.inputs[0].status, "INCOMPLETE");
      assert.equal((await read(other.id, caseId)).evidence.length, 3);
      const { buildCaseContext } = load("src/lib/services/caseContext.ts");
      const context = await buildCaseContext(caseId, sid); assert.equal(context.planning.inputs[0].criteria[0].stale, true);
      const { getSituationWorkflow } = load("src/lib/services/workflow.ts");
      const workflow = await getSituationWorkflow(sid);
      for (const input of [workflow.required_inputs[0], context.workflow.required_inputs[0]]) {
        assert.equal(input.situation_id, sid); assert.equal(input.title, content.inputs[0].title);
        const c = input.criteria[0];
        assert.equal(c.required_input_id, input.id); assert.equal(c.status, "MISSING");
        assert.equal(c.matched_value, "1,80 m"); assert.equal(typeof c.evidence_refs_json, "string"); assert.equal(c.stale, true);
      }
      assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER)\b/i.test(q))); assert.deepEqual(await snapshot(), before);
    });
    await t.test("editing accepted Plan preserves history, cancels consent and rejects old acceptance", async () => {
      const oldPlan = state.plan.id; const changed = { ...content, expectedOutput: "Nový uživatelský výstup" };
      state = (await send(command(state, { action: "savePlan", goalId: state.goal.id, content: changed }))).planning;
      assert.equal(state.plan.status, "DRAFT"); assert.equal(state.inputs.length, 0); assert.equal(state.history.find((p) => p.id === oldPlan).status, "SUPERSEDED");
      assert.equal((await send(command(state, { action: "acceptPlan", planId: oldPlan }))).status, 409);
      assert.equal(await db.requiredInput.count({ where: { plan_id: oldPlan } }), 1, "old inputs survive as history");
      state = await read(sid, caseId);
    });
    await t.test("goal change preserves old goal/plan, stale goal-bound plan request and cross-scope requests fail", async () => {
      const oldGoal = state.goal.id;
      state = (await send(command(state, { action: "confirmGoal", goalId: oldGoal, title: "Vyjasnit chybějící podklady před odpovědí" }))).planning;
      assert.notEqual(state.goal.id, oldGoal); assert.equal(state.plan, null);
      assert.equal((await send(command(state, { action: "savePlan", goalId: oldGoal, content }))).status, 409);
      assert.equal((await send(command(state, { action: "confirmGoal", goalId: oldGoal, title: "Wrong" }), other.id)).status, 409);
      assert.equal((await send({ ...command(state, { action: "confirmGoal", title: "Wrong" }), caseId: otherCase.id })).status, 404);
      const { updateGoal } = load("src/lib/services/goals.ts");
      await assert.rejects(updateGoal(state.goal.id, { title: "Bypass" }), /výslovným potvrzením/); await invariant();
      assert.equal((await db.goal.findUnique({ where: { id: oldGoal } })).status, "archived");
    });
    await t.test("failed initialization rolls back goal, revision, plan and Step transition", async () => {
      await db.$executeRawUnsafe(`CREATE TRIGGER fail_plan BEFORE INSERT ON SituationPlan BEGIN SELECT RAISE(ABORT, 'injected plan failure'); END`);
      state = await read(sid, caseId); const revision = state.revision;
      const result = await send(command(state, { action: "savePlan", goalId: state.goal.id, content })); assert.equal(result.status, 503);
      assert.equal((await read(sid, caseId)).revision, revision); await invariant();
      await db.$executeRawUnsafe("DROP TRIGGER fail_plan");
      const broken = await createSituation(caseId, { title: "Broken initialization" });
      await db.workflowStep.deleteMany({ where: { situation_id: broken.id, step_key: "PLAN" } });
      const brokenState = await read(broken.id, caseId);
      assert.equal((await send(command(brokenState, { action: "confirmGoal", title: "Cannot transition" }), broken.id)).status, 409);
      assert.equal((await read(broken.id, caseId)).revision, brokenState.revision);
      assert.equal(await db.goal.count({ where: { situation_id: broken.id } }), 0);
    });
    await t.test("AI failure/invalid output and response after changed context never create authoritative state", async () => {
      state = await read(sid, caseId); const revision = state.revision;
      aiReply = { nonsense: "bad" };
      assert.equal((await send(command(state, { action: "suggestPlan", goalId: state.goal.id }))).status, 400);
      assert.equal((await read(sid, caseId)).revision, revision);
      let resolve; deferredAI = new Promise((r) => { resolve = r; });
      const pending = send(command(state, { action: "suggestPlan", goalId: state.goal.id }));
      await new Promise((r) => setTimeout(r, 30));
      await db.situation.update({ where: { id: sid }, data: { description: "Podklady se změnily během AI" } });
      resolve(content); assert.equal((await pending).status, 409); deferredAI = null;
      state = await read(sid, caseId); assert.equal(state.revision, revision); assert.equal(state.plan, null);
    });
    await t.test("legacy ambiguity requires selection; two concurrent different confirmations cannot both win", async () => {
      // A separate new Situation provides a complete seven-Step workflow.
      const legacy = await createSituation(caseId, { title: "Legacy choice" });
      const a = await db.goal.create({ data: { situation_id: legacy.id, title: "A", status: "active" } });
      const b = await db.goal.create({ data: { situation_id: legacy.id, title: "B", status: "active" } });
      const old = await read(legacy.id, caseId); assert.equal(old.goal, null);
      assert.equal((await send(command(old, { action: "confirmGoal", title: "Silent replacement" }), legacy.id)).status, 409);
      const results = await Promise.all([send(command(old, { action: "confirmGoal", goalId: a.id, title: a.title }), legacy.id), send(command(old, { action: "confirmGoal", goalId: b.id, title: b.title }), legacy.id)]);
      assert.equal(results.filter((r) => r.status === 200).length, 1); await invariant(legacy.id);
      assert.equal(await db.goal.count({ where: { situation_id: legacy.id } }), 2);
    });
    await t.test("database index rejects a second confirmed active goal; Case cascade remains valid", async () => {
      await assert.rejects(db.goal.create({ data: { situation_id: sid, title: "Duplicate authority", status: "active", confirmed_at: new Date() } }), (e) => e.code === "P2002");
      await db.case.delete({ where: { id: caseId } }); assert.equal(await db.situationPlan.count({ where: { situation_id: sid } }), 0);
      assert.deepEqual(await db.$queryRawUnsafe("PRAGMA foreign_key_check"), []);
    });
  } finally { globalThis.prisma = previous; await db.$disconnect(); rmSync(dir, { recursive: true, force: true }); }
});

test("real Responses transport uses existing configuration, validates JSON and fails closed without live requests", async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.OPENAI_API_KEY, previousModel = process.env.OPENAI_MODEL;
  const { requestAIJson } = loader()("src/lib/ai/jsonResponse.ts");
  const { goalSuggestionsSchema } = loader()("src/lib/workflow/planning.ts");
  const answer = { goals: [{ title: "Cíl A", reason: "Uložený požadavek", insightIds: [] }, { title: "Cíl B", reason: "Uložená nejasnost", insightIds: [] }] };
  let calls = 0;
  try {
    delete process.env.OPENAI_API_KEY;
    globalThis.fetch = async () => { throw new Error("No network permitted in this regression"); };
    await assert.rejects(requestAIJson("test", goalSuggestionsSchema), /ručně/);
    process.env.OPENAI_API_KEY = "synthetic-test-only"; process.env.OPENAI_MODEL = "controlled-model";
    globalThis.fetch = async (url, options) => {
      calls++; assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer synthetic-test-only"); assert.equal(JSON.parse(options.body).model, "controlled-model");
      return { ok: true, json: async () => ({ output: [{ content: [{ text: JSON.stringify(answer) }] }] }) };
    };
    assert.deepEqual(await requestAIJson("controlled", goalSuggestionsSchema), answer); assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ output_text: '{"goals":[]}' }) });
    await assert.rejects(requestAIJson("controlled", goalSuggestionsSchema));
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { message: "provider details should not be exposed" } }) });
    await assert.rejects(requestAIJson("controlled", goalSuggestionsSchema), /Ruční zadání/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
  }
});

test("actual planning UI callbacks reject double clicks and stale responses; edits and GET never accept", async (t) => {
  const env = environment(), previous = new Map(["window", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = env.window;
  const responses = [], calls = [];
  globalThis.fetch = (url, options = {}) => {
    calls.push({ url, options }); return new Promise((resolve) => responses.push(resolve));
  };
  const snapshot = { revision: 0, contextHash: "a".repeat(64), goalSelectionRequired: false, goal: null, goals: [], steps: [], plan: null, history: [], inputs: [], evidence: [] };
  const renderer = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", {
    caseId: "case", situationId: "s1", view: "ANALYSIS", onOpenSource: async () => true
  });
  const allRenderers = [renderer];
  const button = (label) => elements(renderer.tree, (e) => e.type === "button" && e.props.children === label)[0];
  async function settle() { for (let i = 0; i < 15; i++) { for (const r of allRenderers) if (!r.disposed) r.render(); await Promise.resolve(); await Promise.resolve(); } }
  const respond = (state, ok = true) => responses.shift()({ ok, json: async () => ok ? { planning: state } : { error: "AI nedostupná" } });
  try {
    await settle(); respond(snapshot); await settle();
    await t.test("typing and selection do not write; immediate double click sends one explicit command", async () => {
      const title = elements(renderer.tree, (e) => e.type === "textarea")[0]; title.props.onChange({ target: { value: "Vlastní konkrétní cíl" } }); await settle();
      assert.equal(calls.filter((c) => c.options.method).length, 0);
      const confirm = button("Potvrdit cíl a otevřít Plán");
      const first = confirm.props.onClick(); confirm.props.onClick(); await settle();
      assert.equal(calls.filter((c) => c.options.method === "POST").length, 1);
      assert.equal(JSON.parse(calls.at(-1).options.body).title, "Vlastní konkrétní cíl");
      respond({ ...snapshot, revision: 1, goal: { id: "g", title: "Vlastní konkrétní cíl" } }); await first; await settle();
    });
    await t.test("editing Plan fields never accepts it; unmount rejects old AI/GET responses", async () => {
      renderer.update({ view: "PLAN" }); await settle();
      const textarea = elements(renderer.tree, (e) => e.type === "textarea")[0]; textarea.props.onChange({ target: { value: "Ruční výstup" } }); await settle();
      assert.equal(calls.filter((c) => c.options.method).length, 1);
      assert.equal(button("Použít tento plán").props.disabled, true);
      assert.equal(button("Navrhnout plán pomocí AI").props.disabled, true, "unsaved manual edits are protected from an AI replacement");
      button("Načíst uložený stav").props.onClick(); await settle();
      respond({ ...snapshot, revision: 1, goal: { id: "g", title: "Vlastní konkrétní cíl" } }); await settle();
      const pending = button("Navrhnout plán pomocí AI").props.onClick(); await settle();
      renderer.dispose();
      respond({ ...snapshot, revision: 2, goal: { id: "old-g", title: "Stará situace" } }); await pending; await settle();
      const next = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "case", situationId: "s2", view: "ANALYSIS", onOpenSource: async () => true }); allRenderers.push(next);
      await settle(); assert.match(calls.at(-1).url, /s2/); respond(snapshot); await settle();
      assert.equal(elements(next.tree, (e) => e.type === "textarea")[0].props.value, "");
      // A pending read is also ignored after leaving the Situation.
      elements(next.tree, (e) => e.type === "button" && e.props.children === "Načíst uložený stav")[0].props.onClick(); await settle(); next.dispose(); respond(snapshot); await settle();
    });
  } finally {
    for (const r of allRenderers) if (!r.disposed) r.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test("coverage refresh hides removed evidence immediately and rail reload follows persisted active Step", async () => {
  const env = environment(), previous = new Map(["window", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = env.window;
  const requests = [], selected = [];
  globalThis.fetch = (url) => new Promise((resolve) => requests.push({ url, resolve }));
  const content = { expectedOutput: "Odpověď", procedure: ["Ověřit"], inputs: [{ title: "Údaj", description: "", criteria: ["Ověřit údaj"] }] };
  const snapshot = { revision: 3, contextHash: "a".repeat(64), goal: { id: "g", title: "Cíl" }, goalSelectionRequired: false, goals: [],
    plan: { id: "p", goal_id: "g", revision: 2, status: "ACCEPTED", content }, history: [],
    inputs: [{ id: "input", title: "Údaj", status: "SATISFIED", criteria: [] }], evidence: [], steps: [] };
  const panel = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", {
    caseId: "case", situationId: "s1", view: "COLLECTION", onOpenSource: async () => true
  });
  const rail = hookRenderer("src/components/workflow/WorkflowRail.tsx", "WorkflowRail", {
    caseId: "case", selectedSituationId: "s1", selectedStepKey: null, onSelectSituation() {}, onSelectStep: (key) => selected.push(key)
  });
  const renderers = [panel, rail];
  async function settle() { for (let i = 0; i < 15; i++) { for (const r of renderers) r.render(); await Promise.resolve(); await Promise.resolve(); } }
  const answer = (contains, data) => { const i = requests.findIndex((r) => r.url.includes(contains)); assert.ok(i >= 0); requests.splice(i, 1)[0].resolve({ ok: true, json: async () => data }); };
  try {
    await settle();
    answer("/planning", { planning: snapshot });
    answer("/situations", { situations: [{ id: "s1", status: "active", title: "Situace" }] });
    answer("/workflow", { workflow: { goals: [{ id: "g", title: "Cíl", status: "active", confirmed_at: "2026-10-30T00:00:00Z" }], workflow_steps: [{ id: "a", step_key: "ANALYSIS", status: "COMPLETED" }, { id: "c", step_key: "COLLECTION", status: "ACTIVE" }] } });
    await settle(); assert.equal(selected.at(-1), "COLLECTION"); assert.equal(byClass(panel.tree, "planning-coverage").length, 1);
    env.window.dispatchEvent(new Event("bureaucat:journal-refresh")); await settle();
    assert.equal(byClass(panel.tree, "planning-coverage").length, 0, "do not show old SATISFIED while evidence refresh is pending");
    answer("/planning", { planning: { ...snapshot, inputs: [{ ...snapshot.inputs[0], status: "INCOMPLETE" }] } }); await settle();
    assert.equal(byClass(panel.tree, "planning-coverage")[0].props.children[0].props.children.at(-1), "Neúplné");
    rail.update({ selectedSituationId: "s2" }); await settle();
    assert.equal(byClass(rail.tree, "workflow-step-button").length, 0, "old Situation's steps are cleared during scope switch");
  } finally {
    for (const r of renderers) r.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
