import { SourceLanguage } from './multiPlatformBuilder';

export interface ProjectFileEntry {
  path: string;
  name: string;
  folder: string;
  sizeBytes: number;
  isText: boolean;
  textContent: string;
  binaryData: Uint8Array;
  bytes: Uint8Array;
  mimeType: string;
}

export interface ImportedZipProject {
  archiveName: string;
  zipFileName: string;
  suggestedAppName: string;
  totalFiles: number;
  folderCount: number;
  totalBytes: number;
  totalUncompressedBytes: number;
  detectedLanguage: SourceLanguage;
  entryFilePath: string;
  entryTextContent: string;
  files: ProjectFileEntry[];
}

const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'css', 'scss', 'less', 'js', 'mjs', 'cjs',
  'ts', 'tsx', 'jsx', 'json', 'xml', 'svg', 'md', 'txt', 'csv',
  'yaml', 'yml', 'toml', 'ini', 'glsl', 'frag', 'vert', 'obj', 'mtl', 'atlas'
]);

const DATA_TEXT_EXTENSIONS = new Set([
  'json', 'xml', 'csv', 'txt', 'md', 'yaml', 'yml', 'toml', 'ini',
  'glsl', 'frag', 'vert', 'obj', 'mtl', 'atlas'
]);

function getExtension(filePath: string): string {
  const clean = filePath.split('?')[0].split('#')[0];
  const parts = clean.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function guessMimeType(filePath: string): string {
  const ext = getExtension(filePath);
  switch (ext) {
    case 'html':
    case 'htm':
    case 'xhtml':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'application/javascript';
    case 'json':
      return 'application/json';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serializes any value to JSON with all '<', '>', '&', and line-separator characters
 * unicode-escaped so that embedding the JSON inside an HTML <script> tag can NEVER
 * prematurely close </script>, </head>, or </body>, or be matched by HTML tag regexes.
 */
export function safeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return compressed;
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const readPromise = new Response(ds.readable).arrayBuffer();

  const buf = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(buf).set(compressed);
  writer.write(new Uint8Array(buf)).catch(() => {});
  writer.close().catch(() => {});

  const outAb = await readPromise;
  return new Uint8Array(outAb);
}

/**
 * Parses a standard .ZIP archive buffer in the browser using Central Directory headers
 * and decompresses STORE (0) and DEFLATE (8) entries into a virtual file tree.
 */
export async function parseZipProjectArchive(
  file: File
): Promise<ImportedZipProject> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const view = new DataView(ab);
  const dec = new TextDecoder('utf-8', { fatal: false });

  // Locate End of Central Directory (EOCD) signature 0x06054b50 from the end
  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, bytes.byteLength - 65557);
  for (let i = bytes.byteLength - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file: End of Central Directory record not found.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  let ptr = centralDirOffset;
  const extractedFiles: ProjectFileEntry[] = [];

  for (let i = 0; i < totalEntries && ptr + 46 <= bytes.byteLength; i++) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x02014b50) break;

    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const rawPath = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    const slashPath = rawPath.replace(/\\/g, '/');

    // Skip directories, node_modules, .git, and macOS __MACOSX metadata files
    if (
      slashPath.endsWith('/') ||
      slashPath.includes('__MACOSX/') ||
      slashPath.includes('/node_modules/') ||
      slashPath.startsWith('node_modules/') ||
      slashPath.includes('/.git/') ||
      slashPath.split('/').pop()?.startsWith('._')
    ) {
      continue;
    }

    if (localHeaderOffset + 30 > bytes.byteLength) continue;
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let fileBytes: Uint8Array;
    if (compressionMethod === 0) {
      fileBytes = new Uint8Array(compressedSlice);
    } else if (compressionMethod === 8) {
      try {
        fileBytes = await inflateRawBytes(compressedSlice);
      } catch {
        fileBytes = new Uint8Array(compressedSlice);
      }
    } else {
      continue;
    }

    const normalizedPath = slashPath.replace(/^\/+/, '');
    const segments = normalizedPath.split('/');
    const fileName = segments[segments.length - 1] || normalizedPath;
    const folder = segments.length > 1 ? segments.slice(0, -1).join('/') : '/';
    const ext = getExtension(normalizedPath);
    const isText = TEXT_EXTENSIONS.has(ext);
    const textContent = isText ? dec.decode(fileBytes).replace(/^\uFEFF/, '') : '';

    extractedFiles.push({
      path: normalizedPath,
      name: fileName,
      folder,
      sizeBytes: uncompressedSize || fileBytes.byteLength,
      isText,
      textContent,
      binaryData: fileBytes,
      bytes: fileBytes,
      mimeType: guessMimeType(normalizedPath)
    });
  }

  // Strip common top-level wrapper folder if all files share one root directory
  if (extractedFiles.length > 1) {
    const firstParts = extractedFiles.map((f) => f.path.split('/')[0]);
    const commonRoot = firstParts[0];
    if (
      commonRoot &&
      extractedFiles.every((f) => f.path.startsWith(commonRoot + '/'))
    ) {
      for (const f of extractedFiles) {
        f.path = f.path.slice(commonRoot.length + 1);
        const segs = f.path.split('/');
        f.name = segs[segs.length - 1] || f.path;
        f.folder = segs.length > 1 ? segs.slice(0, -1).join('/') : '/';
      }
    }
  }

  const detectedLanguage: SourceLanguage = 'html';

  // Prefer built dist/index.html or build/index.html if root index.html is an unbuilt template,
  // otherwise pick root index.html or any .html file.
  const distHtml = extractedFiles.find(
    (f) =>
      f.path.toLowerCase() === 'dist/index.html' ||
      f.path.toLowerCase() === 'build/index.html' ||
      f.path.toLowerCase() === 'public/index.html'
  );
  const rootHtml = extractedFiles.find((f) => f.path.toLowerCase() === 'index.html');
  const anyIndexHtml = extractedFiles.find((f) => f.name.toLowerCase() === 'index.html');
  const anyHtml = extractedFiles.find((f) => /\.x?html?$/i.test(f.name));

  let chosenHtmlFile = rootHtml || distHtml || anyIndexHtml || anyHtml;
  if (
    rootHtml &&
    distHtml &&
    /<script[^>]+src=["'][^"']*\.(tsx|ts|jsx)["']/i.test(rootHtml.textContent)
  ) {
    chosenHtmlFile = distHtml;
  }

  // If the ZIP has no .html file at all, synthesize an index.html that loads the ZIP's CSS and JS/TSX files
  if (!chosenHtmlFile) {
    const cssLinks = extractedFiles
      .filter((f) => /\.css$/i.test(f.name))
      .map((f) => `<link rel="stylesheet" href="${f.path}" />`)
      .join('\n  ');
    const mainScript =
      extractedFiles.find((f) => /^(main|index|app)\.(tsx|jsx|ts|js)$/i.test(f.name)) ||
      extractedFiles.find((f) => /\.(tsx|jsx|ts|js)$/i.test(f.name));
    const synthHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZIP Web Application</title>
  ${cssLinks}
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
  ${mainScript ? `<script src="${mainScript.path}"></script>` : ''}
</body>
</html>`;
    const enc = new TextEncoder();
    const synthBytes = enc.encode(synthHtml);
    chosenHtmlFile = {
      path: 'index.html',
      name: 'index.html',
      folder: '/',
      sizeBytes: synthBytes.byteLength,
      isText: true,
      textContent: synthHtml,
      binaryData: synthBytes,
      bytes: synthBytes,
      mimeType: 'text/html'
    };
    extractedFiles.unshift(chosenHtmlFile);
  }

  const entryFilePath = chosenHtmlFile.path;
  const entryTextContent = chosenHtmlFile.textContent;

  const uniqueFolders = new Set(
    extractedFiles.map((f) => f.folder).filter((fld) => fld && fld !== '/')
  );

  const baseTitle = file.name
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const totalBytes = extractedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  return {
    archiveName: file.name,
    zipFileName: file.name,
    suggestedAppName: baseTitle || 'ZIP Project App',
    totalFiles: extractedFiles.length,
    folderCount: uniqueFolders.size,
    totalBytes,
    totalUncompressedBytes: totalBytes,
    detectedLanguage,
    entryFilePath,
    entryTextContent,
    files: extractedFiles
  };
}

export const parseZipArchive = parseZipProjectArchive;

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)));
  }
  return btoa(chunks.join(''));
}

function normalizePath(p: string, baseDir = ''): string {
  let clean = p.replace(/\\/g, '/').split('?')[0].split('#')[0].trim();
  if (clean.startsWith('@/')) {
    clean = 'src/' + clean.slice(2);
  } else if (clean.startsWith('./') || clean.startsWith('../')) {
    const baseParts = baseDir && baseDir !== '/' ? baseDir.split('/').filter(Boolean) : [];
    const relParts = clean.split('/');
    for (const part of relParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    clean = baseParts.join('/');
  } else {
    clean = clean.replace(/^\/+/, '');
  }
  return clean;
}

/**
 * Converts ES Module syntax (import / export / dynamic import / import.meta) into
 * synchronous CommonJS (__zipRequire / exports / module.exports) so that multi-file
 * JS modules in a .ZIP archive can run inside a standard classic <script> on file://
 * and Android WebView without any CORS or blob: module errors.
 */
function transformEsmToCommonJs(rawCode: string): string {
  let code = rawCode;

  // Replace import.meta.env and import.meta.url so they never throw SyntaxError inside a classic <script>
  code = code.replace(
    /\bimport\.meta\.env\b/g,
    '({ MODE: "production", DEV: false, PROD: true, BASE_URL: "./" })'
  );
  code = code.replace(/\bimport\.meta\.url\b/g, 'window.location.href');
  code = code.replace(/\bimport\.meta\b/g, '({ url: window.location.href, env: { MODE: "production", DEV: false, PROD: true, BASE_URL: "./" } })');

  // Replace dynamic import(...) with __zipDynamicImport(...)
  code = code.replace(/\bimport\s*\(/g, '__zipDynamicImport(');

  // 1. Side-effect only imports: import "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, spec) => `${pre}__zipRequire(${JSON.stringify(spec)});`
  );

  // 2. Namespace imports: import * as ns from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, ns, spec) => `${pre}const ${ns} = __zipRequire(${JSON.stringify(spec)});`
  );

  // 3. Default + Named imports: import Def, { a, b as c } from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s*from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, defName, namedList, spec) => {
      const normalizedNamed = namedList.replace(/\bas\b/g, ':');
      return `${pre}const __imp_${defName} = __zipRequire(${JSON.stringify(spec)}); const ${defName} = __imp_${defName} && __imp_${defName}.__esModule ? __imp_${defName}.default : __imp_${defName}; const { ${normalizedNamed} } = __imp_${defName} || {};`;
    }
  );

  // 4. Default + Namespace imports: import Def, * as ns from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+([A-Za-z_$][\w$]*)\s*,\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, defName, ns, spec) =>
      `${pre}const ${ns} = __zipRequire(${JSON.stringify(spec)}); const ${defName} = ${ns} && ${ns}.__esModule ? ${ns}.default : ${ns};`
  );

  // 5. Named imports: import { a, b as c } from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+\{([^}]*)\}\s*from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, namedList, spec) => {
      // Strip TypeScript `type` keyword inside named imports: import { type Foo, Bar }
      const cleanedItems = namedList
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s && !/^type\s+/i.test(s))
        .map((s: string) => s.replace(/\bas\b/g, ':'))
        .join(', ');
      if (!cleanedItems) return `${pre}`;
      return `${pre}const { ${cleanedItems} } = __zipRequire(${JSON.stringify(spec)}) || {};`;
    }
  );

  // 6. Default imports: import Def from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, defName, spec) => {
      if (defName === 'type') return `${pre}`;
      return `${pre}const __imp_${defName} = __zipRequire(${JSON.stringify(spec)}); const ${defName} = __imp_${defName} && __imp_${defName}.__esModule ? __imp_${defName}.default : __imp_${defName};`;
    }
  );

  // 7. Re-exports: export * from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*export\s+\*\s+from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, spec) => `${pre}Object.assign(exports, __zipRequire(${JSON.stringify(spec)}));`
  );

  // 8. Named re-exports: export { a, b as c } from "foo";
  code = code.replace(
    /(^|[\r\n;])\s*export\s+\{([^}]*)\}\s*from\s+["']([^"']+)["']\s*;?/g,
    (_m, pre, list, spec) => {
      const pairs = list
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((item: string) => {
          const parts = item.split(/\s+as\s+/);
          const orig = parts[0].trim();
          const alias = (parts[1] || orig).trim();
          return `exports.${alias} = __reexp.${orig};`;
        })
        .join(' ');
      return `${pre}{ const __reexp = __zipRequire(${JSON.stringify(spec)}) || {}; ${pairs} }`;
    }
  );

  // 9. Local export list: export { a, b as c };
  code = code.replace(
    /(^|[\r\n;])\s*export\s+\{([^}]*)\}\s*;?/g,
    (_m, pre, list) => {
      const assigns = list
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s && !/^type\s+/i.test(s))
        .map((item: string) => {
          const parts = item.split(/\s+as\s+/);
          const orig = parts[0].trim();
          const alias = (parts[1] || orig).trim();
          return `exports.${alias} = ${orig};`;
        })
        .join(' ');
      return `${pre}${assigns}`;
    }
  );

  // 10. export default function / class / expression
  code = code.replace(
    /(^|[\r\n;])\s*export\s+default\s+/g,
    (_m, pre) => `${pre}exports.default = `
  );

  // 11. export const / let / var
  code = code.replace(
    /(^|[\r\n;])\s*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    (_m, pre, kw, id) => `${pre}${kw} ${id} = exports.${id}`
  );

  // 12. export async function / export function / export class
  code = code.replace(
    /(^|[\r\n;])\s*export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    (_m, pre, asyncKw, id) => `${pre}exports.${id} = ${asyncKw || ''}function ${id}`
  );
  code = code.replace(
    /(^|[\r\n;])\s*export\s+class\s+([A-Za-z_$][\w$]*)/g,
    (_m, pre, id) => `${pre}exports.${id} = class ${id}`
  );

  return `Object.defineProperty(exports, "__esModule", { value: true });\n${code}`;
}

/**
 * Resolves relative CSS, JS, TypeScript/React (.tsx/.jsx/.ts), ES Modules, and Image/Media references
 * from an imported multi-file ZIP project so that the entry HTML document runs 100% locally (file://,
 * Android WebView file:///android_asset/www/index.html, Windows .exe, Linux .deb, and sandboxed iframes).
 */
export function bundleMultiFileHtmlProject(
  projectOrFiles: ImportedZipProject | ProjectFileEntry[],
  htmlOverrideOrEntryPath?: string
): string {
  // Prevent double-bundling if already bundled
  if (
    typeof htmlOverrideOrEntryPath === 'string' &&
    htmlOverrideOrEntryPath.includes('id="webapk-zip-vfs"')
  ) {
    return htmlOverrideOrEntryPath;
  }

  const files = Array.isArray(projectOrFiles)
    ? projectOrFiles
    : projectOrFiles.files;
  const entryPath = Array.isArray(projectOrFiles)
    ? 'index.html'
    : projectOrFiles.entryFilePath || 'index.html';

  const entryFile =
    files.find((f) => f.path === entryPath) ||
    files.find((f) => f.path.toLowerCase() === 'index.html') ||
    files.find((f) => f.name.toLowerCase() === 'index.html') ||
    files.find((f) => /\.x?html?$/i.test(f.name)) ||
    files[0];

  const entryDir = entryFile?.folder && entryFile.folder !== '/' ? entryFile.folder : '';

  // Only accept htmlOverrideOrEntryPath if it is an authentic HTML document (not JS/TSX/CSS source)
  const trimmedOverride =
    typeof htmlOverrideOrEntryPath === 'string' ? htmlOverrideOrEntryPath.trim() : '';
  const looksLikeGenuineHtml =
    trimmedOverride.length > 0 &&
    (/^(<!doctype\s+html|<html\b|<head\b|<body\b|<!--)/i.test(trimmedOverride) ||
      (/<(html|head|body|meta|title|link|style|script|div|main|canvas|section|header|footer)\b/i.test(
        trimmedOverride
      ) &&
        !/^\s*(import\s+|export\s+|const\s+|let\s+|var\s+|function\s+|class\s+|\/\/|\/\*)/m.test(
          trimmedOverride
        )));

  const html = looksLikeGenuineHtml
    ? htmlOverrideOrEntryPath!
    : entryFile?.textContent || '';

  if (!html) {
    return '<!DOCTYPE html><html><body><p>No HTML entry file found in ZIP archive.</p></body></html>';
  }

  const findByRelPath = (rel: string, fromDir = entryDir): ProjectFileEntry | undefined => {
    const resolvedFromBase = normalizePath(rel, fromDir);
    const resolvedFromRoot = normalizePath(rel, '');
    const baseName = resolvedFromRoot.split('/').pop() || '';

    const candidates = [
      resolvedFromBase,
      resolvedFromRoot,
      `src/${resolvedFromRoot}`,
      `public/${resolvedFromRoot}`,
      `dist/${resolvedFromRoot}`
    ];

    const extensionsToTry = [
      '',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '/index.tsx',
      '/index.ts',
      '/index.jsx',
      '/index.js'
    ];

    for (const cand of candidates) {
      if (!cand) continue;
      for (const ext of extensionsToTry) {
        const target = (cand + ext).toLowerCase();
        const exact = files.find((f) => f.path.toLowerCase() === target);
        if (exact) return exact;
      }
    }

    return (
      files.find((f) => f.path.toLowerCase().endsWith('/' + resolvedFromRoot.toLowerCase())) ||
      (baseName
        ? files.find((f) => f.name.toLowerCase() === baseName.toLowerCase())
        : undefined)
    );
  };

  // Helper to inline url(...) and @import references inside a CSS string
  const resolveCssUrls = (cssText: string, cssFolder: string, visited = new Set<string>()): string => {
    let processed = cssText.replace(/@import\s+["']tailwindcss["']\s*;?/gi, '');

    processed = processed.replace(
      /@import\s+(?:url\()?["']([^"']+\.css)["']\)?\s*;?/gi,
      (full, href) => {
        if (/^(https?:|data:|\/\/)/i.test(href)) return full;
        const importedCss = findByRelPath(href, cssFolder);
        if (importedCss && importedCss.textContent && !visited.has(importedCss.path)) {
          visited.add(importedCss.path);
          return resolveCssUrls(importedCss.textContent, importedCss.folder, visited);
        }
        return '';
      }
    );

    processed = processed.replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (full, _quote, assetUrl) => {
        if (/^(https?:|data:|blob:|\/\/|#)/i.test(assetUrl.trim())) return full;
        const assetFile = findByRelPath(assetUrl.trim(), cssFolder);
        if (assetFile) {
          const b64 = uint8ToBase64(assetFile.binaryData);
          return `url("data:${assetFile.mimeType};base64,${b64}")`;
        }
        return full;
      }
    );

    return processed.replace(/<\/style/gi, '<\\/style');
  };

  // Detect if any CSS or HTML file uses Tailwind CSS directives
  const usesTailwind = files.some(
    (f) =>
      f.isText &&
      (/@import\s+["']tailwindcss["']/i.test(f.textContent) ||
        /@tailwind\s+(base|components|utilities)/i.test(f.textContent))
  );

  // Build Virtual Asset Map for binary media (images, audio, video, fonts, SVGs) and data files (.json, .txt, .csv, .xml)
  const assetDataUrlMap: Record<string, string> = {};
  const assetTextMap: Record<string, string> = {};

  for (const f of files) {
    const key = f.path.replace(/^\/+/, '');
    const ext = getExtension(f.name);
    if (DATA_TEXT_EXTENSIONS.has(ext) && f.isText) {
      assetTextMap[key] = f.textContent;
      assetTextMap[f.name] = f.textContent;
    } else if (!TEXT_EXTENSIONS.has(ext) || ext === 'svg') {
      const dataUrl = `data:${f.mimeType};base64,${uint8ToBase64(f.binaryData)}`;
      assetDataUrlMap[key] = dataUrl;
      assetDataUrlMap[f.name] = dataUrl;
    }
  }

  // Helper to replace asset path strings inside a JS bundle
  const replaceAssetPathsInJs = (jsCode: string): string => {
    let out = jsCode;
    for (const [assetPath, dataUrl] of Object.entries(assetDataUrlMap)) {
      if (assetPath.length > 2 && out.includes(assetPath)) {
        out = out.split(`"/${assetPath}"`).join(`"${dataUrl}"`);
        out = out.split(`'/${assetPath}'`).join(`'${dataUrl}'`);
        out = out.split(`"./${assetPath}"`).join(`"${dataUrl}"`);
        out = out.split(`'./${assetPath}'`).join(`'${dataUrl}'`);
        out = out.split(`"${assetPath}"`).join(`"${dataUrl}"`);
        out = out.split(`'${assetPath}'`).join(`'${dataUrl}'`);
      }
    }
    return out.replace(/<\/script/gi, '<\\/script');
  };

  const entryScriptsToRun: string[] = [];
  const inlinedCssPaths = new Set<string>();

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove any <base> tag or <link rel="modulepreload"> that breaks local file:// resolution
    doc.querySelectorAll('base, link[rel="modulepreload"]').forEach((el) => el.remove());

    // 1. Replace <link rel="stylesheet" href="..."> with <style> elements
    const links = Array.from(doc.querySelectorAll('link[href]'));
    for (const linkEl of links) {
      const href = linkEl.getAttribute('href') || '';
      if (!href || /^(https?:|data:|blob:|\/\/)/i.test(href)) continue;

      const rel = (linkEl.getAttribute('rel') || '').toLowerCase();
      const isStylesheet = rel.includes('stylesheet') || /\.css(\?.*)?$/i.test(href);
      if (isStylesheet) {
        const cssFile = findByRelPath(href, entryDir);
        if (cssFile && cssFile.textContent !== undefined) {
          inlinedCssPaths.add(cssFile.path);
          const styleEl = doc.createElement('style');
          styleEl.setAttribute('data-zip-css', cssFile.path);
          styleEl.textContent = resolveCssUrls(cssFile.textContent, cssFile.folder);
          linkEl.replaceWith(styleEl);
        }
      } else if (rel.includes('icon')) {
        const iconFile = findByRelPath(href, entryDir);
        if (iconFile) {
          const b64 = uint8ToBase64(iconFile.binaryData);
          linkEl.setAttribute('href', `data:${iconFile.mimeType};base64,${b64}`);
        }
      } else if (rel.includes('manifest')) {
        // Remove webmanifest link on file:// to avoid CORS errors in local browsers
        linkEl.remove();
      }
    }

    // 2. Resolve static <img src="...">, <audio src="...">, <video src="...">, <source src="...">
    const mediaEls = Array.from(
      doc.querySelectorAll('img[src], audio[src], video[src], source[src], embed[src]')
    );
    for (const el of mediaEls) {
      const src = el.getAttribute('src') || '';
      if (!src || /^(https?:|data:|blob:|\/\/)/i.test(src)) continue;
      const assetFile = findByRelPath(src, entryDir);
      if (assetFile) {
        const b64 = uint8ToBase64(assetFile.binaryData);
        el.setAttribute('src', `data:${assetFile.mimeType};base64,${b64}`);
      }
    }

    // 3. Process <script src="..."> elements so they run 100% locally (without file:// CORS errors)
    const scriptEls = Array.from(doc.querySelectorAll('script[src]'));
    for (const scriptEl of scriptEls) {
      const src = scriptEl.getAttribute('src') || '';
      if (!src || /^(https?:|data:|blob:|\/\/)/i.test(src)) continue;

      const scriptFile = findByRelPath(src, entryDir);
      if (!scriptFile || scriptFile.textContent === undefined) continue;

      const typeAttr = (scriptEl.getAttribute('type') || '').toLowerCase();
      const isModule = typeAttr === 'module';
      const isDeferred = scriptEl.hasAttribute('defer');
      const isInHead = Boolean(scriptEl.closest('head'));
      const isTsxOrJsx = /\.(tsx|ts|jsx)$/i.test(scriptFile.name);

      // Check if this script imports other files from the ZIP or uses ES module syntax
      const hasStaticImportOrExport =
        /(^|[\r\n;])\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?["'][^"']+["']/.test(
          scriptFile.textContent
        ) ||
        /(^|[\r\n;])\s*export\s+(?:default|const|let|var|function|class|\{|\*)/.test(
          scriptFile.textContent
        );

      if (isTsxOrJsx || hasStaticImportOrExport) {
        entryScriptsToRun.push(scriptFile.path);
        scriptEl.remove();
        continue;
      }

      // Single self-contained JS script (including single-bundle Vite/Rollup scripts that had type="module"):
      // Run as a standard classic <script> (NO type="module" so it never triggers file:// CORS blocks!)
      let processedJs = replaceAssetPathsInJs(scriptFile.textContent);
      // Replace any import.meta references inside Vite bundles so they work in classic <script>
      processedJs = processedJs
        .replace(
          /\bimport\.meta\.env\b/g,
          '({ MODE: "production", DEV: false, PROD: true, BASE_URL: "./" })'
        )
        .replace(/\bimport\.meta\.url\b/g, 'window.location.href')
        .replace(
          /\bimport\.meta\b/g,
          '({ url: window.location.href, env: { MODE: "production", DEV: false, PROD: true, BASE_URL: "./" } })'
        );

      const inlineScript = doc.createElement('script');
      inlineScript.setAttribute('data-zip-script', scriptFile.path);

      if (isModule || (isInHead && isDeferred)) {
        // Place deferred / module bundles at the end of <body> as a classic <script> IIFE
        // so <body> (<div id="root">, etc.) is already mounted AND it runs locally on file://!
        inlineScript.textContent = `(function(){\n${processedJs}\n})();`;
        scriptEl.remove();
        doc.body.appendChild(inlineScript);
      } else if (isInHead) {
        // Classic script in <head> without defer: run immediately (for libraries like jQuery/Three.js/GSAP),
        // and if it fails because document.body is null, automatically re-run on DOMContentLoaded!
        inlineScript.textContent = `try {\n${processedJs}\n} catch (__zipHeadErr) {\n  if (!document.body) {\n    window.addEventListener('DOMContentLoaded', function() {\n${processedJs}\n    });\n  } else {\n    console.error(__zipHeadErr);\n  }\n}`;
        scriptEl.replaceWith(inlineScript);
      } else {
        inlineScript.textContent = processedJs;
        scriptEl.replaceWith(inlineScript);
      }
    }

    // Also convert any inline <script type="module"> in index.html into a local-safe classic <script>
    const inlineModuleScripts = Array.from(doc.querySelectorAll('script[type="module"]:not([src])'));
    for (const modEl of inlineModuleScripts) {
      const rawInlineCode = modEl.textContent || '';
      const hasImports = /(^|[\r\n;])\s*import\s+/.test(rawInlineCode);
      if (hasImports) {
        const virtualInlinePath = '__inline_module_' + entryScriptsToRun.length + '.js';
        files.push({
          path: virtualInlinePath,
          name: virtualInlinePath,
          folder: entryDir || '/',
          sizeBytes: rawInlineCode.length,
          isText: true,
          textContent: rawInlineCode,
          binaryData: new Uint8Array(0),
          bytes: new Uint8Array(0),
          mimeType: 'application/javascript'
        });
        entryScriptsToRun.push(virtualInlinePath);
        modEl.remove();
      } else {
        const classicEl = doc.createElement('script');
        classicEl.textContent = `(function(){\n${replaceAssetPathsInJs(rawInlineCode)}\n})();`;
        modEl.replaceWith(classicEl);
      }
    }

    // 4. If no CSS was linked in HTML (or if compiling a module/React tree), inject unlinked CSS files
    if (inlinedCssPaths.size === 0 || entryScriptsToRun.length > 0) {
      const allCssFiles = files.filter((f) => /\.css$/i.test(f.name));
      for (const cssFile of allCssFiles) {
        if (!inlinedCssPaths.has(cssFile.path)) {
          const styleEl = doc.createElement('style');
          styleEl.setAttribute('data-zip-css', cssFile.path);
          styleEl.textContent = resolveCssUrls(cssFile.textContent, cssFile.folder);
          doc.head.appendChild(styleEl);
        }
      }
    }

    // 5. Inject Tailwind CDN if @import "tailwindcss" or @tailwind directives were detected
    if (usesTailwind && !doc.querySelector('script[src*="tailwindcss"]')) {
      const twEl = doc.createElement('script');
      twEl.setAttribute('src', 'https://cdn.tailwindcss.com');
      doc.head.appendChild(twEl);
    }

    // 6. Inject 100% Local-First Virtual ZIP File System & file:// Compatibility Shims into <head>
    const vfsEl = doc.createElement('script');
    vfsEl.id = 'webapk-zip-vfs';
    vfsEl.textContent = `(function() {
  // A. Local file:// Web Storage (localStorage / sessionStorage) fallback shim
  function ensureStorage(propName) {
    try {
      var st = window[propName];
      var testKey = '__webapk_storage_test__';
      st.setItem(testKey, '1');
      st.removeItem(testKey);
    } catch (e) {
      var mem = {};
      var fakeStorage = {
        getItem: function(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function(k, v) { mem[String(k)] = String(v); },
        removeItem: function(k) { delete mem[String(k)]; },
        clear: function() { mem = {}; },
        key: function(i) { return Object.keys(mem)[i] || null; },
        get length() { return Object.keys(mem).length; }
      };
      try {
        Object.defineProperty(window, propName, { value: fakeStorage, configurable: true });
      } catch (_err) {}
    }
  }
  ensureStorage('localStorage');
  ensureStorage('sessionStorage');

  // B. Local file:// History API (pushState / replaceState) & ServiceWorker safety shim
  try {
    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    history.pushState = function(state, title, url) {
      try {
        return origPushState.apply(history, arguments);
      } catch (_e) {
        if (url && typeof url === 'string' && !url.startsWith('#')) {
          try { window.location.hash = url; } catch (__e) {}
        }
      }
    };
    history.replaceState = function(state, title, url) {
      try {
        return origReplaceState.apply(history, arguments);
      } catch (_e) {
        if (url && typeof url === 'string' && !url.startsWith('#')) {
          try { window.location.hash = url; } catch (__e) {}
        }
      }
    };
  } catch (_hErr) {}

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.register) {
      var origSwReg = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = function() {
        if (location.protocol === 'file:' || location.protocol === 'about:' || location.protocol === 'data:') {
          return Promise.resolve({ scope: './', update: function(){}, unregister: function(){ return Promise.resolve(true); } });
        }
        return origSwReg.apply(navigator.serviceWorker, arguments).catch(function() {
          return { scope: './', update: function(){}, unregister: function(){ return Promise.resolve(true); } };
        });
      };
    }
  } catch (_swErr) {}

  // C. Virtual ZIP Asset & Data File Map (100% in-memory, zero network or file:// CORS needed)
  var assetDataUrls = ${safeJsonForHtmlScript(assetDataUrlMap)};
  var assetTexts = ${safeJsonForHtmlScript(assetTextMap)};

  function lookupAsset(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    var clean = rawUrl.split('?')[0].split('#')[0].replace(/^(\\.?\\/+)+/, '');
    if (assetDataUrls[clean]) return { type: 'dataUrl', value: assetDataUrls[clean] };
    if (assetTexts[clean] !== undefined) return { type: 'text', value: assetTexts[clean] };
    var base = clean.split('/').pop();
    if (base && assetDataUrls[base]) return { type: 'dataUrl', value: assetDataUrls[base] };
    if (base && assetTexts[base] !== undefined) return { type: 'text', value: assetTexts[base] };
    return null;
  }

  function dataUrlToBytes(dataUrl) {
    var parts = dataUrl.split(',');
    var mimeMatch = (parts[0] || '').match(/data:([^;]+)/);
    var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    var bstr = atob(parts[1] || '');
    var n = bstr.length;
    var u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    return { bytes: u8, mime: mime };
  }

  window.__ZIP_LOOKUP_ASSET__ = lookupAsset;

  // D. 100% Local window.fetch Interceptor (never calls network fetch for ZIP assets)
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (url && !/^(https?:|data:|blob:|\\/\\/)/i.test(url)) {
        var found = lookupAsset(url);
        if (found) {
          if (found.type === 'dataUrl') {
            var decoded = dataUrlToBytes(found.value);
            return Promise.resolve(new Response(decoded.bytes.buffer, {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': decoded.mime }
            }));
          }
          return Promise.resolve(new Response(found.value, {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': url.endsWith('.json') ? 'application/json' : 'text/plain' }
          }));
        }
      }
      return origFetch.apply(this, arguments);
    };
  }

  // E. 100% Local XMLHttpRequest Interceptor (for games, Phaser, PixiJS, Three.js, JSON loaders on file://)
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__zipLocalUrl = typeof url === 'string' ? url : '';
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      var url = xhr.__zipLocalUrl;
      if (url && !/^(https?:|data:|blob:|\\/\\/)/i.test(url)) {
        var found = lookupAsset(url);
        if (found) {
          setTimeout(function() {
            try {
              var rType = xhr.responseType || '';
              var respVal = null;
              var respText = '';

              if (found.type === 'text') {
                respText = found.value;
                if (rType === 'json') {
                  try { respVal = JSON.parse(found.value); } catch (_e) { respVal = null; }
                } else if (rType === 'arraybuffer') {
                  respVal = new TextEncoder().encode(found.value).buffer;
                } else if (rType === 'blob') {
                  respVal = new Blob([found.value], { type: 'text/plain' });
                } else {
                  respVal = found.value;
                }
              } else {
                var dec = dataUrlToBytes(found.value);
                if (rType === 'arraybuffer') {
                  respVal = dec.bytes.buffer;
                } else if (rType === 'blob') {
                  respVal = new Blob([dec.bytes.buffer], { type: dec.mime });
                } else {
                  respVal = found.value;
                  respText = found.value;
                }
              }

              Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
              Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
              Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
              Object.defineProperty(xhr, 'response', { value: respVal, configurable: true });
              if (!rType || rType === 'text') {
                Object.defineProperty(xhr, 'responseText', { value: respText, configurable: true });
              }

              if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
              xhr.dispatchEvent(new Event('readystatechange'));
              if (typeof xhr.onload === 'function') xhr.onload(new ProgressEvent('load'));
              xhr.dispatchEvent(new ProgressEvent('load'));
              if (typeof xhr.onloadend === 'function') xhr.onloadend(new ProgressEvent('loadend'));
              xhr.dispatchEvent(new ProgressEvent('loadend'));
            } catch (_xhrErr) {}
          }, 0);
          return;
        }
      }
      return origSend.apply(this, arguments);
    };
  }

  // F. Intercept dynamic Image().src, Audio().src, Video().src, and DOM elements
  function patchMediaSrcSetter(Proto) {
    if (!Proto) return;
    var desc = Object.getOwnPropertyDescriptor(Proto, 'src');
    if (desc && desc.set && desc.configurable) {
      Object.defineProperty(Proto, 'src', {
        get: desc.get,
        set: function(val) {
          if (typeof val === 'string' && !/^(https?:|data:|blob:|\\/\\/)/i.test(val)) {
            var found = lookupAsset(val);
            if (found && found.type === 'dataUrl') {
              return desc.set.call(this, found.value);
            }
          }
          return desc.set.call(this, val);
        },
        configurable: true,
        enumerable: desc.enumerable
      });
    }
  }
  try {
    patchMediaSrcSetter(window.HTMLImageElement && HTMLImageElement.prototype);
    patchMediaSrcSetter(window.HTMLMediaElement && HTMLMediaElement.prototype);
    patchMediaSrcSetter(window.HTMLSourceElement && HTMLSourceElement.prototype);
  } catch (_pErr) {}

  function resolveElementMedia(el) {
    if (!el || !el.getAttribute) return;
    var src = el.getAttribute('src');
    if (src && !/^(https?:|data:|blob:|\\/\\/)/i.test(src)) {
      var found = lookupAsset(src);
      if (found && found.type === 'dataUrl') {
        el.setAttribute('src', found.value);
      }
    }
  }

  var obs = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node && node.nodeType === 1) {
          resolveElementMedia(node);
          if (node.querySelectorAll) {
            var mediaEls = node.querySelectorAll('img[src],audio[src],video[src],source[src]');
            for (var k = 0; k < mediaEls.length; k++) resolveElementMedia(mediaEls[k]);
          }
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();`;
    doc.head.insertBefore(vfsEl, doc.head.firstChild);

    // 7. If the ZIP has multi-file ES modules or TypeScript/React (.tsx/.ts/.jsx),
    // compile JS modules into a synchronous CommonJS bundle that runs inside a standard <script>
    // (ZERO type="module" and ZERO blob: imports so it works 100% locally on file://!)
    if (entryScriptsToRun.length > 0) {
      const hasTsxOrTs = files.some((f) => /\.(tsx|ts|jsx)$/i.test(f.name));

      if (!hasTsxOrTs) {
        // Pure multi-file JS/MJS/JSON/CSS ES Modules -> Pre-compile into synchronous CommonJS at bundle time!
        // Runs 100% offline and locally on file:// with zero external dependencies!
        const cjsModulesMap: Record<string, string> = {};
        for (const f of files) {
          const lower = f.name.toLowerCase();
          if (/\.(js|mjs|cjs)$/.test(lower)) {
            cjsModulesMap[f.path] = transformEsmToCommonJs(replaceAssetPathsInJs(f.textContent));
          } else if (lower.endsWith('.json')) {
            cjsModulesMap[f.path] = `module.exports = ${f.textContent || '{}'};`;
          } else if (lower.endsWith('.css')) {
            cjsModulesMap[f.path] = `module.exports = "";`;
          }
        }

        const localBundleEl = doc.createElement('script');
        localBundleEl.id = 'webapk-local-cjs-bundle';
        localBundleEl.textContent = `(function() {
  var rawModules = ${safeJsonForHtmlScript(cjsModulesMap)};
  var entryPaths = ${safeJsonForHtmlScript(entryScriptsToRun)};
  var moduleCache = {};

  function resolveModuleKey(fromFile, spec) {
    var clean = String(spec || '').split('?')[0].split('#')[0];
    if (clean.startsWith('@/')) {
      clean = 'src/' + clean.slice(2);
    } else if (clean.startsWith('./') || clean.startsWith('../')) {
      var dirParts = fromFile.split('/');
      dirParts.pop();
      var segs = clean.split('/');
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (!s || s === '.') continue;
        if (s === '..') dirParts.pop();
        else dirParts.push(s);
      }
      clean = dirParts.join('/');
    } else if (clean.startsWith('/')) {
      clean = clean.replace(/^\\/+/, '');
    }

    var exts = ['', '.js', '.mjs', '.cjs', '.json', '.css', '/index.js', '/index.mjs'];
    var keys = Object.keys(rawModules);
    for (var e = 0; e < exts.length; e++) {
      var cand = (clean + exts[e]).toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === cand) return keys[k];
      }
    }
    var base = clean.split('/').pop().toLowerCase();
    for (var j = 0; j < keys.length; j++) {
      if (keys[j].split('/').pop().toLowerCase() === base) return keys[j];
    }
    return null;
  }

  function execModule(modPath) {
    if (moduleCache[modPath]) return moduleCache[modPath].exports;
    var mod = { exports: {} };
    moduleCache[modPath] = mod;
    var code = rawModules[modPath] || '';

    var localRequire = function(spec) {
      var resolved = resolveModuleKey(modPath, spec);
      if (resolved) return execModule(resolved);
      if (window[spec]) return window[spec];
      return {};
    };

    var localDynamicImport = function(spec) {
      return Promise.resolve(localRequire(spec));
    };

    try {
      var fn = new Function('module', 'exports', '__zipRequire', '__zipDynamicImport', code);
      fn(mod, mod.exports, localRequire, localDynamicImport);
    } catch (err) {
      console.error('Error in local module ' + modPath + ':', err);
    }
    return mod.exports;
  }

  function startEntries() {
    for (var i = 0; i < entryPaths.length; i++) {
      var key = resolveModuleKey('', entryPaths[i]) || entryPaths[i];
      if (rawModules[key] !== undefined) {
        execModule(key);
      }
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startEntries);
  } else {
    startEntries();
  }
})();`;
        doc.body.appendChild(localBundleEl);
      } else {
        // Unbuilt TypeScript/JSX (.tsx/.ts/.jsx) source archive -> compile via Babel Standalone into CommonJS
        // (Zero blob: module imports so it works on file:// as well!)
        const babelScript = doc.createElement('script');
        babelScript.setAttribute('src', 'https://unpkg.com/@babel/standalone/babel.min.js');
        doc.body.appendChild(babelScript);

        const sourceModulesMap: Record<string, string> = {};
        for (const f of files) {
          if (/\.(tsx|ts|jsx|js|mjs|cjs|json|css)$/i.test(f.name)) {
            sourceModulesMap[f.path] = replaceAssetPathsInJs(f.textContent);
          }
        }

        const runnerEl = doc.createElement('script');
        runnerEl.textContent = `(function() {
  var rawModules = ${safeJsonForHtmlScript(sourceModulesMap)};
  var entryPaths = ${safeJsonForHtmlScript(entryScriptsToRun)};
  var moduleCache = {};

  function resolveLocalPath(fromFile, importSpec) {
    var clean = String(importSpec || '').split('?')[0].split('#')[0];
    if (clean.startsWith('@/')) {
      clean = 'src/' + clean.slice(2);
    } else if (clean.startsWith('./') || clean.startsWith('../')) {
      var dirParts = fromFile.split('/');
      dirParts.pop();
      var segs = clean.split('/');
      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if (!seg || seg === '.') continue;
        if (seg === '..') dirParts.pop();
        else dirParts.push(seg);
      }
      clean = dirParts.join('/');
    } else if (clean.startsWith('/')) {
      clean = clean.replace(/^\\/+/, '');
    } else {
      return null;
    }

    var exts = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
    var keys = Object.keys(rawModules);
    for (var e = 0; e < exts.length; e++) {
      var cand = (clean + exts[e]).toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === cand) return keys[k];
      }
    }
    return null;
  }

  function requireModule(fromFile, spec) {
    if (/\\.css$/i.test(spec)) return {};
    var localKey = fromFile ? resolveLocalPath(fromFile, spec) : (resolveLocalPath('', spec) || spec);
    if (!localKey || rawModules[localKey] === undefined) {
      if (spec === 'react' && window.React) return window.React;
      if ((spec === 'react-dom' || spec === 'react-dom/client') && window.ReactDOM) return window.ReactDOM;
      return window[spec] || {};
    }
    if (moduleCache[localKey]) return moduleCache[localKey].exports;

    var mod = { exports: {} };
    moduleCache[localKey] = mod;
    var code = rawModules[localKey] || '';
    var lower = localKey.toLowerCase();

    if (lower.endsWith('.json')) {
      try { mod.exports = JSON.parse(code); } catch (_e) {}
      return mod.exports;
    }
    if (lower.endsWith('.css')) {
      return mod.exports;
    }

    if ((lower.endsWith('.tsx') || lower.endsWith('.jsx')) && !/\\bimport\\s+React\\b/.test(code)) {
      code = 'import React from "react";\\n' + code;
    }

    if (window.Babel) {
      try {
        var res = window.Babel.transform(code, {
          filename: localKey,
          presets: [
            ['env', { modules: 'commonjs' }],
            ['typescript', { isTSX: lower.endsWith('.tsx'), allExtensions: true }],
            ['react', { runtime: 'classic' }]
          ]
        });
        if (res && res.code) code = res.code;
      } catch (err) {
        console.error('Babel compile error in ' + localKey + ':', err);
      }
    }

    var childRequire = function(childSpec) {
      return requireModule(localKey, childSpec);
    };

    try {
      var fn = new Function('module', 'exports', 'require', code);
      fn(mod, mod.exports, childRequire);
    } catch (execErr) {
      console.error('Execution error in ' + localKey + ':', execErr);
    }
    return mod.exports;
  }

  function bootTsxEntries() {
    for (var i = 0; i < entryPaths.length; i++) {
      requireModule('', entryPaths[i]);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootTsxEntries);
  } else {
    bootTsxEntries();
  }
})();`;
        doc.body.appendChild(runnerEl);
      }
    }

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  return html;
}
