/**
 * Cryptographic APK Signer implementing BOTH:
 * 1. APK Signature Scheme v1 (JAR Signing: META-INF/MANIFEST.MF, CERT.SF, and PKCS#7 DER CERT.RSA)
 * 2. APK Signature Scheme v2 ("APK Sig Block 42", ID 0x7109871a, RSASSA-PKCS1-v1_5 with SHA-256 0x0103)
 *
 * Includes Google Play Protect Friendly X.509v3 certificate generation with per-package unique
 * serial numbers, SubjectKeyIdentifier (2.5.29.14), KeyUsage (digitalSignature 2.5.29.15),
 * and BasicConstraints (CA:FALSE 2.5.29.19).
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

// ============================================================================
// ASN.1 DER Encoding Helpers for X.509v3 Certificate & PKCS#7 SignedData
// ============================================================================

function derEncodeLength(len: number): Uint8Array {
  if (len < 128) {
    return new Uint8Array([len]);
  }
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTlv(tag: number, content: Uint8Array): Uint8Array {
  const lenBytes = derEncodeLength(content.byteLength);
  const out = new Uint8Array(1 + lenBytes.byteLength + content.byteLength);
  out[0] = tag;
  out.set(lenBytes, 1);
  out.set(content, 1 + lenBytes.byteLength);
  return out;
}

function derSeq(items: Uint8Array[]): Uint8Array {
  return derTlv(0x30, concatBytes(items));
}

function derSet(items: Uint8Array[]): Uint8Array {
  return derTlv(0x31, concatBytes(items));
}

function derInteger(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) {
    const padded = new Uint8Array(bytes.length + 1);
    padded[0] = 0x00;
    padded.set(bytes, 1);
    return derTlv(0x02, padded);
  }
  return derTlv(0x02, bytes);
}

function derIntNum(val: number): Uint8Array {
  if (val === 0) return derTlv(0x02, new Uint8Array([0]));
  const bytes: number[] = [];
  let v = val;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>>= 8;
  }
  return derInteger(new Uint8Array(bytes));
}

function derOid(oidNumbers: number[]): Uint8Array {
  const body: number[] = [oidNumbers[0] * 40 + oidNumbers[1]];
  for (let i = 2; i < oidNumbers.length; i++) {
    let v = oidNumbers[i];
    if (v === 0) {
      body.push(0);
      continue;
    }
    const sub: number[] = [];
    while (v > 0) {
      sub.unshift(v & 0x7f);
      v >>>= 7;
    }
    for (let j = 0; j < sub.length - 1; j++) {
      sub[j] |= 0x80;
    }
    body.push(...sub);
  }
  return derTlv(0x06, new Uint8Array(body));
}

function derNull(): Uint8Array {
  return new Uint8Array([0x05, 0x00]);
}

function derBoolean(val: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, val ? 0xff : 0x00]);
}

function derOctetString(bytes: Uint8Array): Uint8Array {
  return derTlv(0x04, bytes);
}

function derBitString(bytes: Uint8Array, unusedBits = 0): Uint8Array {
  const content = new Uint8Array(1 + bytes.byteLength);
  content[0] = unusedBits & 0xff;
  content.set(bytes, 1);
  return derTlv(0x03, content);
}

function derUtf8String(str: string): Uint8Array {
  return derTlv(0x0c, new TextEncoder().encode(str));
}

function derPrintableString(str: string): Uint8Array {
  return derTlv(0x13, new TextEncoder().encode(str));
}

function derUtcTime(str: string): Uint8Array {
  return derTlv(0x17, new TextEncoder().encode(str));
}

// OIDs
const OID_RSA_ENCRYPTION = [1, 2, 840, 113549, 1, 1, 1];
const OID_SHA256_WITH_RSA = [1, 2, 840, 113549, 1, 1, 11];
const OID_SHA256 = [2, 16, 840, 1, 101, 3, 4, 2, 1];
const OID_COMMON_NAME = [2, 5, 4, 3];
const OID_COUNTRY_NAME = [2, 5, 4, 6];
const OID_ORG_NAME = [2, 5, 4, 10];
const OID_ORG_UNIT_NAME = [2, 5, 4, 11];
const OID_PKCS7_DATA = [1, 2, 840, 113549, 1, 7, 1];
const OID_PKCS7_SIGNED_DATA = [1, 2, 840, 113549, 1, 7, 2];

// X.509v3 Extension OIDs
const OID_EXT_SUBJECT_KEY_ID = [2, 5, 29, 14];
const OID_EXT_KEY_USAGE = [2, 5, 29, 15];
const OID_EXT_BASIC_CONSTRAINTS = [2, 5, 29, 19];

/**
 * Generates an RSA-2048 keypair and a Play Protect compliant X.509v3 DER certificate
 * with unique per-package serial number and standard v3 extensions.
 */
export async function generateApkSigningIdentity(
  packageName = 'com.shailesh.app',
  appName = 'Release Application'
): Promise<{
  privateKey: CryptoKey;
  publicKeySpkiDer: Uint8Array;
  certDer: Uint8Array;
  issuerNameDer: Uint8Array;
  serialNumberDer: Uint8Array;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeySpkiDer = new Uint8Array(spkiBuffer);

  // Compute unique 8-byte positive serial number from packageName + appName
  const seedBytes = new TextEncoder().encode(`${packageName}:${appName}:ShaileshRaj`);
  const seedHashBuf = await crypto.subtle.digest('SHA-256', toArrayBuffer(seedBytes));
  const serialBytes = new Uint8Array(seedHashBuf).slice(0, 8);
  serialBytes[0] = (serialBytes[0] & 0x7f) | 0x01; // Ensure positive non-zero MSB
  const serialNumberDer = derInteger(serialBytes);

  // Compute 20-byte SHA-1 SubjectKeyIdentifier over publicKeySpkiDer
  const skiSha1Buf = await crypto.subtle.digest('SHA-1', toArrayBuffer(publicKeySpkiDer));
  const skiBytes = new Uint8Array(skiSha1Buf);

  const cleanCn = (appName || 'Mobile App').replace(/[^a-zA-Z0-9 ._-]/g, '').slice(0, 48) || 'Mobile App';

  // Distinguished Name: C=IN, O=Shailesh Raj Studio, OU=Android Release Engineering, CN=<AppName>
  const rdnCountry = derSet([derSeq([derOid(OID_COUNTRY_NAME), derPrintableString('IN')])]);
  const rdnOrg = derSet([derSeq([derOid(OID_ORG_NAME), derUtf8String('Shailesh Raj Studio')])]);
  const rdnOu = derSet([
    derSeq([derOid(OID_ORG_UNIT_NAME), derUtf8String('Android Release Engineering')])
  ]);
  const rdnCn = derSet([derSeq([derOid(OID_COMMON_NAME), derUtf8String(cleanCn)])]);
  const nameDer = derSeq([rdnCountry, rdnOrg, rdnOu, rdnCn]);

  const sigAlgDer = derSeq([derOid(OID_SHA256_WITH_RSA), derNull()]);

  const validityDer = derSeq([
    derUtcTime('240101000000Z'),
    derUtcTime('491231235959Z')
  ]);

  // X.509v3 Extensions:
  // 1. BasicConstraints (2.5.29.19): critical = true, CA = false (empty SEQUENCE)
  const extBasicConstraints = derSeq([
    derOid(OID_EXT_BASIC_CONSTRAINTS),
    derBoolean(true),
    derOctetString(derSeq([]))
  ]);

  // 2. KeyUsage (2.5.29.15): critical = true, digitalSignature (bit 0 -> 0x80, 7 unused bits)
  const extKeyUsage = derSeq([
    derOid(OID_EXT_KEY_USAGE),
    derBoolean(true),
    derOctetString(derBitString(new Uint8Array([0x80]), 7))
  ]);

  // 3. SubjectKeyIdentifier (2.5.29.14): critical = false, OCTET STRING(skiBytes)
  const extSubjectKeyId = derSeq([
    derOid(OID_EXT_SUBJECT_KEY_ID),
    derOctetString(derOctetString(skiBytes))
  ]);

  const extensionsExplicit = derTlv(
    0xa3,
    derSeq([extBasicConstraints, extKeyUsage, extSubjectKeyId])
  );

  const versionExplicit = derTlv(0xa0, derIntNum(2)); // v3 = 2

  const tbsCertificate = derSeq([
    versionExplicit,
    serialNumberDer,
    sigAlgDer,
    nameDer,
    validityDer,
    nameDer,
    publicKeySpkiDer,
    extensionsExplicit
  ]);

  const certSigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    toArrayBuffer(tbsCertificate)
  );
  const certSigBytes = new Uint8Array(certSigBuf);

  const certDer = derSeq([tbsCertificate, sigAlgDer, derBitString(certSigBytes)]);

  return {
    privateKey: keyPair.privateKey,
    publicKeySpkiDer,
    certDer,
    issuerNameDer: nameDer,
    serialNumberDer
  };
}

/**
 * Builds a valid PKCS#7 / CMS SignedData DER block (META-INF/CERT.RSA)
 * signing the bytes of META-INF/CERT.SF (APK Signature Scheme v1).
 */
export async function buildPkcs7CertRsa(
  certSfBytes: Uint8Array,
  identity: {
    privateKey: CryptoKey;
    certDer: Uint8Array;
    issuerNameDer: Uint8Array;
    serialNumberDer: Uint8Array;
  }
): Promise<Uint8Array> {
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    identity.privateKey,
    toArrayBuffer(certSfBytes)
  );
  const signatureBytes = new Uint8Array(sigBuf);

  const digestAlgId = derSeq([derOid(OID_SHA256), derNull()]);
  const sigAlgId = derSeq([derOid(OID_RSA_ENCRYPTION), derNull()]);
  const issuerAndSerial = derSeq([identity.issuerNameDer, identity.serialNumberDer]);

  const signerInfo = derSeq([
    derIntNum(1),
    issuerAndSerial,
    digestAlgId,
    sigAlgId,
    derOctetString(signatureBytes)
  ]);

  const signedData = derSeq([
    derIntNum(1),
    derSet([digestAlgId]),
    derSeq([derOid(OID_PKCS7_DATA)]),
    derTlv(0xa0, identity.certDer),
    derSet([signerInfo])
  ]);

  return derSeq([derOid(OID_PKCS7_SIGNED_DATA), derTlv(0xa0, signedData)]);
}

// ============================================================================
// APK Signature Scheme v2 ("APK Sig Block 42", ID 0x7109871a)
// ============================================================================

function lpUint32(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.byteLength);
  new DataView(out.buffer).setUint32(0, payload.byteLength, true);
  out.set(payload, 4);
  return out;
}

function uint32Le(val: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, val >>> 0, true);
  return b;
}

function uint64Le(val: number): Uint8Array {
  const b = new Uint8Array(8);
  const v = new DataView(b.buffer);
  v.setUint32(0, val >>> 0, true);
  v.setUint32(4, Math.floor(val / 0x100000000) >>> 0, true);
  return b;
}

async function computeApkV2ContentDigest(
  zipEntriesPart: Uint8Array,
  centralDirPart: Uint8Array,
  eocdPartForHashing: Uint8Array
): Promise<Uint8Array> {
  const CHUNK_SIZE = 1024 * 1024;
  const sections = [zipEntriesPart, centralDirPart, eocdPartForHashing];
  const chunkDigests: Uint8Array[] = [];

  for (const section of sections) {
    let offset = 0;
    while (offset < section.byteLength) {
      const chunkLen = Math.min(CHUNK_SIZE, section.byteLength - offset);
      const chunkData = section.subarray(offset, offset + chunkLen);

      const prefix = new Uint8Array(5 + chunkLen);
      prefix[0] = 0xa5;
      new DataView(prefix.buffer).setUint32(1, chunkLen, true);
      prefix.set(chunkData, 5);

      const digestBuf = await crypto.subtle.digest('SHA-256', toArrayBuffer(prefix));
      chunkDigests.push(new Uint8Array(digestBuf));
      offset += chunkLen;
    }
  }

  const allChunkHashes = concatBytes(chunkDigests);
  const topInput = new Uint8Array(5 + allChunkHashes.byteLength);
  topInput[0] = 0x5a;
  new DataView(topInput.buffer).setUint32(1, chunkDigests.length, true);
  topInput.set(allChunkHashes, 5);

  const topDigestBuf = await crypto.subtle.digest('SHA-256', toArrayBuffer(topInput));
  return new Uint8Array(topDigestBuf);
}

export async function injectApkSignatureSchemeV2Block(
  zipEntriesPart: Uint8Array,
  centralDirPart: Uint8Array,
  eocdPart: Uint8Array,
  identity: {
    privateKey: CryptoKey;
    publicKeySpkiDer: Uint8Array;
    certDer: Uint8Array;
  }
): Promise<Uint8Array> {
  const eocdForHash = new Uint8Array(eocdPart.byteLength);
  eocdForHash.set(eocdPart);
  new DataView(eocdForHash.buffer).setUint32(16, zipEntriesPart.byteLength, true);

  const topLevelDigest = await computeApkV2ContentDigest(
    zipEntriesPart,
    centralDirPart,
    eocdForHash
  );

  const SIG_ALG_RSA_PKCS1_V1_5_SHA256 = 0x0103;

  const digestEntry = lpUint32(
    concatBytes([uint32Le(SIG_ALG_RSA_PKCS1_V1_5_SHA256), lpUint32(topLevelDigest)])
  );
  const digests = lpUint32(digestEntry);
  const certificates = lpUint32(lpUint32(identity.certDer));
  const additionalAttributes = uint32Le(0);
  const signedDataBytes = concatBytes([digests, certificates, additionalAttributes]);

  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    identity.privateKey,
    toArrayBuffer(signedDataBytes)
  );
  const sigBytes = new Uint8Array(sigBuf);

  const signatureEntry = lpUint32(
    concatBytes([uint32Le(SIG_ALG_RSA_PKCS1_V1_5_SHA256), lpUint32(sigBytes)])
  );
  const signatures = lpUint32(signatureEntry);

  const signer = lpUint32(
    concatBytes([
      lpUint32(signedDataBytes),
      signatures,
      lpUint32(identity.publicKeySpkiDer)
    ])
  );

  const v2BlockValue = lpUint32(signer);

  const pair1 = concatBytes([
    uint64Le(4 + v2BlockValue.byteLength),
    uint32Le(0x7109871a),
    v2BlockValue
  ]);

  const unpaddedTotal = pair1.byteLength + 32;
  let pairsBytes = pair1;
  const remainder = unpaddedTotal % 4096;
  if (remainder !== 0) {
    let padNeeded = 4096 - remainder;
    if (padNeeded < 12) {
      padNeeded += 4096;
    }
    const padValLen = padNeeded - 12;
    const padPair = concatBytes([
      uint64Le(4 + padValLen),
      uint32Le(0x42726577),
      new Uint8Array(padValLen)
    ]);
    pairsBytes = concatBytes([pair1, padPair]);
  }

  const sizeOfBlockValue = pairsBytes.byteLength + 24;
  const magicBytes = new TextEncoder().encode('APK Sig Block 42');

  const apkSigningBlock = concatBytes([
    uint64Le(sizeOfBlockValue),
    pairsBytes,
    uint64Le(sizeOfBlockValue),
    magicBytes
  ]);

  const finalEocd = new Uint8Array(eocdPart.byteLength);
  finalEocd.set(eocdPart);
  const newCentralDirOffset = zipEntriesPart.byteLength + apkSigningBlock.byteLength;
  new DataView(finalEocd.buffer).setUint32(16, newCentralDirOffset, true);

  return concatBytes([zipEntriesPart, apkSigningBlock, centralDirPart, finalEocd]);
}
