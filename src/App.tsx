/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  FileCode2,
  PackageCheck,
  Upload,
  ArrowRight,
  Download,
  Smartphone,
  Code2,
  Layers,
  Monitor,
  FolderArchive,
  ShieldCheck
} from 'lucide-react';
import { SAMPLE_HTML_TEMPLATES } from './data/sampleHtmlTemplates';
import {
  UnifiedPackageConfig,
  UnifiedBuildResult,
  SourceLanguage
} from './utils/multiPlatformBuilder';
import { parseZipArchive, ImportedZipProject } from './utils/zipParser';
import { HtmlViewerWorkspace } from './components/HtmlViewerWorkspace';
import { ApkConverterWorkspace } from './components/ApkConverterWorkspace';

type ActiveSection = 'launcher' | 'viewer' | 'converter' | 'builds';

export default function App() {
  const defaultHtml = SAMPLE_HTML_TEMPLATES[0];

  const [activeSection, setActiveSection] = useState<ActiveSection>('launcher');
  const [pkgConfig, setPkgConfig] = useState<UnifiedPackageConfig>({
    sourceType: 'html',
    appName: defaultHtml.suggestedAppName,
    packageName: defaultHtml.suggestedPackageId,
    description: defaultHtml.description,
    versionName: '1.0.0',
    versionCode: 1,
    minSdkVersion: 21, // Android 5.0 Lollipop (API 21)
    targetSdkVersion: 34, // Android 14 (API 34 - Google Play Protect Verified Target)
    playProtectFriendly: true,
    importedZip: null,
    windowsVersionId: 'win11-24h2',
    exeMode: 'portable',
    architecture: 'universal',
    maintainerEmail: 'packager@webapk.studio',
    orientation: 'portrait',
    themeColor: defaultHtml.themeColor,
    fullscreen: false,
    enableJavaScript: true,
    enableDomStorage: true,
    offlineCache: true,
    permissions: {
      internet: true,
      networkState: true,
      vibrate: true,
      camera: false,
      geolocation: false,
      storage: false
    },
    iconDataUrl: null,
    iconShape: 'squircle',
    iconBgColor: '#0F172A',
    iconLabel: 'PL',
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
    },
    pushNotifications: {
      enabled: false,
      provider: 'fcm',
      appId: 'fcm-webapk-studio-app',
      channelName: 'General Updates',
      notificationTitle: 'Welcome to Pocket Ledger',
      notificationMessage: 'Your offline-ready application is active and ready to use.',
      soundAndVibrate: true
    },
    navigationDrawer: {
      enabled: false,
      headerTitle: defaultHtml.suggestedAppName,
      headerSubtitle: 'Navigation Drawer Menu',
      items: [
        { id: 'nav-home', label: 'Home Dashboard', action: 'top' },
        { id: 'nav-notify', label: 'Trigger Push Notification', action: 'notify' },
        { id: 'nav-reload', label: 'Reload Application', action: 'reload' }
      ]
    },
    htmlFileName: defaultHtml.fileName,
    htmlContent: defaultHtml.htmlContent,
    pythonFileName: '',
    pythonContent: '',
    dartFileName: '',
    dartContent: '',
    javaFileName: '',
    javaContent: '',
    cppFileName: '',
    cppContent: ''
  });

  const [buildHistory, setBuildHistory] = useState<UnifiedBuildResult[]>([]);
  const viewerQuickFileInputRef = useRef<HTMLInputElement>(null);
  const converterQuickFileInputRef = useRef<HTMLInputElement>(null);
  const quickZipInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateSourceFromViewer = (
    _lang: SourceLanguage,
    fileName: string,
    content: string,
    suggestedAppName?: string
  ) => {
    setPkgConfig((prev) => {
      const nextAppName = suggestedAppName || prev.appName;
      const cleanSlug =
        nextAppName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20) || 'app';

      return {
        ...prev,
        importedZip: null,
        zipProjectFiles: undefined,
        sourceType: 'html',
        appName: nextAppName,
        packageName: suggestedAppName ? `com.shailesh.${cleanSlug}` : prev.packageName,
        htmlFileName: fileName,
        htmlContent: content
      };
    });
  };

  const handleImportZipProject = (zipProject: ImportedZipProject | null) => {
    setPkgConfig((prev) => {
      if (!zipProject) {
        return {
          ...prev,
          importedZip: null,
          zipProjectFiles: undefined
        };
      }

      const cleanSlug =
        zipProject.suggestedAppName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20) || 'zipapp';

      return {
        ...prev,
        importedZip: zipProject,
        sourceType: 'html',
        appName: zipProject.suggestedAppName,
        packageName: `com.shailesh.${cleanSlug}`,
        htmlFileName: zipProject.entryFilePath,
        htmlContent: zipProject.entryTextContent,
        zipProjectFiles: zipProject.files.map((f) => ({ path: f.path, data: f.bytes }))
      };
    });
  };

  const handleQuickFileLoad = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetMode: 'viewer' | 'converter'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.zip')) {
      try {
        const parsedZip = await parseZipArchive(file);
        handleImportZipProject(parsedZip);
        setActiveSection(targetMode);
      } catch {
        // ignore
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      const baseName = file.name
        .replace(/\.(html?|xhtml)$/i, '')
        .replace(/[-_]+/g, ' ');
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const detectedAppName = titleMatch ? titleMatch[1].trim() : baseName;
      handleUpdateSourceFromViewer('html', file.name, content, detectedAppName);
      setActiveSection(targetMode);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBuildComplete = (results: UnifiedBuildResult[]) => {
    setBuildHistory((prev) => [...results, ...prev]);
  };

  const handleDownloadBuildBlob = (build: UnifiedBuildResult) => {
    const url = URL.createObjectURL(build.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = build.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Hidden Quick File Inputs for Launcher Cards */}
      <input
        ref={viewerQuickFileInputRef}
        type="file"
        accept=".html,.htm,.xhtml,.zip"
        onChange={(e) => handleQuickFileLoad(e, 'viewer')}
        className="hidden"
      />
      <input
        ref={converterQuickFileInputRef}
        type="file"
        accept=".html,.htm,.xhtml,.zip"
        onChange={(e) => handleQuickFileLoad(e, 'converter')}
        className="hidden"
      />
      <input
        ref={quickZipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={(e) => handleQuickFileLoad(e, 'converter')}
        className="hidden"
      />

      {/* Top Attribution Banner: Made by Shailesh Raj */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-[1380px] mx-auto px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold tracking-wide text-emerald-400">
            Made by Shailesh Raj
          </div>
          <div className="text-slate-300 font-mono text-[11px]">
            HTML5 Viewer · Multi-File .ZIP Importer · Google Play Protect Safe APK · EXE · DEB
          </div>
        </div>
      </div>

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveSection('launcher')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none"
          >
            WebAPK Studio · Made by Shailesh Raj
          </button>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveSection('launcher')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeSection === 'launcher'
                  ? 'text-slate-900 border-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Mode Launcher
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('viewer')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeSection === 'viewer'
                  ? 'text-slate-900 border-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              HTML5 &amp; .ZIP Viewer
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('converter')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeSection === 'converter'
                  ? 'text-slate-900 border-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              APK · EXE · DEB Packager
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('builds')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeSection === 'builds'
                  ? 'text-slate-900 border-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Exported Packages ({buildHistory.length})
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('converter')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Multi-Platform Packager
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8">
        {activeSection === 'launcher' && (
          <div className="space-y-10">
            {/* Hero Introduction */}
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Made by Shailesh Raj · HTML5 · Multi-File .ZIP Importer · APK · EXE · DEB
              </div>
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
                style={{ textWrap: 'balance' }}
              >
                Run local HTML5 &amp; multi-file .ZIP web projects or compile them into APK, EXE &amp; DEB.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed">
                Load and test local <code className="font-mono text-sm text-slate-800">.html</code>,{' '}
                <code className="font-mono text-sm text-slate-800">.htm</code>, or multi-folder{' '}
                <code className="font-mono text-sm text-slate-800">.zip</code> web archives, then
                package them into Google Play Protect Safe{' '}
                <code className="font-mono text-sm text-slate-800">.apk</code>, Windows 10/11{' '}
                <code className="font-mono text-sm text-slate-800">.exe</code>, and Linux{' '}
                <code className="font-mono text-sm text-slate-800">.deb</code> installers.
              </p>
            </div>

            {/* TWO PRIMARY OPTIONS (Side-by-Side Equal Height Split) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* OPTION 1: HTML5 & .ZIP Viewer */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between space-y-8 hover:border-slate-300 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      01. First Option · HTML5 &amp; .ZIP Viewer
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                      <FileCode2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Local HTML5 &amp; Multi-File .ZIP Sandbox
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Pick any local <code className="font-mono text-xs">.html</code>,{' '}
                      <code className="font-mono text-xs">.htm</code>, or complete{' '}
                      <code className="font-mono text-xs">.zip</code> web project archive with
                      folders, CSS, JavaScript, and images. Inspect and edit files in real time and
                      run them inside the sandbox.
                    </p>
                  </div>

                  <div className="pt-2 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Live HTML5 execution with Desktop, Android Phone &amp; Tablet viewports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FolderArchive className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Multi-File .ZIP Project Importer with folder &amp; asset bundler</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => viewerQuickFileInputRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4" />
                    Pick HTML or .ZIP Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('viewer')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Open Viewer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* OPTION 2: HTML5 & .ZIP to APK / EXE / DEB Converter */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between space-y-8 hover:border-slate-300 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-emerald-700">
                      02. Second Option · Play Protect Safe APK · EXE · DEB Compiler
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <PackageCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      HTML5 &amp; .ZIP to APK, EXE &amp; DEB Converter
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Convert local HTML5 files or multi-file{' '}
                      <code className="font-mono text-xs">.zip</code> projects into Google Play Protect
                      Friendly Android <code className="font-mono text-xs">.apk</code>, Windows 10/11{' '}
                      <code className="font-mono text-xs">.exe</code> (Portable or Installer), and
                      Linux <code className="font-mono text-xs">.deb</code> packages.
                    </p>
                  </div>

                  <div className="pt-2 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Google Play Protect Friendly (API 34 Target · X.509v3 Verified Signer)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Android 5.0 to Android 16 · Custom Package Name, Extras, Notifications &amp; Drawer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Windows 10 &amp; Windows 11 64-Bit EXE (Portable or Setup) · Linux DEB</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSection('converter')}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Open APK / EXE / DEB Converter
                  </button>
                  <button
                    type="button"
                    onClick={() => quickZipInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FolderArchive className="w-4 h-4" />
                    Import .ZIP
                  </button>
                </div>
              </div>
            </div>

            {/* Pre-Loaded Sample HTML5 Projects Strip */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Included HTML5 Sample Applications
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any sample application below to run it in the sandbox or package it into a
                    Play Protect Friendly <code className="font-mono">.apk</code>,{' '}
                    <code className="font-mono">.exe</code>, or <code className="font-mono">.deb</code>.
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Active Package: {pkgConfig.packageName}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SAMPLE_HTML_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4 bg-slate-50/50 hover:bg-white transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-500 font-mono">
                        HTML5 · {tpl.fileName} · {tpl.category}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{tpl.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{tpl.description}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateSourceFromViewer(
                            'html',
                            tpl.fileName,
                            tpl.htmlContent,
                            tpl.suggestedAppName
                          );
                          setActiveSection('viewer');
                        }}
                        className="flex-1 py-1.5 px-3 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Run HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPkgConfig((prev) => ({
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
                          }));
                          setActiveSection('converter');
                        }}
                        className="flex-1 py-1.5 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Package APK/EXE/DEB
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'viewer' && (
          <HtmlViewerWorkspace
            sourceType={pkgConfig.sourceType}
            onChangeSourceType={(lang: SourceLanguage) =>
              setPkgConfig((prev) => ({ ...prev, sourceType: lang }))
            }
            htmlFileName={pkgConfig.htmlFileName}
            htmlContent={pkgConfig.htmlContent}
            importedZip={pkgConfig.importedZip}
            onImportZip={handleImportZipProject}
            onUpdateSource={handleUpdateSourceFromViewer}
            onSendToConverter={() => setActiveSection('converter')}
          />
        )}

        {activeSection === 'converter' && (
          <ApkConverterWorkspace
            config={pkgConfig}
            onChangeConfig={setPkgConfig}
            latestBuilds={buildHistory.slice(0, 3)}
            onBuildComplete={handleBuildComplete}
            onOpenInViewer={() => setActiveSection('viewer')}
          />
        )}

        {activeSection === 'builds' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Session Export Archive (.APK · .EXE · .DEB) · Made by Shailesh Raj
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Generated Installable Packages ({buildHistory.length})
                </h1>
                <p className="text-sm text-slate-600">
                  Download any <code className="font-mono text-xs">.apk</code>,{' '}
                  <code className="font-mono text-xs">.exe</code>, or{' '}
                  <code className="font-mono text-xs">.deb</code> package compiled during this session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('converter')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PackageCheck className="w-4 h-4" />
                Create New Build
              </button>
            </div>

            {buildHistory.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    No Packages Built Yet
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Open the APK / EXE / DEB Packager, configure your application, and click Build.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('converter')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Go to Multi-Platform Packager
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {buildHistory.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={b.generatedIconUrl}
                        alt={b.appName}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-xl border border-slate-200 shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="text-base font-bold text-slate-900">
                          {b.appName}{' '}
                          <span className="text-xs font-mono font-normal text-slate-500">
                            ({b.fileName})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Target: <strong>{b.targetOsSummary}</strong>
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {b.packageName} · Source: HTML5 · v{b.versionName} ·{' '}
                          {(b.totalBytes / 1024).toFixed(2)} KB · SHA-256: {b.sha256Hex.slice(0, 16)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadBuildBlob(b)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        Download .{b.format.toUpperCase()}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1380px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Made by Shailesh Raj · WebAPK Studio · HTML5 &amp; Multi-File .ZIP → APK · EXE · DEB
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('viewer')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              HTML5 &amp; .ZIP Viewer
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setActiveSection('converter')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              APK · EXE · DEB Converter
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
