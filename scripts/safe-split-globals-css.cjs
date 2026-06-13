const fs = require("fs");
const path = require("path");

const inputPath = path.join(process.cwd(), "src/app/globals.css");
const stylesDir = path.join(process.cwd(), "src/app/styles");
const css = fs.readFileSync(inputPath, "utf8");

const firstSectionMatch = css.match(/^\/\* === .* === \*\/$/m);
if (!firstSectionMatch || firstSectionMatch.index == null) {
  throw new Error("No section headers found.");
}

const baseCss = css.slice(0, firstSectionMatch.index).trimEnd() + "\n";
const sectionCss = css.slice(firstSectionMatch.index);

const sectionRegex = /^\/\* === (.*?) === \*\/$/gm;
const matches = [...sectionCss.matchAll(sectionRegex)];

const buckets = {
  journal: [],
  rightPanel: [],
  workspace: [],
  documents: [],
  title: [],
  misc: []
};

function bucketFor(title) {
  const t = title.toUpperCase();

  if (
    t.includes("NOTEBOOK") ||
    t.includes("JOURNAL") ||
    t.includes("LEFT PANEL")
  ) return "journal";

  if (
    t.includes("RIGHT PANEL") ||
    t.includes("RIGHT CONTENT") ||
    t.includes("DIRECT DOCUMENT UPLOAD")
  ) return "rightPanel";

  if (
    t.includes("DOCUMENT") ||
    t.includes("NOTE ") ||
    t.includes("PIN") ||
    t.includes("BOOKMARK") ||
    t.includes("SENTENCE HIGHLIGHT") ||
    t.includes("COLOR BUTTON")
  ) return "documents";

  if (
    t.includes("TITLE") ||
    t.includes("GLASS PANEL") ||
    t.includes("CINEMATIC")
  ) return "title";

  if (
    t.includes("HEADER") ||
    t.includes("WORKSPACE") ||
    t.includes("PANEL HEADER") ||
    t.includes("VIEWPORT") ||
    t.includes("TYPOGRAPHY") ||
    t.includes("POLISH")
  ) return "workspace";

  return "misc";
}

for (let i = 0; i < matches.length; i++) {
  const start = matches[i].index;
  const end = i + 1 < matches.length ? matches[i + 1].index : sectionCss.length;
  const title = matches[i][1];
  const block = sectionCss.slice(start, end).trimEnd() + "\n";
  buckets[bucketFor(title)].push(block);
}

const files = {
  "base.css": baseCss,
  "journal.css": buckets.journal.join("\n"),
  "right-panel.css": buckets.rightPanel.join("\n"),
  "workspace.css": buckets.workspace.join("\n"),
  "documents.css": buckets.documents.join("\n"),
  "title.css": buckets.title.join("\n"),
  "misc.css": buckets.misc.join("\n")
};

for (const [file, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(stylesDir, file), content.trimEnd() + "\n", "utf8");
}

const imports = [
  '@import "./styles/base.css";',
  '@import "./styles/journal.css";',
  '@import "./styles/right-panel.css";',
  '@import "./styles/workspace.css";',
  '@import "./styles/documents.css";',
  '@import "./styles/title.css";',
  '@import "./styles/misc.css";'
].join("\n");

fs.writeFileSync(inputPath, imports + "\n", "utf8");

function count(s, ch) {
  return [...s].filter(c => c === ch).length;
}

console.log("Safe split complete.");
for (const [file, content] of Object.entries(files)) {
  console.log(file, "lines:", content.split("\n").length, "opens:", count(content, "{"), "closes:", count(content, "}"));
}
