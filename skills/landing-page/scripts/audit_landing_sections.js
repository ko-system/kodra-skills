// audit_landing_sections (read-only MustardScript).
// Audits a landing page: one h1, a CTA in the hero, standard sections,
// placeholder copy, dead links and image basics. Follows local component
// imports one level deep.
// ARGS: { file?: string } (app-relative path of the page component)

const PAGE_CANDIDATES = [
  "src/pages/Index.tsx",
  "app/page.tsx",
  "src/app/page.tsx",
  "pages/index.tsx",
  "src/pages/index.tsx",
  "src/App.tsx",
];
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const MAX_COMPONENT_FILES = 25;
const MAX_READ_BYTES = 262144;

const SECTION_PATTERNS = {
  hero: /<Hero\b|<h1\b/,
  socialProof:
    /<(Testimonials|LogoMarquee)\b|testimonial|trusted by|reviews\b|rating/i,
  features: /<(FeatureGrid|BentoGrid)\b|features?\b|benefits?\b/i,
  howItWorks: /<StepList\b|how it works|three steps|step 1\b/i,
  pricing: /<PricingTable\b|pricing|per month|\/\s*(month|mo)\b|เดือน|฿\s?\d/i,
  faq: /<Faq\b|\bFAQ\b|frequently asked|<Accordion\b/i,
  finalCta: /<CtaBand\b|id=["'](cta|get-started|contact)["']/i,
  footer: /<(SiteFooter|footer)\b/,
};
const RECOMMENDED_SECTIONS = ["hero", "features", "finalCta", "footer"];
const OPTIONAL_SECTIONS = ["socialProof", "howItWorks", "pricing", "faq"];
const PLACEHOLDER_PATTERN =
  /lorem ipsum|dolor sit amet|your (tagline|headline|company|product|brand) here|\bfeature (one|two|three|[0-9])\b|placeholder text|\bacme (inc|corp)\b|\bjohn doe\b|\bjane doe\b|\bTODO\b|\bTBD\b/gi;

function lineOf(text, index) {
  let line = 1;
  let pos = text.indexOf("\n");
  while (pos !== -1 && pos < index) {
    line += 1;
    pos = text.indexOf("\n", pos + 1);
  }
  return line;
}

function dirOf(file) {
  const slash = file.lastIndexOf("/");
  return slash === -1 ? "" : file.slice(0, slash);
}

function joinPath(dir, relative) {
  const parts = dir === "" ? [] : dir.split("/");
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

async function isFile(path) {
  try {
    await file_stats(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveSource(base) {
  if (SOURCE_EXTENSIONS.some((ext) => base.endsWith(ext))) {
    return (await isFile(base)) ? base : null;
  }
  for (const ext of SOURCE_EXTENSIONS) {
    if (await isFile(base + ext)) return base + ext;
  }
  for (const ext of SOURCE_EXTENSIONS) {
    if (await isFile(base + "/index" + ext)) return base + "/index" + ext;
  }
  return null;
}

async function resolveImport(fromFile, spec) {
  if (spec.startsWith("@/")) {
    return (
      (await resolveSource("src/" + spec.slice(2))) ??
      (await resolveSource(spec.slice(2)))
    );
  }
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const joined = joinPath(dirOf(fromFile), spec);
    return joined === null ? null : await resolveSource(joined);
  }
  return null;
}

// Returns the source of the JSX element starting at `start` ("<Tag ...").
function elementSource(text, start, tagName) {
  let depth = 0;
  let quote = "";
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      if (depth > 0 || ch !== "`") quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) {
      if (text[i - 1] === "/") return text.slice(start, i + 1);
      const close = text.indexOf("</" + tagName + ">", i);
      return text.slice(
        start,
        close === -1 ? i + 1 : close + tagName.length + 3,
      );
    }
  }
  return text.slice(start);
}

function parseImports(text) {
  const bindings = [];
  const importRe = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(importRe)) {
    if (match[1]) continue;
    const clause = match[2];
    const spec = match[3];
    const names = [];
    const defaultMatch = /^([A-Za-z_$][\w$]*)/.exec(clause.trim());
    if (defaultMatch) names.push(defaultMatch[1]);
    const braces = /\{([\s\S]*?)\}/.exec(clause);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const cleaned = part.trim().replace(/^type\s+/, "");
        if (cleaned === "") continue;
        const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(cleaned);
        names.push(alias ? alias[1] : cleaned);
      }
    }
    for (const name of names) {
      if (/^[A-Z]/.test(name)) bindings.push({ name, spec });
    }
  }
  return bindings;
}

function countMatches(text, re) {
  let count = 0;
  for (const _ of text.matchAll(re)) count += 1;
  return count;
}

function check(id, status, message) {
  return { id, status, message };
}

async function main() {
  // --- main -------------------------------------------------------------------

  let pageFile = null;
  const tried = [];
  if (typeof ARGS.file === "string" && ARGS.file !== "") {
    tried.push(ARGS.file);
    if (await isFile(ARGS.file)) pageFile = ARGS.file;
  } else {
    for (const candidate of PAGE_CANDIDATES) {
      tried.push(candidate);
      if (await isFile(candidate)) {
        pageFile = candidate;
        break;
      }
    }
  }

  let result;
  if (pageFile === null) {
    result = {
      error: "No landing page file found. Pass { file: '<path>' }.",
      tried,
    };
  } else {
    const pageText = await read_file(pageFile, { length: MAX_READ_BYTES });
    const components = [];
    const seenFiles = new Set([pageFile]);
    for (const binding of parseImports(pageText)) {
      if (components.length >= MAX_COMPONENT_FILES) break;
      const usage = new RegExp("<" + binding.name + "[\\s/>]", "g");
      const uses = countMatches(pageText, usage);
      if (uses === 0) continue;
      const file = await resolveImport(pageFile, binding.spec);
      if (file === null || seenFiles.has(file)) continue;
      seenFiles.add(file);
      const text = await read_file(file, { length: MAX_READ_BYTES });
      components.push({ name: binding.name, file, uses, text });
    }

    const checks = [];

    // 1. Exactly one h1.
    const ownH1 = countMatches(pageText, /<h1\b/g);
    let h1Count = ownH1;
    const h1Sources = [];
    if (ownH1 > 0) h1Sources.push(pageFile + " (" + ownH1 + ")");
    for (const component of components) {
      if (/<h1\b/.test(component.text)) {
        h1Count += component.uses;
        h1Sources.push(component.name + " x" + component.uses);
      }
    }
    if (h1Count === 1) {
      checks.push(
        check("single_h1", "pass", "Exactly one h1: " + h1Sources[0]),
      );
    } else if (h1Count === 0) {
      checks.push(
        check(
          "single_h1",
          "fail",
          "No h1 found. Put the headline in Hero's title or an <h1>.",
        ),
      );
    } else {
      checks.push(
        check(
          "single_h1",
          "fail",
          "Found " +
            h1Count +
            " h1 elements (" +
            h1Sources.join(", ") +
            "). Keep one; use h2 for section titles.",
        ),
      );
    }

    // 2. CTA above the fold (inside the hero).
    let heroSource = "";
    const heroStart = pageText.search(/<Hero\b/);
    if (heroStart !== -1) {
      heroSource = elementSource(pageText, heroStart, "Hero");
    } else {
      const h1Start = pageText.search(/<h1\b/);
      if (h1Start !== -1) {
        const sectionEnd = pageText
          .slice(h1Start)
          .search(/<\/(section|header)>/);
        heroSource = pageText.slice(
          h1Start,
          sectionEnd === -1 ? h1Start + 2000 : h1Start + sectionEnd,
        );
      }
    }
    if (heroSource === "") {
      checks.push(
        check(
          "cta_above_fold",
          "warn",
          "Could not locate the hero to check its CTA.",
        ),
      );
    } else if (/<(Button|a|Link)\b/.test(heroSource)) {
      if (/(href|to)=["']#["']/.test(heroSource)) {
        checks.push(
          check(
            "cta_above_fold",
            "warn",
            "Hero CTA exists but points at '#'. Link it to a real route, form or contact target.",
          ),
        );
      } else {
        checks.push(
          check("cta_above_fold", "pass", "Hero contains a call to action."),
        );
      }
    } else {
      checks.push(
        check(
          "cta_above_fold",
          "fail",
          "No button or link in the hero. Add the primary CTA (Hero 'actions' prop).",
        ),
      );
    }

    // 3. Hero image should not be lazy (LCP).
    if (
      heroSource !== "" &&
      /<img\b[^>]*loading=["']lazy["']/.test(heroSource)
    ) {
      checks.push(
        check(
          "hero_image_eager",
          "warn",
          'Hero image uses loading="lazy"; the LCP image should load eagerly (fetchPriority="high").',
        ),
      );
    }

    // 4. Sections.
    const corpusParts = [pageText];
    for (const component of components) {
      if (!component.file.startsWith("src/components/ui/")) {
        corpusParts.push(component.text);
      }
    }
    const corpus = corpusParts.join("\n");
    const sections = {};
    for (const key of Object.keys(SECTION_PATTERNS)) {
      sections[key] = SECTION_PATTERNS[key].test(corpus);
    }
    const missingRecommended = RECOMMENDED_SECTIONS.filter(
      (key) => !sections[key],
    );
    const missingOptional = OPTIONAL_SECTIONS.filter((key) => !sections[key]);
    if (missingRecommended.length === 0) {
      checks.push(
        check(
          "sections",
          "pass",
          "Hero, features, final CTA and footer are present.",
        ),
      );
    } else {
      checks.push(
        check(
          "sections",
          "warn",
          "Missing recommended sections: " +
            missingRecommended.join(", ") +
            ".",
        ),
      );
    }

    // 5. Placeholder copy.
    const placeholders = [];
    const scanned = [{ file: pageFile, text: pageText }];
    for (const component of components) {
      if (!component.file.startsWith("src/components/ui/")) {
        scanned.push({ file: component.file, text: component.text });
      }
    }
    for (const item of scanned) {
      for (const match of item.text.matchAll(PLACEHOLDER_PATTERN)) {
        if (placeholders.length >= 20) break;
        const lineStart = item.text.lastIndexOf("\n", match.index) + 1;
        let lineEnd = item.text.indexOf("\n", match.index);
        if (lineEnd === -1) lineEnd = item.text.length;
        placeholders.push({
          file: item.file,
          line: lineOf(item.text, match.index),
          text: item.text.slice(lineStart, lineEnd).trim().slice(0, 100),
        });
      }
    }
    checks.push(
      placeholders.length === 0
        ? check("placeholder_copy", "pass", "No placeholder copy found.")
        : check(
            "placeholder_copy",
            "fail",
            placeholders.length +
              " placeholder/filler snippet(s) found; replace with real content.",
          ),
    );

    // 6. Dead links and image alt text on the page itself.
    const deadLinks = countMatches(pageText, /(href|to)=["']#?["']/g);
    checks.push(
      deadLinks === 0
        ? check("dead_links", "pass", 'No href="#" links on the page.')
        : check(
            "dead_links",
            "warn",
            deadLinks +
              " link(s) point at '#' or ''. Point them at real targets.",
          ),
    );
    let imagesWithoutAlt = 0;
    for (const match of pageText.matchAll(/<img\b/g)) {
      if (!/\balt=/.test(elementSource(pageText, match.index, "img"))) {
        imagesWithoutAlt += 1;
      }
    }
    checks.push(
      imagesWithoutAlt === 0
        ? check("img_alt", "pass", "All <img> elements on the page have alt.")
        : check(
            "img_alt",
            "fail",
            imagesWithoutAlt +
              ' <img> without alt. Describe meaningful images; use alt="" for decoration.',
          ),
    );

    const summary = { pass: 0, warn: 0, fail: 0 };
    for (const item of checks) summary[item.status] += 1;

    result = {
      file: pageFile,
      scannedFiles: [pageFile].concat(components.map((c) => c.file)),
      summary,
      checks,
      sections,
      missingRecommended,
      missingOptional,
      placeholders,
    };
  }

  return result;
}

// The sandbox returns the value of the last expression (awaited).
main();
