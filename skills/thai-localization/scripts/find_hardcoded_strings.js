// find_hardcoded_strings (read-only MustardScript).
// Finds hard-coded UI strings (Thai and Latin), locale-less date/number
// formatting, Thai text with clipping-prone or unsupported styles, and a
// missing Thai font or <html lang>.
// ARGS: { dir?: string = "src", maxFindings?: number = 150,
//         includeUi?: boolean = false, maxFiles?: number = 600 }

const ROOT = typeof ARGS.dir === "string" && ARGS.dir !== "" ? ARGS.dir : "src";
const MAX_FINDINGS = Number.isInteger(ARGS.maxFindings)
  ? ARGS.maxFindings
  : 150;
const INCLUDE_UI = ARGS.includeUi === true;
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
  "i18n/",
  "locales/",
  "messages/",
];
const THAI = /[฀-๿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const CODE_LIKE =
  /=>|&&|\|\||[;=]|\w\(|\bReact\.|\breturn\b|^[,)&|.\]}]|^[\s\d.,:%+\-*/()]+$/;
const I18N_USAGE =
  /useTranslation\(|useTranslations\(|getTranslations\(|<Trans\b|<FormattedMessage\b|useIntl\(|\bt\(\s*["'`]/;
const THAI_FONTS =
  /IBM Plex Sans Thai|Noto Sans Thai|Noto Serif Thai|Sarabun|Anuphan|Kanit|Prompt|Mitr|Bai Jamjuree|Chakra Petch|K2D|Niramit|Pridi|Trirong|Taviraj|Mali|Krub|Thasadith|Chonburi|Athiti|Pattaya|Sriracha|Charm|Itim|Leelawadee|Thonburi|Sukhumvit/i;

function lineOf(text, index) {
  let line = 1;
  let pos = text.indexOf("\n");
  while (pos !== -1 && pos < index) {
    line += 1;
    pos = text.indexOf("\n", pos + 1);
  }
  return line;
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

function scriptOf(text) {
  const thai = THAI.test(text);
  const latin = LATIN_WORD.test(text);
  if (thai && latin) return "mixed";
  return thai ? "thai" : "latin";
}

const findings = [];
let truncated = false;
const counts = { thai: 0, latin: 0, mixed: 0, total: 0 };

function add(file, text, index, rule, severity, message, extra) {
  if (findings.length >= MAX_FINDINGS) {
    truncated = true;
    return;
  }
  const finding = { file, line: lineOf(text, index), rule, severity, message };
  if (extra) finding.text = extra.slice(0, 80);
  findings.push(finding);
}

function addString(file, text, index, rule, value) {
  const script = scriptOf(value);
  counts[script] += 1;
  counts.total += 1;
  add(file, text, index, rule, "info", script + " string", value);
}

async function readOrNull(path) {
  try {
    return await read_file(path, { length: MAX_FILE_BYTES });
  } catch {
    return null;
  }
}

async function main() {
  // --- project context -----------------------------------------------------------
  const pkgText = await readOrNull("package.json");
  let i18nLibrary = null;
  if (pkgText !== null) {
    const m =
      /"(react-i18next|i18next|next-intl|react-intl|@lingui\/react|next-i18next)"\s*:/.exec(
        pkgText,
      );
    if (m) i18nLibrary = m[1];
  }

  const styleSources = [];
  for (const path of [
    "index.html",
    "src/globals.css",
    "src/index.css",
    "app/globals.css",
    "src/app/globals.css",
    "app/layout.tsx",
    "src/app/layout.tsx",
    "tailwind.config.ts",
    "tailwind.config.js",
    "tailwind.design-preset.ts",
  ]) {
    const text = await readOrNull(path);
    if (text !== null) styleSources.push({ path, text });
  }
  const hasThaiFont = styleSources.some((s) => THAI_FONTS.test(s.text));
  let htmlLang = null;
  let htmlLangSource = null;
  for (const source of styleSources) {
    const m = /<html\b[^>]*\blang=["']([^"']+)["']/.exec(source.text);
    if (m) {
      htmlLang = m[1];
      htmlLangSource = source;
      break;
    }
  }

  // --- collect files -----------------------------------------------------------
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
      else if (
        /\.(tsx|jsx|ts|js)$/.test(entry) &&
        !/\.(test|spec|d)\.[jt]sx?$/.test(entry)
      )
        files.push(entry);
    }
  }
  files.sort();

  // --- scan --------------------------------------------------------------------
  let scanned = 0;
  let filesUsingI18n = 0;
  let thaiFiles = 0;
  for (const file of files) {
    const text = await readOrNull(file);
    if (text === null) continue;
    scanned += 1;
    const usesI18n = I18N_USAGE.test(text);
    if (usesI18n) filesUsingI18n += 1;
    const hasThai = THAI.test(text);
    if (hasThai) thaiFiles += 1;
    const isJsx = /\.(tsx|jsx)$/.test(file);

    if (isJsx) {
      for (const m of text.matchAll(/>([^<>{}]*[A-Za-z฀-๿][^<>{}]*)</g)) {
        if (m.index > 0 && text[m.index - 1] === "=") continue; // arrow function "=>"
        const value = m[1].replace(/\s+/g, " ").trim();
        if (
          value.length < 2 ||
          CODE_LIKE.test(value) ||
          /^&\w+;$/.test(value) ||
          /^\(?\s*(\/\/|\/\*)/.test(value)
        )
          continue;
        if (!THAI.test(value) && !LATIN_WORD.test(value)) continue;
        addString(file, text, m.index + 1, "hardcoded-text", value);
      }
      for (const m of text.matchAll(
        /\b(placeholder|title|alt|aria-label|label|description|emptyText|helperText)=["']([^"']*[A-Za-z฀-๿][^"']*)["']/g,
      )) {
        const value = m[2].trim();
        if (value.length < 2 || (!THAI.test(value) && !LATIN_WORD.test(value)))
          continue;
        addString(
          file,
          text,
          m.index,
          "hardcoded-attribute",
          m[1] + ": " + value,
        );
      }
    }
    for (const m of text.matchAll(
      /\btoast(\.(success|error|info|warning|message))?\(\s*["'`]([^"'`]*[A-Za-z฀-๿][^"'`]*)["'`]/g,
    )) {
      addString(file, text, m.index, "hardcoded-toast", m[3].trim());
    }

    for (const m of text.matchAll(/\.toLocale(Date|Time)?String\(\s*\)/g)) {
      add(
        file,
        text,
        m.index,
        "locale-less-format",
        "warn",
        "toLocale" +
          (m[1] ?? "") +
          'String() without a locale follows the visitor\'s browser. Use Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok" }).',
      );
    }
    for (const m of text.matchAll(
      /new Intl\.(NumberFormat|DateTimeFormat)\(\s*\)/g,
    )) {
      add(
        file,
        text,
        m.index,
        "locale-less-format",
        "warn",
        "Intl." +
          m[1] +
          '() without a locale; pass "th-TH" (or the active language).',
      );
    }
    if (hasThai) {
      for (const m of text.matchAll(/currency:\s*["']USD["']/g)) {
        add(
          file,
          text,
          m.index,
          "locale-less-format",
          "info",
          "USD currency in a file with Thai text; Thai prices are usually THB.",
        );
      }
    }
    // Typography classes only matter in rendered markup (JSX).
    if (hasThai && isJsx) {
      for (const m of text.matchAll(
        /(^|[\s"'`:])(uppercase|italic|-?tracking-(tight|tighter)|leading-none|leading-tight)\b/g,
      )) {
        add(
          file,
          text,
          m.index + m[1].length,
          "thai-typography",
          "warn",
          m[2] +
            " in a file with Thai text: Thai has no case or italics, and tight tracking/leading clips vowels and tone marks. Scope it to Latin-only elements or remove it.",
        );
      }
      for (const m of text.matchAll(/(^|[\s"'`:])break-all\b/g)) {
        add(
          file,
          text,
          m.index + m[1].length,
          "thai-typography",
          "warn",
          "break-all splits Thai words mid-syllable. Remove it or use Intl.Segmenter-based word breaks.",
        );
      }
    }
  }

  if (thaiFiles > 0 && !hasThaiFont) {
    findings.unshift({
      file: "index.html",
      line: 1,
      rule: "missing-thai-font",
      severity: "warn",
      message:
        "Thai text found but no Thai-capable font is configured (e.g. IBM Plex Sans Thai, Noto Sans Thai, Sarabun).",
    });
  }
  if (
    thaiFiles > 0 &&
    htmlLang !== null &&
    !/^th\b/i.test(htmlLang) &&
    i18nLibrary === null
  ) {
    findings.unshift({
      file: htmlLangSource.path,
      line: 1,
      rule: "html-lang",
      severity: "warn",
      message:
        '<html lang="' +
        htmlLang +
        '"> but the UI contains Thai text. Use lang="th" (or switch it with the language).',
    });
  }
  if (findings.length > MAX_FINDINGS) {
    findings.length = MAX_FINDINGS;
    truncated = true;
  }

  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;

  const result = {
    root: ROOT,
    scannedFiles: scanned,
    fileLimitReached: files.length >= MAX_FILES,
    i18nLibrary,
    filesUsingI18n,
    filesWithThaiText: thaiFiles,
    thaiFontConfigured: hasThaiFont,
    htmlLang,
    counts,
    byRule,
    truncated,
    findings,
    advice:
      i18nLibrary === null
        ? "No i18n library found. Fine for a single-language app; for Thai + English, set up i18next (Vite) or next-intl (Next.js) and move these strings into locale files."
        : "Move hard-coded strings into the " +
          i18nLibrary +
          " locale files and use t().",
  };
  if (listError !== null)
    result.error = "Could not list " + ROOT + ": " + listError;
  return result;
}

// The sandbox returns the value of the last expression (awaited).
main();
