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
const manualBrief = { trigger: { description: "Vlastní záměr uživatele", documentIds: [] }, requirements: [], deadline: null };
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
  let aiReply, aiCalls = 0, deferredAI = null, lastPrompt = "";
  const load = loader({ "@/lib/ai/jsonResponse": { requestAIJson: async (_prompt, schema) => {
    aiCalls++; lastPrompt = _prompt; const result = deferredAI ? await deferredAI : aiReply; return schema.parse(result);
  } } });
  const { getSituationPlanning: read, executePlanningCommand: execute } = load("src/lib/services/situationPlanning.ts");
  const { createCase } = load("src/lib/services/cases.ts");
  const { createSituation } = load("src/lib/services/situations.ts");
  const { GET, POST } = load("src/app/api/situations/[situationId]/planning/route.ts");
  const content = { version: 2, expectedOutput: "Připravit doloženou odpověď", procedure: [{ id: "action-a", title: "Ověřit údaje", expectedResult: "Ověřené hodnoty", inputIds: ["input-a"] }], inputs: [
    { id: "input-a", title: "Ověřené rozměry", description: "Dvě hodnoty a jejich zdroje", criteria: ["Doložená šířka", "Doložená hloubka"] }
  ] };
  const suggestedContent = { ...content, version: 3, inputs: content.inputs.map((input) => ({ ...input, attachmentRequired: false, suggestedValue: "", insightIds: [] })), procedure: content.procedure.map((action) => ({ ...action, task: null })) };
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
      aiReply = { brief: manualBrief, goals: [{ title: "Doložit rozměry pro vyjádření", reason: "Je vyžadován údaj", insightIds: [width.id] }, { title: "Vyjasnit rozpor měření", reason: "Podklady se rozcházejí", insightIds: [conflict.id] }] };
      const c = command(state, { action: "suggestGoals" }); const result = await send(c);
      assert.equal(result.status, 200); state = result.planning;
      assert.equal(state.goal, null); assert.equal(state.goals.length, 2); assert.ok(state.goals.every((g) => g.status === "draft"));
      assert.ok(state.goals.every((g) => g.reason && g.currentProposal && g.insightIds.length === 1));
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "ANALYSIS");
      const calls = aiCalls; await send(c); assert.equal(aiCalls, calls, "completed request retry has no new AI call");
      assert.equal(await db.goal.count({ where: { situation_id: sid } }), 2);
    });
    await t.test("request, sketch and issued application produce one umbrella Goal with separately sourced requirements and deadline", async () => {
      const target = await createSituation(caseId, { title: "Doplnění žádosti" });
      const documents = [];
      const references = [];
      for (const [name, body] of [["Odeslaná žádost", "Žádám o povolení umístění stojanu."], ["Novější náčrt", "Šířka 1,80 m a hloubka 1,20 m."], ["Výzva", "Doplňte poštovní adresu a rozměry do 11. září."]]) {
        const d = await db.document.create({ data: { case_id: caseId, filename: name, filetype: "txt", original_file: "", processed_text: body } });
        documents.push(d); await db.situationDocument.create({ data: { situation_id: target.id, document_id: d.id } });
        references.push(await db.documentInsight.create({ data: { document_id: d.id, source_document_id: d.id, title: name, content: body, source_text: body, source_start_offset: 0, source_end_offset: body.length, insight_type: "fact", evidence_state: "verified", target_section: "description", target_item_type: "FACT", status: "approved" } }));
      }
      const brief = { trigger: { description: "Doručená výzva k doplnění žádosti", documentIds: [documents[2].id] }, requirements: [{ text: "Úplná poštovní adresa", insightIds: [references[2].id] }, { text: "Šířka a hloubka stojanu", insightIds: [references[2].id] }], deadline: { text: "do 11. září", insightIds: [references[2].id] } };
      aiReply = { brief, goals: [{ title: "Připravit a odeslat doplnění žádosti podle výzvy", reason: "Reakce občana na výzvu", insightIds: [references[2].id] }] };
      let current = await read(target.id, caseId);
      const response = await send(command(current, { action: "suggestGoals" }), target.id);
      assert.equal(response.status, 200); current = response.planning;
      assert.equal(current.goals.length, 1); assert.deepEqual(current.brief, brief); assert.equal(current.documents.length, 3);
      const promptData = JSON.parse(lastPrompt.slice(lastPrompt.lastIndexOf('\n') + 1));
      assert.deepEqual(promptData.allowedInsightIds, references.map((r) => r.id).sort());
      assert.ok(promptData.findings.every((finding) => !Object.hasOwn(finding, "journalItemId")), "presentation-only metadata must not alter AI context");
      assert.ok(lastPrompt.includes("Dílčí požadavky nejsou alternativní cíle")); assert.ok(lastPrompt.includes("novější datum přílohy automaticky neurčuje podnět"));
      current = (await send(command(current, { action: "confirmGoal", goalId: current.goals[0].id, title: current.goals[0].title }), target.id)).planning;
      assert.deepEqual((await read(target.id, caseId)).brief, brief);
      assert.ok(!current.inputs.length, "request does not declare existing sketch data missing");
      const event = await db.workflowEvent.findFirst({ where: { situation_id: target.id, event_type: "PLANNING_confirmGoal" } });
      assert.deepEqual(JSON.parse(event.payload_json).brief, brief);
      // Different Situation's existing insight/document IDs are still foreign.
      for (const invalid of [{ ...brief, trigger: { description: "Foreign", documentIds: [doc.id] } }, { ...brief, requirements: [{ text: "Foreign", insightIds: [width.id] }] }]) {
        aiReply = { brief: invalid, goals: [{ title: "No write", reason: "No", insightIds: [] }] };
        assert.equal((await send(command(current, { action: "suggestGoals" }), target.id)).status, 409);
      }
      const { situationBriefSchema } = loader()("src/lib/workflow/planning.ts");
      assert.deepEqual(situationBriefSchema.parse({ ...brief, trigger: { ...brief.trigger, documentIds: [documents[2].id, documents[2].id] } }).trigger.documentIds, [documents[2].id]);
      aiReply = suggestedContent;
      const draftResponse = await send(command(current, { action: "suggestPlan", goalId: current.goal.id }), target.id);
      assert.equal(draftResponse.status, 200); current = draftResponse.planning;
      const planContext = JSON.parse(lastPrompt.slice(lastPrompt.lastIndexOf('\n') + 1));
      assert.deepEqual(planContext.situationBrief, brief); assert.ok(planContext.findings.some((finding) => finding.value.includes("1,80 m")));
      assert.ok(lastPrompt.includes("Nezadávej získávání informace, která již je doložená"));
      current = (await send(command(current, { action: "acceptPlan", planId: current.plan.id }), target.id)).planning;
      const oldPlanId = current.plan.id;
      current = (await send(command(current, { action: "confirmGoal", goalId: current.goal.id, title: current.goal.title, brief: { ...brief, trigger: { ...brief.trigger, description: "Výslovně změněný podnět" } } }), target.id)).planning;
      assert.equal(current.plan, null); assert.equal(current.history.find((plan) => plan.id === oldPlanId).status, "SUPERSEDED", "changed brief revokes old Plan consent even with same Goal title");
      const ambiguous = { ...manualBrief, trigger: { description: "Nejasné, zda reagovat na žádost či výzvu", documentIds: documents.slice(0, 1).map((d) => d.id) } };
      const result = await send(command(current, { action: "confirmGoal", title: "Vlastní Akce", brief: manualBrief }), target.id);
      assert.equal(result.status, 200); assert.deepEqual(result.planning.brief, manualBrief);
      const choice = await send(command(result.planning, { action: "confirmGoal", title: "Upravený podnět", brief: ambiguous }), target.id);
      assert.equal(choice.status, 200); assert.deepEqual(choice.planning.brief, ambiguous);
      await invariant(target.id);
    });
    await t.test("confirmed brief survives source removal as history; actual refreshed editor clears or replaces references and reconfirms", async () => {
      const target = await createSituation(caseId, { title: "Brief repair" });
      const refs = [];
      for (const name of ["Removed request", "Replacement request"]) {
        const body = "Doplňte údaje do 11. září.";
        const document = await db.document.create({ data: { case_id: caseId, filename: name, filetype: "txt", original_file: "", processed_text: body } });
        await db.situationDocument.create({ data: { situation_id: target.id, document_id: document.id } });
        const insight = await db.documentInsight.create({ data: { document_id: document.id, source_document_id: document.id, title: name, content: body, source_text: body, source_start_offset: 0, source_end_offset: body.length, insight_type: "fact", evidence_state: "verified", target_section: "description", target_item_type: "FACT", status: "approved" } });
        refs.push({ document, insight });
      }
      const brief = { trigger: { description: "Výzva", documentIds: [refs[0].document.id] }, requirements: [{ text: "Doplnit údaje", insightIds: [refs[0].insight.id] }], deadline: { text: "11. září", insightIds: [refs[0].insight.id] } };
      let current = await read(target.id, caseId);
      current = (await send(command(current, { action: "confirmGoal", title: "Doplnit žádost", brief }), target.id)).planning;
      assert.equal(current.deadlineVerified, true);
      const original = await db.workflowEvent.findFirst({ where: { situation_id: target.id, event_type: "PLANNING_confirmGoal" } });
      const env = environment(), previousWindow = globalThis.window, previousFetch = globalThis.fetch;
      globalThis.window = env.window;
      let hold = false, release, posted;
      const operations = [];
      globalThis.fetch = (_url, options = {}) => {
        const operation = (async () => {
          if (!options.method) {
            if (hold) await new Promise((resolve) => release = resolve);
            const planning = await read(target.id, caseId);
            return { ok: true, json: async () => ({ planning }) };
          }
          posted = JSON.parse(options.body);
          const result = await send(posted, target.id);
          return { ok: result.status === 200, json: async () => result };
        })(); operations.push(operation); return operation;
      };
      const panel = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId, situationId: target.id, view: "ANALYSIS", onOpenSource: async () => true });
      const settle = async () => { for (let i = 0; i < 30; i++) { panel.render(); await new Promise((resolve) => setImmediate(resolve)); } };
      const button = (text) => elements(panel.tree, (e) => e.type === "button" && e.props.children === text)[0];
      const field = (text) => elements(panel.tree, (e) => e.type === "label" && e.props.children?.[0] === text)[0].props.children[1];
      try {
        await settle(); await operations.at(-1); await settle(); button("Změnit").props.onClick(); await settle();
        field("Čeho chcete dosáhnout?").props.onChange({ target: { value: "Rozepsaný opravený cíl" } }); await settle();
        await db.situationDocument.deleteMany({ where: { situation_id: target.id, document_id: refs[0].document.id } });
        await new Promise((resolve) => setImmediate(resolve)); queries.length = 0;
        hold = true; env.window.dispatchEvent(new Event("bureaucat:journal-refresh")); await settle();
        assert.ok(release); assert.ok(!JSON.stringify(panel.tree).includes('"Doložený explicitní termín"'));
        release(); hold = false; await operations.at(-1); await settle();
        assert.equal(field("Čeho chcete dosáhnout?").props.value, "Rozepsaný opravený cíl");
        assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)), queries.join("\n"));
        current = await read(target.id, caseId);
        assert.equal(current.deadlineVerified, false); assert.deepEqual(current.historicalBrief, brief);
        assert.deepEqual(current.brief.trigger.documentIds, []); assert.deepEqual(current.brief.requirements[0].insightIds, []);
        assert.deepEqual(current.brief.deadline.insightIds, []); assert.equal(current.brief.deadline.text, "11. září");
        assert.equal((await send(command(current, { action: "confirmGoal", goalId: current.goal.id, title: current.goal.title }), target.id)).status, 409, "implicit confirmation cannot silently clean historical links");
        aiReply = { brief: current.brief, goals: [{ title: "Nedoložený termín z AI", reason: "Test", insightIds: [] }] };
        assert.equal((await send(command(current, { action: "suggestGoals" }), target.id)).status, 409, "AI still needs an actual source for a deadline");
        for (const id of ["unknown-id", width.id]) {
          const invalid = { ...current.brief, requirements: [{ text: "Wrong source", insightIds: [id] }] };
          assert.equal((await send(command(current, { action: "confirmGoal", goalId: current.goal.id, title: current.goal.title, brief: invalid }), target.id)).status, 409);
        }
        field("Podnět / co nyní řešíme").props.onChange({ target: { value: "Opravený podnět bez původního zdroje" } }); await settle();
        button("Potvrdit cíl").props.onClick(); await operations.at(-1); await settle();
        current = await read(target.id, caseId);
        assert.equal(current.goal.title, "Rozepsaný opravený cíl"); assert.equal(current.brief.trigger.description, "Opravený podnět bez původního zdroje");
        assert.deepEqual(posted.brief.requirements[0].insightIds, []); assert.deepEqual(posted.brief.deadline.insightIds, []);
        assert.equal(current.deadlineVerified, false); assert.equal(current.brief.deadline.text, "11. září");
        assert.equal((await db.workflowEvent.findUnique({ where: { id: original.id } })).payload_json, original.payload_json);
        assert.ok(current.briefHistory.some((entry) => entry.id === original.id && entry.brief.deadline.insightIds.includes(refs[0].insight.id)));
        button("Změnit").props.onClick(); await settle();
        let selectors = elements(panel.tree, (e) => e.type?.name === "BriefSourceSelection");
        assert.equal(selectors.length, 2);
        for (let i = 0; i < 2; i++) {
          selectors = elements(panel.tree, (e) => e.type?.name === "BriefSourceSelection");
          const actual = selectors[i].type(selectors[i].props);
          const boxes = elements(actual, (e) => e.type === "input"); assert.equal(boxes.length, 1);
          boxes[0].props.onChange({ target: { checked: true } }); await settle();
        }
        button("Potvrdit cíl").props.onClick(); await operations.at(-1); await settle();
        current = await read(target.id, caseId); assert.equal(current.deadlineVerified, true);
        assert.deepEqual(current.brief.deadline.insightIds, [refs[1].insight.id]);
        assert.deepEqual(current.brief.requirements[0].insightIds, [refs[1].insight.id]);
        button("Změnit").props.onClick(); await settle();
        button("Odebrat termín").props.onClick(); await settle();
        button("Potvrdit cíl").props.onClick(); await operations.at(-1); await settle();
        current = await read(target.id, caseId); assert.equal(current.brief.deadline, null); assert.equal(current.deadlineVerified, false);
        assert.equal((await db.workflowEvent.findUnique({ where: { id: original.id } })).payload_json, original.payload_json);
        await invariant(target.id);
      } finally { panel.dispose(); globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
    });
    await t.test("Analysis question source metadata is read-only and keeps Journal links and insight identity", async () => {
      const target = await createSituation(caseId, { title: "Question source projection" });
      const ownDoc = await db.document.create({ data: { case_id: caseId, filename: "isolated-question.txt", filetype: "txt", original_file: "", processed_text: "Šířka je 1,80 m." } });
      await db.situationDocument.create({ data: { situation_id: target.id, document_id: ownDoc.id } });
      const ownInsight = await db.documentInsight.create({ data: { document_id: ownDoc.id, source_document_id: ownDoc.id, title: "Šířka", content: "Šířka je 1,80 m.", source_text: "Šířka je 1,80 m.", source_start_offset: 0, source_end_offset: 15, insight_type: "fact", evidence_state: "verified", target_section: "description", target_item_type: "FACT", status: "approved" } });
      const links = [{ insightId: ownInsight.id, documentId: ownDoc.id, sourceText: ownInsight.source_text }];
      const item = await db.journalItem.create({ data: { case_id: caseId, situation_id: target.id, section: "open_questions", item_type: "QUESTION", title: "Ověřit šířku", value: "Je míra doložená?", source_links_json: JSON.stringify(links) } });
      await db.documentInsight.update({ where: { id: ownInsight.id }, data: { journal_item_id: item.id } });
      await new Promise((resolve) => setImmediate(resolve)); queries.length = 0;
      const current = await read(target.id, caseId);
      const { analysisOverview } = loader()("src/lib/workflow/analysisOverview.ts");
      const overview = analysisOverview(current); analysisOverview(current);
      assert.deepEqual(current.preliminary[0].sourceLinks, links);
      assert.equal(current.evidence.find((e) => e.id === ownInsight.id).journalItemId, item.id);
      assert.equal(overview.questions[0].sources[0].key, `insight:${ownInsight.id}`);
      assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)), queries.join("\n"));
      assert.equal((await db.journalItem.findUnique({ where: { id: item.id } })).source_links_json, JSON.stringify(links));
    });
    await t.test("atomic completion batch stores USER assertions, explicit attachments, invalidation, scope and rollback", async () => {
      const target = await createSituation(caseId, { title: "Completion form" });
      let current = await read(target.id, caseId);
      current = (await send(command(current, { action: "confirmGoal", title: "Připravit odpověď" }), target.id)).planning;
      const combined = { ...content, inputs: [{ ...content.inputs[0], criteria: ["Poštovní adresa a rozměry", "Další požadovaná informace"] }] };
      current = (await send(command(current, { action: "savePlan", goalId: current.goal.id, content: combined }), target.id)).planning;
      current = (await send(command(current, { action: "acceptPlan", planId: current.plan.id }), target.id)).planning;
      const [first, second] = current.inputs[0].criteria;
      assert.equal(first.requirement_text, "Poštovní adresa a rozměry", "accepted compound requirement remains one editable row");
      const review = (criterionId, value, sufficient, documentIds = [], insightIds = [], origin = "USER") => ({ criterionId, value, sufficient, documentIds, insightIds, origin, explanation: "Výslovné uživatelské doplnění" });
      const batch = (reviews, base = current) => command(base, { action: "reviewInputs", planId: current.plan.id, reviews });
      const beforeInsights = await db.documentInsight.count(); const beforePins = await db.documentPin.count();
      const manual = batch([review(first.id, "Ručně zadaná hodnota", true), review(second.id, "Rozepsaný údaj", false)]);
      let response = await send(manual, target.id); assert.equal(response.status, 200); current = response.planning;
      assert.equal(current.inputs[0].criteria[0].status, "SATISFIED"); assert.equal(current.inputs[0].criteria[0].origin, "USER");
      assert.deepEqual(current.inputs[0].criteria[0].sources, []); assert.equal(current.inputs[0].criteria[1].status, "MISSING");
      assert.equal((await read(target.id, caseId)).inputs[0].criteria[0].value, "Ručně zadaná hodnota");
      assert.equal(await db.documentInsight.count(), beforeInsights); assert.equal(await db.documentPin.count(), beforePins);
      const revision = current.revision; assert.equal((await send(manual, target.id)).status, 200); assert.equal((await read(target.id, caseId)).revision, revision);
      current = (await send(batch([review(first.id, "Změněná hodnota", false)]), target.id)).planning;
      assert.equal(current.inputs[0].criteria[0].status, "MISSING");
      current = (await send(batch([review(first.id, "Změněná hodnota", true)]), target.id)).planning;
      const attachment = await db.document.create({ data: { case_id: caseId, filename: "attached.txt", filetype: "txt", original_file: "", processed_text: "Uploaded information" } });
      await db.situationDocument.create({ data: { situation_id: target.id, document_id: attachment.id } });
      current = await read(target.id, caseId); assert.equal(current.inputs[0].criteria[1].status, "MISSING", "file presence is not sufficiency");
      assert.equal(current.inputs[0].criteria[0].status, "SATISFIED", "unrelated upload does not revoke a source-independent assertion");
      const context = await load("src/lib/services/caseContext.ts").buildCaseContext(caseId, target.id);
      assert.equal(context.workflow.required_inputs[0].criteria[0].origin, "USER");
      assert.equal(context.workflow.required_inputs[0].criteria[0].status, "SATISFIED");
      current = (await send(batch([review(second.id, "Hodnota s přílohou", false, [attachment.id])]), target.id)).planning;
      assert.equal(current.inputs[0].criteria[1].status, "MISSING"); assert.equal(current.inputs[0].criteria[1].attachments.length, 1);
      assert.equal((await send(batch([review(second.id, "Value", true, [attachment.id], [], "DOCUMENT")]), target.id)).status, 409, "a file is not document verification");
      const ambiguous = await db.documentInsight.create({ data: { document_id: attachment.id, source_document_id: attachment.id, title: "Rozpor", content: "Uploaded information", source_text: "Uploaded information", source_start_offset: 0, source_end_offset: 20, insight_type: "conflict", evidence_state: "conflict", target_section: "description", target_item_type: "FACT", status: "approved" } });
      current = await read(target.id, caseId);
      assert.equal((await send(batch([review(second.id, "User assertion", true, [attachment.id], [ambiguous.id])]), target.id)).status, 409, "USER origin cannot launder a conflicting document source");
      current = (await send(batch([review(second.id, "Hodnota s přílohou", true, [attachment.id, attachment.id])]), target.id)).planning;
      assert.equal(current.inputs[0].criteria[1].status, "SATISFIED"); assert.equal(current.inputs[0].criteria[1].attachments.length, 1);
      const stored = await db.requiredInputCriterion.findUnique({ where: { id: second.id } });
      const duplicates = JSON.parse(stored.evidence_refs_json); duplicates.documents.unshift({ documentId: attachment.id, fingerprint: "wrong duplicate" });
      const duplicateJson = JSON.stringify(duplicates);
      await db.requiredInputCriterion.update({ where: { id: second.id }, data: { evidence_refs_json: duplicateJson } });
      const duplicateRead = await read(target.id, caseId); assert.equal(duplicateRead.inputs[0].criteria[1].stale, true);
      assert.equal(duplicateRead.inputs[0].criteria[1].status, "MISSING"); assert.equal(duplicateRead.inputs[0].criteria[1].attachments.length, 1);
      assert.equal((await db.requiredInputCriterion.findUnique({ where: { id: second.id } })).evidence_refs_json, duplicateJson, "GET cannot rewrite duplicate attachment history");
      await db.requiredInputCriterion.update({ where: { id: second.id }, data: { evidence_refs_json: stored.evidence_refs_json } });
      await db.situationDocument.deleteMany({ where: { situation_id: target.id, document_id: attachment.id } });
      await new Promise((resolve) => setImmediate(resolve)); queries.length = 0;
      current = await read(target.id, caseId); assert.equal(current.inputs[0].criteria[1].status, "MISSING"); assert.equal(current.inputs[0].criteria[1].stale, true);
      assert.equal(current.inputs[0].criteria[0].status, "SATISFIED");
      assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)));
      assert.equal((await db.requiredInputCriterion.findUnique({ where: { id: second.id } })).evidence_refs_json, stored.evidence_refs_json);
      current = (await send(batch([review(first.id, "Ponechat vlastní údaj", true)]), target.id)).planning;
      assert.equal((await db.requiredInput.findUnique({ where: { id: current.inputs[0].id } })).status, "INCOMPLETE", "explicit save must aggregate effective stale support, not raw SATISFIED flags");
      current = (await send(batch([review(second.id, "Nezávislé ruční doplnění", true)]), target.id)).planning;
      assert.equal(current.inputs[0].criteria[1].status, "SATISFIED"); assert.ok(current.inputs[0].criteria[1].historicalDocumentIds.includes(attachment.id));
      const foreign = await db.document.create({ data: { case_id: otherCase.id, filename: "foreign.txt", filetype: "txt", original_file: "" } });
      const stable = current.inputs[0].criteria[0].value, stableRevision = current.revision;
      for (const bad of [review(second.id, "", true), review(second.id, "Bad", true, [foreign.id]), review(second.id, "Bad", true, [], [width.id]), review(second.id, "Bad", true, [], ["unknown"])]) {
        const result = await send(batch([review(first.id, "Must roll back", true), bad]), target.id); assert.equal(result.status, 409);
        assert.equal((await read(target.id, caseId)).inputs[0].criteria[0].value, stable); assert.equal((await read(target.id, caseId)).revision, stableRevision);
      }
      assert.equal((await send(batch([review(first.id, "Duplicate", true), review(first.id, "Duplicate", true)]), target.id)).status, 400);
      const concurrent = await Promise.all([send(batch([review(first.id, "Concurrent A", true)]), target.id), send(batch([review(first.id, "Concurrent B", true)]), target.id)]);
      assert.equal(concurrent.filter((result) => result.status === 200).length, 1); assert.equal(concurrent.filter((result) => result.status === 409).length, 1);
      current = await read(target.id, caseId);
      await db.$executeRawUnsafe(`CREATE TRIGGER fail_completion BEFORE UPDATE ON RequiredInputCriterion WHEN NEW.id = '${second.id}' BEGIN SELECT RAISE(ABORT, 'controlled completion failure'); END`);
      const prior = JSON.stringify(current.inputs);
      assert.equal((await send(batch([review(first.id, "No partial save", true), review(second.id, "Fail", true)]), target.id)).status, 503);
      assert.equal(JSON.stringify((await read(target.id, caseId)).inputs), prior);
      await db.$executeRawUnsafe("DROP TRIGGER fail_completion");
      const oldPlan = current.plan.id;
      const oldJson = (await db.situationPlan.findUnique({ where: { id: oldPlan } })).content_json;
      const split = { ...content, inputs: [{ ...content.inputs[0], criteria: ["Poštovní adresa", "Šířka", "Hloubka"] }] };
      current = (await send(batch([review(first.id, current.inputs[0].criteria[0].value, false)]), target.id)).planning;
      const replacement = await send(command(current, { action: "savePlan", goalId: current.goal.id, content: split }), target.id);
      assert.equal(replacement.status, 200); current = replacement.planning;
      assert.equal(current.plan.status, "DRAFT"); assert.equal(current.inputs.length, 0);
      assert.equal((await db.situationPlan.findUnique({ where: { id: oldPlan } })).content_json, oldJson);
      current = (await send(command(current, { action: "acceptPlan", planId: current.plan.id }), target.id)).planning;
      assert.equal(current.inputs[0].criteria.length, 3); assert.ok(current.inputs[0].criteria.every((criterion) => criterion.status === "MISSING"));
      assert.equal(await db.requiredInputCriterion.count({ where: { required_input: { plan_id: oldPlan } } }), 2);
      await invariant(target.id);
    });
    await t.test("v3 information names, criteria, explicit files and WorkflowTasks stay distinct with sourced deadlines", async () => {
      const target = await createSituation(caseId, { title: "Information and tasks" });
      const body = "Adresa: Testovací 12. Rozměry: 1,80 x 1,20 m. Doplnění do 11. září. Přiložte náčrt.";
      const doc = await db.document.create({ data: { case_id: caseId, filename: "arbitrary-fixture.txt", filetype: "txt", original_file: "", processed_text: body } });
      await db.situationDocument.create({ data: { situation_id: target.id, document_id: doc.id } });
      const finding = async (title, quote, value = quote) => db.documentInsight.create({ data: { document_id: doc.id, source_document_id: doc.id, title, content: value, source_text: quote, source_start_offset: body.indexOf(quote), source_end_offset: body.indexOf(quote) + quote.length, insight_type: "fact", evidence_state: "verified", status: "approved", target_section: "description", target_item_type: "FACT" } });
      const address = await finding("Adresa", "Adresa: Testovací 12.", "Testovací 12");
      const dimensions = await finding("Rozměry", "Rozměry: 1,80 x 1,20 m.", "1,80 x 1,20 m");
      const due = await finding("Termín", "Doplnění do 11. září.");
      let current = await read(target.id, caseId);
      const brief = { trigger: { description: "Výzva k doplnění", documentIds: [doc.id] }, requirements: [{ text: "Poštovní adresa a rozměry", insightIds: [address.id, dimensions.id] }], deadline: { text: "do 11. září", insightIds: [due.id] } };
      current = (await send(command(current, { action: "confirmGoal", title: "Připravit a odeslat doplnění", brief }), target.id)).planning;
      const legacy = { ...content, inputs: [{ ...content.inputs[0], criteria: ["Adresa a rozměry jsou uvedeny úplně"] }] };
      current = (await send(command(current, { action: "savePlan", goalId: current.goal.id, content: legacy }), target.id)).planning;
      current = (await send(command(current, { action: "acceptPlan", planId: current.plan.id }), target.id)).planning;
      const oldPlan = current.plan.id, oldCriterion = current.inputs[0].criteria[0].id;
      current = (await send(command(current, { action: "reviewInputs", planId: oldPlan, reviews: [{ criterionId: oldCriterion, value: "Staré kombinované doplnění", sufficient: true, origin: "USER", insightIds: [], documentIds: [], explanation: "Historie" }] }), target.id)).planning;
      const original = await db.requiredInputCriterion.findUnique({ where: { id: oldCriterion } });
      assert.equal(current.needsPlanRevision, true);
      const { editPlan } = load("src/lib/workflow/planning.ts");
      const editing = editPlan(current.plan.content); assert.equal(editing.inputs.length, 1); assert.deepEqual(editing.inputs[0].criteria, legacy.inputs[0].criteria);
      const modern = { version: 3, expectedOutput: "Doplnění žádosti", inputs: [
        { id: "postal", title: "Poštovní adresa žadatele", description: "", criteria: ["Adresa je úplná"], attachmentRequired: false, suggestedValue: address.content, insightIds: [address.id] },
        { id: "sizes", title: "Rozměry stojanu", description: "", criteria: ["Šířka a hloubka jsou určeny"], attachmentRequired: false, suggestedValue: dimensions.content, insightIds: [dimensions.id] },
        { id: "sketch", title: "Vyžádaný náčrt", description: "", criteria: ["Příloha zachycuje umístění"], attachmentRequired: true, suggestedValue: "", insightIds: [] }
      ], procedure: [
        { id: "prepare", title: "Připravit odpověď", expectedResult: "Připravená odpověď", inputIds: ["postal", "sizes"], task: null },
        { id: "send", title: "Odeslat doplnění", expectedResult: "Uchovaný doklad o odeslání", inputIds: ["postal", "sizes"], task: { stepKey: "EXECUTION", deadlineFromBrief: true } }
      ] };
      aiReply = { ...modern, inputs: modern.inputs.map((input, index) => index === 0 ? { ...input, suggestedValue: "Invented value" } : input) };
      assert.equal((await send(command(current, { action: "suggestPlan", goalId: current.goal.id }), target.id)).status, 409, "AI cannot invent a prefilled value");
      assert.equal((await send(command(current, { action: "savePlan", goalId: current.goal.id, content: { ...modern, inputs: modern.inputs.map((input, index) => index === 0 ? { ...input, insightIds: [width.id] } : input) } }), target.id)).status, 409, "references remain Situation-scoped");
      current = (await send(command(current, { action: "savePlan", goalId: current.goal.id, content: modern }), target.id)).planning;
      assert.equal(current.inputs.length, 0); assert.equal(await db.workflowTask.count({ where: { situation_id: target.id } }), 0);
      const acceptance = command(current, { action: "acceptPlan", planId: current.plan.id });
      current = (await send(acceptance, target.id)).planning; assert.equal((await send(acceptance, target.id)).status, 200);
      assert.equal(current.needsPlanRevision, false); assert.deepEqual(current.inputs.map((input) => input.title), modern.inputs.map((input) => input.title));
      assert.deepEqual(current.inputs.map((input) => input.attachmentRequired), [false, false, true]);
      assert.ok(current.inputs.every((input) => input.criteria.every((criterion) => criterion.status === "MISSING")));
      assert.equal(current.inputs[0].criteria[0].value, address.content); assert.equal(current.inputs[1].criteria[0].value, dimensions.content);
      assert.equal((await db.requiredInputCriterion.findUnique({ where: { id: oldCriterion } })).evidence_refs_json, original.evidence_refs_json);
      assert.equal((await db.requiredInputCriterion.findUnique({ where: { id: oldCriterion } })).status, "SATISFIED");
      assert.equal(current.tasks.length, 1); assert.equal(current.tasks[0].deadline, "do 11. září"); assert.equal(current.tasks[0].completed, false);
      const execution = await db.workflowStep.findUnique({ where: { situation_id_step_key: { situation_id: target.id, step_key: "EXECUTION" } } });
      assert.equal((await db.workflowTask.findUnique({ where: { id: current.tasks[0].id } })).workflow_step_id, execution.id); assert.equal(execution.status, "INACTIVE");
      const form = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", { state: current, caseId, situationId: target.id, disabled: false, refreshing: false, onUploaded() {}, onSave: async () => null });
      try {
        form.render(); const rows = byClass(form.tree, "required-input-row"); assert.deepEqual(rows.map((row) => row.props["aria-label"]), modern.inputs.map((input) => input.title));
        assert.equal(elements(form.tree, (e) => e.type === "details" || e.type === "select").length, 0);
        assert.ok(!JSON.stringify(form.tree).includes("Adresa je úplná"));
        const taskRow = byClass(form.tree, "required-task-row")[0]; assert.equal(elements(taskRow, (e) => e.type === "input" && e.props.type === "text").length, 0);
        assert.equal(elements(form.tree, (e) => e.type === "button" && e.props.children === "📎").length, 1);
        const file = elements(form.tree, (e) => e.type === "input" && e.props.type === "file")[0]; assert.equal(file.props.hidden, true);
        let picked = 0; file.props.ref({ click() { picked++; } });
        elements(form.tree, (e) => e.type === "button" && e.props.children === "📎")[0].props.onClick(); assert.equal(picked, 1);
      } finally { form.dispose(); }
      const reviews = current.inputs.slice(0, 2).flatMap((input) => input.criteria.map((criterion) => ({ criterionId: criterion.id, value: criterion.value, sufficient: true, origin: "USER", insightIds: [], documentIds: [], explanation: "Výslovné doplnění" })));
      current = (await send(command(current, { action: "reviewInputs", planId: current.plan.id, reviews }), target.id)).planning;
      assert.equal(current.tasks[0].completed, false, "filling information never confirms sending");
      const taskId = current.tasks[0].id, steps = JSON.stringify(current.steps);
      const done = command(current, { action: "reviewInputs", planId: current.plan.id, reviews: [], tasks: [{ taskId, completed: true }] });
      current = (await send(done, target.id)).planning; assert.equal((await send(done, target.id)).status, 200);
      assert.equal(current.tasks[0].completed, true); assert.equal(JSON.stringify(current.steps), steps);
      assert.equal((await db.situation.findUnique({ where: { id: target.id } })).status, "active");
      assert.equal(await db.workflowTask.count({ where: { situation_id: target.id } }), 1);
      const before = current.inputs[0].criteria[0].value;
      const foreignStep = await db.workflowStep.findUnique({ where: { situation_id_step_key: { situation_id: other.id, step_key: "EXECUTION" } } });
      const foreignTask = await db.workflowTask.create({ data: { situation_id: other.id, workflow_step_id: foreignStep.id, title: "Foreign work" } });
      assert.equal((await send(command(current, { action: "reviewInputs", planId: current.plan.id, reviews: [], tasks: [{ taskId: foreignTask.id, completed: true }] }), target.id)).status, 409);
      assert.equal((await db.workflowTask.findUnique({ where: { id: foreignTask.id } })).status, "PENDING");
      const invalid = await send(command(current, { action: "reviewInputs", planId: current.plan.id, reviews: [{ ...reviews[0], value: "Must roll back" }], tasks: [{ taskId: "foreign-task", completed: true }] }), target.id);
      assert.equal(invalid.status, 409); assert.equal((await read(target.id, caseId)).inputs[0].criteria[0].value, before);
      const noFile = await send(command(current, { action: "reviewInputs", planId: current.plan.id, reviews: [{ ...reviews[0], documentIds: [doc.id], sufficient: false }] }), target.id); assert.equal(noFile.status, 409);
      await db.situationDocument.deleteMany({ where: { situation_id: target.id, document_id: doc.id } });
      await new Promise((resolve) => setImmediate(resolve)); queries.length = 0; current = await read(target.id, caseId);
      assert.equal(current.tasks[0].deadline, null); assert.equal(current.tasks[0].deadlineStale, true); assert.equal(current.tasks[0].completed, true);
      assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)));
      const changed = await send(command(current, { action: "savePlan", goalId: current.goal.id, content: { ...modern, inputs: modern.inputs.map((input) => ({ ...input, suggestedValue: "", insightIds: [] })) } }), target.id);
      assert.equal(changed.status, 200); current = changed.planning;
      const countBefore = await db.workflowTask.count({ where: { situation_id: target.id } });
      assert.equal((await send(command(current, { action: "acceptPlan", planId: current.plan.id }), target.id)).status, 409, "deadline cannot be invented from a removed source");
      assert.equal(await db.workflowTask.count({ where: { situation_id: target.id } }), countBefore);
      assert.equal((await read(target.id, caseId)).inputs.length, 0);
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
    await t.test("legacy Plan reads and acceptance preserve content; only explicit new saves use version 2", async () => {
      const legacy = { expectedOutput: "Starý výstup", procedure: ["Starý bod"], inputs: [{ title: "Starý vstup", description: "", criteria: ["Staré kritérium"] }] };
      const plan = await db.situationPlan.create({ data: { situation_id: sid, goal_id: state.goal.id, revision: -1, context_hash: state.contextHash, content_json: JSON.stringify(legacy) } });
      await new Promise((resolve) => setImmediate(resolve));
      queries.length = 0; state = await read(sid, caseId);
      assert.deepEqual(state.plan.content, legacy); assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)), queries.join("\n"));
      const { editPlan } = load("src/lib/workflow/planning.ts");
      const editing = editPlan(state.plan.content);
      assert.equal(editing.version, 3); assert.equal(editing.procedure[0].expectedResult, ""); assert.deepEqual(editing.procedure[0].inputIds, []);
      assert.notEqual(editing.inputs[0].id, editing.inputs[0].title);
      assert.equal((await send(command(state, { action: "savePlan", goalId: state.goal.id, content: legacy }))).status, 400);
      state = (await send(command(state, { action: "acceptPlan", planId: plan.id }))).planning;
      assert.equal(state.plan.status, "ACCEPTED"); assert.deepEqual(state.plan.content, legacy);
      const before = await db.situationPlan.findUnique({ where: { id: plan.id } }); await read(sid, caseId);
      assert.deepEqual(await db.situationPlan.findUnique({ where: { id: plan.id } }), before);
    });
    await t.test("new Plan IDs and references are validated independently of names and ordering", async () => {
      for (const bad of [
        { ...content, inputs: [content.inputs[0], content.inputs[0]] },
        { ...content, procedure: [content.procedure[0], content.procedure[0]] },
        { ...content, procedure: [{ ...content.procedure[0], inputIds: ["foreign-input"] }] },
        { ...content, procedure: [{ ...content.procedure[0], inputIds: ["input-a", "input-a"] }] }
      ]) assert.equal((await send(command(state, { action: "savePlan", goalId: state.goal.id, content: bad }))).status, 400);
      const { newPlanContentSchema } = load("src/lib/workflow/planning.ts");
      assert.deepEqual(newPlanContentSchema.parse({ ...content, inputs: content.inputs.map((i) => ({ ...i, title: "Renamed", criteria: [...i.criteria].reverse() })) }).procedure[0].inputIds, ["input-a"]);
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
      assert.equal(state.inputs.length, 1); assert.equal(state.inputs[0].criteria.length, 2); assert.equal(state.inputs[0].status, "MISSING"); assert.ok(state.inputs[0].criteria.every((c) => c.assessed === false));
      assert.equal(state.steps.find((s) => s.status === "ACTIVE").step_key, "COLLECTION");
      await send(c); assert.equal(await db.requiredInput.count({ where: { plan_id: state.plan.id } }), 1); await invariant();
    });
    await t.test("AI matches expose conflicting variants, absent data is not a negative fact, no automatic SATISFIED", async () => {
      const [a, b] = state.inputs[0].criteria;
      aiReply = { matches: [{ criterionId: a.id, value: "1,80 m / 1,20 m", insightIds: [width.id, width.id, conflict.id, conflict.id], explanation: "Rozpor hodnot; nutné vyjasnit" }, { criterionId: b.id, value: "", insightIds: [], explanation: "Hloubka není doložena, nelze tvrdit nulovou hloubku" }] };
      state = (await send(command(state, { action: "matchInputs", planId: state.plan.id }))).planning;
      assert.equal(state.inputs[0].status, "INCOMPLETE"); assert.match(state.inputs[0].criteria[0].value, /1,80.*1,20/);
      assert.equal(state.inputs[0].criteria[1].value, ""); assert.equal(state.inputs[0].criteria[1].assessed, true);
      assert.deepEqual(state.inputs[0].criteria[0].insightIds, [width.id, conflict.id]);
      const storedAI = JSON.parse((await db.requiredInputCriterion.findUnique({ where: { id: a.id } })).evidence_refs_json);
      assert.deepEqual(storedAI.sources.map((source) => source.insightId), [width.id, conflict.id]);
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
    await t.test("removed evidence stays historical but refresh permits clearing and explicit replacement", async () => {
      const criterionId = state.inputs[0].criteria[0].id;
      const oldValue = state.inputs[0].criteria[0].value, oldExplanation = state.inputs[0].criteria[0].explanation;
      await db.documentInsight.delete({ where: { id: width.id } });
      state = await read(sid, caseId);
      assert.deepEqual(state.inputs[0].criteria[0].insightIds, []);
      assert.ok(state.inputs[0].criteria[0].historicalInsightIds.includes(width.id));
      const action = { action: "reviewCriterion", planId: state.plan.id, criterionId, value: oldValue, explanation: oldExplanation, sufficient: false, insightIds: [] };
      for (const id of [width.id, conflict.id, "foreign-or-invalid-id"]) assert.equal((await send(command(state, { ...action, insightIds: [id] }))).status, 409);
      const cleared = await send(command(state, action)); assert.equal(cleared.status, 200); state = cleared.planning;
      let c = state.inputs[0].criteria[0];
      assert.equal(c.value, oldValue); assert.equal(c.explanation, oldExplanation); assert.equal(c.stale, true);
      assert.deepEqual(c.insightIds, []); assert.ok(c.historicalInsightIds.includes(width.id));
      const replacementDoc = await db.document.create({ data: { case_id: caseId, filename: "replacement.txt", filetype: "txt", original_file: "", processed_text: "Ověřená šířka 1,80 m." } });
      await db.situationDocument.create({ data: { situation_id: sid, document_id: replacementDoc.id } });
      const replacement = await db.documentInsight.create({ data: { document_id: replacementDoc.id, source_document_id: replacementDoc.id,
        title: "Náhradní měření", content: "1,80 m", source_text: "Ověřená šířka 1,80 m.", source_start_offset: 0, source_end_offset: "Ověřená šířka 1,80 m.".length,
        insight_type: "fact", evidence_state: "verified", target_section: "description", target_item_type: "FACT", status: "approved" } });
      state = await read(sid, caseId);
      state = (await send(command(state, { ...action, insightIds: [replacement.id], sufficient: true }))).planning;
      c = state.inputs[0].criteria[0]; assert.equal(c.status, "SATISFIED"); assert.equal(c.stale, false);
      assert.deepEqual(c.insightIds, [replacement.id]); assert.ok(c.historicalInsightIds.includes(width.id));
      assert.equal(c.value, oldValue); assert.equal(c.explanation, oldExplanation);
      assert.ok(state.reviewHistory.some((entry) => entry.changes.some((change) => change.before.refs.includes(width.id))));
    });
    await t.test("manual duplicate IDs normalize; legacy duplicate references project read-only without merging different insights", async () => {
      const c = state.inputs[0].criteria[0]; const id = c.insightIds[0];
      const original = await db.documentInsight.findUnique({ where: { id } });
      const { id: ignored, created_at, updated_at, ...fields } = original;
      const twin = await db.documentInsight.create({ data: { ...fields, title: "Jiný poznatek stejné pasáže" } });
      state = await read(sid, caseId);
      const action = { action: "reviewCriterion", planId: state.plan.id, criterionId: c.id, value: c.value, explanation: c.explanation, sufficient: true, insightIds: [id, id, twin.id, twin.id] };
      state = (await send(command(state, action))).planning;
      assert.deepEqual(state.inputs[0].criteria[0].sources.map((source) => source.id), [id, twin.id]);
      const row = await db.requiredInputCriterion.findUnique({ where: { id: c.id } });
      const refs = JSON.parse(row.evidence_refs_json); assert.equal(refs.sources.length, 2);
      refs.sources = [refs.sources[0], refs.sources[0], refs.sources[1], refs.sources[1]];
      const json = JSON.stringify(refs);
      await db.requiredInputCriterion.update({ where: { id: c.id }, data: { evidence_refs_json: json } });
      queries.length = 0; state = await read(sid, caseId);
      let current = state.inputs[0].criteria[0];
      assert.deepEqual(current.insightIds, [id, twin.id]); assert.deepEqual(current.sources.map((source) => source.id), [id, twin.id]);
      assert.equal(current.status, "SATISFIED"); assert.equal(current.stale, false);
      assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)));
      assert.equal((await db.requiredInputCriterion.findUnique({ where: { id: c.id } })).evidence_refs_json, json);
      refs.sources.push({ insightId: id, fingerprint: "outdated" });
      await db.requiredInputCriterion.update({ where: { id: c.id }, data: { evidence_refs_json: JSON.stringify(refs) } });
      current = (await read(sid, caseId)).inputs[0].criteria[0];
      assert.equal(current.stale, true, "a duplicate with a wrong fingerprint must not be hidden by a valid one"); assert.equal(current.status, "MISSING");
      assert.deepEqual(current.sources.map((source) => source.id), [id, twin.id]);
      for (const invalid of ["missing", conflict.id]) assert.equal((await send(command(state, { ...action, insightIds: [id, id, invalid, invalid] }))).status, 409);
      state = await read(sid, caseId);
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
    await t.test("known Goal AI failure for unknown insight ID remains explicit and creates no draft", async () => {
      state = await read(sid, caseId); const before = state.goals.length;
      aiReply = { brief: manualBrief, goals: [{ title: "A", reason: "Reason", insightIds: ["unknown-insight"] }, { title: "B", reason: "Reason", insightIds: [] }] };
      const result = await send(command(state, { action: "suggestGoals" }));
      assert.equal(result.status, 409); assert.match(result.error, /neznámý poznatek/);
      state = await read(sid, caseId); assert.equal(state.goals.length, before);
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
      resolve(suggestedContent); assert.equal((await pending).status, 409); deferredAI = null;
      state = await read(sid, caseId); assert.equal(state.revision, revision); assert.equal(state.plan, null);
    });
    await t.test("legacy ambiguity requires selection; two concurrent different confirmations cannot both win", async () => {
      // A separate new Situation provides a complete seven-Step workflow.
      const legacy = await createSituation(caseId, { title: "Legacy choice" });
      const a = await db.goal.create({ data: { situation_id: legacy.id, title: "A", status: "active" } });
      const b = await db.goal.create({ data: { situation_id: legacy.id, title: "B", status: "active" } });
      await db.workflowEvent.create({ data: { situation_id: legacy.id, event_type: "PLANNING_suggestGoals", payload_json: JSON.stringify({ suggestions: { goals: [{ title: a.title, reason: "Unlinked old reason", insightIds: [] }] } }) } });
      const old = await read(legacy.id, caseId); assert.equal(old.goal, null);
      assert.ok(old.goals.every((g) => g.reason === null));
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
  const answer = { brief: manualBrief, goals: [{ title: "Cíl A", reason: "Uložený požadavek", insightIds: [] }, { title: "Cíl B", reason: "Uložená nejasnost", insightIds: [] }] };
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
      button("Vlastní cíl").props.onClick(); await settle();
      const title = elements(renderer.tree, (e) => e.type === "textarea")[0]; title.props.onChange({ target: { value: "Vlastní konkrétní cíl" } }); await settle();
      assert.equal(calls.filter((c) => c.options.method).length, 0);
      const confirm = button("Potvrdit cíl");
      const first = confirm.props.onClick(); confirm.props.onClick(); await settle();
      assert.equal(calls.filter((c) => c.options.method === "POST").length, 1);
      assert.equal(JSON.parse(calls.at(-1).options.body).title, "Vlastní konkrétní cíl");
      respond({ ...snapshot, revision: 1, goal: { id: "g", title: "Vlastní konkrétní cíl" } }); await first; await settle();
    });
    await t.test("editing Plan fields never accepts it; unmount rejects old AI/GET responses", async () => {
      renderer.update({ view: "PLAN" }); await settle();
      button("Vytvořit plán ručně").props.onClick(); await settle();
      const planSection = elements(renderer.tree, (e) => e.props["aria-label"] === "Plán situace")[0];
      const textarea = elements(planSection, (e) => e.type === "textarea")[0]; textarea.props.onChange({ target: { value: "Ruční výstup" } }); await settle();
      assert.equal(calls.filter((c) => c.options.method).length, 1);
      renderer.update({ view: "ANALYSIS" }); await settle();
      renderer.update({ view: "PLAN" }); await settle();
      assert.equal(elements(elements(renderer.tree, (e) => e.props["aria-label"] === "Plán situace")[0], (e) => e.type === "textarea")[0].props.value, "Ruční výstup");
      renderer.dispose();
      const next = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "case", situationId: "s2", view: "ANALYSIS", onOpenSource: async () => true }); allRenderers.push(next);
      await settle(); assert.match(calls.at(-1).url, /s2/); respond(snapshot); await settle();
      assert.equal(elements(next.tree, (e) => e.type === "textarea")[0].props.value, "");
      // A pending read is also ignored after leaving the Situation.
      elements(next.tree, (e) => e.type === "button" && e.props.children === "Navrhnout cíl a podnět pomocí AI")[0].props.onClick(); await settle(); next.dispose(); respond(snapshot); await settle();
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
    inputs: [{ id: "input", title: "Údaj", status: "SATISFIED", criteria: [{ id: "c", requirement_text: "Údaj", status: "MISSING", value: "", explanation: "", sources: [], insightIds: [], stale: false }] }], evidence: [], steps: [] };
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
    await settle(); assert.equal(selected.at(-1), "COLLECTION"); assert.equal(elements(panel.tree, (e) => e.props.state && e.props.onSave).length, 1);
    env.window.dispatchEvent(new Event("bureaucat:journal-refresh")); await settle();
    let slot = elements(panel.tree, (e) => e.props.state && e.props.onSave)[0];
    assert.equal(slot.props.refreshing, true, "keep the form mounted and mark old support stale while GET is pending");
    answer("/planning", { planning: { ...snapshot, inputs: [{ ...snapshot.inputs[0], status: "INCOMPLETE" }] } }); await settle();
    slot = elements(panel.tree, (e) => e.props.state && e.props.onSave)[0]; assert.equal(slot.props.refreshing, false);
    rail.update({ selectedSituationId: "s2" }); await settle();
    assert.equal(byClass(rail.tree, "workflow-step-button").length, 0, "old Situation's steps are cleared during scope switch");
  } finally {
    for (const r of renderers) r.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test("parent and single RequiredInputsForm preserve drafts, prune removed sources and save one batch after refresh", async () => {
  const env = environment(), oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  globalThis.window = env.window; const pending = [], calls = [];
  globalThis.fetch = (url, options = {}) => { calls.push({ url, options }); return new Promise((resolve) => pending.push(resolve)); };
  const source = { id: "old", documentId: "doc", documentName: "Old", title: "Source", quote: "Quote", value: "Value", fingerprint: "old-fingerprint", usable: true };
  const row = { id: "first", requirement_text: "Adresa", status: "MISSING", value: "", explanation: "", origin: "DOCUMENT", insightIds: [source.id], sources: [source], stale: false };
  const state = { revision: 1, contextHash: "a".repeat(64), goal: { id: "goal", title: "Goal" }, goals: [], goalSelectionRequired: false,
    plan: { id: "plan", status: "ACCEPTED", content: { expectedOutput: "Output", procedure: ["Procedure"], inputs: [] } }, history: [],
    tasks: [{ id: "send-task", title: "Odeslat odpověď", completed: false, deadline: null, deadlineStale: false }], inputs: [{ id: "input", title: "Adresa", status: "MISSING", criteria: [row] }, { id: "second-input", title: "Rozměry", status: "MISSING", criteria: [{ ...row, id: "second", requirement_text: "Rozměry" }] }], evidence: [source], documents: [{ id: "doc", name: "Old", fingerprint: "doc-hash" }] };
  const parent = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "case", situationId: "s", view: "ANALYSIS", onOpenSource: async () => true });
  let child, key, mounts = 0;
  async function settle() {
    for (let i = 0; i < 12; i++) {
      parent.render(); const slot = elements(parent.tree, (e) => e.props.state && e.props.onSave)[0];
      if (slot) { if (!child || key !== slot.key) { child?.dispose(); key = slot.key; child = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", slot.props); mounts++; } else child.update(slot.props); child.render(); }
      else if (child) { child.dispose(); child = null; }
      await Promise.resolve(); await Promise.resolve();
    }
  }
  const respond = (planning, ok = true) => pending.shift()({ ok, json: async () => ok ? { planning } : { error: "Controlled save failure" } });
  const rows = () => byClass(child.tree, "required-input-row");
  const value = (i) => elements(rows()[i], (e) => e.type === "input" && e.props.type === "text")[0];
  try {
    await settle(); respond(state); await settle(); assert.equal(mounts, 1);
    value(0).props.onChange({ target: { value: "Rozepsaná adresa" } }); value(1).props.onChange({ target: { value: "Rozepsané rozměry" } }); await settle();
    elements(byClass(child.tree, "required-task-row")[0], (element) => element.type === "input")[0].props.onChange({ target: { checked: true } }); await settle();
    for (const view of ["PLAN", "ANALYSIS"]) { parent.update({ view }); await settle(); }
    assert.equal(value(0).props.value, "Rozepsaná adresa");
    env.window.dispatchEvent(new Event("bureaucat:journal-refresh")); await settle();
    assert.equal(child.props.refreshing, true); assert.equal(value(1).props.value, "Rozepsané rozměry");
    const refreshed = { ...state, revision: 2, contextHash: "b".repeat(64), evidence: [], documents: [], inputs: state.inputs.map((input) => ({ ...input, criteria: input.criteria.map((c) => ({ ...c, insightIds: [], sources: [], stale: true })) })) };
    respond(refreshed); await settle(); assert.equal(mounts, 1); assert.equal(value(0).props.value, "Rozepsaná adresa");
    const submit = () => child.tree.props.onSubmit({ preventDefault() {} });
    submit(); submit(); await settle(); assert.equal(calls.filter((c) => c.options.method).length, 1);
    const body = JSON.parse(calls.at(-1).options.body); assert.equal(body.action, "reviewInputs"); assert.equal(body.reviews.length, 2); assert.deepEqual(body.tasks, [{ taskId: "send-task", completed: true }]);
    assert.deepEqual(body.reviews[0].insightIds, []); assert.equal(body.expectedRevision, 2);
    respond(null, false); await settle(); assert.equal(value(0).props.value, "Rozepsaná adresa"); assert.ok(JSON.stringify(child.tree).includes("Uložení se nezdařilo"));
    assert.ok(!JSON.stringify(child.tree).includes('"Uloženo."'));
    submit(); await settle(); const saved = { ...refreshed, revision: 3, tasks: [{ ...refreshed.tasks[0], completed: true }], inputs: refreshed.inputs.map((input, i) => ({ ...input, criteria: input.criteria.map((c) => ({ ...c, value: body.reviews[i].value, origin: "USER" })) })) };
    respond(saved); await settle(); assert.equal(mounts, 1); assert.equal(value(1).props.value, "Rozepsané rozměry");
  } finally { parent.dispose(); child?.dispose(); globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

test("minimal form hides source controls and preserves explicit draft confirmation until Save", async () => {
  const a = { id: "a", documentId: "doc", documentName: "Doc", quote: "Same", title: "A", usable: true, fingerprint: "a" }, b = { ...a, id: "b", title: "B", fingerprint: "b" };
  const state = { plan: { id: "plan" }, documents: [], evidence: [a, a, b, b], inputs: [{ id: "input", criteria: [{ id: "criterion", requirement_text: "Údaj", value: "Value", explanation: "Note", insightIds: ["a", "a", "b", "b"], sources: [a, a, b, b], status: "MISSING", stale: false }] }] };
  const saves = [];
  const form = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", { state, caseId: "case", situationId: "s", disabled: false, refreshing: false, onSave: async (reviews) => { saves.push(reviews); return null; }, onOpenSource: async () => true, onUploaded() {} });
  const settle = () => { for (let i = 0; i < 5; i++) form.render(); };
  try {
    settle(); assert.equal(elements(form.tree, (e) => e.type === "details" || e.type === "select").length, 0, "technical source controls are not rendered");
    const checkbox = () => byClass(form.tree, "required-input-title")[0].props.children[0];
    checkbox().props.onChange({ target: { checked: true } }); settle(); assert.equal(saves.length, 0); assert.equal(checkbox().props.checked, true);
    elements(form.tree, (e) => e.type === "input" && e.props.type === "text")[0].props.onChange({ target: { value: "User value" } }); settle(); assert.equal(checkbox().props.checked, false);
    checkbox().props.onChange({ target: { checked: true } }); settle();
    form.tree.props.onSubmit({ preventDefault() {} }); await Promise.resolve(); settle();
    assert.deepEqual(saves[0][0].insightIds, []); assert.equal(saves[0][0].origin, "USER"); assert.equal(saves[0][0].sufficient, true);
  } finally { form.dispose(); }
});

test("right tabs keep one planning component, center only Journal, and Plan drafts survive tab navigation", async () => {
  const env = environment(), previous = new Map(["window", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = env.window;
  const requests = [], calls = [];
  globalThis.fetch = (url, options = {}) => { calls.push({ url, options }); return new Promise((resolve) => requests.push(resolve)); };
  const workspace = hookRenderer("src/components/ThreePanelWorkspace.tsx", "ThreePanelWorkspace", { caseItem: { id: "case", title: "Panels", icon: "folder", icon_color: "blue" } });
  let planner;
  const right = () => elements(workspace.tree, (e) => e.type?.name === "RightContextPanel")[0].props;
  const center = () => elements(workspace.tree, (e) => typeof e.props.onOpenAnalysisSourceReference === "function")[0].props;
  const snapshot = { revision: 1, contextHash: "a".repeat(64), goal: { id: "g", title: "Confirmed" }, goalSelectionRequired: false, goals: [], plan: null, history: [], inputs: [], evidence: [], preliminary: [] };
  async function settle() { for (let i = 0; i < 12; i++) { workspace.render(); if (planner) { planner.update(right().planningPanel.props); planner.render(); } await Promise.resolve(); await Promise.resolve(); } }
  try {
    await settle(); center().onSelectSituation("s1"); await settle();
    const slot = right().planningPanel; assert.ok(slot); const key = slot.key;
    planner = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", slot.props);
    await settle(); requests.shift()({ ok: true, json: async () => ({ planning: snapshot }) }); await settle();
    const journal = hookRenderer("src/components/workflow/StepWorkspace.tsx", "StepWorkspace", center()); journal.render();
    assert.equal(elements(journal.tree, (e) => e.type?.name === "SituationPlanningPanel").length, 0);
    assert.equal(elements(journal.tree, (e) => e.type?.name === "ChatPanel").length, 0); journal.dispose();
    right().onActiveTabChange("plan"); await settle();
    assert.equal(right().planningPanel.key, key);
    const planSection = () => elements(planner.tree, (e) => e.props["aria-label"] === "Plán situace")[0];
    elements(planSection(), (e) => e.type === "button" && e.props.children === "Vytvořit plán ručně")[0].props.onClick(); await settle();
    const fields = () => elements(planSection(), (e) => e.type === "textarea");
    fields()[0].props.onChange({ target: { value: "Rozpracovaný výstup" } }); await settle();
    const actionIds = elements(planSection(), (e) => e.type === "div" && e.key).map((e) => e.key);
    for (const tab of ["documents", "analysis", "plan"]) { right().onActiveTabChange(tab); await settle(); assert.equal(right().planningPanel.key, key); }
    assert.equal(fields()[0].props.value, "Rozpracovaný výstup");
    assert.deepEqual(elements(planSection(), (e) => e.type === "div" && e.key).map((e) => e.key), actionIds);
    assert.equal(calls.filter((call) => call.options.method).length, 0, "tabs, edit opening and typing do not confirm or save");
    right().planningPanel.props.onSelectPlan(); await settle(); assert.equal(right().activeTab, "plan");
    const rightRenderer = hookRenderer("src/components/ThreePanelWorkspace.tsx", "RightContextPanel", right()); rightRenderer.render();
    assert.deepEqual(elements(rightRenderer.tree, (e) => e.props.role === "tab").map((e) => e.props.children), ["Dokument", "Analýza", "Plán"]);
    for (const tab of ["documents", "analysis", "plan"]) {
      right().onActiveTabChange(tab); await settle(); rightRenderer.update(right()); rightRenderer.render();
      assert.equal(elements(rightRenderer.tree, (e) => e === right().planningPanel).length, 1, "actual right-panel tree retains one planning child even in Document tab");
    }
    rightRenderer.dispose();
  } finally {
    workspace.dispose(); planner?.dispose();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});


test("Analysis has three main sections, compact sourced Situation and no repeated document list", async () => {
  const env = environment(); const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  globalThis.window = env.window;
  const brief = { trigger: { description: "Reagovat na výzvu", documentIds: ["request"] }, requirements: [{ text: "Rozměry stojanu", insightIds: ["i1"] }], deadline: { text: "11. září", insightIds: ["i2"] } };
  const snapshot = { revision: 1, contextHash: "a".repeat(64), goal: null, goalSelectionRequired: false, goals: [], plan: { id: "p", goal_id: "g", status: "ACCEPTED", content: { expectedOutput: "Starý výstup", procedure: ["Starý bod"], inputs: [] } }, history: [], inputs: [], evidence: [{ id: "i1", documentId: "sketch", title: "Repeated atom", value: "1,80 m" }, { id: "i2", documentId: "sketch", title: "Repeated atom", value: "1,20 m" }], brief, documents: [{ id: "request", name: "Výzva" }, { id: "sketch", name: "Náčrt" }], preliminary: [] };
  const calls = [], opened = [];
  globalThis.fetch = async (url, options) => { calls.push(options); return { ok: true, json: async () => ({ planning: snapshot }) }; };
  const r = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "c", situationId: "s", view: "ANALYSIS", onOpenSource: async () => true, onOpenDocument: (id) => opened.push(id) });
  try {
    for (let i = 0; i < 8; i++) { r.render(); await Promise.resolve(); }
    const section = elements(r.tree, (e) => e.props["aria-label"] === "Analýza situace")[0];
    assert.deepEqual(elements(section, (e) => e.type === "h2").map((e) => e.props.children), ["Situace", "Cíl", "K doplnění"]);
    const triggerButton = elements(section, (e) => e.type === "button" && e.props.children === "Výzva");
    assert.equal(triggerButton.length, 1); triggerButton[0].props.onClick(); assert.deepEqual(opened, ["request"]);
    assert.equal(elements(section, (e) => e.type === "button" && e.props.children === "Náčrt").length, 0);
    assert.equal(byClass(section, "planning-situation-requirements").length, 1);
    assert.ok(JSON.stringify(byClass(section, "planning-situation-requirements")[0]).includes("Rozměry stojanu"));
    assert.equal(elements(section, (e) => e.type?.name === "BriefSources").length, 2, "requirement and deadline retain source menus");
    assert.ok(JSON.stringify(section).includes("11. září"));
    assert.ok(!JSON.stringify(section).includes('"K dispozici"'));
    assert.ok(!JSON.stringify(r.tree).includes("Výsledek a vazby nejsou"));
    assert.ok(calls.every((options) => !options?.method), "read and document selection never write planning");
    const custom = elements(section, (e) => e.type === "button" && e.props.children === "Vlastní cíl")[0]; custom.props.onClick(); r.render();
    const trigger = () => elements(r.tree, (e) => e.type === "label" && e.props.children?.[0] === "Podnět / co nyní řešíme")[0].props.children[1];
    trigger().props.onChange({ target: { value: "Vlastní Akce bez dokumentu" } }); r.render();
    for (const view of ["PLAN", "ANALYSIS"]) { r.update({ view }); r.render(); }
    assert.equal(trigger().props.value, "Vlastní Akce bez dokumentu");
  } finally { r.dispose(); globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

test("Analysis overview groups exact question content only and preserves distinct values and all source identities", () => {
  const { analysisOverview } = loader()("src/lib/workflow/analysisOverview.ts");
  const evidence = (id, title, value, type = "question") => ({ id, title, value, type, evidenceState: type === "conflict" ? "conflict" : "unverified", documentId: "doc", documentName: "Podklad", quote: "Same passage", pinId: null, startOffset: 0, endOffset: 12, usable: true, fingerprint: id });
  const shared = evidence("a", "Ověřit adresu", "Ověřit adresu");
  const state = { evidence: [shared, { ...shared, id: "b" }, evidence("c", "Rozměry", "1,80 m", "conflict"), evidence("d", "Rozměry", "1,20 m", "conflict"), evidence("e", "Ověřit adresy", "Ověřit adresy")],
    documents: [{ id: "doc", name: "Podklad" }, { id: "extra", name: "Další zdroj" }], inputs: [],
    preliminary: [{ id: "journal", title: shared.title, value: shared.value, type: "QUESTION", evidenceState: "unverified", sourceLinks: [{ insightId: shared.id }, { documentId: "extra", sourceText: "Extra quote" }] }] };
  const before = JSON.stringify(state); const view = analysisOverview(state);
  assert.equal(view.questions.length, 4, "only the complete identical statement groups");
  const same = view.questions.find((q) => q.title === shared.title); assert.equal(same.sources.length, 3);
  assert.ok(same.sources.some((source) => source.key === "insight:a")); assert.ok(same.sources.some((source) => source.key === "insight:b"));
  assert.deepEqual(view.questions.filter((q) => q.conflict).map((q) => q.value), ["1,80 m", "1,20 m"]);
  assert.equal(JSON.stringify(state), before); assert.deepEqual(analysisOverview(state), view);
});

test("accepted criteria remain separate, omit SATISFIED and move uncertain questions to additional details", () => {
  const { analysisOverview } = loader()("src/lib/workflow/analysisOverview.ts");
  const criterion = (id, requirement_text, status = "MISSING") => ({ id, requirement_text, status, sources: [], value: "", explanation: "Dosud nezjištěno", assessed: false, stale: false, insightIds: [] });
  const criteria = [criterion("done", "Potvrzené rozměry", "SATISFIED"), criterion("address", "Poštovní adresa"), criterion("combined", "Adresa a rozměry", "INCOMPLETE")];
  const q = (id, title, value = title, type = "question") => ({ id, title, value, type, evidenceState: type === "conflict" ? "conflict" : "unverified", documentId: "doc", documentName: "Doc", quote: title, usable: true });
  const state = { plan: { status: "ACCEPTED" }, inputs: [{ id: "parent", title: "Společný název", status: "INCOMPLETE", criteria }],
    evidence: [q("same", "Poštovní adresa"), q("satisfied", "Potvrzené rozměry"), q("uncertain", "Poštovní adresa", "Není jasné, zda je úplná"), q("conflict", "Adresa a rozměry", "Adresa a rozměry", "conflict")], preliminary: [] };
  const view = analysisOverview(state);
  assert.deepEqual(view.openCriteria.map(({ criterion: c }) => c.id), ["address", "combined"]);
  assert.equal(view.openCriteria[1].criterion.requirement_text, "Adresa a rozměry", "combined criterion is neither split nor merged");
  assert.deepEqual(view.questions.map((q) => q.title), ["Poštovní adresa", "Adresa a rozměry"]);
  assert.equal(view.openCriteria[0].sources[0].key, "insight:same", "exact duplicate's source stays with the criterion");
  assert.equal(criteria[0].status, "SATISFIED");
  const ambiguous = analysisOverview({ ...state, inputs: [{ ...state.inputs[0], criteria: [...criteria, criterion("another-address", "Poštovní adresa")] }] });
  assert.equal(ambiguous.questions.filter((question) => question.title === "Poštovní adresa").length, 2, "even exact text stays additional when multiple distinct criteria could own it");
});

test("Analysis renders one completion form, including confirmed criteria, with no second assessment surface", async () => {
  const env = environment(), oldWindow = globalThis.window, oldFetch = globalThis.fetch; globalThis.window = env.window;
  const row = (id, status) => ({ id, requirement_text: id, status, value: "", explanation: "", sources: [], insightIds: [], stale: false });
  const state = { revision: 1, contextHash: "a".repeat(64), goal: { id: "g", title: "Goal" }, goals: [], plan: { id: "plan", status: "ACCEPTED", content: { expectedOutput: "Output", procedure: ["Procedure"], inputs: [] } }, history: [], inputs: [{ id: "input", criteria: [row("Done", "SATISFIED"), row("Address", "MISSING")] }], evidence: [], preliminary: [] };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ planning: state }) });
  const panel = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "c", situationId: "s", view: "ANALYSIS", onOpenSource: async () => true });
  try {
    for (let i = 0; i < 10; i++) { panel.render(); await Promise.resolve(); }
    const slots = elements(panel.tree, (e) => e.props.state && e.props.onSave); assert.equal(slots.length, 1); assert.equal(slots[0].key, "plan");
    assert.equal(slots[0].props.state.inputs[0].criteria.length, 2);
    assert.ok(!JSON.stringify(panel.tree).includes("Posoudit požadavky přijatého plánu")); assert.ok(!JSON.stringify(panel.tree).includes('"K ověření"'));
  } finally { panel.dispose(); globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});


test("attachment uses only existing upload and Situation-link endpoints, with no analysis or confirmation", async () => {
  const { uploadToSituation } = loader()("src/lib/documents/uploadToSituation.ts");
  const previous = globalThis.fetch, calls = [];
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ document: { id: "uploaded", filename: "proof.txt" } }) }; };
    const file = new File(["synthetic"], "proof.txt", { type: "text/plain" });
    assert.deepEqual(await uploadToSituation("case", "situation", file), { id: "uploaded", name: "proof.txt" });
    assert.deepEqual(calls.map((call) => call.url), ["/api/cases/case/documents", "/api/situations/situation/documents"]);
    assert.equal(calls[0].options.body.get("file").name, "proof.txt"); assert.deepEqual(JSON.parse(calls[1].options.body), { document_id: "uploaded" });
    globalThis.fetch = async (url) => ({ ok: !url.includes("/situations/"), json: async () => ({ document: { id: "uploaded", filename: "proof.txt" } }) });
    await assert.rejects(uploadToSituation("case", "situation", file), /Vazba k položce nebyla uložena/);
  } finally { globalThis.fetch = previous; }
});

test("confirmed USER values remain visible, editing requires reconfirmation and failed saves retain the checked draft", async () => {
  let state = { documents: [{ id: "doc", name: "Attached", fingerprint: "one" }], evidence: [], inputs: [{ id: "input", title: "Poštovní adresa", criteria: [{ id: "c", requirement_text: "Poštovní adresa", value: "Původní adresa", explanation: "", origin: "USER", status: "SATISFIED", stale: false, insightIds: [], sources: [], documentIds: ["doc"] }] }] };
  let succeed = false;
  const form = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", { state, caseId: "case", situationId: "s", disabled: false, refreshing: false, onUploaded() {}, onOpenSource: async () => true,
    onSave: async ([review]) => { if (!succeed) return null; state = { ...state, inputs: [{ ...state.inputs[0], criteria: [{ ...state.inputs[0].criteria[0], ...review, status: review.sufficient ? "SATISFIED" : "MISSING" }] }] }; return state; } });
  const settle = async () => { for (let i = 0; i < 8; i++) { form.render(); await Promise.resolve(); } };
  const check = () => byClass(form.tree, "required-input-title")[0].props.children[0];
  const valueField = () => elements(form.tree, (e) => e.type === "input" && e.props.type === "text")[0];
  try {
    await settle(); assert.equal(check().props.checked, true); assert.ok(valueField());
    assert.equal(elements(form.tree, (e) => e.type === "select" || e.type === "details").length, 0);
    state = { ...state, inputs: [{ ...state.inputs[0], criteria: [{ ...state.inputs[0].criteria[0], value: "Aktuálně uložená adresa" }] }] };
    form.update({ state }); await settle(); assert.ok(JSON.stringify(form.tree).includes("Aktuálně uložená adresa")); assert.equal(check().props.checked, true);
    valueField().props.onChange({ target: { value: "Nová adresa" } }); await settle(); assert.equal(check().props.checked, false);
    check().props.onChange({ target: { checked: true } }); await settle();
    form.tree.props.onSubmit({ preventDefault() {} }); await settle(); assert.equal(valueField().props.value, "Nová adresa"); assert.equal(check().props.checked, true);
    assert.ok(JSON.stringify(form.tree).includes("Uložení se nezdařilo")); assert.ok(!JSON.stringify(form.tree).includes('"Uloženo."'));
    succeed = true; form.tree.props.onSubmit({ preventDefault() {} }); await settle(); assert.ok(valueField()); assert.equal(check().props.checked, true);
    form.update({ state: { ...state, documents: [{ id: "doc", name: "Attached", fingerprint: "changed" }] } }); await settle();
    assert.equal(check().props.checked, false, "changed attached source cannot retain draft consent"); assert.equal(valueField().props.value, "Nová adresa");
  } finally { form.dispose(); }
});

test("actual file control attaches to only its row without confirming and waits for refreshed source context", async () => {
  const oldFetch = globalThis.fetch, calls = [], saves = [];
  const state = { documents: [], evidence: [], inputs: ["a", "b"].map((id) => ({ id: `input-${id}`, title: id, attachmentRequired: id === "a", criteria: [{ id, requirement_text: id, value: "", explanation: "", status: "MISSING", stale: false, insightIds: [], sources: [] }] })) };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ document: { id: "upload", filename: "proof.txt" } }) }; };
  let notices = 0;
  const form = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", { state, caseId: "case", situationId: "s", disabled: false, refreshing: false, onUploaded() { notices++; form.update({ refreshing: true }); }, onOpenSource: async () => true, onSave: async (reviews) => { saves.push(reviews); return null; } });
  const settle = async () => { for (let i = 0; i < 12; i++) { form.render(); await Promise.resolve(); } };
  try {
    await settle(); const input = elements(byClass(form.tree, "required-input-row")[0], (e) => e.type === "input" && e.props.type === "file")[0];
    input.props.onChange({ target: { files: [new File(["synthetic"], "proof.txt")], value: "proof.txt" } }); await settle();
    assert.equal(calls.length, 2); assert.equal(notices, 1); assert.equal(saves.length, 0);
    assert.equal(byClass(form.tree, "required-input-title")[0].props.children[0].props.checked, false);
    assert.equal(elements(form.tree, (e) => e.type === "button" && e.props.type === "submit")[0].props.disabled, true);
    const fresh = { ...state, documents: [{ id: "upload", name: "proof.txt", fingerprint: "hash" }] };
    form.update({ state: fresh, refreshing: false }); await settle(); form.tree.props.onSubmit({ preventDefault() {} }); await settle();
    assert.equal(saves.length, 1); assert.equal(saves[0].length, 1); assert.equal(saves[0][0].criterionId, "a"); assert.deepEqual(saves[0][0].documentIds, ["upload"]); assert.equal(saves[0][0].sufficient, false);
  } finally { form.dispose(); globalThis.fetch = oldFetch; }
});

test("one information field has its concrete RequiredInput name, even with multiple validation conditions", async () => {
  const criterion = (id, text) => ({ id, requirement_text: text, value: "", explanation: "", status: "MISSING", origin: "USER", insightIds: [], sources: [], stale: false });
  const state = { documents: [], evidence: [], inputs: [{ id: "postal", title: "Poštovní adresa žadatele", attachmentRequired: false, criteria: [criterion("street", "Adresa je úplná"), criterion("delivery", "Adresa umožňuje doručení")] }] };
  const saves = [];
  const form = hookRenderer("src/components/workflow/RequiredInputsForm.tsx", "RequiredInputsForm", { state, caseId: "case", situationId: "s", disabled: false, refreshing: false, onUploaded() {}, onSave: async (...args) => { saves.push(args); return null; } });
  const settle = async () => { for (let i = 0; i < 7; i++) { form.render(); await Promise.resolve(); } };
  try {
    await settle(); assert.equal(byClass(form.tree, "required-input-row").length, 1);
    const fields = elements(form.tree, (e) => e.type === "input" && e.props.type === "text"); assert.equal(fields.length, 1); assert.equal(fields[0].props["aria-label"], state.inputs[0].title);
    assert.ok(!JSON.stringify(form.tree).includes("Adresa je úplná")); assert.equal(elements(form.tree, (e) => e.type === "input" && e.props.type === "file").length, 0);
    fields[0].props.onChange({ target: { value: "Testovací 12, Praha" } }); await settle();
    byClass(form.tree, "required-input-title")[0].props.children[0].props.onChange({ target: { checked: true } }); await settle();
    form.tree.props.onSubmit({ preventDefault() {} }); await settle();
    assert.deepEqual(saves[0][0].map((review) => [review.criterionId, review.value, review.sufficient]), [["street", "Testovací 12, Praha", true], ["delivery", "Testovací 12, Praha", true]]);
    assert.deepEqual(saves[0][1], []);
  } finally { form.dispose(); }
});

test("legacy combined consent has an explicit new-Plan editor instead of renamed or split Analysis rows", async () => {
  const env = environment(), oldWindow = globalThis.window, oldFetch = globalThis.fetch, calls = []; globalThis.window = env.window;
  const state = { revision: 1, contextHash: "a".repeat(64), goal: { id: "g", title: "Goal" }, goals: [], history: [], evidence: [], needsPlanRevision: true,
    plan: { id: "old", status: "ACCEPTED", content: { version: 2, expectedOutput: "Output", procedure: [{ id: "action", title: "Procedure", expectedResult: "Result", inputIds: ["old-input"] }], inputs: [{ id: "old-input", title: "Adresa a rozměry", description: "", criteria: ["Adresa a rozměry jsou uvedeny úplně"] }] } },
    inputs: [{ id: "old-row", title: "Adresa a rozměry", status: "SATISFIED", criteria: [{ id: "old-criterion", requirement_text: "Adresa a rozměry jsou uvedeny úplně", status: "SATISFIED", value: "Old consent", insightIds: [], sources: [] }] }] };
  const before = JSON.stringify(state); let selected = 0;
  globalThis.fetch = async (_url, options = {}) => { calls.push(options); return { ok: true, json: async () => ({ planning: state }) }; };
  const panel = hookRenderer("src/components/workflow/SituationPlanningPanel.tsx", "SituationPlanningPanel", { caseId: "case", situationId: "s", view: "ANALYSIS", onOpenSource: async () => true, onSelectPlan() { selected++; } });
  const settle = async () => { for (let i = 0; i < 10; i++) { panel.render(); await Promise.resolve(); } };
  try {
    await settle(); assert.equal(elements(panel.tree, (e) => e.props.state && e.props.onSave).length, 0);
    for (const label of ["Historie", "Další otázky z podkladů", "Zdroje a podrobnosti"]) assert.equal(elements(panel.tree, (e) => e.type === "summary" && e.props.children === label).length, 0);
    elements(panel.tree, (e) => e.type === "button" && e.props.children === "Upravit požadavky v nové verzi Plánu")[0].props.onClick(); await settle(); assert.equal(selected, 1);
    panel.update({ view: "PLAN" }); await settle();
    assert.equal(elements(panel.tree, (e) => e.type === "label" && e.props.children?.[0] === "Potřebná informace").length, 1);
    const flags = elements(panel.tree, (e) => e.type === "label" && e.props.children?.[1] === "Vyžaduje soubor / přílohu"); assert.equal(flags[0].props.children[0].props.checked, false);
    assert.equal(JSON.stringify(state), before); assert.ok(calls.every((options) => !options.method));
  } finally { panel.dispose(); globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});
