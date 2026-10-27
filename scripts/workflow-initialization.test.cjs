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

test("Situation workflow initialization on an isolated SQLite database", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bureaucat-workflow-"));
  const databasePath = path.join(directory, "test.sqlite");
  writeFileSync(databasePath, "");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [{ emit: "event", level: "query" }]
  });
  const queries = [];
  prisma.$on("query", ({ query }) => queries.push(query));
  const previousPrisma = globalThis.prisma;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "inherit"
      });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Temporary DB migration exited ${code}`)));
    });

    globalThis.prisma = prisma;
    const load = sourceLoader();
    const { createCase } = load("src/lib/services/cases.ts");
    const { createSituation } = load("src/lib/services/situations.ts");
    const { GET } = load("src/app/api/situations/[situationId]/workflow/route.ts");
    const { WORKFLOW_STEP_DEFINITIONS: definitions } = load("src/lib/workflow/constants.ts");
    assert.equal(definitions.length, 7);
    const initialSteps = definitions.map(({ key, order }) => ({
      step_key: key,
      display_order: order,
      status: key === "ANALYSIS" ? "ACTIVE" : "INACTIVE"
    }));
    const existingCase = await prisma.case.create({ data: { title: "Existing case" } });
    const legacy = await prisma.situation.create({
      data: { case_id: existingCase.id, title: "Existing situation without steps" }
    });
    const progressed = await prisma.situation.create({
      data: {
        case_id: existingCase.id,
        title: "Existing situation in Plan",
        workflow_steps: {
          create: initialSteps.map((step) => ({
            ...step,
            status: step.step_key === "ANALYSIS" ? "COMPLETED" : step.step_key === "PLAN" ? "ACTIVE" : "INACTIVE"
          }))
        }
      }
    });
    const existingIds = [legacy.id, progressed.id];
    const existingState = () => prisma.situation.findMany({
      where: { id: { in: existingIds } },
      orderBy: { id: "asc" },
      include: { workflow_steps: { orderBy: { display_order: "asc" } } }
    });
    const originalState = await existingState();
    const snapshot = () => Promise.all([
      prisma.case.findMany({ orderBy: { id: "asc" } }),
      prisma.situation.findMany({ orderBy: { id: "asc" } }),
      prisma.workflowStep.findMany({ orderBy: { id: "asc" } })
    ]);
    async function assertInitialSteps(situationId) {
      const steps = await prisma.workflowStep.findMany({
        where: { situation_id: situationId },
        orderBy: { display_order: "asc" },
        select: { step_key: true, display_order: true, status: true }
      });
      assert.deepEqual(steps, initialSteps);
      assert.equal(new Set(steps.map((step) => step.step_key)).size, 7);
      assert.equal(steps.filter((step) => step.status === "ACTIVE").length, 1);
    }

    await t.test("createCase creates its default situation and exactly seven canonical steps", async () => {
      const createdCase = await createCase({ title: "New case" });
      assert.equal(createdCase.situation_count, 1);
      const situations = await prisma.situation.findMany({ where: { case_id: createdCase.id } });
      assert.equal(situations.length, 1);
      assert.equal(situations[0].title, "Situace 1");
      assert.equal(situations[0].display_order, 0);
      await assertInitialSteps(situations[0].id);
    });

    await t.test("createSituation uses the same initial keys, order and active state", async () => {
      const situation = await createSituation(existingCase.id, { title: "New separate situation" });
      await assertInitialSteps(situation.id);
    });

    await t.test("repeated GETs perform no writes, backfill or active-step reset", async () => {
      const before = await snapshot();
      queries.length = 0;
      for (const situationId of existingIds) {
        for (let repeat = 0; repeat < 2; repeat++) {
          const response = await GET(new Request("http://localhost/api/workflow"), {
            params: Promise.resolve({ situationId })
          });
          assert.equal(response.status, 200);
          const { workflow } = await response.json();
          assert.equal(workflow.workflow_steps.length, situationId === legacy.id ? 0 : 7);
        }
      }
      const missing = await GET(new Request("http://localhost/api/workflow"), {
        params: Promise.resolve({ situationId: "nonexistent" })
      });
      assert.equal(missing.status, 404);
      assert.ok(!queries.some((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(query)));
      assert.deepEqual(await snapshot(), before);
    });

    for (const [name, operation] of [
      ["createCase", () => createCase({ title: "Must roll back with its situation" })],
      ["createSituation", () => createSituation(existingCase.id, { title: "Must roll back" })]
    ]) {
      await t.test(`${name} rolls back all records when workflow initialization fails`, async () => {
        const before = await snapshot();
        await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_workflow_step BEFORE INSERT ON "WorkflowStep"
          WHEN NEW."step_key" = 'PLAN' BEGIN SELECT RAISE(ABORT, 'injected workflow-step failure'); END`);
        try {
          await assert.rejects(operation, (error) => {
            assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
            assert.match(error.message, /workflowStep\.createMany/);
            console.log(`EXPECTED INITIALIZATION FAILURE [${name}] ${error.code}: ${error.message}`);
            return true;
          });
          assert.deepEqual(await snapshot(), before);
        } finally {
          await prisma.$executeRawUnsafe('DROP TRIGGER "fail_workflow_step"');
        }
      });
    }

    await t.test("creating new situations preserves existing situations and workflow history", async () => {
      assert.deepEqual(await existingState(), originalState);
    });
  } finally {
    globalThis.prisma = previousPrisma;
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
