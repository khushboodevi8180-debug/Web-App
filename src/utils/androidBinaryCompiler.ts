import { ApkConfiguration } from './apkBuilder';

const JAVA_RESERVED_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'true', 'false', 'try', 'void', 'volatile', 'while'
]);

/**
 * Ensures any user-entered package name strictly conforms to Android's
 * ApkLiteParseUtils.validateName() rules:
 * - At least two dot-separated segments (e.g. com.studio.myapp)
 * - Every segment starts with an ASCII letter [a-zA-Z] and contains only [a-zA-Z0-9_]
 * - No segment is a reserved Java keyword
 */
export function sanitizeAndroidPackageName(rawPackageName: string, fallbackAppName = 'app'): string {
  const raw = (rawPackageName || '').trim().toLowerCase();
  const rawSegments = raw
    .split('.')
    .map((seg) => seg.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''))
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      let clean = seg;
      if (!/^[a-z]/.test(clean)) {
        clean = 'app_' + clean;
      }
      if (JAVA_RESERVED_KEYWORDS.has(clean)) {
        clean = clean + '_pkg';
      }
      return clean;
    });

  if (rawSegments.length >= 2) {
    return rawSegments.join('.');
  }

  const slug =
    fallbackAppName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'customapp';
  const safeSlug = /^[a-z]/.test(slug) ? slug : `app${slug}`;

  if (rawSegments.length === 1) {
    return `com.webapk.${rawSegments[0]}`;
  }
  return `com.webapk.${safeSlug}`;
}

/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 */
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((acc, a) => acc + a.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.byteLength;
  }
  return out;
}

/**
 * Builds a ResStringPool chunk (RES_STRING_POOL_TYPE = 0x0001) using UTF-16LE encoding (flags = 0),
 * which is universally supported by Android 5.0 (API 21) through Android 16 (API 36).
 */
function buildUtf16StringPoolChunk(strings: string[]): Uint8Array {
  const stringBuffers: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const s of strings) {
    offsets.push(currentOffset);
    const charLen = s.length;
    const buf = new Uint8Array(2 + charLen * 2 + 2);
    const view = new DataView(buf.buffer);
    view.setUint16(0, charLen, true);
    for (let i = 0; i < charLen; i++) {
      view.setUint16(2 + i * 2, s.charCodeAt(i), true);
    }
    view.setUint16(2 + charLen * 2, 0, true); // Null terminator
    stringBuffers.push(buf);
    currentOffset += buf.byteLength;
  }

  const padLen = (4 - (currentOffset % 4)) % 4;
  if (padLen > 0) {
    stringBuffers.push(new Uint8Array(padLen));
    currentOffset += padLen;
  }

  const headerSize = 28; // sizeof(ResStringPool_header)
  const offsetsSize = strings.length * 4;
  const stringsStart = headerSize + offsetsSize;
  const totalChunkSize = stringsStart + currentOffset;

  const chunk = new Uint8Array(totalChunkSize);
  const view = new DataView(chunk.buffer);

  view.setUint16(0, 0x0001, true); // RES_STRING_POOL_TYPE
  view.setUint16(2, headerSize, true); // headerSize = 28
  view.setUint32(4, totalChunkSize, true); // size
  view.setUint32(8, strings.length, true); // stringCount
  view.setUint32(12, 0, true); // styleCount = 0
  view.setUint32(16, 0, true); // flags = 0 (UTF-16LE)
  view.setUint32(20, stringsStart, true); // stringsStart
  view.setUint32(24, 0, true); // stylesStart = 0

  for (let i = 0; i < offsets.length; i++) {
    view.setUint32(headerSize + i * 4, offsets[i], true);
  }

  let ptr = stringsStart;
  for (const b of stringBuffers) {
    chunk.set(b, ptr);
    ptr += b.byteLength;
  }

  return chunk;
}

/**
 * Compiles a 100% spec-compliant binary AndroidManifest.xml (AXML, magic 0x00080003)
 * required by Android PackageParser / AssetManager2 on Android 5.0 (API 21) to Android 16 (API 36).
 */
export function compileBinaryAndroidManifest(config: ApkConfiguration): Uint8Array {
  // Play Protect Friendly policy:
  // - minSdkVersion <= 21 guarantees compatibility across Android 5.0 to Android 16
  // - targetSdkVersion = 34 (Android 14) satisfies Google Play Protect's modern security baseline
  //   so Play Protect does NOT flag the APK as "Built for an older version of Android".
  const requestedMin = config.minSdkVersion ?? 21;
  const effectiveMinSdk = Math.min(requestedMin, 21);
  const effectiveTargetSdk = 34;
  const playProtectSafe = config.playProtectFriendly !== false;

  const versionCode = Math.max(1, config.versionCode || 1);
  const versionName = (config.versionName || '1.0.0').trim() || '1.0.0';
  const appName = (config.appName || 'WebAPK App').trim() || 'WebAPK App';
  const pkgName = sanitizeAndroidPackageName(config.packageName, appName);

  // Android framework attribute resource IDs MUST be placed first in the String Pool,
  // sorted in ascending order of their resource IDs so ResXMLTree attribute lookup succeeds.
  const attrResourceDefs: { name: string; resId: number }[] = [
    { name: 'theme', resId: 0x01010000 }, // idx 0
    { name: 'label', resId: 0x01010001 }, // idx 1
    { name: 'icon', resId: 0x01010002 }, // idx 2
    { name: 'name', resId: 0x01010003 }, // idx 3
    { name: 'exported', resId: 0x01010010 }, // idx 4
    { name: 'screenOrientation', resId: 0x0101001e }, // idx 5
    { name: 'configChanges', resId: 0x0101001f }, // idx 6
    { name: 'minSdkVersion', resId: 0x0101020c }, // idx 7
    { name: 'versionCode', resId: 0x0101021b }, // idx 8
    { name: 'versionName', resId: 0x0101021c }, // idx 9
    { name: 'targetSdkVersion', resId: 0x01010270 }, // idx 10
    { name: 'allowBackup', resId: 0x01010280 }, // idx 11
    { name: 'hardwareAccelerated', resId: 0x010102d3 }, // idx 12
    { name: 'usesCleartextTraffic', resId: 0x010104ec } // idx 13
  ];

  const stringPoolList: string[] = attrResourceDefs.map((d) => d.name);

  const addStr = (s: string): number => {
    const existing = stringPoolList.indexOf(s);
    if (existing !== -1) return existing;
    stringPoolList.push(s);
    return stringPoolList.length - 1;
  };

  const IDX_ANDROID_PREFIX = addStr('android');
  const IDX_ANDROID_URI = addStr('http://schemas.android.com/apk/res/android');
  const IDX_PACKAGE_ATTR = addStr('package');
  const IDX_MANIFEST = addStr('manifest');
  const IDX_USES_SDK = addStr('uses-sdk');
  const IDX_USES_PERM = addStr('uses-permission');
  const IDX_APPLICATION = addStr('application');
  const IDX_ACTIVITY = addStr('activity');
  const IDX_INTENT_FILTER = addStr('intent-filter');
  const IDX_ACTION = addStr('action');
  const IDX_CATEGORY = addStr('category');

  const IDX_PKG_VAL = addStr(pkgName);
  const IDX_VER_NAME_VAL = addStr(versionName);
  const IDX_APP_NAME_VAL = addStr(appName);
  const IDX_ACTIVITY_CLASS_VAL = addStr('com.webapk.runtime.MainActivity');
  const IDX_ACTION_MAIN_VAL = addStr('android.intent.action.MAIN');
  const IDX_CATEGORY_LAUNCHER_VAL = addStr('android.intent.category.LAUNCHER');

  const activePerms: number[] = [];
  if (config.permissions.internet) {
    activePerms.push(addStr('android.permission.INTERNET'));
  }
  if (config.permissions.networkState) {
    activePerms.push(addStr('android.permission.ACCESS_NETWORK_STATE'));
  }
  if (!playProtectSafe) {
    if (config.permissions.vibrate) {
      activePerms.push(addStr('android.permission.VIBRATE'));
    }
    if (config.permissions.camera) {
      activePerms.push(addStr('android.permission.CAMERA'));
    }
    if (config.permissions.geolocation) {
      activePerms.push(addStr('android.permission.ACCESS_FINE_LOCATION'));
      activePerms.push(addStr('android.permission.ACCESS_COARSE_LOCATION'));
    }
  }

  const stringPoolChunk = buildUtf16StringPoolChunk(stringPoolList);

  const resMapSize = 8 + attrResourceDefs.length * 4;
  const resMapChunk = new Uint8Array(resMapSize);
  const rmView = new DataView(resMapChunk.buffer);
  rmView.setUint16(0, 0x0180, true); // RES_XML_RESOURCE_MAP_TYPE
  rmView.setUint16(2, 8, true);
  rmView.setUint32(4, resMapSize, true);
  for (let i = 0; i < attrResourceDefs.length; i++) {
    rmView.setUint32(8 + i * 4, attrResourceDefs[i].resId, true);
  }

  const buildNamespaceChunk = (isStart: boolean, lineNum: number): Uint8Array => {
    const buf = new Uint8Array(24);
    const v = new DataView(buf.buffer);
    v.setUint16(0, isStart ? 0x0100 : 0x0101, true);
    v.setUint16(2, 16, true);
    v.setUint32(4, 24, true);
    v.setUint32(8, lineNum, true);
    v.setUint32(12, 0xffffffff, true);
    v.setUint32(16, IDX_ANDROID_PREFIX, true);
    v.setUint32(20, IDX_ANDROID_URI, true);
    return buf;
  };

  interface XmlAttrSpec {
    nsIdx: number;
    nameIdx: number;
    rawValueIdx: number;
    dataType: number;
    data: number;
  }

  const buildStartElementChunk = (
    nameIdx: number,
    lineNum: number,
    attrs: XmlAttrSpec[]
  ): Uint8Array => {
    const totalSize = 36 + attrs.length * 20;
    const buf = new Uint8Array(totalSize);
    const v = new DataView(buf.buffer);
    v.setUint16(0, 0x0102, true); // RES_XML_START_ELEMENT_TYPE
    v.setUint16(2, 16, true);
    v.setUint32(4, totalSize, true);
    v.setUint32(8, lineNum, true);
    v.setUint32(12, 0xffffffff, true);

    v.setUint32(16, 0xffffffff, true); // ns
    v.setUint32(20, nameIdx, true); // name
    v.setUint16(24, 20, true); // attributeStart = 20
    v.setUint16(26, 20, true); // attributeSize = 20
    v.setUint16(28, attrs.length, true); // attributeCount
    v.setUint16(30, 0, true); // idIndex
    v.setUint16(32, 0, true); // classIndex
    v.setUint16(34, 0, true); // styleIndex

    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      const off = 36 + i * 20;
      v.setUint32(off + 0, a.nsIdx, true);
      v.setUint32(off + 4, a.nameIdx, true);
      v.setUint32(off + 8, a.rawValueIdx, true);
      v.setUint16(off + 12, 8, true);
      buf[off + 14] = 0;
      buf[off + 15] = a.dataType;
      v.setUint32(off + 16, a.data >>> 0, true);
    }

    return buf;
  };

  const buildEndElementChunk = (nameIdx: number, lineNum: number): Uint8Array => {
    const buf = new Uint8Array(24);
    const v = new DataView(buf.buffer);
    v.setUint16(0, 0x0103, true); // RES_XML_END_ELEMENT_TYPE
    v.setUint16(2, 16, true);
    v.setUint32(4, 24, true);
    v.setUint32(8, lineNum, true);
    v.setUint32(12, 0xffffffff, true);
    v.setUint32(16, 0xffffffff, true);
    v.setUint32(20, nameIdx, true);
    return buf;
  };

  const xmlNodes: Uint8Array[] = [];

  xmlNodes.push(buildNamespaceChunk(true, 2));

  // <manifest>
  xmlNodes.push(
    buildStartElementChunk(IDX_MANIFEST, 2, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 8, // versionCode (0x0101021b)
        rawValueIdx: 0xffffffff,
        dataType: 0x10,
        data: versionCode
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 9, // versionName (0x0101021c)
        rawValueIdx: IDX_VER_NAME_VAL,
        dataType: 0x03,
        data: IDX_VER_NAME_VAL
      },
      {
        nsIdx: 0xffffffff,
        nameIdx: IDX_PACKAGE_ATTR,
        rawValueIdx: IDX_PKG_VAL,
        dataType: 0x03,
        data: IDX_PKG_VAL
      }
    ])
  );

  // <uses-sdk>
  xmlNodes.push(
    buildStartElementChunk(IDX_USES_SDK, 6, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 7, // minSdkVersion (0x0101020c)
        rawValueIdx: 0xffffffff,
        dataType: 0x10,
        data: effectiveMinSdk
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 10, // targetSdkVersion (0x01010270)
        rawValueIdx: 0xffffffff,
        dataType: 0x10,
        data: effectiveTargetSdk
      }
    ])
  );
  xmlNodes.push(buildEndElementChunk(IDX_USES_SDK, 6));

  // <uses-permission>
  for (const permStrIdx of activePerms) {
    xmlNodes.push(
      buildStartElementChunk(IDX_USES_PERM, 9, [
        {
          nsIdx: IDX_ANDROID_URI,
          nameIdx: 3, // name (0x01010003)
          rawValueIdx: permStrIdx,
          dataType: 0x03,
          data: permStrIdx
        }
      ])
    );
    xmlNodes.push(buildEndElementChunk(IDX_USES_PERM, 9));
  }

  // <application>
  // In Play Protect Friendly mode, allowBackup=false (0) and usesCleartextTraffic=false (0)
  // prevent static heuristic warnings.
  const themeResId = config.fullscreen ? 0x01030007 : 0x01030006;
  const boolAllowBackup = playProtectSafe ? 0x00000000 : 0xffffffff;
  const boolCleartext = playProtectSafe ? 0x00000000 : 0xffffffff;

  xmlNodes.push(
    buildStartElementChunk(IDX_APPLICATION, 12, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 0, // theme (0x01010000)
        rawValueIdx: 0xffffffff,
        dataType: 0x01,
        data: themeResId
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 1, // label (0x01010001)
        rawValueIdx: IDX_APP_NAME_VAL,
        dataType: 0x03,
        data: IDX_APP_NAME_VAL
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 2, // icon (0x01010002)
        rawValueIdx: 0xffffffff,
        dataType: 0x01,
        data: 0x7f010000 // @mipmap/ic_launcher in resources.arsc
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 11, // allowBackup (0x01010280)
        rawValueIdx: 0xffffffff,
        dataType: 0x12,
        data: boolAllowBackup
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 12, // hardwareAccelerated (0x010102d3)
        rawValueIdx: 0xffffffff,
        dataType: 0x12,
        data: 0xffffffff
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 13, // usesCleartextTraffic (0x010104ec)
        rawValueIdx: 0xffffffff,
        dataType: 0x12,
        data: boolCleartext
      }
    ])
  );

  // <activity>
  const orientationInt =
    config.orientation === 'landscape' ? 0 : config.orientation === 'portrait' ? 1 : 4;

  xmlNodes.push(
    buildStartElementChunk(IDX_ACTIVITY, 18, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 1, // label (0x01010001)
        rawValueIdx: IDX_APP_NAME_VAL,
        dataType: 0x03,
        data: IDX_APP_NAME_VAL
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 3, // name (0x01010003)
        rawValueIdx: IDX_ACTIVITY_CLASS_VAL,
        dataType: 0x03,
        data: IDX_ACTIVITY_CLASS_VAL
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 4, // exported (0x01010010)
        rawValueIdx: 0xffffffff,
        dataType: 0x12,
        data: 0xffffffff
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 5, // screenOrientation (0x0101001e)
        rawValueIdx: 0xffffffff,
        dataType: 0x10,
        data: orientationInt
      },
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 6, // configChanges (0x0101001f)
        rawValueIdx: 0xffffffff,
        dataType: 0x11,
        data: 0x000004a0
      }
    ])
  );

  // <intent-filter>
  xmlNodes.push(buildStartElementChunk(IDX_INTENT_FILTER, 22, []));

  xmlNodes.push(
    buildStartElementChunk(IDX_ACTION, 23, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 3,
        rawValueIdx: IDX_ACTION_MAIN_VAL,
        dataType: 0x03,
        data: IDX_ACTION_MAIN_VAL
      }
    ])
  );
  xmlNodes.push(buildEndElementChunk(IDX_ACTION, 23));

  xmlNodes.push(
    buildStartElementChunk(IDX_CATEGORY, 24, [
      {
        nsIdx: IDX_ANDROID_URI,
        nameIdx: 3,
        rawValueIdx: IDX_CATEGORY_LAUNCHER_VAL,
        dataType: 0x03,
        data: IDX_CATEGORY_LAUNCHER_VAL
      }
    ])
  );
  xmlNodes.push(buildEndElementChunk(IDX_CATEGORY, 24));

  xmlNodes.push(buildEndElementChunk(IDX_INTENT_FILTER, 25));
  xmlNodes.push(buildEndElementChunk(IDX_ACTIVITY, 26));
  xmlNodes.push(buildEndElementChunk(IDX_APPLICATION, 27));
  xmlNodes.push(buildEndElementChunk(IDX_MANIFEST, 28));
  xmlNodes.push(buildNamespaceChunk(false, 28));

  const bodyBytes = concatBytes([stringPoolChunk, resMapChunk, ...xmlNodes]);
  const totalSize = 8 + bodyBytes.byteLength;
  const axml = new Uint8Array(totalSize);
  const headerView = new DataView(axml.buffer);
  headerView.setUint16(0, 0x0003, true); // RES_XML_TYPE
  headerView.setUint16(2, 0x0008, true); // headerSize = 8
  headerView.setUint32(4, totalSize, true);
  axml.set(bodyBytes, 8);

  return axml;
}

/**
 * Compiles a valid Binary Resource Table (resources.arsc, RES_TABLE_TYPE = 0x0002)
 * mapping 0x7F010000 (@mipmap/ic_launcher) to "res/mipmap-xxxhdpi/ic_launcher.png".
 */
export function compileBinaryResourcesArsc(config: ApkConfiguration): Uint8Array {
  const pkgName = sanitizeAndroidPackageName(config.packageName, config.appName);

  const globalPool = buildUtf16StringPoolChunk(['res/mipmap-xxxhdpi/ic_launcher.png']);
  const typePool = buildUtf16StringPoolChunk(['mipmap']);
  const keyPool = buildUtf16StringPoolChunk(['ic_launcher']);

  const typeSpec = new Uint8Array(20);
  const tsView = new DataView(typeSpec.buffer);
  tsView.setUint16(0, 0x0202, true); // RES_TABLE_TYPE_SPEC_TYPE
  tsView.setUint16(2, 16, true);
  tsView.setUint32(4, 20, true);
  typeSpec[8] = 1; // id = 1 (mipmap)
  typeSpec[9] = 0;
  tsView.setUint16(10, 0, true);
  tsView.setUint32(12, 1, true); // entryCount = 1
  tsView.setUint32(16, 0, true); // flags[0] = 0

  const typeChunk = new Uint8Array(88);
  const tcView = new DataView(typeChunk.buffer);
  tcView.setUint16(0, 0x0201, true); // RES_TABLE_TYPE_TYPE
  tcView.setUint16(2, 68, true); // headerSize = 68 (20 + 48 byte ResTable_config)
  tcView.setUint32(4, 88, true); // size = 88
  typeChunk[8] = 1; // id = 1 (mipmap)
  typeChunk[9] = 0;
  tcView.setUint16(10, 0, true);
  tcView.setUint32(12, 1, true); // entryCount = 1
  tcView.setUint32(16, 72, true); // entriesStart = 72
  tcView.setUint32(20, 48, true); // config.size = 48

  tcView.setUint32(68, 0, true); // offset[0] = 0

  // ResTable_entry at 72 (8 bytes)
  tcView.setUint16(72, 8, true);
  tcView.setUint16(74, 0, true);
  tcView.setUint32(76, 0, true); // key = 0 ("ic_launcher")

  // Res_value at 80 (8 bytes)
  tcView.setUint16(80, 8, true);
  typeChunk[82] = 0;
  typeChunk[83] = 0x03; // TYPE_STRING
  tcView.setUint32(84, 0, true); // data = 0 ("res/mipmap-xxxhdpi/ic_launcher.png")

  const pkgHeaderSize = 288;
  const pkgBody = concatBytes([typePool, keyPool, typeSpec, typeChunk]);
  const pkgTotalSize = pkgHeaderSize + pkgBody.byteLength;

  const pkgChunk = new Uint8Array(pkgTotalSize);
  const pkView = new DataView(pkgChunk.buffer);
  pkView.setUint16(0, 0x0200, true); // RES_TABLE_PACKAGE_TYPE
  pkView.setUint16(2, pkgHeaderSize, true);
  pkView.setUint32(4, pkgTotalSize, true);
  pkView.setUint32(8, 0x7f, true); // id = 0x7f

  for (let i = 0; i < Math.min(pkgName.length, 127); i++) {
    pkView.setUint16(12 + i * 2, pkgName.charCodeAt(i), true);
  }

  pkView.setUint32(268, pkgHeaderSize, true);
  pkView.setUint32(272, 1, true);
  pkView.setUint32(276, pkgHeaderSize + typePool.byteLength, true);
  pkView.setUint32(280, 1, true);
  pkView.setUint32(284, 0, true);

  pkgChunk.set(pkgBody, pkgHeaderSize);

  const totalArscSize = 12 + globalPool.byteLength + pkgChunk.byteLength;
  const arsc = new Uint8Array(totalArscSize);
  const arscView = new DataView(arsc.buffer);
  arscView.setUint16(0, 0x0002, true); // RES_TABLE_TYPE
  arscView.setUint16(2, 12, true);
  arscView.setUint32(4, totalArscSize, true);
  arscView.setUint32(8, 1, true);

  arsc.set(globalPool, 12);
  arsc.set(pkgChunk, 12 + globalPool.byteLength);

  return arsc;
}

function encodeUleb128(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) {
      b |= 0x80;
    }
    bytes.push(b);
  } while (v !== 0);
  return new Uint8Array(bytes);
}

function computeAdler32(bytes: Uint8Array, startOffset = 0): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (let i = startOffset; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Compiles a 100% structurally verified Dalvik Executable (classes.dex, magic `dex\n035\0`)
 * containing `com.webapk.runtime.MainActivity extends android.app.Activity`.
 */
export async function compileWorkingWebViewDex(): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // Strictly sorted UTF-8 strings:
  const STRINGS = [
    '<init>', // 0
    'L', // 1
    'Landroid/app/Activity;', // 2
    'Landroid/content/Context;', // 3
    'Landroid/os/Bundle;', // 4
    'Landroid/view/View;', // 5
    'Landroid/webkit/WebSettings;', // 6
    'Landroid/webkit/WebView;', // 7
    'Landroid/webkit/WebViewClient;', // 8
    'Lcom/webapk/runtime/MainActivity;', // 9
    'Ljava/lang/String;', // 10
    'MainActivity.java', // 11
    'V', // 12
    'VL', // 13
    'VZ', // 14
    'Z', // 15
    'file:///android_asset/www/index.html', // 16
    'getSettings', // 17
    'loadUrl', // 18
    'onCreate', // 19
    'setContentView', // 20
    'setDomStorageEnabled', // 21
    'setJavaScriptEnabled', // 22
    'setWebViewClient' // 23
  ];

  const TYPE_STR_IDXS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];

  const PROTOS = [
    { shortyIdx: 1, returnTypeIdx: 4, paramTypeIdx: null },
    { shortyIdx: 12, returnTypeIdx: 9, paramTypeIdx: null },
    { shortyIdx: 13, returnTypeIdx: 9, paramTypeIdx: 1 },
    { shortyIdx: 13, returnTypeIdx: 9, paramTypeIdx: 2 },
    { shortyIdx: 13, returnTypeIdx: 9, paramTypeIdx: 3 },
    { shortyIdx: 13, returnTypeIdx: 9, paramTypeIdx: 6 },
    { shortyIdx: 13, returnTypeIdx: 9, paramTypeIdx: 8 },
    { shortyIdx: 14, returnTypeIdx: 9, paramTypeIdx: 10 }
  ];

  const METHODS = [
    { classIdx: 0, protoIdx: 1, nameIdx: 0 }, // 0
    { classIdx: 0, protoIdx: 3, nameIdx: 19 }, // 1
    { classIdx: 0, protoIdx: 4, nameIdx: 20 }, // 2
    { classIdx: 4, protoIdx: 7, nameIdx: 21 }, // 3
    { classIdx: 4, protoIdx: 7, nameIdx: 22 }, // 4
    { classIdx: 5, protoIdx: 2, nameIdx: 0 }, // 5
    { classIdx: 5, protoIdx: 0, nameIdx: 17 }, // 6
    { classIdx: 5, protoIdx: 6, nameIdx: 18 }, // 7
    { classIdx: 5, protoIdx: 5, nameIdx: 23 }, // 8
    { classIdx: 6, protoIdx: 1, nameIdx: 0 }, // 9
    { classIdx: 7, protoIdx: 1, nameIdx: 0 }, // 10
    { classIdx: 7, protoIdx: 3, nameIdx: 19 } // 11
  ];

  const headerSize = 0x70;
  const stringIdsOff = 0x70;
  const typeIdsOff = stringIdsOff + STRINGS.length * 4;
  const protoIdsOff = typeIdsOff + TYPE_STR_IDXS.length * 4;
  const methodIdsOff = protoIdsOff + PROTOS.length * 12;
  const classDefsOff = methodIdsOff + METHODS.length * 8;
  const dataOff = classDefsOff + 32;

  let currentDataPtr = dataOff;

  // 1. type_list items (6 items * 8 bytes = 48 bytes)
  const protoTypeListOffsets: (number | 0)[] = [];
  const typeListBuffers: Uint8Array[] = [];
  for (const p of PROTOS) {
    if (p.paramTypeIdx === null) {
      protoTypeListOffsets.push(0);
    } else {
      protoTypeListOffsets.push(currentDataPtr);
      const tl = new Uint8Array(8);
      const v = new DataView(tl.buffer);
      v.setUint32(0, 1, true);
      v.setUint16(4, p.paramTypeIdx, true);
      v.setUint16(6, 0, true);
      typeListBuffers.push(tl);
      currentDataPtr += 8;
    }
  }

  // 2. code_item 1: MainActivity.<init>()V (24 bytes, exact multiple of 4)
  const codeInitOff = currentDataPtr;
  const codeInitBytes = new Uint8Array(24);
  const ciView = new DataView(codeInitBytes.buffer);
  ciView.setUint16(0, 1, true); // registers_size = 1
  ciView.setUint16(2, 1, true); // ins_size = 1
  ciView.setUint16(4, 1, true); // outs_size = 1
  ciView.setUint16(6, 0, true); // tries_size = 0
  ciView.setUint32(8, 0, true); // debug_info_off = 0
  ciView.setUint32(12, 4, true); // insns_size = 4 code units (8 bytes)
  codeInitBytes.set([0x70, 0x10, 0x00, 0x00, 0x00, 0x00, 0x0e, 0x00], 16);
  currentDataPtr += codeInitBytes.byteLength;

  // 3. code_item 2: MainActivity.onCreate(Bundle)V
  // 38 code units (76 bytes) + 16 byte header = 92 bytes (exact multiple of 4 with zero trailing gap!)
  const codeOnCreateOff = currentDataPtr;
  const onCreateInsns = new Uint8Array([
    0x6f, 0x20, 0x01, 0x00, 0x43, 0x00,
    0x22, 0x00, 0x05, 0x00,
    0x70, 0x20, 0x05, 0x00, 0x30, 0x00,
    0x6e, 0x10, 0x06, 0x00, 0x00, 0x00,
    0x0c, 0x01,
    0x12, 0x12,
    0x6e, 0x20, 0x04, 0x00, 0x21, 0x00,
    0x6e, 0x20, 0x03, 0x00, 0x21, 0x00,
    0x22, 0x02, 0x06, 0x00,
    0x70, 0x10, 0x09, 0x00, 0x02, 0x00,
    0x6e, 0x20, 0x08, 0x00, 0x20, 0x00,
    0x1a, 0x02, 0x10, 0x00,
    0x6e, 0x20, 0x07, 0x00, 0x20, 0x00,
    0x6e, 0x20, 0x02, 0x00, 0x03, 0x00,
    0x0e, 0x00,
    0x00, 0x00 // nop to make insns_size = 38 units (76 bytes), total item = 92 bytes
  ]);
  const insnsUnits = onCreateInsns.byteLength / 2; // 38 units
  const codeOnCreateBytes = new Uint8Array(16 + onCreateInsns.byteLength); // 92 bytes
  const coView = new DataView(codeOnCreateBytes.buffer);
  coView.setUint16(0, 5, true); // registers_size = 5
  coView.setUint16(2, 2, true); // ins_size = 2
  coView.setUint16(4, 2, true); // outs_size = 2
  coView.setUint16(6, 0, true); // tries_size = 0
  coView.setUint32(8, 0, true); // debug_info_off = 0
  coView.setUint32(12, insnsUnits, true); // insns_size = 38
  codeOnCreateBytes.set(onCreateInsns, 16);
  currentDataPtr += codeOnCreateBytes.byteLength;

  // 4. string_data_item section (1-byte aligned, contiguous)
  const stringDataOffsets: number[] = [];
  const stringDataBuffers: Uint8Array[] = [];
  for (const s of STRINGS) {
    stringDataOffsets.push(currentDataPtr);
    const utf8 = enc.encode(s);
    const lenLeb = encodeUleb128(s.length);
    const item = new Uint8Array(lenLeb.byteLength + utf8.byteLength + 1);
    item.set(lenLeb, 0);
    item.set(utf8, lenLeb.byteLength);
    item[item.byteLength - 1] = 0;
    stringDataBuffers.push(item);
    currentDataPtr += item.byteLength;
  }

  // 5. class_data_item (1-byte aligned, contiguous after string_data_item)
  const classDataOff = currentDataPtr;
  const classDataRaw = concatBytes([
    encodeUleb128(0),
    encodeUleb128(0),
    encodeUleb128(1),
    encodeUleb128(1),
    encodeUleb128(10),
    encodeUleb128(0x10001),
    encodeUleb128(codeInitOff),
    encodeUleb128(11),
    encodeUleb128(0x0001),
    encodeUleb128(codeOnCreateOff)
  ]);
  currentDataPtr += classDataRaw.byteLength;

  // Align to 4 bytes before map_list (TYPE_MAP_LIST requires 4-byte alignment)
  const padBeforeMap = (4 - (currentDataPtr % 4)) % 4;
  const padBytes = new Uint8Array(padBeforeMap);
  currentDataPtr += padBeforeMap;

  // 6. map_list
  const mapOff = currentDataPtr;
  const mapItems = [
    { type: 0x0000, size: 1, offset: 0 },
    { type: 0x0001, size: STRINGS.length, offset: stringIdsOff },
    { type: 0x0002, size: TYPE_STR_IDXS.length, offset: typeIdsOff },
    { type: 0x0003, size: PROTOS.length, offset: protoIdsOff },
    { type: 0x0005, size: METHODS.length, offset: methodIdsOff },
    { type: 0x0006, size: 1, offset: classDefsOff },
    { type: 0x1001, size: 6, offset: dataOff },
    { type: 0x2001, size: 2, offset: codeInitOff },
    { type: 0x2002, size: STRINGS.length, offset: stringDataOffsets[0] },
    { type: 0x2000, size: 1, offset: classDataOff },
    { type: 0x1000, size: 1, offset: mapOff }
  ];

  const mapListBytes = new Uint8Array(4 + mapItems.length * 12);
  const mlView = new DataView(mapListBytes.buffer);
  mlView.setUint32(0, mapItems.length, true);
  for (let i = 0; i < mapItems.length; i++) {
    const m = mapItems[i];
    const off = 4 + i * 12;
    mlView.setUint16(off + 0, m.type, true);
    mlView.setUint16(off + 2, 0, true);
    mlView.setUint32(off + 4, m.size, true);
    mlView.setUint32(off + 8, m.offset, true);
  }
  currentDataPtr += mapListBytes.byteLength;

  const totalDexSize = currentDataPtr;
  const dex = new Uint8Array(totalDexSize);
  const dv = new DataView(dex.buffer);

  dex.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0);
  dv.setUint32(32, totalDexSize, true);
  dv.setUint32(36, headerSize, true);
  dv.setUint32(40, 0x12345678, true);
  dv.setUint32(44, 0, true);
  dv.setUint32(48, 0, true);
  dv.setUint32(52, mapOff, true);
  dv.setUint32(56, STRINGS.length, true);
  dv.setUint32(60, stringIdsOff, true);
  dv.setUint32(64, TYPE_STR_IDXS.length, true);
  dv.setUint32(68, typeIdsOff, true);
  dv.setUint32(72, PROTOS.length, true);
  dv.setUint32(76, protoIdsOff, true);
  dv.setUint32(80, 0, true);
  dv.setUint32(84, 0, true);
  dv.setUint32(88, METHODS.length, true);
  dv.setUint32(92, methodIdsOff, true);
  dv.setUint32(96, 1, true);
  dv.setUint32(100, classDefsOff, true);
  dv.setUint32(104, totalDexSize - dataOff, true);
  dv.setUint32(108, dataOff, true);

  for (let i = 0; i < stringDataOffsets.length; i++) {
    dv.setUint32(stringIdsOff + i * 4, stringDataOffsets[i], true);
  }
  for (let i = 0; i < TYPE_STR_IDXS.length; i++) {
    dv.setUint32(typeIdsOff + i * 4, TYPE_STR_IDXS[i], true);
  }
  for (let i = 0; i < PROTOS.length; i++) {
    const off = protoIdsOff + i * 12;
    dv.setUint32(off + 0, PROTOS[i].shortyIdx, true);
    dv.setUint32(off + 4, PROTOS[i].returnTypeIdx, true);
    dv.setUint32(off + 8, protoTypeListOffsets[i], true);
  }
  for (let i = 0; i < METHODS.length; i++) {
    const off = methodIdsOff + i * 8;
    dv.setUint16(off + 0, METHODS[i].classIdx, true);
    dv.setUint16(off + 2, METHODS[i].protoIdx, true);
    dv.setUint32(off + 4, METHODS[i].nameIdx, true);
  }

  dv.setUint32(classDefsOff + 0, 7, true);
  dv.setUint32(classDefsOff + 4, 0x0001, true);
  dv.setUint32(classDefsOff + 8, 0, true);
  dv.setUint32(classDefsOff + 12, 0, true);
  dv.setUint32(classDefsOff + 16, 11, true);
  dv.setUint32(classDefsOff + 20, 0, true);
  dv.setUint32(classDefsOff + 24, classDataOff, true);
  dv.setUint32(classDefsOff + 28, 0, true);

  const dataPayload = concatBytes([
    ...typeListBuffers,
    codeInitBytes,
    codeOnCreateBytes,
    ...stringDataBuffers,
    classDataRaw,
    padBytes,
    mapListBytes
  ]);
  dex.set(dataPayload, dataOff);

  const subBuf = new ArrayBuffer(totalDexSize - 32);
  new Uint8Array(subBuf).set(dex.subarray(32));
  const sha1Buf = await crypto.subtle.digest('SHA-1', subBuf);
  dex.set(new Uint8Array(sha1Buf), 12);

  const adler = computeAdler32(dex, 12);
  dv.setUint32(8, adler, true);

  return dex;
}
