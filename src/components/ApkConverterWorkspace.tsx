import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Download,
  PackageCheck,
  Smartphone,
  FileCode2,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Play,
  FileArchive,
  RefreshCw,
  Trash2,
  Eye,
  Monitor,
  Terminal,
  Layers,
  FolderArchive,
  FolderOpen,
  Maximize2,
  X,
  Bell,
  Menu,
  Plus,
  SlidersHorizontal
} from 'lucide-react';
import {
  ApkExtrasConfig,
  buildApkPackage,
  buildPackagedHtmlAsset,
  generateAndroidManifestXml,
  renderLauncherIconPng
} from '../utils/apkBuilder';
import {
  UnifiedPackageConfig,
  UnifiedBuildResult,
  TargetFormat,
  buildWindowsExePackage,
  buildDebianDebPackage,
  getAndroidSupportSummary
} from '../utils/multiPlatformBuilder';
import { SAMPLE_HTML_TEMPLATES } from '../data/sampleHtmlTemplates';
import {
  ANDROID_VERSIONS,
  WINDOWS_VERSIONS
} from '../data/platformVersions';
import { parseZipArchive, bundleMultiFileHtmlProject } from '../utils/zipParser';

interface ApkConverterWorkspaceProps {
  config: UnifiedPackageConfig;
  onChangeConfig: React.Dispatch<React.SetStateAction<UnifiedPackageConfig>>;
  latestBuilds: UnifiedBuildResult[];
  onBuildComplete: (results: UnifiedBuildResult[]) => void;
  onOpenInViewer: () => void;
}

type SimulatorTab = 'launcher' | 'runtime' | 'manifest';

const ICON_BG_PRESETS = [
  '#0F172A',
  '#059669',
  '#2563EB',
  '#D97706',
  '#DC2626',
  '#4F46E5',
  '#0D9488'
];

const EXTRAS_CHECKBOX_ITEMS: { key: keyof ApkExtrasConfig; label: string }[] = [
  { key: 'supportZoom', label: 'Support Zoom' },
  { key: 'zoomButtons', label: 'Zoom Buttons' },
  { key: 'sideScrollBars', label: 'Side ScrollBars' },
  { key: 'textSelection', label: 'Text Selection' },
  { key: 'saveFormData', label: 'Save Form Data' },
  { key: 'fullscreen', label: 'Full Screen' },
  { key: 'javascriptApis', label: 'JavaScript APIs' },
  { key: 'httpsOnlyContent', label: 'HTTPs Only Content' },
  { key: 'allowExternalUrls', label: 'Allow External URLs' },
  { key: 'confirmOnExit', label: 'Confirm on Exit' },
  { key: 'enableGpsPrompt', label: 'Enable GPS Prompt' },
  { key: 'disallowScreenshot', label: 'Disallow Screenshot' },
  { key: 'allowFileAccess', label: 'Allow File Access' },
  { key: 'allowCrossOrigin', label: 'Allow Cross-Origin (For Local Files)' },
  { key: 'showToolbar', label: 'Show Toolbar (Title)' },
  { key: 'liveToolbarTitle', label: 'Live Toolbar Title' },
  { key: 'homeButton', label: 'Home Button' },
  { key: 'pullToRefresh', label: 'Pull to Refresh' },
  { key: 'deepLinking', label: 'Deep-linking' },
  { key: 'popupBlocker', label: 'Pop-up Blocker' }
];

export const ApkConverterWorkspace: React.FC<ApkConverterWorkspaceProps> = ({
  config,
  onChangeConfig,
  latestBuilds,
  onBuildComplete,
  onOpenInViewer
}) => {
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [targetFormat, setTargetFormat] = useState<TargetFormat>('apk');
  const [renderedIconPreview, setRenderedIconPreview] = useState<string>('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStageText, setBuildStageText] = useState<string>('');
  const [buildProgress, setBuildProgress] = useState<number>(0);
  const [simulatorTab, setSimulatorTab] = useState<SimulatorTab>('launcher');
  const [packageAutoSync, setPackageAutoSync] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [showPushConfigModal, setShowPushConfigModal] = useState(false);
  const [showNavDrawerConfigModal, setShowNavDrawerConfigModal] = useState(false);
  const [newNavItemLabel, setNewNavItemLabel] = useState('');
  const [newNavItemAction, setNewNavItemAction] = useState('top');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);

  // Allow exiting full screen preview with Escape key
  useEffect(() => {
    if (!isFullScreenPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreenPreview(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenPreview]);

  // Rasterize live icon preview whenever logo settings change (debounced for low-end devices)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      renderLauncherIconPng(
        {
          iconDataUrl: config.iconDataUrl,
          iconShape: config.iconShape,
          iconBgColor: config.iconBgColor,
          iconLabel: config.iconLabel,
          appName: config.appName
        },
        144
      ).then((res) => {
        if (active) setRenderedIconPreview(res.dataUrl);
      });
    }, 100);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [config.iconDataUrl, config.iconShape, config.iconBgColor, config.iconLabel, config.appName]);

  const handleSourceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.zip')) {
      handleZipArchiveUpload(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      const baseTitle = file.name
        .replace(/\.(html?|xhtml)$/i, '')
        .replace(/[-_]+/g, ' ');
      const cleanPkgSlug =
        baseTitle
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20) || 'customapp';

      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const detectedAppName = titleMatch ? titleMatch[1].trim() : baseTitle;

      onChangeConfig((prev) => ({
        ...prev,
        importedZip: null,
        zipProjectFiles: undefined,
        sourceType: 'html',
        appName: detectedAppName,
        packageName: packageAutoSync ? `com.shailesh.${cleanPkgSlug}` : prev.packageName,
        htmlFileName: file.name,
        htmlContent: content
      }));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleZipInputSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleZipArchiveUpload(file);
    e.target.value = '';
  };

  const handleZipArchiveUpload = async (file: File) => {
    setZipError(null);
    try {
      const parsedZip = await parseZipArchive(file);
      const cleanSlug =
        parsedZip.suggestedAppName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20) || 'zipapp';

      onChangeConfig((prev) => ({
        ...prev,
        importedZip: parsedZip,
        sourceType: 'html',
        appName: parsedZip.suggestedAppName,
        packageName: `com.shailesh.${cleanSlug}`,
        htmlFileName: parsedZip.entryFilePath,
        htmlContent: parsedZip.entryTextContent,
        zipProjectFiles: parsedZip.files.map((f) => ({ path: f.path, data: f.bytes }))
      }));
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to extract .zip project');
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = typeof ev.target?.result === 'string' ? ev.target.result : null;
      onChangeConfig((prev) => ({
        ...prev,
        iconDataUrl: dataUrl
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAppNameChange = (newName: string) => {
    const cleanSlug =
      newName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 22) || 'app';

    onChangeConfig((prev) => ({
      ...prev,
      appName: newName,
      packageName: packageAutoSync ? `com.shailesh.${cleanSlug}` : prev.packageName
    }));
  };

  const buildSingleFormat = async (fmt: TargetFormat): Promise<UnifiedBuildResult> => {
    const zipEntryHtml = config.importedZip
      ? config.importedZip.files.find((f) => f.path === config.importedZip?.entryFilePath)?.textContent ??
        config.importedZip.entryTextContent ??
        config.htmlContent
      : config.htmlContent;

    const resolvedHtml = config.importedZip
      ? bundleMultiFileHtmlProject(config.importedZip, zipEntryHtml)
      : config.htmlContent;

    if (fmt === 'apk') {
      const apkRes = await buildApkPackage(
        {
          ...config,
          sourceType: 'html',
          htmlContent: resolvedHtml,
          zipProjectFiles: config.importedZip
            ? config.importedZip.files.map((f) => ({ path: f.path, data: f.bytes }))
            : undefined
        },
        (stage, pct) => {
          setBuildStageText(stage);
          setBuildProgress(pct);
        },
        resolvedHtml
      );

      return {
        id: `apk-${Date.now()}`,
        format: 'apk',
        sourceType: 'html',
        blob: apkRes.apkBlob,
        companionBlob: apkRes.sourceZipBlob,
        fileName: apkRes.fileName,
        companionFileName: apkRes.sourceZipFileName,
        totalBytes: apkRes.totalBytes,
        sha256Hex: apkRes.sha256Hex,
        builtAtIso: apkRes.builtAtIso,
        targetOsSummary: getAndroidSupportSummary(
          config.minSdkVersion,
          config.targetSdkVersion,
          config.playProtectFriendly
        ),
        packageName: config.packageName,
        appName: config.appName,
        versionName: config.versionName,
        generatedIconUrl: apkRes.generatedIconUrl,
        entries: apkRes.entries,
        installInstructions: [
          `Play Protect Verified APK (Target API 34 · Signed by O=Shailesh Raj Studio).`,
          `Transfer ${apkRes.fileName} to your Android device and tap to install seamlessly.`
        ]
      };
    }

    if (fmt === 'exe') {
      return buildWindowsExePackage(
        { ...config, sourceType: 'html', htmlContent: resolvedHtml },
        (stage, pct) => {
          setBuildStageText(stage);
          setBuildProgress(pct);
        }
      );
    }

    return buildDebianDebPackage(
      { ...config, sourceType: 'html', htmlContent: resolvedHtml },
      (stage, pct) => {
        setBuildStageText(stage);
        setBuildProgress(pct);
      }
    );
  };

  const handleTriggerBuild = async (formatsToBuild: TargetFormat[]) => {
    if (!config.htmlContent.trim() && !config.importedZip) return;

    setIsBuilding(true);
    setBuildProgress(5);
    setBuildStageText('Initializing packaging pipeline...');

    try {
      const builtResults: UnifiedBuildResult[] = [];
      for (const fmt of formatsToBuild) {
        await new Promise((r) => setTimeout(r, 120));
        const res = await buildSingleFormat(fmt);
        builtResults.push(res);
      }
      onBuildComplete(builtResults);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDownloadBuild = (item: UnifiedBuildResult, useCompanion = false) => {
    const blob = useCompanion && item.companionBlob ? item.companionBlob : item.blob;
    const name =
      useCompanion && item.companionFileName ? item.companionFileName : item.fileName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sourceByteSize = config.importedZip
    ? config.importedZip.totalUncompressedBytes
    : new Blob([config.htmlContent]).size;

  const bundledPreviewHtml = useMemo(() => {
    if (config.importedZip) {
      const entryFileObj = config.importedZip.files.find(
        (f) => f.path === config.importedZip?.entryFilePath
      );
      const entryHtml =
        entryFileObj?.textContent ?? config.importedZip.entryTextContent ?? config.htmlContent;
      return bundleMultiFileHtmlProject(config.importedZip, entryHtml);
    }
    return config.htmlContent;
  }, [config.importedZip, config.htmlContent]);

  const runtimePreviewHtml = useMemo(
    () => buildPackagedHtmlAsset(config, bundledPreviewHtml),
    [config, bundledPreviewHtml]
  );

  const manifestXmlPreview = useMemo(
    () => generateAndroidManifestXml(config),
    [config]
  );

  const currentBuild =
    latestBuilds.find((b) => b.format === targetFormat) || latestBuilds[0] || null;

  return (
    <div className="space-y-6">
      {/* FULL SCREEN PREVIEW OVERLAY — Only Cross (X) Button Shown to Exit */}
      {isFullScreenPreview && (
        <div className="fixed inset-0 z-50 bg-white w-screen h-screen overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFullScreenPreview(false)}
            aria-label="Exit Full Screen Preview"
            title="Exit Full Screen Preview"
            className="fixed top-3 right-3 z-50 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <iframe
            title="Full Screen Application Runtime Preview"
            srcDoc={runtimePreviewHtml}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
            className="w-full h-full border-0 bg-white block"
          />
        </div>
      )}

      {/* Top Studio Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-emerald-700">
            Made by Shailesh Raj · HTML5 &amp; .ZIP Compiler (HTML5 · Multi-File .ZIP → APK · EXE · DEB)
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            HTML5 &amp; .ZIP to APK, EXE &amp; DEB Packager
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Package local HTML5 documents (<code className="font-mono text-xs">.html</code>,{' '}
            <code className="font-mono text-xs">.htm</code>,{' '}
            <code className="font-mono text-xs">.xhtml</code>) or complete multi-folder{' '}
            <code className="font-mono text-xs">.zip</code> web projects into Google Play Protect
            Friendly Android <code className="font-mono text-xs">.apk</code>, Windows 10/11{' '}
            <code className="font-mono text-xs">.exe</code>, or Linux{' '}
            <code className="font-mono text-xs">.deb</code> packages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenInViewer}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4" />
            Test in Sandbox
          </button>

          <button
            type="button"
            onClick={() => handleTriggerBuild([targetFormat])}
            disabled={isBuilding || (!config.htmlContent.trim() && !config.importedZip)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isBuilding ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Building ({buildProgress}%)
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                Build .{targetFormat.toUpperCase()} Package
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTriggerBuild(['apk', 'exe', 'deb'])}
            disabled={isBuilding || (!config.htmlContent.trim() && !config.importedZip)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Compile APK, Windows EXE, and Linux DEB simultaneously"
          >
            <Layers className="w-4 h-4" />
            Build All 3 (APK + EXE + DEB)
          </button>
        </div>
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Configuration Steps (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Local HTML5 Document or Multi-File .ZIP Project */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  01. Select Local HTML5 Document or Import Multi-File .ZIP Project
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick a single .html file or import a full .ZIP archive containing HTML, CSS, JS, and assets
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md shrink-0">
                HTML5 + .ZIP Bundler
              </span>
            </div>

            {/* Active Source File Card & Dual File/ZIP Pickers */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  {config.importedZip ? (
                    <FolderArchive className="w-5 h-5 text-amber-600" />
                  ) : (
                    <FileCode2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 font-mono">
                    {config.importedZip
                      ? `${config.importedZip.zipFileName} (${config.importedZip.files.length} files)`
                      : config.htmlFileName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {(sourceByteSize / 1024).toFixed(2)} KB · HTML5 Web Document
                    {config.importedZip
                      ? ` · Entry: ${config.importedZip.entryFilePath}`
                      : ''}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  ref={sourceFileInputRef}
                  type="file"
                  accept=".html,.htm,.xhtml,.zip"
                  onChange={handleSourceFileSelect}
                  className="hidden"
                />
                <input
                  ref={zipFileInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={handleZipInputSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => sourceFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Pick .html File
                </button>

                <button
                  type="button"
                  onClick={() => zipFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  Import .ZIP Project
                </button>
              </div>
            </div>

            {zipError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {zipError}
              </div>
            )}

            {/* Imported Multi-File ZIP Summary */}
            {config.importedZip && (
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Bundling {config.importedZip.files.length} files &amp;{' '}
                      {config.importedZip.folderCount} folder(s) from{' '}
                      <span className="font-mono text-amber-300">{config.importedZip.zipFileName}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        importedZip: null,
                        zipProjectFiles: undefined
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Remove .ZIP
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto text-[11px] font-mono">
                  {config.importedZip.files.map((f) => {
                    const isEntry = f.path === config.importedZip?.entryFilePath;
                    const isHtml = /\.(html?|xhtml)$/i.test(f.path);
                    return (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => {
                          if (isHtml && f.isText && f.textContent !== undefined && config.importedZip) {
                            onChangeConfig((prev) => ({
                              ...prev,
                              htmlFileName: f.path,
                              htmlContent: f.textContent || prev.htmlContent,
                              importedZip: prev.importedZip
                                ? {
                                    ...prev.importedZip,
                                    entryFilePath: f.path,
                                    entryTextContent: f.textContent || prev.importedZip.entryTextContent
                                  }
                                : null
                            }));
                          }
                        }}
                        className={`px-2 py-0.5 rounded border transition-colors ${
                          isEntry
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                            : isHtml
                              ? 'bg-slate-800 text-amber-200 border-slate-700 hover:bg-slate-700 cursor-pointer'
                              : 'bg-slate-800 text-slate-200 border-slate-700'
                        }`}
                      >
                        {f.path}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Template Selector */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-slate-500 mr-1">
                Load sample HTML5 project:
              </span>
              {SAMPLE_HTML_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      importedZip: null,
                      zipProjectFiles: undefined,
                      sourceType: 'html',
                      htmlFileName: tpl.fileName,
                      htmlContent: tpl.htmlContent,
                      appName: tpl.suggestedAppName,
                      packageName: tpl.suggestedPackageId,
                      description: tpl.description,
                      themeColor: tpl.themeColor
                    }))
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                    !config.importedZip && config.htmlFileName === tpl.fileName
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Target Export Platform & Google Play Protect Safe Mode */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                02. Target Platform, OS Support &amp; Google Play Protect Safe Mode
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure Google Play Store / Play Protect compliance, Android SDK compatibility, or
                Windows 10/11 Portable vs. Installer EXE
              </p>
            </div>

            {/* 3 Target Platform Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'apk' as const,
                  title: 'Android Package (.APK)',
                  sub: 'Play Protect Safe · API 21–36',
                  icon: Smartphone
                },
                {
                  id: 'exe' as const,
                  title: 'Windows Executable (.EXE)',
                  sub: 'Win 10 & Win 11 · Portable / Setup',
                  icon: Monitor
                },
                {
                  id: 'deb' as const,
                  title: 'Linux Package (.DEB)',
                  sub: 'Ubuntu · Debian · Mint',
                  icon: Terminal
                }
              ].map((item) => {
                const Icon = item.icon;
                const active = targetFormat === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetFormat(item.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span
                        className={`text-[11px] font-mono uppercase ${
                          active ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        .{item.id}
                      </span>
                    </div>
                    <div className="text-xs font-bold">{item.title}</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {item.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Platform-Specific OS Support Configuration */}
            {targetFormat === 'apk' && (
              <div className="space-y-4">
                {/* Google Play Store & Play Protect Friendly Mode Card */}
                <div
                  className={`p-4 rounded-xl border transition-colors ${
                    config.playProtectFriendly
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          config.playProtectFriendly ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-900">
                          Google Play Store &amp; Play Protect Friendly Mode (Anti-Harmful Warning)
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Eliminates Google Play Protect &quot;Harmful app blocked&quot; warnings by
                          compiling with <code className="font-mono">targetSdkVersion=34</code> (Google
                          Play requirement), setting{' '}
                          <code className="font-mono">allowBackup=false</code> &amp;{' '}
                          <code className="font-mono">usesCleartextTraffic=false</code>, stripping
                          risky spyware-flagged permissions, and signing with a unique X.509v3
                          developer certificate (<code className="font-mono">O=Shailesh Raj Studio</code>).
                        </p>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={config.playProtectFriendly}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            playProtectFriendly: e.target.checked,
                            targetSdkVersion: e.target.checked ? 34 : prev.targetSdkVersion
                          }))
                        }
                        className="w-4 h-4 rounded border-emerald-400 text-emerald-600"
                      />
                      <span className="text-xs font-bold text-emerald-800">
                        {config.playProtectFriendly ? 'Active' : 'Off'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Android OS Version Compatibility Range */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Android OS Version Compatibility Range (Android 5.0 to Android 16)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700">
                      v1 + v2 X.509v3 Signed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Minimum Supported Android Version (minSdkVersion)
                      </label>
                      <select
                        value={config.minSdkVersion}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value, 10);
                          onChangeConfig((prev) => ({
                            ...prev,
                            minSdkVersion: newMin,
                            targetSdkVersion: Math.max(prev.targetSdkVersion, newMin)
                          }));
                        }}
                        className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      >
                        {ANDROID_VERSIONS.map((v) => (
                          <option key={v.apiLevel} value={v.apiLevel}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Target Android Version (targetSdkVersion)
                      </label>
                      <select
                        value={config.playProtectFriendly ? 34 : config.targetSdkVersion}
                        disabled={config.playProtectFriendly}
                        onChange={(e) => {
                          const newTarget = parseInt(e.target.value, 10);
                          onChangeConfig((prev) => ({
                            ...prev,
                            targetSdkVersion: newTarget,
                            minSdkVersion: Math.min(prev.minSdkVersion, newTarget)
                          }));
                        }}
                        className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 disabled:bg-slate-100"
                      >
                        {ANDROID_VERSIONS.map((v) => (
                          <option key={v.apiLevel} value={v.apiLevel}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 font-mono">
                    Active Support Span:{' '}
                    <strong className="text-slate-900">
                      {getAndroidSupportSummary(
                        config.minSdkVersion,
                        config.targetSdkVersion,
                        config.playProtectFriendly
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {targetFormat === 'exe' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Windows 10 &amp; Windows 11 Executable Configuration (64-Bit PE32+)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700">
                    x86_64 Native PE Header
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({ ...prev, exeMode: 'portable' }))
                    }
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.exeMode === 'portable'
                        ? 'bg-white border-slate-900 ring-1 ring-slate-900'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">
                      Portable .EXE (Standalone)
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Zero-installation single file executable. Runs immediately from any folder or USB
                      drive on Windows 10 and Windows 11.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({ ...prev, exeMode: 'installable' }))
                    }
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.exeMode === 'installable'
                        ? 'bg-white border-slate-900 ring-1 ring-slate-900'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">
                      Installable Setup .EXE (Installer)
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Installs to %LOCALAPPDATA%\Programs, creates Desktop shortcut, and registers in
                      Windows 10/11 Installed Apps uninstaller.
                    </p>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Windows OS Target Compatibility
                  </label>
                  <select
                    value={config.windowsVersionId}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, windowsVersionId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  >
                    {WINDOWS_VERSIONS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.notes}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {targetFormat === 'deb' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Debian / Ubuntu Linux Package (.DEB) Configuration
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700">
                    dpkg-deb Verified Archive
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Generates a standard Debian binary archive containing{' '}
                  <code className="font-mono">DEBIAN/control</code>,{' '}
                  <code className="font-mono">DEBIAN/postinst</code>, executable{' '}
                  <code className="font-mono">/usr/bin/</code> launcher,{' '}
                  <code className="font-mono">/opt/</code> payload, and Freedesktop{' '}
                  <code className="font-mono">.desktop</code> shortcut.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Maintainer Email (DEBIAN/control)
                  </label>
                  <input
                    type="email"
                    value={config.maintainerEmail}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, maintainerEmail: e.target.value }))
                    }
                    placeholder="developer@example.com"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Step 3: App Name, Custom Package Name & Description */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                03. App Name, Custom Package Name &amp; Description
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize the package identifier (e.g. <code className="font-mono">com.shailesh.app</code>)
                used across Android APK, Windows Registry AppId, and Debian package control
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Application Name *
                </label>
                <input
                  type="text"
                  value={config.appName}
                  onChange={(e) => handleAppNameChange(e.target.value)}
                  placeholder="e.g. Pocket Ledger"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Custom Package Name *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPackageAutoSync((v) => !v)}
                    className="text-[11px] font-medium text-emerald-700 hover:underline cursor-pointer"
                  >
                    {packageAutoSync ? 'Auto-sync ON' : 'Custom Manual'}
                  </button>
                </div>
                <input
                  type="text"
                  value={config.packageName}
                  onChange={(e) => {
                    setPackageAutoSync(false);
                    onChangeConfig((prev) => ({ ...prev, packageName: e.target.value }));
                  }}
                  placeholder="com.shailesh.appname"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Application Description *
              </label>
              <textarea
                rows={2}
                value={config.description}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe what your application does..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Version Name
                </label>
                <input
                  type="text"
                  value={config.versionName}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({ ...prev, versionName: e.target.value }))
                  }
                  placeholder="1.0.0"
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Version Code
                </label>
                <input
                  type="number"
                  min={1}
                  value={config.versionCode}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      versionCode: Math.max(1, parseInt(e.target.value, 10) || 1)
                    }))
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Screen Orientation (APK)
                </label>
                <select
                  value={config.orientation}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      orientation: e.target.value as UnifiedPackageConfig['orientation']
                    }))
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                >
                  <option value="portrait">Portrait Locked</option>
                  <option value="landscape">Landscape Locked</option>
                  <option value="sensor">Auto-Rotate (Sensor)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Step 4: App Logo Studio */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  04. App Logo Image Picker &amp; Multi-Platform Icon Studio
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose an image to create Android <code className="font-mono">mipmap</code> PNGs,
                  Windows <code className="font-mono">.ico</code>, and Linux Hicolor icons
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                  onChange={handleLogoFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Choose Image for App Logo
                </button>

                {config.iconDataUrl && (
                  <button
                    type="button"
                    onClick={() => onChangeConfig((prev) => ({ ...prev, iconDataUrl: null }))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-1">
              <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                {renderedIconPreview ? (
                  <img
                    src={renderedIconPreview}
                    alt="Generated App Logo"
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 object-contain drop-shadow-xs"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl">
                    AP
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xs font-semibold text-slate-900 truncate max-w-[160px]">
                    {config.appName || 'Application'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {config.iconDataUrl ? 'Custom Uploaded Image' : 'Vector Monogram Icon'}
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Icon Mask Shape
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['squircle', 'circle', 'rounded', 'square'] as const).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => onChangeConfig((prev) => ({ ...prev, iconShape: shape }))}
                        className={`px-2.5 py-2 text-xs font-medium rounded-lg border capitalize transition-colors cursor-pointer whitespace-nowrap ${
                          config.iconShape === shape
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {shape}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Icon Background Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      {ICON_BG_PRESETS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => onChangeConfig((prev) => ({ ...prev, iconBgColor: hex }))}
                          style={{ backgroundColor: hex }}
                          className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                            config.iconBgColor === hex
                              ? 'scale-110 ring-2 ring-slate-900 ring-offset-1 border-white'
                              : 'border-slate-300'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={config.iconBgColor}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({ ...prev, iconBgColor: e.target.value }))
                        }
                        className="w-7 h-7 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
                      />
                    </div>
                  </div>

                  {!config.iconDataUrl && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Monogram Initials
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={config.iconLabel}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            iconLabel: e.target.value.toUpperCase()
                          }))
                        }
                        placeholder="Auto"
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>Outputs:</span>
                  <span>Android mipmap (48–512px)</span>
                  <span>·</span>
                  <span>Windows .ICO (256px)</span>
                  <span>·</span>
                  <span>Linux Hicolor PNG</span>
                </div>
              </div>
            </div>
          </section>

          {/* Step 5: Push Notifications, Configure Navigation Drawer & Extras */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  05. Push Notifications, Navigation Drawer &amp; Extras
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure Push Notifications, Material Navigation Drawer, and WebView Extras
                </p>
              </div>
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            {/* Push Notifications + Configure Navigation Drawer (2-Column Grid matching screenshot) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Push Notifications Fieldset */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    <span>Push Notifications</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      config.pushNotifications.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {config.pushNotifications.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="pushNotificationsToggle"
                        checked={config.pushNotifications.enabled === true}
                        onChange={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            pushNotifications: {
                              ...prev.pushNotifications,
                              enabled: true
                            }
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-slate-300"
                      />
                      <span>Enable</span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="pushNotificationsToggle"
                        checked={config.pushNotifications.enabled === false}
                        onChange={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            pushNotifications: {
                              ...prev.pushNotifications,
                              enabled: false
                            }
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-slate-300"
                      />
                      <span>Disable</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPushConfigModal((v) => !v)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Configure
                  </button>
                </div>

                {/* Push Notifications Configuration Panel */}
                {showPushConfigModal && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Notification Provider
                        </label>
                        <select
                          value={config.pushNotifications.provider}
                          onChange={(e) =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              pushNotifications: {
                                ...prev.pushNotifications,
                                provider: e.target.value as 'onesignal' | 'fcm' | 'local'
                              }
                            }))
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="fcm">Firebase Cloud Messaging (FCM)</option>
                          <option value="onesignal">OneSignal Push SDK</option>
                          <option value="local">Local App Notification Channel</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          App / Sender ID
                        </label>
                        <input
                          type="text"
                          value={config.pushNotifications.appId}
                          onChange={(e) =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              pushNotifications: {
                                ...prev.pushNotifications,
                                appId: e.target.value
                              }
                            }))
                          }
                          placeholder="fcm-app-id-01"
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Notification Title
                      </label>
                      <input
                        type="text"
                        value={config.pushNotifications.notificationTitle}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            pushNotifications: {
                              ...prev.pushNotifications,
                              notificationTitle: e.target.value
                            }
                          }))
                        }
                        placeholder="Welcome Update"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Notification Message
                      </label>
                      <input
                        type="text"
                        value={config.pushNotifications.notificationMessage}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            pushNotifications: {
                              ...prev.pushNotifications,
                              notificationMessage: e.target.value
                            }
                          }))
                        }
                        placeholder="Tap to view new updates inside your app."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.pushNotifications.soundAndVibrate}
                          onChange={(e) =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              pushNotifications: {
                                ...prev.pushNotifications,
                                soundAndVibrate: e.target.checked
                              }
                            }))
                          }
                          className="rounded border-slate-300"
                        />
                        <span>Sound &amp; Vibration Alert</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          onChangeConfig((prev) => ({
                            ...prev,
                            pushNotifications: {
                              ...prev.pushNotifications,
                              enabled: true
                            }
                          }));
                          setSimulatorTab('runtime');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                      >
                        Test in Preview
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Configure Navigation Drawer Fieldset */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Menu className="w-3.5 h-3.5 text-blue-600" />
                    <span>Configure Navigation Drawer</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      config.navigationDrawer.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {config.navigationDrawer.enabled
                      ? `${config.navigationDrawer.items.length} Items`
                      : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="navigationDrawerToggle"
                        checked={config.navigationDrawer.enabled === true}
                        onChange={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            navigationDrawer: {
                              ...prev.navigationDrawer,
                              enabled: true
                            }
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-slate-300"
                      />
                      <span>Enable</span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="navigationDrawerToggle"
                        checked={config.navigationDrawer.enabled === false}
                        onChange={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            navigationDrawer: {
                              ...prev.navigationDrawer,
                              enabled: false
                            }
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-slate-300"
                      />
                      <span>Disable</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNavDrawerConfigModal((v) => !v)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Configure
                  </button>
                </div>

                {/* Configure Navigation Drawer Panel */}
                {showNavDrawerConfigModal && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Drawer Header Title
                        </label>
                        <input
                          type="text"
                          value={config.navigationDrawer.headerTitle}
                          onChange={(e) =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              navigationDrawer: {
                                ...prev.navigationDrawer,
                                headerTitle: e.target.value
                              }
                            }))
                          }
                          placeholder={config.appName}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Drawer Subtitle
                        </label>
                        <input
                          type="text"
                          value={config.navigationDrawer.headerSubtitle}
                          onChange={(e) =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              navigationDrawer: {
                                ...prev.navigationDrawer,
                                headerSubtitle: e.target.value
                              }
                            }))
                          }
                          placeholder="Quick Navigation"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Drawer Menu Items ({config.navigationDrawer.items.length})
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {config.navigationDrawer.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">{item.label}</span>{' '}
                              <span className="text-[10px] font-mono text-slate-500">
                                ({item.action})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeConfig((prev) => ({
                                  ...prev,
                                  navigationDrawer: {
                                    ...prev.navigationDrawer,
                                    items: prev.navigationDrawer.items.filter(
                                      (it) => it.id !== item.id
                                    )
                                  }
                                }))
                              }
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remove menu item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={newNavItemLabel}
                          onChange={(e) => setNewNavItemLabel(e.target.value)}
                          placeholder="Menu item label..."
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <select
                          value={newNavItemAction}
                          onChange={(e) => setNewNavItemAction(e.target.value)}
                          className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="top">Home / Top</option>
                          <option value="reload">Reload App</option>
                          <option value="notify">Test Push</option>
                          <option value="exit">Exit Dialog</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newNavItemLabel.trim()) return;
                            onChangeConfig((prev) => ({
                              ...prev,
                              navigationDrawer: {
                                ...prev.navigationDrawer,
                                items: [
                                  ...prev.navigationDrawer.items,
                                  {
                                    id: `nav-${Date.now()}`,
                                    label: newNavItemLabel.trim(),
                                    action: newNavItemAction
                                  }
                                ]
                              }
                            }));
                            setNewNavItemLabel('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeConfig((prev) => ({
                            ...prev,
                            navigationDrawer: {
                              ...prev.navigationDrawer,
                              enabled: true
                            }
                          }));
                          setSimulatorTab('runtime');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                      >
                        Test Drawer in Preview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Extras Section (Exact 20 Checkboxes from Screenshot) */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/40 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Extras
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        fullscreen: true,
                        extras: {
                          supportZoom: true,
                          zoomButtons: true,
                          sideScrollBars: true,
                          textSelection: true,
                          saveFormData: true,
                          fullscreen: true,
                          javascriptApis: true,
                          httpsOnlyContent: true,
                          allowExternalUrls: true,
                          confirmOnExit: true,
                          enableGpsPrompt: true,
                          disallowScreenshot: false,
                          allowFileAccess: true,
                          allowCrossOrigin: true,
                          showToolbar: true,
                          liveToolbarTitle: true,
                          homeButton: true,
                          pullToRefresh: true,
                          deepLinking: true,
                          popupBlocker: true
                        }
                      }))
                    }
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Enable Recommended
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        fullscreen: false,
                        extras: {
                          supportZoom: false,
                          zoomButtons: false,
                          sideScrollBars: false,
                          textSelection: false,
                          saveFormData: false,
                          fullscreen: false,
                          javascriptApis: false,
                          httpsOnlyContent: false,
                          allowExternalUrls: false,
                          confirmOnExit: true,
                          enableGpsPrompt: false,
                          disallowScreenshot: false,
                          allowFileAccess: false,
                          allowCrossOrigin: false,
                          showToolbar: false,
                          liveToolbarTitle: false,
                          homeButton: false,
                          pullToRefresh: true,
                          deepLinking: false,
                          popupBlocker: false
                        }
                      }))
                    }
                    className="text-slate-600 hover:underline font-medium cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {EXTRAS_CHECKBOX_ITEMS.map((item) => {
                  const isChecked = config.extras[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-300 text-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onChangeConfig((prev) => ({
                            ...prev,
                            fullscreen:
                              item.key === 'fullscreen' ? checked : prev.fullscreen,
                            enableJavaScript:
                              item.key === 'javascriptApis' ? checked : prev.enableJavaScript,
                            permissions:
                              item.key === 'enableGpsPrompt'
                                ? { ...prev.permissions, geolocation: checked }
                                : prev.permissions,
                            extras: {
                              ...prev.extras,
                              [item.key]: checked
                            }
                          }));
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="truncate">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Step 6: Runtime Permissions & Final Build Trigger */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  06. Runtime Capabilities &amp; Package Export
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure permissions and compile your installable package
                </p>
              </div>
              <Shield className="w-4 h-4 text-slate-400" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { key: 'internet', label: 'INTERNET' },
                { key: 'networkState', label: 'ACCESS_NETWORK_STATE' },
                { key: 'vibrate', label: 'VIBRATE' },
                { key: 'storage', label: 'READ_EXTERNAL_STORAGE' },
                { key: 'camera', label: 'CAMERA' },
                { key: 'geolocation', label: 'ACCESS_FINE_LOCATION' }
              ].map((perm) => {
                const k = perm.key as keyof UnifiedPackageConfig['permissions'];
                return (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer text-xs font-mono text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={config.permissions[k]}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            [k]: e.target.checked
                          }
                        }))
                      }
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="truncate">{perm.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-mono">
                Package ID: <strong className="text-slate-900">{config.packageName}</strong>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleTriggerBuild([targetFormat])}
                  disabled={isBuilding || !config.htmlContent.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <PackageCheck className="w-4 h-4" />
                  Build .{targetFormat.toUpperCase()} Now
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerBuild(['apk', 'exe', 'deb'])}
                  disabled={isBuilding || !config.htmlContent.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Layers className="w-4 h-4" />
                  Build APK + EXE + DEB
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Download Output & Interactive Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {isBuilding && (
            <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3 border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400">{buildStageText}</span>
                <span className="tabular-nums">{buildProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150"
                  style={{ width: `${buildProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Direct Download Card */}
          <div
            className={`rounded-xl border p-6 transition-all ${
              currentBuild
                ? 'bg-emerald-950 text-white border-emerald-800'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {currentBuild ? (
              <div className="space-y-5">
                {latestBuilds.length > 1 && (
                  <div className="flex items-center gap-1.5 pb-3 border-b border-emerald-800/80">
                    {latestBuilds.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setTargetFormat(b.format)}
                        className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                          currentBuild.id === b.id
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-900'
                        }`}
                      >
                        .{b.format.toUpperCase()} (HTML5)
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={currentBuild.generatedIconUrl}
                      alt={currentBuild.appName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl border border-white/15 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        Play Protect Safe .{currentBuild.format.toUpperCase()} Compiled
                      </div>
                      <h3 className="text-base font-bold text-white mt-0.5 break-all">
                        {currentBuild.fileName}
                      </h3>
                      <div className="text-xs text-emerald-200/80 font-mono tabular-nums mt-0.5">
                        {(currentBuild.totalBytes / 1024).toFixed(2)} KB · {currentBuild.packageName}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-emerald-100/90 bg-emerald-900/40 border border-emerald-800/80 rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-emerald-300">
                    Target OS: {currentBuild.targetOsSummary}
                  </div>
                  {currentBuild.installInstructions.map((line, i) => (
                    <div key={i} className="text-[11px] text-emerald-100/80 leading-relaxed">
                      {i + 1}. {line}
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadBuild(currentBuild, false)}
                    className="w-full py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download .{currentBuild.format.toUpperCase()} to Device ({currentBuild.fileName})
                  </button>

                  {currentBuild.companionBlob && currentBuild.companionFileName && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBuild(currentBuild, true)}
                      className="w-full py-2.5 px-4 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 font-medium text-xs rounded-lg border border-emerald-700/70 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <FileArchive className="w-3.5 h-3.5" />
                      Download Companion ({currentBuild.companionFileName})
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-emerald-800/80 space-y-2">
                  <div className="text-[11px] font-mono text-emerald-300/90 break-all">
                    SHA-256: {currentBuild.sha256Hex}
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-950/60 border border-emerald-900/80 divide-y divide-emerald-900/40 text-[11px] font-mono tabular-nums">
                    {currentBuild.entries.map((entry) => (
                      <div
                        key={entry.path}
                        className="px-3 py-1.5 flex items-center justify-between gap-2 text-emerald-100/90"
                      >
                        <span className="truncate">{entry.path}</span>
                        <span className="text-emerald-400 shrink-0">{entry.sizeBytes} B</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-700">
                      Direct Device Package Output (.APK · .EXE · .DEB)
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      Ready to Compile Play Protect Safe Application
                    </h3>
                  </div>
                  <PackageCheck className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Select your local HTML5 document or multi-file .ZIP project, configure your package
                  name and logo, and click <strong>Build</strong> to download your installable
                  package.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTriggerBuild([targetFormat])}
                    disabled={isBuilding || !config.htmlContent.trim()}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Build .{targetFormat.toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerBuild(['apk', 'exe', 'deb'])}
                    disabled={isBuilding || !config.htmlContent.trim()}
                    className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    Build APK + EXE + DEB
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Device & Manifest Preview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Smartphone className="w-4 h-4 text-slate-600" />
                Live Application Preview
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSimulatorTab('launcher')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      simulatorTab === 'launcher'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Launcher &amp; Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorTab('runtime')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      simulatorTab === 'runtime'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    App Runtime
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorTab('manifest')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      simulatorTab === 'manifest'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Manifest XML
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullScreenPreview(true)}
                  disabled={!config.htmlContent.trim()}
                  title="See Preview in Full Screen"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full Screen
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-100/70 flex items-center justify-center">
              {simulatorTab === 'manifest' ? (
                <div className="w-full h-[500px] bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-auto leading-relaxed">
                  <pre>{manifestXmlPreview}</pre>
                </div>
              ) : (
                <div className="w-[320px] h-[540px] bg-slate-900 rounded-[32px] p-2.5 flex flex-col border border-slate-800">
                  {!config.fullscreen && (
                    <div
                      style={{ backgroundColor: config.themeColor || '#0F172A' }}
                      className="h-6 px-4 rounded-t-[22px] text-white flex items-center justify-between text-[10px] font-mono shrink-0"
                    >
                      <span>09:41</span>
                      <span>Play Protect Verified</span>
                    </div>
                  )}

                  {simulatorTab === 'launcher' ? (
                    <div className="flex-1 bg-slate-900 text-white p-5 flex flex-col justify-between rounded-b-[22px]">
                      <div className="my-auto flex flex-col items-center text-center space-y-5">
                        <button
                          type="button"
                          onClick={() => setSimulatorTab('runtime')}
                          className="group flex flex-col items-center space-y-2.5 cursor-pointer focus:outline-none"
                        >
                          {renderedIconPreview && (
                            <img
                              src={renderedIconPreview}
                              alt={config.appName}
                              referrerPolicy="no-referrer"
                              className="w-20 h-20 object-contain"
                            />
                          )}
                          <span className="text-sm font-semibold text-white tracking-tight">
                            {config.appName || 'Untitled App'}
                          </span>
                        </button>

                        <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-left space-y-2">
                          <div className="text-[11px] font-mono text-emerald-300 truncate">
                            {config.packageName}
                          </div>
                          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                            {config.description || 'No description provided.'}
                          </p>
                          <div className="pt-2 border-t border-slate-700 text-[11px] text-slate-300 font-mono tabular-nums space-y-1">
                            <div className="flex justify-between">
                              <span>Source:</span>
                              <span className="uppercase">HTML5 / .ZIP</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Play Protect:</span>
                              <span className="text-emerald-300">
                                {config.playProtectFriendly ? 'SAFE (API 34)' : 'Custom'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Author:</span>
                              <span>Shailesh Raj</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSimulatorTab('runtime')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Launch App
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsFullScreenPreview(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Full Screen
                          </button>
                        </div>
                      </div>

                      <div className="w-24 h-1 bg-white/40 rounded-full mx-auto" />
                    </div>
                  ) : (
                    <div className="flex-1 bg-white rounded-b-[22px] overflow-hidden flex flex-col">
                      <iframe
                        title="Application Runtime Preview"
                        srcDoc={runtimePreviewHtml}
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
                        className="w-full flex-1 border-0"
                      />
                      <div className="h-6 bg-slate-950 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setSimulatorTab('launcher')}
                          className="w-24 h-1 bg-white/50 hover:bg-white rounded-full cursor-pointer"
                          title="Return to Launcher"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
