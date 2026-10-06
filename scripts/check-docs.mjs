import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(root).filter((name) => name.endsWith(".md"));
const documents = new Map();
const errors = [];

export function slug(text) {
  return text.toLowerCase().trim().replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/ /g, "-");
}

for (const file of files) {
  const lines = readFileSync(resolve(root, file), "utf8").split(/\r?\n/);
  const anchors = new Set();
  const counts = new Map();
  const headings = [];
  const prose = [];
  let fence = null;
  let parent = null;
  let lastSection = 0;
  let lastSubsection = 0;
  const numbers = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    prose.push({ line, number: i + 1 });
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!heading) continue;
    const base = slug(heading[2]);
    const count = counts.get(base) ?? 0;
    const anchor = count ? `${base}-${count}` : base;
    anchors.add(anchor);
    counts.set(base, count + 1);
    headings.push({ level: heading[1].length, text: heading[2], anchor, line: i + 1 });
    const numeric = heading[2].match(/^(\d+(?:\.\d+)*)\.?\s/);
    if (!numeric) continue;
    const number = numeric[1];
    if (numbers.has(number)) errors.push(`${file}:${i + 1}: duplicate section ${number}`);
    numbers.add(number);
    if (heading[1].length === 2) {
      if (number.includes(".")) errors.push(`${file}:${i + 1}: subsection must use ###`);
      if (Number(number) !== lastSection + 1) errors.push(`${file}:${i + 1}: section ${number} is out of sequence`);
      lastSection = Number(number);
      lastSubsection = 0;
      parent = number;
    } else if (heading[1].length === 3) {
      if (number.split(".")[0] !== parent) errors.push(`${file}:${i + 1}: subsection ${number} is under ${parent}`);
      const part = Number(number.split(".")[1]);
      if (part !== lastSubsection + 1) errors.push(`${file}:${i + 1}: subsection ${number} is out of sequence`);
      lastSubsection = part;
    }
  }
  if (fence) errors.push(`${file}: unclosed code fence`);
  documents.set(file, { anchors, headings, prose });
}

let links = 0;
for (const [file, document] of documents) {
  for (const { line, number } of document.prose) {
    const markdown = line.replace(/(`+).*?\1/g, "");
    for (const match of markdown.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const [path, hash] = target.split("#");
      const destination = path ? decodeURIComponent(path) : file;
      const linked = documents.get(destination);
      links++;
      if (!existsSync(resolve(root, destination))) {
        errors.push(`${file}:${number}: missing file ${destination}`);
      } else if (hash && linked && !linked.anchors.has(decodeURIComponent(hash))) {
        errors.push(`${file}:${number}: missing anchor ${target}`);
      }
    }
  }
  const toc = document.headings.find((heading) => heading.text === "Mục lục");
  if (!toc) continue;
  const next = document.headings.find((heading) => heading.line > toc.line && heading.level === 2);
  const tocLines = document.prose.filter(({ number }) => number > toc.line && number < (next?.line ?? Infinity));
  for (const heading of document.headings.filter((heading) => heading.line > (next?.line ?? Infinity) - 1 && heading.level >= 2 && heading.level <= 4)) {
    if (!tocLines.some(({ line }) => line.includes(`](#${heading.anchor})`))) {
      errors.push(`${file}:${heading.line}: section missing from table of contents`);
    }
  }
}

const readme = documents.get("README.md");
if (readme) {
  for (const file of files.filter((file) => file !== "README.md")) {
    if (!readme.prose.some(({ line }) => line.includes(`](${file})`))) {
      errors.push(`README.md: missing document index entry ${file}`);
    }
  }
}

if (errors.length) {
  process.stderr.write(errors.join("\n") + "\n");
  process.exitCode = 1;
} else {
  const headingCount = [...documents.values()].reduce((sum, doc) => sum + doc.headings.length, 0);
  process.stdout.write(`Checked ${files.length} Markdown files, ${headingCount} headings and ${links} local links.\n`);
}
