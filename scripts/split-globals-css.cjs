const fs = require("fs");
const path = require("path");

const inputPath = path.join(process.cwd(), "src/app/globals.css");
const stylesDir = path.join(process.cwd(), "src/app/styles");
const css = fs.readFileSync(inputPath, "utf8");

const sections = [
  {
    file: "base.css",
    start: 1,
    end: 1508
  },
  {
    file: "journal.css",
    ranges: [
      [1509, 1580],
      [4906, 5383],
      [6404, 6425]
    ]
  },
  {
    file: "right-panel.css",
    ranges: [
      [1581, 1718],
      [2015, 2131],
      [2547, 2575],
      [2597, 2677],
      [5384, 5554]
    ]
  },
  {
    file: "workspace.css",
    ranges: [
      [1721, 1784],
      [2134, 2384],
      [2473, 2531],
      [5456, 5826],
      [6253, 6402]
    ]
  },
  {
    file: "documents.css",
    ranges: [
      [1787, 2012],
      [2680, 4895]
    ]
  },
  {
    file: "title.css",
    ranges: [
      [5827, 6252]
    ]
  },
  {
    file: "misc.css",
    ranges: [
      [2387, 2470],
      [2534, 2544],
      [2578, 2594]
    ]
  }
];

const lines = css.split(/\n/);

function sliceRange(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

for (const section of sections) {
  let content = "";
  if (section.start && section.end) {
    content = sliceRange(section.start, section.end);
  } else {
    content = section.ranges.map(([start, end]) => sliceRange(start, end)).join("\n\n");
  }

  fs.writeFileSync(path.join(stylesDir, section.file), content.trimEnd() + "\n", "utf8");
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

console.log("Split complete.");
