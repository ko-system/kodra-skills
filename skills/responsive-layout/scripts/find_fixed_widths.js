// find_fixed_widths (read-only MustardScript).
// Finds layout code that breaks small screens: fixed pixel widths, grids
// without a mobile column count, small touch targets and 100vh usage.
// ARGS: { dir?: string = "src", maxFindings?: number = 120,
//         minWidthPx?: number = 400, maxFiles?: number = 600 }

const ROOT = typeof ARGS.dir === "string" && ARGS.dir !== "" ? ARGS.dir : "src";
const MAX_FINDINGS = Number.isInteger(ARGS.maxFindings)
  ? ARGS.maxFindings
  : 120;
const MIN_WIDTH = Number.isInteger(ARGS.minWidthPx) ? ARGS.minWidthPx : 400;
const MAX_FILES = Number.isInteger(ARGS.maxFiles) ? ARGS.maxFiles : 600;
const MAX_FILE_BYTES = 262144;
const EXTENSIONS = [".tsx", ".jsx", ".ts", ".js", ".css", ".html"];
const SKIP_DIRS = [
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  ".output/",
  "coverage/",
  ".dyad/",
  "test-results/",
  "playwright-report/",
  "e2e-tests/",
  "src/components/ui/",
];
const BREAKPOINT_PREFIX =
  /(^|:)(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|min-\[[^\]]*\]|@[a-z0-9]*):$/;

function lineOf(text, index) {
  let line = 1;
  let pos = text.indexOf("\n");
  while (pos !== -1 && pos < index) {
    line += 1;
    pos = text.indexOf("\n", pos + 1);
  }
  return line;
}

function snippetAt(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  let end = text.indexOf("\n", index);
  if (end === -1) end = text.length;
  return text.slice(start, end).trim().slice(0, 120);
}

function isSkipped(path) {
  const withSlash = path.endsWith("/") ? path : path + "/";
  return SKIP_DIRS.some(
    (dir) =>
      withSlash === dir ||
      withSlash.startsWith(dir) ||
      withSlash.includes("/" + dir),
  );
}

function hasExtension(path) {
  return EXTENSIONS.some((ext) => path.endsWith(ext));
}

function toPx(value, unit) {
  const n = Number(value);
  return unit === "rem" ? n * 16 : n;
}

function startTag(text, start) {
  let depth = 0;
  let quote = "";
  const limit = Math.min(text.length, start + 2000);
  for (let i = start + 1; i < limit; i++) {
    const ch = text[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start, limit);
}

const findings = [];
let truncated = false;

function add(file, text, index, rule, severity, message) {
  if (findings.length >= MAX_FINDINGS) {
    truncated = true;
    return;
  }
  findings.push({
    file,
    line: lineOf(text, index),
    rule,
    severity,
    message,
    snippet: snippetAt(text, index),
  });
}

async function main() {
  // --- collect files ---------------------------------------------------------
  const files = [];
  const stack = [ROOT];
  let listError = null;
  while (stack.length > 0 && files.length < MAX_FILES) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = await list_files(dir);
    } catch (error) {
      if (dir === ROOT)
        listError = String(error && error.message ? error.message : error);
      continue;
    }
    for (const entry of entries) {
      if (isSkipped(entry)) continue;
      if (entry.endsWith("/")) stack.push(entry.slice(0, -1));
      else if (hasExtension(entry)) files.push(entry);
    }
  }
  if (ROOT === "src") {
    for (const extra of ["index.html", "app/globals.css"]) {
      try {
        await file_stats(extra);
        files.push(extra);
      } catch {
        // optional file
      }
    }
  }
  files.sort();

  // --- scan ------------------------------------------------------------------
  let scanned = 0;
  for (const file of files) {
    if (findings.length >= MAX_FINDINGS) {
      truncated = true;
      break;
    }
    let text;
    try {
      text = await read_file(file, { length: MAX_FILE_BYTES });
    } catch {
      continue;
    }
    scanned += 1;
    const isCss = file.endsWith(".css");
    const isMarkup =
      file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".html");

    if (!isCss) {
      for (const m of text.matchAll(
        /(^|[\s"'`{(])((?:[a-z0-9@\[\]-]+:)*)(min-w|w)-\[(\d+(?:\.\d+)?)(px|rem)\]/g,
      )) {
        if (BREAKPOINT_PREFIX.test(m[2])) continue;
        const px = toPx(m[4], m[5]);
        if (px >= MIN_WIDTH) {
          add(
            file,
            text,
            m.index + m[1].length,
            "fixed-width",
            "error",
            m[3] +
              "-[" +
              m[4] +
              m[5] +
              "] is wider than small phones. Use w-full with max-w-[" +
              m[4] +
              m[5] +
              "], or apply it from a breakpoint (md:" +
              m[3] +
              "-[...]).",
          );
        }
      }
      for (const m of text.matchAll(
        /(^|[^A-Za-z])(width|minWidth)\s*:\s*["']?(\d{3,4})(px)?["']?/g,
      )) {
        if (Number(m[3]) >= MIN_WIDTH) {
          add(
            file,
            text,
            m.index + m[1].length,
            "inline-fixed-width",
            "warn",
            "Inline " +
              m[2] +
              ": " +
              m[3] +
              "px. Use maxWidth or a responsive Tailwind class instead.",
          );
        }
      }
    }

    if (isCss) {
      for (const m of text.matchAll(
        /(^|[;{\s])(width|min-width)\s*:\s*(\d{3,4})px/g,
      )) {
        if (Number(m[3]) >= MIN_WIDTH) {
          add(
            file,
            text,
            m.index + m[1].length,
            "css-fixed-width",
            "warn",
            m[2] +
              ": " +
              m[3] +
              "px. Prefer max-width, or set it inside a min-width media query.",
          );
        }
      }
    }

    if (isMarkup) {
      for (const m of text.matchAll(
        /(^|[\s"'`{(])grid-cols-([3-9]|1[0-2])\b/g,
      )) {
        add(
          file,
          text,
          m.index + m[1].length,
          "grid-no-mobile",
          "warn",
          "grid-cols-" +
            m[2] +
            " applies on phones too. Start with grid-cols-1 (or 2) and add md:grid-cols-" +
            m[2] +
            ", unless the items are tiny (icons, calendar days).",
        );
      }
      for (const m of text.matchAll(/<(button|Button)\b/g)) {
        const tag = startTag(text, m.index);
        const small = /(^|[\s"'`])(h|size)-(5|6|7|8|9)([\s"'`]|$)/.exec(tag);
        if (small && !/\b(min-h-11|min-h-\[44px\]|h-11|h-12)\b/.test(tag)) {
          add(
            file,
            text,
            m.index,
            "small-touch-target",
            "info",
            "Button height " +
              small[2] +
              "-" +
              small[3] +
              " is under 44px. Use h-11 (or min-h-11) for touch, at least below md.",
          );
        }
      }
    }

    for (const m of text.matchAll(/(^|[\s"'`{(:])h-screen\b|100vh/g)) {
      add(
        file,
        text,
        m.index + (m[1] ? m[1].length : 0),
        "viewport-height",
        "info",
        "100vh/h-screen ignores mobile browser bars. Prefer min-h-dvh / h-dvh (or 100dvh).",
      );
    }
  }

  const bySeverity = { error: 0, warn: 0, info: 0 };
  const byRule = {};
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  }

  const result = {
    root: ROOT,
    scannedFiles: scanned,
    fileLimitReached: files.length >= MAX_FILES,
    summary: { bySeverity, byRule },
    truncated,
    findings,
  };
  if (listError !== null)
    result.error = "Could not list " + ROOT + ": " + listError;
  return result;
}

// The sandbox returns the value of the last expression (awaited).
main();
