// find_large_assets (read-only MustardScript).
// Lists oversized images, GIFs, videos and fonts (via file_stats) and scans
// source files for images without dimensions, eager below-the-fold images,
// heavy imports and non-lazy routes.
// ARGS: { dirs?: string[] = ["public", "src", "app"], imageKb?: number = 200,
//         videoKb?: number = 2048, fontKb?: number = 150,
//         maxFindings?: number = 120, maxFiles?: number = 1500 }

const DIRS =
  Array.isArray(ARGS.dirs) && ARGS.dirs.length > 0
    ? ARGS.dirs.filter((d) => typeof d === "string" && d !== "")
    : ["public", "src", "app"];
const IMAGE_KB = typeof ARGS.imageKb === "number" ? ARGS.imageKb : 200;
const VIDEO_KB = typeof ARGS.videoKb === "number" ? ARGS.videoKb : 2048;
const FONT_KB = typeof ARGS.fontKb === "number" ? ARGS.fontKb : 150;
const MAX_FINDINGS = Number.isInteger(ARGS.maxFindings)
  ? ARGS.maxFindings
  : 120;
const MAX_FILES = Number.isInteger(ARGS.maxFiles) ? ARGS.maxFiles : 1500;
const MAX_SOURCE_BYTES = 262144;
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
  "components/ui/",
];
const TYPES = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  tif: "image",
  tiff: "image",
  gif: "gif",
  svg: "svg",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  woff2: "font",
  woff: "font",
  ttf: "font",
  otf: "font",
  eot: "font",
};
const HEAVY_IMPORTS = [
  {
    re: /import\s+\*\s+as\s+\w+\s+from\s+["']lucide-react["']/g,
    message: "import * from lucide-react pulls every icon; use named imports.",
  },
  {
    re: /from\s+["']moment["']/g,
    message: "moment is large; use Intl.DateTimeFormat or date-fns.",
  },
  {
    re: /from\s+["']lodash["']/g,
    message: "Full lodash import; use native methods or lodash-es/<fn>.",
  },
  {
    re: /import\s+\*\s+as\s+\w+\s+from\s+["']react-icons\/\w+["']/g,
    message: "import * from react-icons; import only the icons you use.",
  },
  {
    re: /from\s+["']@mui\/icons-material["']/g,
    message: "Barrel import from @mui/icons-material; import icons by path.",
  },
];

function extOf(path) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

function kb(bytes) {
  return Math.round(bytes / 102.4) / 10;
}

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
  return SKIP_DIRS.some(
    (dir) => withSlash.startsWith(dir) || withSlash.includes("/" + dir),
  );
}

function startTag(text, start) {
  let depth = 0;
  let quote = "";
  const limit = Math.min(text.length, start + 3000);
  for (let i = start + 1; i < limit; i++) {
    const ch = text[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || (ch === "`" && depth > 0)) quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start, limit);
}

const findings = [];
let truncated = false;

function add(file, line, rule, severity, message, sizeKb) {
  if (findings.length >= MAX_FINDINGS) {
    truncated = true;
    return;
  }
  const finding = { file, rule, severity, message };
  if (line !== null) finding.line = line;
  if (sizeKb !== undefined) finding.sizeKb = sizeKb;
  findings.push(finding);
}

async function main() {
  // --- walk --------------------------------------------------------------------
  const assets = [];
  const sources = [];
  const scannedDirs = [];
  let visited = 0;
  for (const root of DIRS) {
    const stack = [root];
    let rootOk = false;
    while (stack.length > 0 && visited < MAX_FILES) {
      const dir = stack.pop();
      let entries;
      try {
        entries = await list_files(dir);
      } catch {
        continue;
      }
      if (dir === root) rootOk = true;
      for (const entry of entries) {
        if (isSkipped(entry)) continue;
        if (entry.endsWith("/")) {
          stack.push(entry.slice(0, -1));
          continue;
        }
        visited += 1;
        const ext = extOf(entry);
        if (TYPES[ext] !== undefined)
          assets.push({ path: entry, ext, type: TYPES[ext] });
        else if (
          (ext === "tsx" || ext === "jsx") &&
          !/\.(test|spec)\.[jt]sx$/.test(entry)
        )
          sources.push(entry);
      }
    }
    if (rootOk) scannedDirs.push(root);
  }

  // --- assets ------------------------------------------------------------------
  const totals = {};
  const sized = [];
  const assetPaths = new Set(assets.map((a) => a.path));
  for (const asset of assets) {
    let stats;
    try {
      stats = await file_stats(asset.path);
    } catch {
      continue;
    }
    const size = stats.size;
    sized.push({ path: asset.path, sizeKb: kb(size) });
    totals[asset.type] = totals[asset.type] ?? { count: 0, kb: 0 };
    totals[asset.type].count += 1;
    totals[asset.type].kb =
      Math.round((totals[asset.type].kb + size / 1024) * 10) / 10;
    const sizeKb = kb(size);

    if (asset.type === "image" && sizeKb > IMAGE_KB) {
      add(
        asset.path,
        null,
        "large-image",
        sizeKb > IMAGE_KB * 2 ? "error" : "warn",
        "Image is " +
          sizeKb +
          " KB (budget " +
          IMAGE_KB +
          " KB). Resize to ~2x its displayed width and use WebP/AVIF.",
        sizeKb,
      );
    } else if (asset.type === "gif" && sizeKb > 200) {
      add(
        asset.path,
        null,
        "large-gif",
        "error",
        "Animated GIF is " +
          sizeKb +
          " KB. Use a muted looping MP4/WebM video instead.",
        sizeKb,
      );
    } else if (asset.type === "video" && sizeKb > VIDEO_KB) {
      add(
        asset.path,
        null,
        "large-video",
        "warn",
        "Video is " +
          sizeKb +
          ' KB. Compress it, add a poster and use preload="none".',
        sizeKb,
      );
    } else if (asset.type === "svg" && sizeKb > 100) {
      add(
        asset.path,
        null,
        "large-svg",
        "warn",
        "SVG is " +
          sizeKb +
          " KB; it may embed a raster image. Optimize it or use WebP.",
        sizeKb,
      );
    } else if (asset.type === "font") {
      if (asset.ext === "ttf" || asset.ext === "otf" || asset.ext === "eot") {
        const base = asset.path.slice(0, asset.path.length - asset.ext.length);
        if (!assetPaths.has(base + "woff2")) {
          add(
            asset.path,
            null,
            "legacy-font",
            "warn",
            "Serve fonts as WOFF2 (30-50% smaller than " +
              asset.ext.toUpperCase() +
              ").",
            sizeKb,
          );
        }
      } else if (sizeKb > FONT_KB) {
        add(
          asset.path,
          null,
          "large-font",
          "warn",
          "Font file is " + sizeKb + " KB. Subset it or load fewer weights.",
          sizeKb,
        );
      }
    }
  }
  sized.sort((a, b) => b.sizeKb - a.sizeKb);

  // --- sources -----------------------------------------------------------------
  let scannedSources = 0;
  for (const file of sources) {
    let text;
    try {
      text = await read_file(file, { length: MAX_SOURCE_BYTES });
    } catch {
      continue;
    }
    scannedSources += 1;
    let imageIndex = 0;
    for (const m of text.matchAll(/<img\b/g)) {
      imageIndex += 1;
      const tag = startTag(text, m.index);
      if (/\{\s*\.\.\./.test(tag)) continue;
      const hasSize =
        (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) ||
        /aspect-|\b(h|size)-(\d|full|\[)|\binset-0\b|\bfill\b/.test(tag);
      if (!hasSize) {
        add(
          file,
          lineOf(text, m.index),
          "img-no-dimensions",
          "warn",
          "<img> without width/height or an aspect-* class causes layout shift (CLS).",
        );
      }
      if (
        imageIndex > 1 &&
        !/\bloading=/.test(tag) &&
        !/fetchPriority/i.test(tag)
      ) {
        add(
          file,
          lineOf(text, m.index),
          "lazy-candidate",
          "info",
          'Image after the first in this file has no loading attribute; add loading="lazy" if it is below the fold.',
        );
      }
    }
    for (const heavy of HEAVY_IMPORTS) {
      for (const m of text.matchAll(heavy.re)) {
        add(file, lineOf(text, m.index), "heavy-import", "warn", heavy.message);
      }
    }
    if (/(^|\/)App\.(tsx|jsx)$/.test(file)) {
      for (const m of text.matchAll(
        /^import\s+(\w+)\s+from\s+["'](\.\/pages\/|@\/pages\/)[^"']+["']/gm,
      )) {
        add(
          file,
          lineOf(text, m.index),
          "eager-route",
          "info",
          "Page " +
            m[1] +
            " is imported eagerly; use const " +
            m[1] +
            " = lazy(() => import(...)) so it gets its own chunk.",
        );
      }
    }
  }

  const bySeverity = { error: 0, warn: 0, info: 0 };
  const byRule = {};
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  }

  return {
    scannedDirs,
    assetCount: assets.length,
    scannedSources,
    fileLimitReached: visited >= MAX_FILES,
    budgetsKb: { image: IMAGE_KB, video: VIDEO_KB, font: FONT_KB },
    totals,
    largest: sized.slice(0, 10),
    summary: { bySeverity, byRule },
    truncated,
    findings,
  };
}

// The sandbox returns the value of the last expression (awaited).
main();
