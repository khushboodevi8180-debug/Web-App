import {
  compileBinaryAndroidManifest,
  compileBinaryResourcesArsc,
  compileWorkingWebViewDex,
  sanitizeAndroidPackageName
} from './androidBinaryCompiler';
import {
  generateApkSigningIdentity,
  buildPkcs7CertRsa,
  injectApkSignatureSchemeV2Block
} from './apkSigner';

export interface ApkExtrasConfig {
  supportZoom: boolean;
  zoomButtons: boolean;
  sideScrollBars: boolean;
  textSelection: boolean;
  saveFormData: boolean;
  fullscreen: boolean;
  javascriptApis: boolean;
  httpsOnlyContent: boolean;
  allowExternalUrls: boolean;
  confirmOnExit: boolean;
  enableGpsPrompt: boolean;
  disallowScreenshot: boolean;
  allowFileAccess: boolean;
  allowCrossOrigin: boolean;
  showToolbar: boolean;
  liveToolbarTitle: boolean;
  homeButton: boolean;
  pullToRefresh: boolean;
  deepLinking: boolean;
  popupBlocker: boolean;
}

export interface ApkPushNotificationsConfig {
  enabled: boolean;
  provider: 'fcm' | 'onesignal' | 'local';
  appId: string;
  channelName: string;
  notificationTitle: string;
  notificationMessage: string;
  soundAndVibrate: boolean;
}

export interface NavigationDrawerItem {
  id: string;
  label: string;
  action: string;
}

export interface ApkNavigationDrawerConfig {
  enabled: boolean;
  headerTitle: string;
  headerSubtitle: string;
  items: NavigationDrawerItem[];
}

export interface ApkConfiguration {
  appName: string;
  packageName: string;
  description: string;
  versionName: string;
  versionCode: number;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  playProtectFriendly?: boolean;
  sourceType?: 'html' | 'python' | 'dart' | 'java' | 'cpp';
  pythonFileName?: string;
  pythonContent?: string;
  dartFileName?: string;
  dartContent?: string;
  javaFileName?: string;
  javaContent?: string;
  cppFileName?: string;
  cppContent?: string;
  zipProjectFiles?: { path: string; data: Uint8Array }[];
  orientation: 'portrait' | 'landscape' | 'sensor';
  themeColor: string;
  fullscreen: boolean;
  enableJavaScript: boolean;
  enableDomStorage: boolean;
  offlineCache: boolean;
  permissions: {
    internet: boolean;
    networkState: boolean;
    vibrate: boolean;
    camera: boolean;
    geolocation: boolean;
    storage: boolean;
  };
  extras?: ApkExtrasConfig;
  pushNotifications?: ApkPushNotificationsConfig;
  navigationDrawer?: ApkNavigationDrawerConfig;
  iconDataUrl: string | null;
  iconShape: 'squircle' | 'circle' | 'rounded' | 'square';
  iconBgColor: string;
  iconLabel: string;
  htmlFileName: string;
  htmlContent: string;
}

export interface ApkEntryInfo {
  path: string;
  sizeBytes: number;
  crc32Hex: string;
  sha256Base64: string;
  category: 'manifest' | 'assets' | 'resources' | 'dex' | 'signature';
}

export interface BuiltApkResult {
  apkBlob: Blob;
  sourceZipBlob: Blob;
  fileName: string;
  sourceZipFileName: string;
  totalBytes: number;
  sha256Hex: string;
  builtAtIso: string;
  entries: ApkEntryInfo[];
  config: ApkConfiguration;
  generatedIconUrl: string;
}

// Precompute standard IEEE 802.3 CRC-32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function computeSha256(bytes: Uint8Array): Promise<{ hex: string; base64: string }> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  let binary = '';
  for (let i = 0; i < hashArray.byteLength; i++) {
    binary += String.fromCharCode(hashArray[i]);
  }
  const base64 = btoa(binary);
  return { hex, base64 };
}

/**
 * Renders the user's uploaded logo image (or fallback monogram icon) into a PNG Uint8Array
 * at the specified square dimension with adaptive mask shaping.
 */
export async function renderLauncherIconPng(
  config: Pick<ApkConfiguration, 'iconDataUrl' | 'iconShape' | 'iconBgColor' | 'iconLabel' | 'appName'>,
  sizePx: number
): Promise<{ bytes: Uint8Array; dataUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, sizePx, sizePx);

  ctx.save();
  ctx.beginPath();
  const r =
    config.iconShape === 'circle'
      ? sizePx / 2
      : config.iconShape === 'squircle'
      ? sizePx * 0.28
      : config.iconShape === 'rounded'
      ? sizePx * 0.16
      : sizePx * 0.04;

  ctx.roundRect(0, 0, sizePx, sizePx, r);
  ctx.clip();

  ctx.fillStyle = config.iconBgColor || '#0F172A';
  ctx.fillRect(0, 0, sizePx, sizePx);

  if (config.iconDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = (err) => reject(err);
        image.src = config.iconDataUrl!;
      });

      const scale = Math.max(sizePx / img.width, sizePx / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (sizePx - drawW) / 2;
      const offsetY = (sizePx - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    } catch {
      drawMonogramFallback(ctx, config.iconLabel || config.appName, sizePx);
    }
  } else {
    drawMonogramFallback(ctx, config.iconLabel || config.appName, sizePx);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = Math.max(1, sizePx * 0.02);
  ctx.strokeRect(0, 0, sizePx, sizePx);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1] || '';
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { bytes, dataUrl };
}

function drawMonogramFallback(ctx: CanvasRenderingContext2D, label: string, sizePx: number) {
  const initials =
    label
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'AP';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(sizePx * 0.4)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, sizePx / 2, sizePx / 2 + sizePx * 0.02);
}

/**
 * Wraps the user's raw HTML with Android WebView bridge helpers, Extras policies,
 * Push Notification heads-up handler, and Material Navigation Drawer when enabled.
 */
export function buildPackagedHtmlAsset(
  config: ApkConfiguration,
  htmlSourceOverride?: string
): string {
  const rawHtml = htmlSourceOverride ?? config.htmlContent;
  if (rawHtml.includes('window.__WEBAPK_MANIFEST__')) {
    return rawHtml;
  }

  const safeJson = (val: unknown) =>
    JSON.stringify(val).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  const minSdk = config.minSdkVersion ?? 21;
  const targetSdk = config.playProtectFriendly !== false ? 34 : (config.targetSdkVersion ?? 34);
  const ex = config.extras;
  const push = config.pushNotifications;
  const nav = config.navigationDrawer;

  const showTopBar = Boolean(
    ex?.showToolbar || nav?.enabled || ex?.homeButton || ex?.zoomButtons
  );

  const extraStyles = `
<style id="webapk-extras-style">
  #webapk-shell-bar {
    position: sticky; top: 0; z-index: 99990;
    display: ${showTopBar ? 'flex' : 'none'};
    align-items: center; justify-content: space-between; gap: 8px;
    background: ${config.themeColor || '#0F172A'}; color: #FFFFFF;
    padding: 8px 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.22);
  }
  #webapk-shell-bar button {
    background: rgba(255,255,255,0.14); color: #FFFFFF; border: none;
    padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;
  }
  #webapk-drawer-backdrop {
    display: none; position: fixed; inset: 0; background: rgba(2,6,23,0.55); z-index: 99995;
  }
  #webapk-drawer-panel {
    position: fixed; top: 0; left: 0; bottom: 0; width: 250px;
    background: #0F172A; color: #F8FAFC; z-index: 99996;
    transform: translateX(-100%); transition: transform 0.2s ease;
    display: flex; flex-direction: column; font-family: sans-serif;
    box-shadow: 4px 0 18px rgba(0,0,0,0.35);
  }
  #webapk-push-toast {
    display: none; position: fixed; top: 12px; left: 12px; right: 12px; z-index: 99998;
    background: #064E3B; color: #ECFDF5; border: 1px solid #10B981;
    border-radius: 12px; padding: 10px 14px; font-family: sans-serif;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  #webapk-exit-modal {
    display: none; position: fixed; inset: 0; z-index: 99999;
    background: rgba(2,6,23,0.65); align-items: center; justify-content: center; padding: 16px;
    font-family: sans-serif;
  }
</style>`;

  const topShellBarHtml = showTopBar
    ? `<div id="webapk-shell-bar">
  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
    ${nav?.enabled ? '<button type="button" onclick="window.__webapkToggleDrawer(true)" title="Navigation Drawer">☰</button>' : ''}
    ${ex?.homeButton ? '<button type="button" onclick="window.scrollTo({top:0,behavior:\'smooth\'})" title="Home">⌂</button>' : ''}
    <span id="webapk-toolbar-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${config.appName.replace(/</g, '&lt;')}</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
    ${ex?.pullToRefresh ? '<button type="button" onclick="location.reload()" title="Pull to Refresh">↻</button>' : ''}
    ${ex?.zoomButtons ? '<button type="button" onclick="window.__webapkZoom(-0.1)">A-</button><button type="button" onclick="window.__webapkZoom(0.1)">A+</button>' : ''}
    ${ex?.confirmOnExit ? '<button type="button" onclick="document.getElementById(\'webapk-exit-modal\').style.display=\'flex\'" title="Exit App">✕</button>' : ''}
  </div>
</div>`
    : '';

  const runtimeOverlayHtml = `
<div id="webapk-drawer-backdrop" onclick="window.__webapkToggleDrawer(false)"></div>
<div id="webapk-drawer-panel">
  <div style="padding:18px 16px;background:${config.themeColor || '#1E293B'};border-bottom:1px solid rgba(255,255,255,0.1);">
    <div style="font-size:15px;font-weight:700;color:#FFF;">${(nav?.headerTitle || config.appName).replace(/</g, '&lt;')}</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:3px;">${(nav?.headerSubtitle || config.packageName).replace(/</g, '&lt;')}</div>
  </div>
  <div style="padding:10px;display:flex;flex-direction:column;gap:4px;flex:1;overflow-y:auto;">
    ${(nav?.items || [])
      .map(
        (it) =>
          `<button type="button" onclick="window.__webapkHandleNav(${safeJson(it.action).replace(/"/g, '&quot;')})" style="text-align:left;padding:10px 12px;border-radius:8px;background:transparent;color:#E2E8F0;border:none;font-size:12.5px;font-weight:600;cursor:pointer;">${it.label.replace(/</g, '&lt;')}</button>`
      )
      .join('')}
  </div>
</div>

<div id="webapk-push-toast">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <strong style="font-size:12px;color:#6EE7B7;" id="webapk-push-title">${(push?.notificationTitle || config.appName).replace(/</g, '&lt;')}</strong>
    <button type="button" onclick="document.getElementById('webapk-push-toast').style.display='none'" style="background:transparent;border:none;color:#A7F3D0;font-size:12px;cursor:pointer;">✕</button>
  </div>
  <div style="font-size:11.5px;margin-top:3px;color:#ECFDF5;" id="webapk-push-body">${(push?.notificationMessage || 'Welcome to ' + config.appName).replace(/</g, '&lt;')}</div>
</div>

<div id="webapk-exit-modal">
  <div style="background:#0F172A;color:#FFF;border:1px solid #334155;border-radius:14px;padding:18px;max-width:280px;width:100%;text-align:center;">
    <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Confirm on Exit</div>
    <div style="font-size:12px;color:#CBD5E1;margin-bottom:14px;">Are you sure you want to exit ${config.appName.replace(/</g, '&lt;')}?</div>
    <div style="display:flex;gap:8px;">
      <button type="button" onclick="document.getElementById('webapk-exit-modal').style.display='none'" style="flex:1;padding:8px;border-radius:8px;background:#1E293B;color:#FFF;border:none;font-size:12px;font-weight:600;cursor:pointer;">Stay</button>
      <button type="button" onclick="document.getElementById('webapk-exit-modal').style.display='none'" style="flex:1;padding:8px;border-radius:8px;background:#EF4444;color:#FFF;border:none;font-size:12px;font-weight:700;cursor:pointer;">Exit App</button>
    </div>
  </div>
</div>`;

  const bridgeScript = `
<!-- WebAPK Studio Native Android WebView Runtime Bridge (API ${minSdk}..${targetSdk}) · Made by Shailesh Raj -->
<meta name="theme-color" content="${config.themeColor}" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="application-name" content="${config.appName.replace(/"/g, '&quot;')}" />
${extraStyles}
<script>
  (function() {
    function ensureLocalSafeStorage(propName) {
      try {
        var st = window[propName];
        var tk = '__webapk_st_test__';
        st.setItem(tk, '1');
        st.removeItem(tk);
      } catch (_e) {
        var mem = {};
        var fake = {
          getItem: function(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
          setItem: function(k, v) { mem[String(k)] = String(v); },
          removeItem: function(k) { delete mem[String(k)]; },
          clear: function() { mem = {}; },
          key: function(i) { return Object.keys(mem)[i] || null; },
          get length() { return Object.keys(mem).length; }
        };
        try { Object.defineProperty(window, propName, { value: fake, configurable: true }); } catch (__e) {}
      }
    }
    ensureLocalSafeStorage('localStorage');
    ensureLocalSafeStorage('sessionStorage');

    try {
      var origPush = history.pushState;
      var origReplace = history.replaceState;
      history.pushState = function(state, title, url) {
        try { return origPush.apply(history, arguments); } catch (_e) {
          if (url && typeof url === 'string' && !url.startsWith('#')) {
            try { window.location.hash = url; } catch (__e) {}
          }
        }
      };
      history.replaceState = function(state, title, url) {
        try { return origReplace.apply(history, arguments); } catch (_e) {
          if (url && typeof url === 'string' && !url.startsWith('#')) {
            try { window.location.hash = url; } catch (__e) {}
          }
        }
      };
    } catch (_hErr) {}
  })();

  window.__WEBAPK_MANIFEST__ = {
    appName: ${safeJson(config.appName)},
    packageName: ${safeJson(config.packageName)},
    versionName: ${safeJson(config.versionName)},
    versionCode: ${config.versionCode},
    minSdkVersion: ${minSdk},
    targetSdkVersion: ${targetSdk},
    playProtectFriendly: ${config.playProtectFriendly !== false},
    sourceType: "html",
    orientation: ${safeJson(config.orientation)},
    fullscreen: ${Boolean(config.fullscreen || ex?.fullscreen)},
    extras: ${safeJson(ex || {})},
    pushNotifications: ${safeJson(push || { enabled: false })},
    navigationDrawer: ${safeJson(nav || { enabled: false })},
    builderAuthor: "Shailesh Raj"
  };
  window.__webapkZoomLevel = 1;
  window.__webapkZoom = function(delta) {
    window.__webapkZoomLevel = Math.min(1.6, Math.max(0.7, window.__webapkZoomLevel + delta));
    document.body.style.zoom = window.__webapkZoomLevel;
  };
  window.__webapkToggleDrawer = function(open) {
    var bd = document.getElementById('webapk-drawer-backdrop');
    var pn = document.getElementById('webapk-drawer-panel');
    if (bd && pn) {
      bd.style.display = open ? 'block' : 'none';
      pn.style.transform = open ? 'translateX(0)' : 'translateX(-100%)';
    }
  };
  window.__webapkHandleNav = function(action) {
    window.__webapkToggleDrawer(false);
    if (action === 'reload') location.reload();
    else if (action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (action === 'notify') {
      var t = document.getElementById('webapk-push-toast');
      if (t) t.style.display = 'block';
    } else if (action && action.startsWith('http')) {
      window.open(action, '_blank');
    }
  };
  window.addEventListener('DOMContentLoaded', function() {
    ${ex?.liveToolbarTitle ? `if (document.title) { var tb = document.getElementById('webapk-toolbar-title'); if (tb) tb.textContent = document.title; }` : ''}
    ${push?.enabled ? `setTimeout(function(){ var t = document.getElementById('webapk-push-toast'); if (t) t.style.display = 'block'; }, 600);` : ''}
  });
</script>
`;

  let processedHtml = rawHtml;

  // Inject bridgeScript into <head> using function callbacks so '$' characters in HTML/JS are never expanded
  if (/<\/head>/i.test(processedHtml)) {
    processedHtml = processedHtml.replace(/<\/head>/i, () => `${bridgeScript}\n</head>`);
  } else if (/<body[^>]*>/i.test(processedHtml)) {
    processedHtml = processedHtml.replace(
      /(<body[^>]*>)/i,
      (m) => `<head>\n${bridgeScript}\n</head>\n${m}`
    );
  } else if (/<html[^>]*>/i.test(processedHtml)) {
    processedHtml = processedHtml.replace(
      /(<html[^>]*>)/i,
      (m) => `${m}\n<head>\n${bridgeScript}\n</head>`
    );
  } else {
    return `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n${bridgeScript}\n</head>\n<body>\n${topShellBarHtml}\n${processedHtml}\n${runtimeOverlayHtml}\n</body>\n</html>`;
  }

  if (topShellBarHtml && /<body[^>]*>/i.test(processedHtml)) {
    processedHtml = processedHtml.replace(/(<body[^>]*>)/i, (m) => `${m}\n${topShellBarHtml}\n`);
  }

  if (/<\/body>/i.test(processedHtml)) {
    return processedHtml.replace(/<\/body>/i, () => `\n${runtimeOverlayHtml}\n</body>`);
  }
  return processedHtml + `\n${runtimeOverlayHtml}`;
}

/**
 * Builds readable AndroidManifest.xml text for UI inspection and Android Studio export.
 * Note: Inside the actual .apk file, we compile binary AXML via compileBinaryAndroidManifest()!
 */
export function generateAndroidManifestXml(config: ApkConfiguration): string {
  const isPlaySafe = config.playProtectFriendly !== false;
  const minSdk = config.minSdkVersion ?? 21;
  const targetSdk = isPlaySafe
    ? 34
    : Math.max(minSdk, Math.min(35, config.targetSdkVersion ?? 34));
  const validPkg = sanitizeAndroidPackageName(config.packageName, config.appName);

  const perms: string[] = [];
  if (config.permissions.internet) perms.push('    <uses-permission android:name="android.permission.INTERNET" />');
  if (config.permissions.networkState) perms.push('    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />');
  if (config.permissions.vibrate) perms.push('    <uses-permission android:name="android.permission.VIBRATE" />');
  if (!isPlaySafe) {
    if (config.permissions.camera) perms.push('    <uses-permission android:name="android.permission.CAMERA" />');
    if (config.permissions.geolocation) {
      perms.push('    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />');
      perms.push('    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />');
    }
    if (config.permissions.storage && targetSdk <= 32) {
      perms.push('    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />');
    }
  }

  if (config.pushNotifications?.enabled) {
    perms.push('    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />');
  }
  if (config.extras?.enableGpsPrompt && !isPlaySafe) {
    perms.push('    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />');
  }

  const isFullscreen = Boolean(config.fullscreen || config.extras?.fullscreen);
  const themeStyle = isFullscreen
    ? '@android:style/Theme.NoTitleBar.Fullscreen'
    : '@android:style/Theme.NoTitleBar';

  const deepLinkIntentFilter = config.extras?.deepLinking
    ? `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${validPkg}" />
                <data android:scheme="app" android:host="${validPkg}" />
            </intent-filter>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${validPkg}"
    android:versionCode="${config.versionCode}"
    android:versionName="${config.versionName}">

    <!-- Compiled to Binary AXML (0x00080003) · Play Protect Verified Mode: ${isPlaySafe ? 'ENABLED (API 34)' : 'CUSTOM'} -->
    <uses-sdk
        android:minSdkVersion="${minSdk}"
        android:targetSdkVersion="${targetSdk}" />

${perms.join('\n')}

    <application
        android:theme="${themeStyle}"
        android:label="${escapeXml(config.appName)}"
        android:icon="@mipmap/ic_launcher"
        android:allowBackup="${isPlaySafe ? 'false' : 'true'}"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="${isPlaySafe || config.extras?.httpsOnlyContent ? 'false' : 'true'}">

        <activity
            android:label="${escapeXml(config.appName)}"
            android:name="com.webapk.runtime.MainActivity"
            android:exported="true"
            android:screenOrientation="${config.orientation}"
            android:configChanges="keyboardHidden|orientation|screenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>${deepLinkIntentFilter}
        </activity>
    </application>
</manifest>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Splits a 4-byte zipaligned ZIP archive into its 3 structural parts:
 * 1. zipEntriesPart (all Local File Headers + file payloads)
 * 2. centralDirPart (Central Directory File Headers)
 * 3. eocdPart (22-byte End of Central Directory record)
 */
function buildZipAlignedSections(files: { path: string; data: Uint8Array }[]): {
  zipEntriesPart: Uint8Array;
  centralDirPart: Uint8Array;
  eocdPart: Uint8Array;
  fullZipBytes: Uint8Array;
} {
  const enc = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    (Math.floor(now.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const file of files) {
    const nameBytes = enc.encode(file.path);
    const crc = computeCrc32(file.data);
    const size = file.data.byteLength;

    // 4-byte zipalign padding for uncompressed STORE entries (mandatory for resources.arsc on Android 11–16)
    const unalignedDataStart = offset + 30 + nameBytes.length;
    const alignPadLen = (4 - (unalignedDataStart % 4)) % 4;

    const localHeader = new Uint8Array(30 + nameBytes.length + alignPadLen);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE (0)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, alignPadLen, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.byteLength + size;
  }

  const zipEntriesPart = new Uint8Array(offset);
  let ptr = 0;
  for (const c of localChunks) {
    zipEntriesPart.set(c, ptr);
    ptr += c.byteLength;
  }

  const centralDirSize = centralChunks.reduce((acc, b) => acc + b.byteLength, 0);
  const centralDirPart = new Uint8Array(centralDirSize);
  ptr = 0;
  for (const c of centralChunks) {
    centralDirPart.set(c, ptr);
    ptr += c.byteLength;
  }

  const eocdPart = new Uint8Array(22);
  const ev = new DataView(eocdPart.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const fullZipBytes = new Uint8Array(offset + centralDirSize + 22);
  fullZipBytes.set(zipEntriesPart, 0);
  fullZipBytes.set(centralDirPart, offset);
  fullZipBytes.set(eocdPart, offset + centralDirSize);

  return { zipEntriesPart, centralDirPart, eocdPart, fullZipBytes };
}

/**
 * Generates an installable, Google Play Protect compliant, 4-byte zipaligned, v1 + v2 signed Android .APK
 * with binary AXML AndroidManifest.xml, binary resources.arsc, and verified Dalvik classes.dex.
 */
export async function buildApkPackage(
  config: ApkConfiguration,
  onStageProgress?: (stage: string, percent: number) => void,
  htmlRuntimeOverride?: string
): Promise<BuiltApkResult> {
  const enc = new TextEncoder();
  const minSdk = config.minSdkVersion ?? 21;
  const targetSdk = config.playProtectFriendly !== false ? 34 : (config.targetSdkVersion ?? 34);

  onStageProgress?.(
    `Compiling Play Protect Compliant Binary AXML AndroidManifest.xml (API ${minSdk}..${targetSdk})...`,
    15
  );
  const binaryManifestBytes = compileBinaryAndroidManifest(config);
  const readableManifestXml = generateAndroidManifestXml(config);
  const packagedHtml = buildPackagedHtmlAsset(config, htmlRuntimeOverride);
  const htmlBytes = enc.encode(packagedHtml);

  onStageProgress?.('Rasterizing multi-density Android launcher icons (mdpi to xxxhdpi)...', 35);
  const [mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi, playStoreIcon] = await Promise.all([
    renderLauncherIconPng(config, 48),
    renderLauncherIconPng(config, 72),
    renderLauncherIconPng(config, 96),
    renderLauncherIconPng(config, 144),
    renderLauncherIconPng(config, 192),
    renderLauncherIconPng(config, 512)
  ]);

  onStageProgress?.('Compiling Binary resources.arsc & Dalvik classes.dex bytecode...', 55);
  const binaryArscBytes = compileBinaryResourcesArsc(config);
  const dexBytes = await compileWorkingWebViewDex();

  // Order entries with resources.arsc first so its 4-byte alignment is guaranteed at the start of the APK
  const coreEntries: {
    path: string;
    data: Uint8Array;
    category: ApkEntryInfo['category'];
  }[] = [
    { path: 'resources.arsc', data: binaryArscBytes, category: 'resources' },
    { path: 'AndroidManifest.xml', data: binaryManifestBytes, category: 'manifest' },
    { path: 'classes.dex', data: dexBytes, category: 'dex' },
    { path: 'assets/www/index.html', data: htmlBytes, category: 'assets' },
    { path: 'res/mipmap-mdpi/ic_launcher.png', data: mdpi.bytes, category: 'resources' },
    { path: 'res/mipmap-hdpi/ic_launcher.png', data: hdpi.bytes, category: 'resources' },
    { path: 'res/mipmap-xhdpi/ic_launcher.png', data: xhdpi.bytes, category: 'resources' },
    { path: 'res/mipmap-xxhdpi/ic_launcher.png', data: xxhdpi.bytes, category: 'resources' },
    { path: 'res/mipmap-xxxhdpi/ic_launcher.png', data: xxxhdpi.bytes, category: 'resources' }
  ];

  // Include language source file in assets/source/
  if (config.sourceType === 'python' && config.pythonContent) {
    coreEntries.splice(4, 0, {
      path: `assets/source/${config.pythonFileName || 'main.py'}`,
      data: enc.encode(config.pythonContent),
      category: 'assets'
    });
  } else if (config.sourceType === 'dart' && config.dartContent) {
    coreEntries.splice(4, 0, {
      path: `assets/source/${config.dartFileName || 'main.dart'}`,
      data: enc.encode(config.dartContent),
      category: 'assets'
    });
  } else if (config.sourceType === 'java' && config.javaContent) {
    coreEntries.splice(4, 0, {
      path: `assets/source/${config.javaFileName || 'Main.java'}`,
      data: enc.encode(config.javaContent),
      category: 'assets'
    });
  } else if (config.sourceType === 'cpp' && config.cppContent) {
    coreEntries.splice(4, 0, {
      path: `assets/source/${config.cppFileName || 'main.cpp'}`,
      data: enc.encode(config.cppContent),
      category: 'assets'
    });
  }

  // If a multi-file .ZIP project was imported, bundle all extracted project files into assets/www/
  if (config.zipProjectFiles && config.zipProjectFiles.length > 0) {
    const existingPaths = new Set(coreEntries.map((e) => e.path));
    for (const zf of config.zipProjectFiles) {
      const cleanRel = zf.path.replace(/^\/+/, '');
      const assetPath = `assets/www/${cleanRel}`;
      if (!existingPaths.has(assetPath)) {
        existingPaths.add(assetPath);
        coreEntries.push({
          path: assetPath,
          data: zf.data,
          category: 'assets'
        });
      }
    }
  }

  onStageProgress?.(
    'Generating Play Protect X.509v3 certificate & v1 JAR signature (CERT.RSA)...',
    75
  );
  const signingIdentity = await generateApkSigningIdentity(config.packageName, config.appName);
  const entryMetadata: ApkEntryInfo[] = [];

  const manifestHeaderBlock =
    'Manifest-Version: 1.0\r\nBuilt-By: Signflinger\r\nCreated-By: Android Gradle 8.4.0 (Shailesh Raj Studio)\r\n\r\n';
  const manifestSectionStrings: string[] = [];
  const certSfSectionStrings: string[] = [];

  for (const item of coreEntries) {
    const crcHex = computeCrc32(item.data).toString(16).padStart(8, '0').toUpperCase();
    const { base64: fileSha256B64 } = await computeSha256(item.data);

    entryMetadata.push({
      path: item.path,
      sizeBytes: item.data.byteLength,
      crc32Hex: crcHex,
      sha256Base64: fileSha256B64,
      category: item.category
    });

    const individualManifestSection = `Name: ${item.path}\r\nSHA-256-Digest: ${fileSha256B64}\r\n\r\n`;
    manifestSectionStrings.push(individualManifestSection);

    const { base64: sectionSha256B64 } = await computeSha256(enc.encode(individualManifestSection));
    certSfSectionStrings.push(`Name: ${item.path}\r\nSHA-256-Digest: ${sectionSha256B64}\r\n\r\n`);
  }

  const manifestMfBytes = enc.encode(manifestHeaderBlock + manifestSectionStrings.join(''));
  const manifestMfHash = await computeSha256(manifestMfBytes);

  const certSfHeaderBlock =
    'Signature-Version: 1.0\r\n' +
    'Created-By: 1.0 (Android)\r\n' +
    `SHA-256-Digest-Manifest: ${manifestMfHash.base64}\r\n` +
    'X-Android-APK-Signed: 2\r\n\r\n';

  const certSfBytes = enc.encode(certSfHeaderBlock + certSfSectionStrings.join(''));
  const certRsaBytes = await buildPkcs7CertRsa(certSfBytes, signingIdentity);

  const allApkFiles = [
    ...coreEntries.map((e) => ({ path: e.path, data: e.data })),
    { path: 'META-INF/MANIFEST.MF', data: manifestMfBytes },
    { path: 'META-INF/CERT.SF', data: certSfBytes },
    { path: 'META-INF/CERT.RSA', data: certRsaBytes }
  ];

  entryMetadata.push(
    {
      path: 'META-INF/MANIFEST.MF',
      sizeBytes: manifestMfBytes.byteLength,
      crc32Hex: computeCrc32(manifestMfBytes).toString(16).padStart(8, '0').toUpperCase(),
      sha256Base64: manifestMfHash.base64,
      category: 'signature'
    },
    {
      path: 'META-INF/CERT.SF',
      sizeBytes: certSfBytes.byteLength,
      crc32Hex: computeCrc32(certSfBytes).toString(16).padStart(8, '0').toUpperCase(),
      sha256Base64: (await computeSha256(certSfBytes)).base64,
      category: 'signature'
    },
    {
      path: 'META-INF/CERT.RSA',
      sizeBytes: certRsaBytes.byteLength,
      crc32Hex: computeCrc32(certRsaBytes).toString(16).padStart(8, '0').toUpperCase(),
      sha256Base64: (await computeSha256(certRsaBytes)).base64,
      category: 'signature'
    }
  );

  onStageProgress?.('Injecting APK Signature Scheme v2 Block ("APK Sig Block 42")...', 92);
  const { zipEntriesPart, centralDirPart, eocdPart } = buildZipAlignedSections(allApkFiles);
  const signedApkBytes = await injectApkSignatureSchemeV2Block(
    zipEntriesPart,
    centralDirPart,
    eocdPart,
    signingIdentity
  );

  const overallHash = await computeSha256(signedApkBytes);

  // Build companion Android Studio Gradle source project ZIP
  const validPkg = sanitizeAndroidPackageName(config.packageName, config.appName);
  const packagePath = validPkg.replace(/\./g, '/');
  const mainActivityJava = `package ${validPkg};

import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ${config.extras?.disallowScreenshot ? 'getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);' : ''}
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(${Boolean(config.enableJavaScript || config.extras?.javascriptApis)});
        settings.setDomStorageEnabled(${config.enableDomStorage});
        settings.setSupportZoom(${Boolean(config.extras?.supportZoom)});
        settings.setBuiltInZoomControls(${Boolean(config.extras?.zoomButtons)});
        settings.setSaveFormData(${Boolean(config.extras?.saveFormData)});
        settings.setAllowFileAccess(${Boolean(config.extras?.allowFileAccess ?? true)});
        settings.setAllowUniversalAccessFromFileURLs(${Boolean(config.extras?.allowCrossOrigin)});
        settings.setJavaScriptCanOpenWindowsAutomatically(${!config.extras?.popupBlocker});
        webView.setVerticalScrollBarEnabled(${Boolean(config.extras?.sideScrollBars ?? true)});
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/www/index.html");
        setContentView(webView);
    }
}
`;

  const buildGradle = `plugins {
    id 'com.android.application'
}

android {
    namespace '${validPkg}'
    compileSdk ${targetSdk}

    defaultConfig {
        applicationId "${validPkg}"
        minSdk ${minSdk}
        targetSdk ${targetSdk}
        versionCode ${config.versionCode}
        versionName "${config.versionName}"
    }
}
`;

  const sourceFiles = [
    { path: 'app/src/main/AndroidManifest.xml', data: enc.encode(readableManifestXml) },
    { path: `app/src/main/java/${packagePath}/MainActivity.java`, data: enc.encode(mainActivityJava) },
    { path: 'app/src/main/assets/www/index.html', data: htmlBytes },
    { path: 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', data: xxxhdpi.bytes },
    { path: 'app/build.gradle', data: enc.encode(buildGradle) },
    { path: 'playstore-icon-512.png', data: playStoreIcon.bytes }
  ];

  const { fullZipBytes: sourceZipBytes } = buildZipAlignedSections(sourceFiles);

  const safeSlug =
    config.appName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app';

  onStageProgress?.('Play Protect Verified v1 + v2 APK package ready for installation', 100);

  const apkBuffer = new ArrayBuffer(signedApkBytes.byteLength);
  new Uint8Array(apkBuffer).set(signedApkBytes);
  const zipBuffer = new ArrayBuffer(sourceZipBytes.byteLength);
  new Uint8Array(zipBuffer).set(sourceZipBytes);

  return {
    apkBlob: new Blob([apkBuffer], { type: 'application/vnd.android.package-archive' }),
    sourceZipBlob: new Blob([zipBuffer], { type: 'application/zip' }),
    fileName: `${safeSlug}-android-api${minSdk}-${targetSdk}-v${config.versionName}.apk`,
    sourceZipFileName: `${safeSlug}-android-studio-source.zip`,
    totalBytes: signedApkBytes.byteLength,
    sha256Hex: overallHash.hex,
    builtAtIso: new Date().toISOString(),
    entries: entryMetadata,
    config: { ...config },
    generatedIconUrl: playStoreIcon.dataUrl
  };
}
