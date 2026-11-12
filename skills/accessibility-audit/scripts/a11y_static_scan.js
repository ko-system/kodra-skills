// a11y_static_scan (read-only MustardScript).
// Static accessibility checks for React/JSX: alt text, control labels, button
// and link names, click handlers on non-interactive elements, tabIndex,
// removed focus outlines and <html lang>.
// ARGS: { dir?: string = "src", includeUi?: boolean = false,
//         maxFindings?: number = 150, maxFiles?: number = 600 }

const ROOT = typeof ARGS.dir === "string" && ARGS.dir !== "" ? ARGS.dir : "src";
const INCLUDE_UI = ARGS.includeUi === true;
const MAX_FINDINGS = Number.isInteger(ARGS.maxFindings)
  ? ARGS.maxFindings
  : 150;
const MAX_FILES = Number.isInteger(ARGS.maxFiles) ? ARGS.maxFiles : 600;
const MAX_FILE_BYTES = 262144;
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
];
const TAG_RE =
  /<(img|Image|input|Input|textarea|Textarea|select|button|Button|a|Link|NavLink|div|span|li|p|section|article|td|tr)\b/g;
const NON_INTERACTIVE = [
  "div",
  "span",
  "li",
  "p",
  "section",
  "article",
  "td",
  "tr",
];
const SKIP_INPUT_TYPES = /\btype=["'](hidden|submit|button|reset|image)["']/;

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
  if (
    !INCLUDE_UI &&
    (withSlash.startsWith("src/components/ui/") ||
      withSlash.includes("/components/ui/"))
  ) {
    return true;
  }
  return SKIP_DIRS.some(
    (dir) => withSlash.startsWith(dir) || withSlash.includes("/" + dir),
  );
}

// Returns the index just after the start tag's closing ">" (or -1).
function startTagEnd(text, start) {
  let depth = 0;
  let quote = "";
  const limit = Math.min(text.length, start + 4000);
  for (let i = start + 1; i < limit; i++) {
    const ch = text[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || (ch === "`" && depth > 0)) quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return i + 1;
  }
  return -1;
}

function innerContent(text, tagEnd, tagName) {
  const close = text.indexOf("</" + tagName + ">", tagEnd);
  if (close === -1 || close - tagEnd > 4000) return null;
  return text.slice(tagEnd, close);
}

function hasAccessibleText(inner) {
  if (/sr-only|aria-label/.test(inner)) return true;
  const stripped = inner
    .replace(/<[A-Za-z][^<>]*\/>/g, "")
    .replace(/<\/?[A-Za-z][^<>]*>/g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .trim();
  return stripped.length > 0;
}

// The string literal (class list) around index, bounded to 600 chars.
function enclosingString(text, index) {
  let start = index;
  while (start > 0 && index - start < 600 && !"\"'`".includes(text[start - 1]))
    start -= 1;
  const quote = text[start - 1];
  let end = text.indexOf(quote, index);
  if (end === -1 || end - index > 600) end = Math.min(text.length, index + 300);
  return text.slice(start, end);
}

function isWrappedInLabel(text, index) {
  const before = text.slice(Math.max(0, index - 1500), index);
  const open = Math.max(
    before.lastIndexOf("<label"),
    before.lastIndexOf("<Label"),
  );
  const close = Math.max(
    before.lastIndexOf("</label>"),
    before.lastIndexOf("</Label>"),
  );
  return open !== -1 && open > close;
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

function checkHtmlLang(file, text) {
  const m = /<html\b[^>]*>/.exec(text);
  if (m && !/\blang=/.test(m[0])) {
    add(
      file,
      text,
      m.index,
      "html-lang",
      "error",
      '<html> has no lang attribute. Set lang to the content language (e.g. lang="en" or lang="th").',
    );
  }
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
      else if (entry.endsWith(".tsx") || entry.endsWith(".jsx"))
        files.push(entry);
    }
  }
  files.sort();

  // --- <html lang> -------------------------------------------------------------
  for (const candidate of [
    "index.html",
    "app/layout.tsx",
    "src/app/layout.tsx",
  ]) {
    try {
      const text = await read_file(candidate, { length: MAX_FILE_BYTES });
      checkHtmlLang(candidate, text);
    } catch {
      // not present in this framework
    }
  }

  // --- scan JSX ----------------------------------------------------------------
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
    const hasDynamicHtmlFor = /htmlFor=\{/.test(text);

    for (const m of text.matchAll(TAG_RE)) {
      const tag = m[1];
      const end = startTagEnd(text, m.index);
      if (end === -1) continue;
      const attrs = text.slice(m.index, end);
      const spreads = /\{\s*\.\.\./.test(attrs);
      const named = /\baria-label(ledby)?=|\btitle=/.test(attrs);

      if (tag === "img" || tag === "Image") {
        if (!/\balt=/.test(attrs) && !spreads) {
          add(
            file,
            text,
            m.index,
            "img-alt",
            "error",
            'Image without alt. Describe meaningful images; use alt="" for decorative ones.',
          );
        }
      } else if (
        tag === "input" ||
        tag === "Input" ||
        tag === "textarea" ||
        tag === "Textarea" ||
        tag === "select"
      ) {
        if (SKIP_INPUT_TYPES.test(attrs) || named || spreads) continue;
        if (isWrappedInLabel(text, m.index)) continue;
        const idMatch = /\bid=["']([^"']+)["']/.exec(attrs);
        if (
          idMatch &&
          (text.includes('htmlFor="' + idMatch[1] + '"') ||
            text.includes("htmlFor='" + idMatch[1] + "'"))
        )
          continue;
        if (/\bid=\{/.test(attrs) && hasDynamicHtmlFor) continue;
        add(
          file,
          text,
          m.index,
          "control-label",
          "error",
          idMatch
            ? 'Control id="' +
                idMatch[1] +
                '" has no <Label htmlFor> in this file. Add a label (or aria-label if a visible label exists elsewhere).'
            : "Form control without a label. Use <Label htmlFor> + id, FormLabel/FormControl, or aria-label. Placeholder is not a label.",
        );
      } else if (tag === "button" || tag === "Button") {
        if (named || spreads) continue;
        if (attrs.endsWith("/>")) {
          add(
            file,
            text,
            m.index,
            "button-name",
            "error",
            "Self-closing button has no accessible name. Add aria-label.",
          );
          continue;
        }
        const inner = innerContent(text, end, tag);
        if (inner !== null && !hasAccessibleText(inner)) {
          add(
            file,
            text,
            m.index,
            "button-name",
            "error",
            'Icon-only button without a name. Add aria-label ("Delete invoice") or sr-only text.',
          );
        }
      } else if (tag === "a" || tag === "Link" || tag === "NavLink") {
        if (tag === "a") {
          if (!/\bhref=/.test(attrs) && !spreads) {
            add(
              file,
              text,
              m.index,
              "link-href",
              "warn",
              "<a> without href is not focusable. Use <button> for actions or add a real href.",
            );
          } else if (/\bhref=["'](#?|javascript:[^"']*)["']/.test(attrs)) {
            add(
              file,
              text,
              m.index,
              "link-href",
              "warn",
              "Link points at '#', '' or javascript:. Use a real URL, or a <button> for actions.",
            );
          }
        }
        if (named || spreads || attrs.endsWith("/>")) continue;
        const inner = innerContent(text, end, tag);
        if (inner !== null && !hasAccessibleText(inner)) {
          add(
            file,
            text,
            m.index,
            "link-name",
            "error",
            "Link without text. Add visible text, sr-only text or aria-label.",
          );
        }
      } else if (NON_INTERACTIVE.includes(tag)) {
        if (!/\bonClick=/.test(attrs)) continue;
        if (!/\brole=/.test(attrs)) {
          add(
            file,
            text,
            m.index,
            "click-non-interactive",
            "error",
            "onClick on <" +
              tag +
              "> is not keyboard accessible. Use <button> (or <a href>) instead.",
          );
        } else if (
          !/\bonKey(Down|Up)=/.test(attrs) ||
          !/\btabIndex=/.test(attrs)
        ) {
          add(
            file,
            text,
            m.index,
            "click-non-interactive",
            "warn",
            "<" +
              tag +
              " role=...> with onClick also needs tabIndex={0} and Enter/Space handling. Prefer a real <button>.",
          );
        }
      }
    }

    for (const m of text.matchAll(/tabIndex=\{?["']?([1-9][0-9]*)/g)) {
      add(
        file,
        text,
        m.index,
        "positive-tabindex",
        "warn",
        "Positive tabIndex breaks the natural focus order. Use 0 or -1.",
      );
    }
    for (const m of text.matchAll(/(^|[\s"'`])(focus:)?outline-none\b/g)) {
      const line =
        enclosingString(text, m.index + m[1].length) +
        " " +
        snippetAt(text, m.index);
      if (
        !/ring|focus-visible:|focus:border|focus:shadow|focus:underline|focus:bg-|focus-within:|data-\[(highlighted|selected)/.test(
          line,
        )
      ) {
        add(
          file,
          text,
          m.index + m[1].length,
          "focus-outline-removed",
          "warn",
          "outline-none without a visible replacement. Add focus-visible:ring-2 focus-visible:ring-ring.",
        );
      }
    }
    for (const m of text.matchAll(/\bautoFocus\b/g)) {
      add(
        file,
        text,
        m.index,
        "autofocus",
        "info",
        "autoFocus can disorient screen reader users; use it only in dialogs or single-purpose pages.",
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
    notStaticallyChecked: [
      "color contrast",
      "focus order and focus management after actions",
      "route-change announcements",
      "content shown only on hover",
    ],
  };
  if (listError !== null)
    result.error = "Could not list " + ROOT + ": " + listError;
  return result;
}

// The sandbox returns the value of the last expression (awaited).
main();
