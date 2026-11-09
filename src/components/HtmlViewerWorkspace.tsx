import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  FileCode2,
  Upload,
  Smartphone,
  Monitor,
  Tablet,
  RotateCcw,
  Code,
  Eye,
  Columns,
  ArrowRight,
  Download,
  RotateCw,
  FileText,
  FolderArchive,
  FolderOpen,
  Maximize2,
  X
} from 'lucide-react';
import { SAMPLE_HTML_TEMPLATES, SampleHtmlTemplate } from '../data/sampleHtmlTemplates';
import { SourceLanguage } from '../utils/multiPlatformBuilder';
import {
  ImportedZipProject,
  parseZipArchive,
  bundleMultiFileHtmlProject
} from '../utils/zipParser';

interface HtmlViewerWorkspaceProps {
  sourceType: SourceLanguage;
  onChangeSourceType: (lang: SourceLanguage) => void;
  htmlFileName: string;
  htmlContent: string;
  importedZip: ImportedZipProject | null;
  onImportZip: (zipProject: ImportedZipProject | null) => void;
  onUpdateSource: (
    lang: SourceLanguage,
    fileName: string,
    content: string,
    suggestedAppName?: string
  ) => void;
  onSendToConverter: () => void;
}

type ViewportPreset = 'desktop' | 'phone' | 'tablet';
type ViewerLayoutMode = 'preview' | 'split' | 'source';

export const HtmlViewerWorkspace: React.FC<HtmlViewerWorkspaceProps> = ({
  htmlFileName,
  htmlContent,
  importedZip,
  onImportZip,
  onUpdateSource,
  onSendToConverter
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [isLandscape, setIsLandscape] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ViewerLayoutMode>('preview');
  const [iframeKey, setIframeKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [selectedZipFilePath, setSelectedZipFilePath] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Allow exiting full screen via Escape key
  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Active file shown in the source code editor when a ZIP is loaded
  const activeEditorFile = useMemo(() => {
    if (!importedZip) {
      return { path: htmlFileName, content: htmlContent };
    }
    const targetPath = selectedZipFilePath || importedZip.entryFilePath;
    const found = importedZip.files.find((f) => f.path === targetPath);
    if (found && found.isText && found.textContent !== undefined) {
      return { path: found.path, content: found.textContent };
    }
    return { path: importedZip.entryFilePath, content: importedZip.entryTextContent || htmlContent };
  }, [importedZip, selectedZipFilePath, htmlFileName, htmlContent]);

  // If a multi-file HTML ZIP is loaded, inline its relative CSS/JS/images/modules for live preview
  const renderedHtmlPreview = useMemo(() => {
    if (importedZip) {
      const entryFileObj = importedZip.files.find((f) => f.path === importedZip.entryFilePath);
      const entryHtml = entryFileObj?.textContent ?? importedZip.entryTextContent ?? htmlContent;
      return bundleMultiFileHtmlProject(importedZip, entryHtml);
    }
    return htmlContent;
  }, [htmlContent, importedZip]);

  const docMetrics = useMemo(() => {
    const byteSize = new Blob([activeEditorFile.content]).size;
    const lineCount = activeEditorFile.content
      ? activeEditorFile.content.split(/\r\n|\r|\n/).length
      : 0;
    const titleMatch = (importedZip ? importedZip.entryTextContent : htmlContent).match(
      /<title[^>]*>([^<]+)<\/title>/i
    );
    const detectedTitle = titleMatch
      ? titleMatch[1].trim()
      : importedZip
        ? importedZip.suggestedAppName
        : 'HTML5 Document';
    return {
      byteSize,
      formattedSize: byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`,
      lineCount,
      detectedTitle
    };
  }, [activeEditorFile.content, htmlContent, importedZip]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.zip')) {
      handleZipFileLoad(file);
    } else {
      readLocalHtmlFile(file);
    }
    e.target.value = '';
  };

  const handleZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleZipFileLoad(file);
    e.target.value = '';
  };

  const handleZipFileLoad = async (file: File) => {
    setZipError(null);
    try {
      const parsedZip = await parseZipArchive(file);
      onImportZip(parsedZip);
      setSelectedZipFilePath(parsedZip.entryFilePath);
      setLayoutMode('preview');
      setIframeKey((k) => k + 1);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to parse .zip file');
    }
  };

  const readLocalHtmlFile = (file: File) => {
    setZipError(null);
    setSelectedZipFilePath(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      const baseName = file.name
        .replace(/\.(html?|xhtml)$/i, '')
        .replace(/[-_]+/g, ' ');

      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const suggestedName = titleMatch ? titleMatch[1].trim() : baseName;
      onUpdateSource('html', file.name, content, suggestedName);
      setIframeKey((k) => k + 1);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.zip')) {
      handleZipFileLoad(file);
    } else {
      readLocalHtmlFile(file);
    }
  };

  const handleLoadHtmlTemplate = (tpl: SampleHtmlTemplate) => {
    setSelectedZipFilePath(null);
    onUpdateSource('html', tpl.fileName, tpl.htmlContent, tpl.suggestedAppName);
    setIframeKey((k) => k + 1);
  };

  const handleDownloadSource = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = htmlFileName || 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFrameDimensions = () => {
    if (viewport === 'desktop') {
      return { width: '100%', height: '640px' };
    }
    if (viewport === 'phone') {
      return isLandscape
        ? { width: '780px', height: '390px' }
        : { width: '390px', height: '740px' };
    }
    return isLandscape
      ? { width: '920px', height: '640px' }
      : { width: '680px', height: '840px' };
  };

  const frameDims = getFrameDimensions();

  return (
    <div className="space-y-6">
      {/* FULL SCREEN PREVIEW OVERLAY — Only Cross (X) Button Shown to Exit */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white w-screen h-screen overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFullScreen(false)}
            aria-label="Exit Full Screen Preview"
            title="Exit Full Screen Preview"
            className="fixed top-3 right-3 z-50 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <iframe
            key={`fs-${iframeKey}`}
            title="Full Screen HTML Runtime Preview"
            srcDoc={renderedHtmlPreview}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
            className="w-full h-full border-0 bg-white block"
          />
        </div>
      )}

      {/* Top File Picker & ZIP Importer Bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-white border rounded-xl p-6 transition-colors ${
          isDragging ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-emerald-700">
              Made by Shailesh Raj · HTML5 &amp; Multi-File .ZIP Sandbox
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              HTML5 Viewer &amp; Multi-File .ZIP Web Project Runner
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Load any local HTML document (<code className="font-mono text-xs">.html</code>,{' '}
              <code className="font-mono text-xs">.htm</code>,{' '}
              <code className="font-mono text-xs">.xhtml</code>) or import a complete{' '}
              <code className="font-mono text-xs">.zip</code> web archive containing folders,
              stylesheets, scripts, and images. Click <strong>Full Screen</strong> to view the
              preview across your entire screen with a single cross (<code className="font-mono text-xs">✕</code>) exit button.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.xhtml,.zip"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleZipInputChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Pick .html File
            </button>

            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderArchive className="w-4 h-4" />
              Import .ZIP Project
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(true)}
              disabled={!htmlContent.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
              Full Screen Preview
            </button>

            <button
              type="button"
              onClick={onSendToConverter}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Convert to APK / EXE / DEB
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {zipError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {zipError}
          </div>
        )}

        {/* Imported ZIP Project Explorer Banner */}
        {importedZip && (
          <div className="mt-5 p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">
                    Imported Project Archive:{' '}
                    <span className="font-mono text-amber-300">{importedZip.zipFileName}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                    {importedZip.files.length} files · {importedZip.folderCount} folder(s) ·{' '}
                    {(importedZip.totalUncompressedBytes / 1024).toFixed(1)} KB total · Entry:{' '}
                    <span className="text-emerald-300">{importedZip.entryFilePath}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onImportZip(null);
                  setSelectedZipFilePath(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear .ZIP Project
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto pt-1">
              {importedZip.files.map((zf) => {
                const isSelected = (selectedZipFilePath || importedZip.entryFilePath) === zf.path;
                const isHtmlFile = /\.(html?|xhtml)$/i.test(zf.path);
                return (
                  <button
                    key={zf.path}
                    type="button"
                    onClick={() => {
                      setSelectedZipFilePath(zf.path);
                      if (isHtmlFile && zf.isText && zf.textContent !== undefined) {
                        onImportZip({
                          ...importedZip,
                          entryFilePath: zf.path,
                          entryTextContent: zf.textContent
                        });
                        setLayoutMode('preview');
                        setIframeKey((k) => k + 1);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {zf.path} ({(zf.sizeBytes / 1024).toFixed(1)} KB)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sample Templates & Current File Metadata Bar */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
            <FileCode2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-900">
              {activeEditorFile.path || 'No file selected'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{docMetrics.detectedTitle}</span>
            <span aria-hidden="true">·</span>
            <span>{docMetrics.formattedSize}</span>
            <span aria-hidden="true">·</span>
            <span>{docMetrics.lineCount} lines</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Sample HTML5 projects:</span>
            {SAMPLE_HTML_TEMPLATES.map((tpl) => {
              const isActive = !importedZip && htmlFileName === tpl.fileName;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleLoadHtmlTemplate(tpl)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tpl.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Runtime Toolbar & Viewport Canvas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
          {/* Left: View Mode Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setLayoutMode('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                layoutMode === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Live HTML Execution
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                layoutMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split Code &amp; Output
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('source')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                layoutMode === 'source'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              HTML5 Source Editor
            </button>
          </div>

          {/* Center: Device Viewport Presets */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  viewport === 'desktop'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop (100%)
              </button>
              <button
                type="button"
                onClick={() => setViewport('phone')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  viewport === 'phone'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Android Phone (390×740)
              </button>
              <button
                type="button"
                onClick={() => setViewport('tablet')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  viewport === 'tablet'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                Tablet (680×840)
              </button>
            </div>

            {viewport !== 'desktop' && (
              <button
                type="button"
                onClick={() => setIsLandscape((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {isLandscape ? 'Landscape' : 'Portrait'}
              </button>
            )}
          </div>

          {/* Right: Runtime Controls + Full Screen Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(true)}
              disabled={!renderedHtmlPreview.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Full Screen
            </button>

            <button
              type="button"
              onClick={() => setIframeKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart HTML Runtime
            </button>

            <button
              type="button"
              onClick={handleDownloadSource}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Save .HTML
            </button>
          </div>
        </div>

        {/* Workspace Content */}
        {!renderedHtmlPreview.trim() ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                No HTML5 Document Loaded
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Select a local HTML file or .ZIP project archive from your device, or choose a sample template above.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`grid ${
              layoutMode === 'split'
                ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200'
                : 'grid-cols-1'
            }`}
          >
            {/* Source Editor Pane */}
            {(layoutMode === 'source' || layoutMode === 'split') && (
              <div className="flex flex-col h-[640px] bg-slate-950 text-slate-100">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>{activeEditorFile.path} · Live Source</span>
                  <span>UTF-8 · Editable</span>
                </div>
                <textarea
                  value={activeEditorFile.content}
                  onChange={(e) => {
                    const newText = e.target.value;
                    if (importedZip) {
                      const targetPath = selectedZipFilePath || importedZip.entryFilePath;
                      const encoded = new TextEncoder().encode(newText);
                      const updatedFiles = importedZip.files.map((f) =>
                        f.path === targetPath
                          ? { ...f, textContent: newText, bytes: encoded, sizeBytes: encoded.byteLength }
                          : f
                      );
                      onImportZip({
                        ...importedZip,
                        files: updatedFiles,
                        entryTextContent:
                          targetPath === importedZip.entryFilePath
                            ? newText
                            : importedZip.entryTextContent
                      });
                    } else {
                      onUpdateSource('html', htmlFileName, newText);
                    }
                  }}
                  spellCheck={false}
                  className="w-full flex-1 p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none resize-none"
                />
              </div>
            )}

            {/* Live Execution Pane */}
            {(layoutMode === 'preview' || layoutMode === 'split') && (
              <div className="bg-slate-100/80 p-6 flex items-center justify-center min-h-[640px] overflow-auto">
                <div
                  style={{
                    width: layoutMode === 'split' ? '100%' : frameDims.width,
                    height: frameDims.height
                  }}
                  className={`bg-white transition-all duration-150 overflow-hidden flex flex-col ${
                    viewport !== 'desktop' && layoutMode !== 'split'
                      ? 'border-[8px] border-slate-900 rounded-[28px] shadow-md'
                      : 'border border-slate-200 rounded-lg w-full'
                  }`}
                >
                  {viewport !== 'desktop' && layoutMode !== 'split' && (
                    <div className="h-7 bg-slate-900 text-white px-4 flex items-center justify-between text-[11px] font-mono select-none shrink-0">
                      <span>09:41</span>
                      <span className="truncate max-w-[180px] text-slate-300">
                        {docMetrics.detectedTitle}
                      </span>
                      <span>5G · 100%</span>
                    </div>
                  )}

                  <iframe
                    key={iframeKey}
                    title="Live HTML Runtime Sandbox"
                    srcDoc={renderedHtmlPreview}
                    sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
                    className="w-full flex-1 border-0 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
