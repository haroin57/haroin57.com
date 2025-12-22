// 認証関連のユーティリティ

import type { Env, FirebaseTokenHeader, FirebaseTokenPayload, PublicKeyCache } from './types'

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const GOOGLE_KEYS_KV_KEY = 'cache:google:public-keys'

let publicKeyCache: PublicKeyCache | null = null

// Base64URLデコード（文字列として）
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

// Base64URLデコード（バイナリとして）
function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// PEM形式の証明書からCryptoKeyを生成
async function importPublicKeyFromCert(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  const binaryDer = atob(pemContents)
  const bytes = new Uint8Array(binaryDer.length)
  for (let i = 0; i < binaryDer.length; i++) {
    bytes[i] = binaryDer.charCodeAt(i)
  }

  const spki = extractSpkiFromCertificate(bytes)

  return await crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
}

// X.509証明書からSPKI（公開鍵情報）を抽出
function extractSpkiFromCertificate(certBytes: Uint8Array): ArrayBuffer {
  let offset = 0

  if (certBytes[offset] !== 0x30) throw new Error('Invalid certificate: expected SEQUENCE')
  offset++
  const [, outerLen] = readAsn1Length(certBytes, offset)
  offset += outerLen

  if (certBytes[offset] !== 0x30) throw new Error('Invalid tbsCertificate: expected SEQUENCE')
  offset++
  const [, tbsLenBytes] = readAsn1Length(certBytes, offset)
  offset += tbsLenBytes

  if (certBytes[offset] === 0xa0) {
    offset++
    const [vLen, vLenBytes] = readAsn1Length(certBytes, offset)
    offset += vLenBytes + vLen
  }

  offset = skipAsn1Element(certBytes, offset)
  offset = skipAsn1Element(certBytes, offset)
  offset = skipAsn1Element(certBytes, offset)
  offset = skipAsn1Element(certBytes, offset)
  offset = skipAsn1Element(certBytes, offset)

  if (certBytes[offset] !== 0x30) throw new Error('Invalid subjectPublicKeyInfo')
  const spkiStart = offset
  offset = skipAsn1Element(certBytes, offset)
  const spkiEnd = offset

  return certBytes.slice(spkiStart, spkiEnd).buffer
}

function readAsn1Length(bytes: Uint8Array, offset: number): [number, number] {
  const first = bytes[offset]
  if (first < 0x80) {
    return [first, 1]
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | bytes[offset + 1 + i]
  }
  return [length, 1 + numBytes]
}

function skipAsn1Element(bytes: Uint8Array, offset: number): number {
  offset++
  const [len, lenBytes] = readAsn1Length(bytes, offset)
  return offset + lenBytes + len
}

// Google公開鍵を取得（KV分散キャッシュ + メモリキャッシュの2層構造）
export async function getGooglePublicKeys(env: Env): Promise<Record<string, CryptoKey>> {
  const now = Date.now()

  if (publicKeyCache && publicKeyCache.expiresAt > now) {
    return publicKeyCache.keys
  }

  const kvCacheJson = await env.HAROIN_PV.get(GOOGLE_KEYS_KV_KEY)
  if (kvCacheJson) {
    try {
      const kvCache = JSON.parse(kvCacheJson) as { certs: Record<string, string>; expiresAt: number }
      if (kvCache.expiresAt > now) {
        const keys: Record<string, CryptoKey> = {}
        for (const [kid, pem] of Object.entries(kvCache.certs)) {
          try {
            keys[kid] = await importPublicKeyFromCert(pem)
          } catch (e) {
            console.error(`Failed to import key ${kid}:`, e)
          }
        }
        publicKeyCache = { keys, expiresAt: kvCache.expiresAt }
        return keys
      }
    } catch (e) {
      console.error('Failed to parse KV cache:', e)
    }
  }

  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public keys: ${response.status}`)
  }

  const cacheControl = response.headers.get('Cache-Control') || ''
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600
  const expiresAt = now + maxAge * 1000

  const certs = (await response.json()) as Record<string, string>
  const keys: Record<string, CryptoKey> = {}

  for (const [kid, pem] of Object.entries(certs)) {
    try {
      keys[kid] = await importPublicKeyFromCert(pem)
    } catch (e) {
      console.error(`Failed to import key ${kid}:`, e)
    }
  }

  publicKeyCache = { keys, expiresAt }

  const kvCacheData = JSON.stringify({ certs, expiresAt })
  const kvTtl = Math.max(60, Math.floor(maxAge * 0.9))
  await env.HAROIN_PV.put(GOOGLE_KEYS_KV_KEY, kvCacheData, { expirationTtl: kvTtl })

  return keys
}

// Firebase IDトークンを検証
export async function verifyFirebaseToken(token: string, env: Env): Promise<FirebaseTokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.log('Invalid token format')
      return null
    }

    const header = JSON.parse(base64UrlDecode(parts[0])) as FirebaseTokenHeader

    if (header.alg !== 'RS256') {
      console.log('Invalid algorithm:', header.alg)
      return null
    }

    if (!header.kid) {
      console.log('Missing kid in header')
      return null
    }

    const payload = JSON.parse(base64UrlDecode(parts[1])) as FirebaseTokenPayload
    const now = Math.floor(Date.now() / 1000)

    if (!payload.exp || payload.exp < now) {
      console.log('Token expired')
      return null
    }

    if (!payload.iat || payload.iat > now) {
      console.log('Invalid iat:', payload.iat)
      return null
    }

    if (!payload.auth_time || payload.auth_time > now) {
      console.log('Invalid auth_time:', payload.auth_time)
      return null
    }

    const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
    if (payload.iss !== expectedIssuer) {
      console.log('Invalid issuer:', payload.iss)
      return null
    }

    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      console.log('Invalid audience:', payload.aud)
      return null
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      console.log('Invalid sub')
      return null
    }

    if (!payload.email_verified) {
      console.log('Email not verified')
      return null
    }

    const publicKeys = await getGooglePublicKeys(env)
    const publicKey = publicKeys[header.kid]
    if (!publicKey) {
      console.log('Public key not found for kid:', header.kid)
      return null
    }

    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const signature = base64UrlToArrayBuffer(parts[2])

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      signedData
    )

    if (!isValid) {
      console.log('Invalid signature')
      return null
    }

    return payload
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

// 管理者認証チェック
export async function checkAdminAuth(req: Request, env: Env): Promise<boolean> {
  const adminEmails = (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase())

  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyFirebaseToken(token, env)

    if (payload?.email && adminEmails.includes(payload.email.toLowerCase())) {
      console.log('Admin authenticated via Firebase:', payload.email)
      return true
    }
  }

  const secret = req.headers.get('X-Admin-Secret')
  if (env.ADMIN_SECRET && secret === env.ADMIN_SECRET) {
    console.log('Admin authenticated via ADMIN_SECRET')
    return true
  }

  console.log('Admin authentication failed')
  return false
}
