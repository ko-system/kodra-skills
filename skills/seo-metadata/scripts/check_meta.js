// check_meta (read-only MustardScript).
// Checks SEO metadata for a Vite SPA (index.html + pages) or a Next.js App
// Router app (Metadata API, robots, sitemap, icons).
// ARGS: { siteUrl?: string }

const SITE_URL =
  typeof ARGS.siteUrl === "string" ? ARGS.siteUrl.replace(/\/+$/, "") : "";
const MAX_READ_BYTES = 262144;
const DEFAULT_TITLES = [
  "dyad-generated-app",
  "vite + react",
  "vite + react + ts",
  "vite app",
  "react app",
  "create next app",
  "my app",
  "untitled",
];

const checks = [];

function check(id, status, message) {
  checks.push({ id, status, message });
}

async function exists(path) {
  try {
    await file_stats(path);
    return true;
  } catch {
    return false;
  }
}

async function firstExisting(paths) {
  for (const path of paths) {
    if (await exists(path)) return path;
  }
  return null;
}

async function readOrNull(path) {
  try {
    return await read_file(path, { length: MAX_READ_BYTES });
  } catch {
    return null;
  }
}

async function listOrEmpty(dir) {
  try {
    return await list_files(dir);
  } catch {
    return [];
  }
}

function attrsOf(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4];
  }
  return attrs;
}

function lengthCheck(id, label, value, min, max) {
  if (value.length < min || value.length > max) {
    check(
      id,
      "warn",
      label +
        " is " +
        value.length +
        " chars; aim for " +
        min +
        "-" +
        max +
        ': "' +
        value.slice(0, 90) +
        '"',
    );
  } else {
    check(id, "pass", label + " length " + value.length + " chars.");
  }
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//.test(value);
}

async function walkPages(root, matcher, limit) {
  const out = [];
  const stack = [root];
  while (stack.length > 0 && out.length < limit) {
    const dir = stack.pop();
    for (const entry of await listOrEmpty(dir)) {
      if (entry.endsWith("/")) {
        if (!/(^|\/)(node_modules|api|components|ui)\/$/.test(entry))
          stack.push(entry.slice(0, -1));
      } else if (matcher.test(entry)) {
        out.push(entry);
      }
    }
  }
  return out.sort();
}

async function checkRobotsAndSitemap(robotsPaths, sitemapPaths) {
  const robots = await firstExisting(robotsPaths);
  if (robots === null) {
    check(
      "robots",
      "warn",
      "No robots file. Add " +
        robotsPaths[0] +
        " allowing crawl and linking the sitemap.",
    );
  } else if (robots.endsWith(".txt")) {
    const text = (await readOrNull(robots)) ?? "";
    if (/^\s*Disallow:\s*\/\s*$/m.test(text) && !/^\s*Allow:/m.test(text)) {
      check(
        "robots",
        "fail",
        robots +
          " disallows the whole site (Disallow: /). Remove it before launch.",
      );
    } else {
      check(
        "robots",
        "pass",
        "Robots file: " +
          robots +
          (/Sitemap:/i.test(text) ? "" : " (consider adding a Sitemap: line)"),
      );
    }
  } else {
    check("robots", "pass", "Robots file: " + robots);
  }
  const sitemap = await firstExisting(sitemapPaths);
  check(
    "sitemap",
    sitemap === null ? "warn" : "pass",
    sitemap === null
      ? "No sitemap. Add " + sitemapPaths[0] + " listing public routes."
      : "Sitemap: " + sitemap,
  );
}

async function main() {
  // --- detect framework ---------------------------------------------------------
  const rootEntries = await listOrEmpty(".");
  const hasNextConfig = rootEntries.some((e) =>
    /^next\.config\.(js|mjs|ts|cjs)$/.test(e),
  );
  const nextLayout = await firstExisting([
    "app/layout.tsx",
    "src/app/layout.tsx",
    "app/layout.jsx",
    "src/app/layout.jsx",
  ]);
  const framework = hasNextConfig || nextLayout !== null ? "nextjs" : "vite";
  let pagesWithoutTitle = [];
  let result;

  if (framework === "vite") {
    const html = await readOrNull("index.html");
    if (html === null) {
      result = { framework, error: "index.html not found at the app root." };
    } else {
      const htmlTag = /<html\b[^>]*>/i.exec(html);
      const lang = htmlTag ? attrsOf(htmlTag[0]).lang : undefined;
      check(
        "html_lang",
        lang ? "pass" : "fail",
        lang ? '<html lang="' + lang + '">' : "<html> has no lang attribute.",
      );

      const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
      const title = titleMatch ? titleMatch[1].trim() : "";
      if (title === "") check("title", "fail", "index.html has no <title>.");
      else if (DEFAULT_TITLES.includes(title.toLowerCase()))
        check(
          "title",
          "fail",
          'Default title "' +
            title +
            "\" is still set. Replace it with the site's name and topic.",
        );
      else lengthCheck("title", "Title", title, 30, 60);

      const metas = [];
      for (const m of html.matchAll(/<meta\b[^>]*>/gi))
        metas.push(attrsOf(m[0]));
      const links = [];
      for (const m of html.matchAll(/<link\b[^>]*>/gi))
        links.push(attrsOf(m[0]));
      const metaValue = (key) => {
        const found = metas.find((a) => a.name === key || a.property === key);
        return found ? (found.content ?? "") : null;
      };

      const description = metaValue("description");
      if (description === null || description.trim() === "")
        check("description", "fail", "No meta description.");
      else
        lengthCheck(
          "description",
          "Meta description",
          description.trim(),
          70,
          160,
        );

      const viewport = metaValue("viewport");
      check(
        "viewport",
        viewport && viewport.includes("width=device-width") ? "pass" : "fail",
        viewport
          ? "Viewport: " + viewport
          : "No viewport meta tag (width=device-width, initial-scale=1).",
      );
      check(
        "charset",
        metas.some((a) => a.charset !== undefined) ? "pass" : "warn",
        "charset meta " +
          (metas.some((a) => a.charset !== undefined)
            ? "present."
            : 'missing; add <meta charset="UTF-8" />.'),
      );

      const canonical = links.find((a) => a.rel === "canonical");
      if (!canonical) check("canonical", "warn", 'No <link rel="canonical">.');
      else if (!isAbsoluteUrl(canonical.href ?? ""))
        check(
          "canonical",
          "warn",
          "Canonical must be an absolute URL: " + canonical.href,
        );
      else if (SITE_URL !== "" && !canonical.href.startsWith(SITE_URL))
        check(
          "canonical",
          "warn",
          "Canonical " + canonical.href + " does not use " + SITE_URL,
        );
      else check("canonical", "pass", "Canonical: " + canonical.href);

      for (const key of ["og:title", "og:description", "og:type", "og:url"]) {
        const value = metaValue(key);
        check(
          key,
          value ? "pass" : "warn",
          value ? key + " set." : key + " missing.",
        );
      }
      const ogImage = metaValue("og:image");
      if (!ogImage)
        check(
          "og:image",
          "warn",
          "og:image missing; link previews will have no image (use 1200x630).",
        );
      else if (!isAbsoluteUrl(ogImage))
        check(
          "og:image",
          "warn",
          "og:image must be an absolute URL: " + ogImage,
        );
      else check("og:image", "pass", "og:image: " + ogImage);
      const twitter = metaValue("twitter:card");
      check(
        "twitter:card",
        twitter ? "pass" : "warn",
        twitter
          ? "twitter:card=" + twitter
          : "twitter:card missing (summary_large_image).",
      );

      const hasIconLink = links.some((a) =>
        /(^|\s)icon(\s|$)/.test(a.rel ?? ""),
      );
      const hasFaviconFile = await exists("public/favicon.ico");
      check(
        "favicon",
        hasIconLink || hasFaviconFile ? "pass" : "warn",
        hasIconLink || hasFaviconFile
          ? "Favicon present."
          : "No favicon link or public/favicon.ico.",
      );

      await checkRobotsAndSitemap(
        ["public/robots.txt"],
        ["public/sitemap.xml"],
      );

      const pages = await walkPages("src/pages", /\.(tsx|jsx)$/, 200);
      let jsonLd = /application\/ld\+json/.test(html);
      for (const page of pages) {
        const text = (await readOrNull(page)) ?? "";
        if (/application\/ld\+json|<JsonLd\b/.test(text)) jsonLd = true;
        if (/NotFound|404/.test(page)) continue;
        if (
          !/usePageMeta\(|document\.title|<title>|useDocumentTitle\(|<Helmet\b|useHead\(/.test(
            text,
          )
        ) {
          pagesWithoutTitle.push(page);
        }
      }
      if (pages.length > 1 && pagesWithoutTitle.length > 0) {
        check(
          "page_titles",
          "warn",
          pagesWithoutTitle.length +
            " of " +
            pages.length +
            " pages never set document.title; all routes share the index.html title.",
        );
      } else {
        check(
          "page_titles",
          "pass",
          "Pages set their own titles (or there is a single page).",
        );
      }
      check(
        "json_ld",
        jsonLd ? "pass" : "info",
        jsonLd
          ? "JSON-LD structured data found."
          : "No JSON-LD found; add Organization/LocalBusiness/Product data where it fits.",
      );
      result = { framework, file: "index.html" };
    }
  } else {
    const appDir =
      nextLayout !== null && nextLayout.startsWith("src/") ? "src/app" : "app";
    const layout =
      nextLayout !== null ? ((await readOrNull(nextLayout)) ?? "") : "";
    if (nextLayout === null)
      check(
        "layout",
        "fail",
        "No app/layout.tsx found (pages router apps: use next/head per page).",
      );
    const htmlTag = /<html\b[^>]*>/.exec(layout);
    check(
      "html_lang",
      htmlTag && /\blang=/.test(htmlTag[0]) ? "pass" : "fail",
      htmlTag && /\blang=/.test(htmlTag[0])
        ? "Root layout sets <html lang>."
        : "Root layout <html> has no lang.",
    );
    const hasMetadata =
      /export\s+const\s+metadata\b|export\s+(async\s+)?function\s+generateMetadata\b/.test(
        layout,
      );
    check(
      "metadata",
      hasMetadata ? "pass" : "fail",
      hasMetadata
        ? "Root layout exports metadata."
        : "Root layout exports no metadata; add export const metadata: Metadata.",
    );
    if (/create next app/i.test(layout))
      check("title", "fail", "Default 'Create Next App' title is still set.");
    else
      check(
        "title_template",
        /template\s*:/.test(layout) ? "pass" : "warn",
        /template\s*:/.test(layout)
          ? "Title template set."
          : 'Use title: { default, template: "%s - Brand" } so pages get consistent titles.',
      );
    check(
      "description",
      /description\s*:/.test(layout) ? "pass" : "warn",
      /description\s*:/.test(layout)
        ? "Default description set."
        : "No description in root metadata.",
    );
    check(
      "metadataBase",
      /metadataBase\s*:/.test(layout) ? "pass" : "warn",
      /metadataBase\s*:/.test(layout)
        ? "metadataBase set."
        : "metadataBase missing; OG image and canonical URLs will not be absolute.",
    );
    const ogImageFile = await firstExisting([
      appDir + "/opengraph-image.tsx",
      appDir + "/opengraph-image.jpg",
      appDir + "/opengraph-image.png",
    ]);
    check(
      "open_graph",
      /openGraph\s*:/.test(layout) || ogImageFile !== null ? "pass" : "warn",
      /openGraph\s*:/.test(layout) || ogImageFile !== null
        ? "Open Graph configured."
        : "No openGraph metadata or opengraph-image file.",
    );
    const icon = await firstExisting([
      appDir + "/icon.svg",
      appDir + "/icon.png",
      appDir + "/favicon.ico",
      "public/favicon.ico",
      "public/favicon.svg",
    ]);
    check(
      "favicon",
      icon !== null ? "pass" : "warn",
      icon !== null ? "Icon: " + icon : "No app/icon.* or favicon.",
    );
    await checkRobotsAndSitemap(
      [appDir + "/robots.ts", appDir + "/robots.txt", "public/robots.txt"],
      [appDir + "/sitemap.ts", appDir + "/sitemap.xml", "public/sitemap.xml"],
    );

    const pages = await walkPages(appDir, /\/page\.(tsx|jsx|ts|js)$/, 300);
    const clientMetadata = [];
    for (const page of pages) {
      const text = (await readOrNull(page)) ?? "";
      const exportsMetadata =
        /export\s+const\s+metadata\b|export\s+(async\s+)?function\s+generateMetadata\b/.test(
          text,
        );
      if (exportsMetadata && /^\s*["']use client["']/.test(text))
        clientMetadata.push(page);
      if (
        !exportsMetadata &&
        page !== appDir + "/page.tsx" &&
        page !== appDir + "/page.jsx"
      )
        pagesWithoutTitle.push(page);
    }
    if (clientMetadata.length > 0) {
      check(
        "client_metadata",
        "fail",
        "metadata exported from client components is ignored: " +
          clientMetadata.join(", "),
      );
    }
    check(
      "page_metadata",
      pagesWithoutTitle.length === 0 ? "pass" : "warn",
      pagesWithoutTitle.length === 0
        ? "Every route exports metadata."
        : pagesWithoutTitle.length +
            " route(s) inherit the root title; add metadata or generateMetadata.",
    );
    result = { framework, file: nextLayout };
  }

  if (result.error === undefined) {
    const summary = { pass: 0, info: 0, warn: 0, fail: 0 };
    for (const item of checks) summary[item.status] += 1;
    result.summary = summary;
    result.checks = checks;
    result.pagesWithoutTitle = pagesWithoutTitle.slice(0, 50);
  }
  return result;
}

// The sandbox returns the value of the last expression (awaited).
main();
