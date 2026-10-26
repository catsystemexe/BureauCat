const { spawn } = require("node:child_process");

const [tool, ...args] = process.argv.slice(2);
const entrypoints = {
  next: "next/dist/bin/next",
  prisma: "prisma/build/index.js",
};

if (!Object.hasOwn(entrypoints, tool)) {
  console.error("Usage: node scripts/with-database.cjs <next|prisma> [args...]");
  process.exit(1);
}

// Run the installed JS CLI directly: no shell syntax or Windows .cmd shim.
const child = spawn(process.execPath, [require.resolve(entrypoints[tool]), ...args], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "file:../data/bureaucat.sqlite" },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
});
