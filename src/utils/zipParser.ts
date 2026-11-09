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
  'yaml', 'yml', 'toml', 'ini', 'glsl', 'frag', 'vert', 'obj', 'mtl'
]);

const DATA_TEXT_EXTENSIONS = new Set([
  'json', 'xml', 'csv', 'txt', 'md', 'yaml', 'yml', 'toml', 'ini',
  'glsl', 'frag', 'vert', 'obj', 'mtl'
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
  ${mainScript ? `<script type="module" src="${mainScript.path}"></script>` : ''}
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
 * Resolves relative CSS, JS, TypeScript/React (.tsx/.jsx/.ts), ES Modules, and Image/Media references
 * from an imported multi-file ZIP project so that the entry HTML document runs seamlessly inside
 * a sandboxed iframe and Android/Windows/Linux WebView without showing raw code or a white screen.
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
  const trimmedOverride = typeof htmlOverrideOrEntryPath === 'string' ? htmlOverrideOrEntryPath.trim() : '';
  const looksLikeGenuineHtml =
    trimmedOverride.length > 0 &&
    (/^(<!doctype\s+html|<html\b|<head\b|<body\b|<!--)/i.test(trimmedOverride) ||
      (/<(html|head|body|meta|title|link|style|script|div|main|canvas|section|header|footer)\b/i.test(
        trimmedOverride
      ) &&
        !/^\s*(import\s+|export\s+|const\s+|let\s+|var\s+|function\s+|class\s+|\/\/|\/\*)/m.test(
          trimmedOverride
        )));

  let html = looksLikeGenuineHtml
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

    // Ensure CSS never contains a literal </style> tag that could close <style> early
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
  // NOTE: Never include .html, .js, .ts, .tsx, or .css source files in assetTextMap!
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
    // Escape any literal </script so an inline <script> tag is never closed prematurely by JS strings
    return out.replace(/<\/script/gi, '<\\/script');
  };

  const entryScriptsToRun: string[] = [];
  const inlinedCssPaths = new Set<string>();

  // Use DOMParser when available in the browser so we only touch real HTML elements
  // and NEVER match <link>, <script>, </head>, or </body> strings inside JS code!
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

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

    // 3. Process <script src="..."> elements
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

      // Check if this script uses ES module imports/exports that reference other files in the ZIP
      const hasModuleSyntax =
        /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?["'][^"']+["']/.test(scriptFile.textContent) ||
        /\bimport\s*\(/.test(scriptFile.textContent) ||
        /\bexport\s+(?:default|const|let|var|function|class|\{|\*)/.test(scriptFile.textContent);

      if (isTsxOrJsx || (isModule && hasModuleSyntax)) {
        entryScriptsToRun.push(scriptFile.path);
        scriptEl.remove();
        continue;
      }

      const processedJs = replaceAssetPathsInJs(scriptFile.textContent);
      const inlineScript = doc.createElement('script');
      inlineScript.setAttribute('data-zip-script', scriptFile.path);

      if (isModule) {
        inlineScript.setAttribute('type', 'module');
        inlineScript.textContent = processedJs;
        scriptEl.replaceWith(inlineScript);
      } else if (isInHead && isDeferred) {
        // Deferred script in <head>: append to the end of <body> so it runs after DOM elements exist
        inlineScript.textContent = processedJs;
        scriptEl.remove();
        doc.body.appendChild(inlineScript);
      } else if (isInHead) {
        // Classic script in <head> without defer: run immediately (for libraries like jQuery/Three.js),
        // and if it fails because document.body is not ready yet, automatically re-run on DOMContentLoaded!
        inlineScript.textContent = `try {\n${processedJs}\n} catch (__zipHeadErr) {\n  if (!document.body) {\n    window.addEventListener('DOMContentLoaded', function() {\n${processedJs}\n    });\n  } else {\n    console.error(__zipHeadErr);\n  }\n}`;
        scriptEl.replaceWith(inlineScript);
      } else {
        // Classic script in <body>: inline directly in exact document order
        inlineScript.textContent = processedJs;
        scriptEl.replaceWith(inlineScript);
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

    // 6. Inject Virtual ZIP File System runtime into <head> using safeJsonForHtmlScript
    // (contains ZERO '<' or '>' characters inside the JSON literals!)
    const vfsEl = doc.createElement('script');
    vfsEl.id = 'webapk-zip-vfs';
    vfsEl.textContent = `(function() {
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

  window.__ZIP_LOOKUP_ASSET__ = lookupAsset;

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (url && !/^(https?:|data:|blob:|\\/\\/)/i.test(url)) {
        var found = lookupAsset(url);
        if (found) {
          if (found.type === 'dataUrl') {
            return origFetch(found.value, init);
          }
          return Promise.resolve(new Response(found.value, {
            status: 200,
            headers: { 'Content-Type': url.endsWith('.json') ? 'application/json' : 'text/plain' }
          }));
        }
      }
      return origFetch.apply(this, arguments);
    };
  }

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

    // 7. If the ZIP has ES module or TypeScript/React (.tsx/.ts/.jsx) entry scripts, append the live module runner
    if (entryScriptsToRun.length > 0) {
      const needsBabel = files.some((f) => /\.(tsx|ts|jsx)$/i.test(f.name));
      if (needsBabel) {
        const babelScript = doc.createElement('script');
        babelScript.setAttribute('src', 'https://unpkg.com/@babel/standalone/babel.min.js');
        doc.body.appendChild(babelScript);
      }

      const sourceModulesMap: Record<string, string> = {};
      for (const f of files) {
        if (/\.(tsx|ts|jsx|js|mjs|cjs|json|css)$/i.test(f.name)) {
          sourceModulesMap[f.path] = replaceAssetPathsInJs(f.textContent);
        }
      }

      const runnerEl = doc.createElement('script');
      runnerEl.setAttribute('type', 'module');
      runnerEl.textContent = `(async function() {
  const rawModules = ${safeJsonForHtmlScript(sourceModulesMap)};
  const entryPaths = ${safeJsonForHtmlScript(entryScriptsToRun)};
  const compiledBlobUrls = {};
  const compilingPromises = {};

  function resolveLocalPath(fromFile, importSpec) {
    let clean = importSpec.split('?')[0].split('#')[0];
    if (clean.startsWith('@/')) {
      clean = 'src/' + clean.slice(2);
    } else if (clean.startsWith('./') || clean.startsWith('../')) {
      const dirParts = fromFile.split('/');
      dirParts.pop();
      for (const seg of clean.split('/')) {
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

    const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
    for (const ext of exts) {
      const cand = clean + ext;
      const matchKey = Object.keys(rawModules).find(k => k.toLowerCase() === cand.toLowerCase());
      if (matchKey) return matchKey;
    }
    return null;
  }

  async function compileModule(filePath) {
    if (compiledBlobUrls[filePath]) return compiledBlobUrls[filePath];
    if (compilingPromises[filePath]) return compilingPromises[filePath];

    compilingPromises[filePath] = (async () => {
      let code = rawModules[filePath] || '';
      const lower = filePath.toLowerCase();

      if (lower.endsWith('.css')) {
        const js = 'export default "";';
        const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
        compiledBlobUrls[filePath] = url;
        return url;
      }

      if (lower.endsWith('.json')) {
        const js = 'export default ' + code + ';';
        const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
        compiledBlobUrls[filePath] = url;
        return url;
      }

      if ((lower.endsWith('.tsx') || lower.endsWith('.jsx')) && !/\\bimport\\s+React\\b/.test(code)) {
        code = 'import React from "react";\\n' + code;
      }

      if (window.Babel && /\\.(tsx|ts|jsx)$/i.test(lower)) {
        try {
          const res = window.Babel.transform(code, {
            filename: filePath,
            presets: [
              ['typescript', { isTSX: lower.endsWith('.tsx'), allExtensions: true }],
              ['react', { runtime: 'classic' }]
            ],
            sourceType: 'module'
          });
          if (res && res.code) code = res.code;
        } catch (err) {
          console.error('Babel transform error in ' + filePath + ':', err);
        }
      }

      const importRegex = /((?:import|export)\\s+(?:[\\w*{}\\s,]+\\s+from\\s+)?["'])([^"']+)(["'])/g;
      const matches = Array.from(code.matchAll(importRegex));

      for (const m of matches) {
        const full = m[0];
        const prefix = m[1];
        const spec = m[2];
        const suffix = m[3];

        if (/^(https?:|data:|blob:)/i.test(spec)) continue;

        if (/\\.css$/i.test(spec)) {
          code = code.replace(full, '/* css imported */');
          continue;
        }

        const localTarget = resolveLocalPath(filePath, spec);
        if (localTarget) {
          const targetUrl = await compileModule(localTarget);
          code = code.split(prefix + spec + suffix).join(prefix + targetUrl + suffix);
        } else {
          const esmUrl =
            spec === 'react' || spec === 'react-dom' || spec === 'react-dom/client'
              ? 'https://esm.sh/' + spec + '@19.0.0'
              : 'https://esm.sh/' + spec + '?deps=react@19.0.0,react-dom@19.0.0';
          code = code.split(prefix + spec + suffix).join(prefix + esmUrl + suffix);
        }
      }

      const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      compiledBlobUrls[filePath] = blobUrl;
      return blobUrl;
    })();

    return compilingPromises[filePath];
  }

  for (const entry of entryPaths) {
    try {
      const rootUrl = await compileModule(entry);
      await import(rootUrl);
    } catch (e) {
      console.error('Error executing ZIP module entry ' + entry + ':', e);
    }
  }
})();`;
      doc.body.appendChild(runnerEl);
    }

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  return html;
}
