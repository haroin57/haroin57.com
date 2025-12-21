---
title: "README3"
summary: "Firebase認証、JWT検証、RS256署名、Cloudflare Workersでのセキュリティ実装を詳しく解説"
date: "2025-12-21T12:00:00+09:00"
tags:
  - Security
  - JWT
  - Firebase
  - Cloudflare
---

このサイトで実装しているセキュリティ対策を初学者向けに詳しく解説する。

## 目次

<br/>

## なぜセキュリティが必要なのか

Webアプリケーションでは、「誰がリクエストを送っているか」を確認することが非常に重要。

- 記事の編集・削除は管理者だけができるべき
- 下書き記事は一般ユーザーには見せたくない
- 不正なリクエストからAPIを保護したい

これらを実現するために、**認証（Authentication）** と **認可（Authorization）** という仕組みを使う。

| 用語 | 意味 | 例 |
|------|------|-----|
| 認証 | 「あなたは誰？」を確認する | ログインして本人確認 |
| 認可 | 「あなたはこれをしていい？」を確認する | 管理者だけが編集可能 |

---

<br/>

## JWT（JSON Web Token）とは

### 基本概念

JWTは、ユーザー情報を安全にやり取りするための「デジタル身分証明書」のようなもの。

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature...
```

一見すると意味不明な文字列だが、実は3つの部分からできている：

```
[ヘッダー].[ペイロード].[署名]
```

それぞれ**Base64URL**という形式でエンコード（変換）されている。

### JWTの3つの構成要素

**① ヘッダー（Header）**

「このトークンは何の方式で署名されているか」を示す。

```json
{
  "alg": "RS256",    // 署名アルゴリズム（RSA + SHA-256）
  "kid": "abc123",   // 公開鍵のID（Key ID）
  "typ": "JWT"       // トークンの種類
}
```

**② ペイロード（Payload）**

ユーザー情報や有効期限などの「中身」が入っている。

```json
{
  "iss": "https://securetoken.google.com/my-project",  // 発行者
  "aud": "my-project",                                  // 対象者（誰向けか）
  "sub": "user123",                                     // ユーザーID
  "email": "user@example.com",                          // メールアドレス
  "email_verified": true,                               // メール確認済みか
  "iat": 1700000000,                                    // 発行時刻
  "exp": 1700003600,                                    // 有効期限
  "auth_time": 1699999000                               // 認証した時刻
}
```

**③ 署名（Signature）**

「このトークンが本物であること」を証明する電子署名。

```
署名 = RSA暗号化(ヘッダー + "." + ペイロード, 秘密鍵)
```

### なぜ署名が必要なのか

署名がなければ、悪意のあるユーザーが自分でトークンを作れてしまう：

```json
// 悪意のあるユーザーが作った偽のペイロード
{
  "email": "admin@example.com",  // 管理者になりすまし！
  "email_verified": true
}
```

しかし、署名があれば：

1. トークンは**秘密鍵**で署名される（Firebaseだけが持っている）
2. サーバーは**公開鍵**で署名を検証できる
3. 署名が合わなければ偽物と判断できる

これを**公開鍵暗号方式**と呼ぶ。

---

<br/>

## Firebase認証の仕組み

### 認証フロー全体像

```
① ユーザーがGoogleログイン
   ブラウザ ──────▶ Firebase ◀────▶ Google OAuth

② FirebaseがIDトークン（JWT）を発行
   ブラウザ ◀────── IDトークン

③ ブラウザがAPIリクエスト時にトークンを添付
   Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

④ Cloudflare Workerがトークンを検証
   Worker ◀─── Google公開鍵 (googleapis.comから取得)
```

### フロントエンド側の実装

`src/contexts/AdminAuthContext.tsx` で認証状態を管理：

```typescript
// Googleログイン処理
const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)

  // FirebaseからIDトークンを取得
  const token = await result.user.getIdToken()
  setIdToken(token)
}
```

**APIリクエスト時のトークン送信：**

```typescript
// 管理者APIを呼び出す例
const response = await fetch('/api/cms/posts/drafts', {
  headers: {
    'Authorization': `Bearer ${idToken}`  // ここでトークンを送る
  }
})
```

`Bearer` は「持参人」という意味で、「このトークンを持っている人を認証してください」という意味。

---

<br/>

## サーバー側のトークン検証

`src/pv-worker.ts` で実装している検証処理を詳しく見ていく。

### 検証の全体像

```typescript
async function verifyFirebaseToken(token: string, env: Env): Promise<FirebaseTokenPayload | null> {
  // 1. トークンを3つの部分に分割
  const parts = token.split('.')
  if (parts.length !== 3) return null  // JWTは必ず3部構成

  // 2. ヘッダーの検証
  // 3. ペイロードの検証（各クレーム）
  // 4. 署名の検証

  return payload  // 全て通過したら成功
}
```

### 各検証項目の詳細

**① アルゴリズムの検証（alg）**

```typescript
const header = JSON.parse(base64UrlDecode(parts[0]))

// RS256以外は拒否（ダウングレード攻撃防止）
if (header.alg !== 'RS256') {
  console.log('Invalid algorithm:', header.alg)
  return null
}
```

なぜこれが必要？
→ 攻撃者が `alg: "none"` を指定して「署名なしでOK」と偽装する攻撃を防ぐため。

**② 有効期限の検証（exp）**

```typescript
const now = Math.floor(Date.now() / 1000)  // 現在時刻（UNIX時間）

if (!payload.exp || payload.exp < now) {
  console.log('Token expired')
  return null
}
```

`exp`（expiration）は「このトークンはいつまで有効か」を示す。期限切れトークンは無効。

**③ 発行時刻の検証（iat）**

```typescript
if (!payload.iat || payload.iat > now) {
  console.log('Invalid iat:', payload.iat)
  return null
}
```

`iat`（issued at）は「トークンがいつ発行されたか」。未来の時刻で発行されたトークンは不正。

**④ 発行者の検証（iss）**

```typescript
const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
if (payload.iss !== expectedIssuer) {
  console.log('Invalid issuer:', payload.iss)
  return null
}
```

`iss`（issuer）は「誰がこのトークンを発行したか」。Firebase以外が発行したトークンは拒否。

**⑤ 対象者の検証（aud）**

```typescript
if (payload.aud !== env.FIREBASE_PROJECT_ID) {
  console.log('Invalid audience:', payload.aud)
  return null
}
```

`aud`（audience）は「このトークンは誰向けか」。自分のプロジェクト向けでないトークンは拒否。

**⑥ メール確認済みの検証（email_verified）**

```typescript
if (!payload.email_verified) {
  console.log('Email not verified')
  return null
}
```

メールアドレスが確認されていないユーザーは管理者として認めない。

---

<br/>

## RS256署名検証の仕組み

### 公開鍵暗号方式とは

```
【署名の作成】Firebase側（秘密鍵を持っている）

   ヘッダー.ペイロード ─▶ RSA暗号 ─▶ 署名
                              ▲
                              │
                         秘密鍵 ← Firebaseだけが持っている

【署名の検証】Worker側（公開鍵で検証）

   ヘッダー.ペイロード ─▶ RSA検証 ◀─ 署名
                              ▲        結果: ✓ 一致 / ✗ 不一致
                              │
                         公開鍵 ← Googleから誰でも取得可能
```

### Google公開鍵の取得

```typescript
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

async function getGooglePublicKeys(): Promise<Record<string, CryptoKey>> {
  // キャッシュが有効ならそれを使う
  if (publicKeyCache && publicKeyCache.expiresAt > Date.now()) {
    return publicKeyCache.keys
  }

  // Googleから証明書を取得
  const response = await fetch(GOOGLE_CERTS_URL)
  const certs = await response.json()

  // Cache-Controlヘッダーからキャッシュ期間を取得
  const cacheControl = response.headers.get('Cache-Control')
  const maxAge = /* max-ageの値を抽出 */

  // 証明書をCryptoKeyオブジェクトに変換
  for (const [kid, pem] of Object.entries(certs)) {
    keys[kid] = await importPublicKeyFromCert(pem)
  }

  // キャッシュを更新
  publicKeyCache = { keys, expiresAt: Date.now() + maxAge * 1000 }

  return keys
}
```

**なぜキャッシュが必要？**

- 毎回Googleにアクセスするとレスポンスが遅くなる
- Googleの公開鍵は頻繁には変わらない（数時間〜数日）
- `Cache-Control`ヘッダーの`max-age`に従ってキャッシュ

### 署名検証の実装

```typescript
// 署名検証（RS256）
const publicKeys = await getGooglePublicKeys()
const publicKey = publicKeys[header.kid]  // kidで公開鍵を特定

if (!publicKey) {
  console.log('Public key not found for kid:', header.kid)
  return null
}

// 署名対象データ: ヘッダー.ペイロード
const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)

// 署名をBase64URLからバイナリに変換
const signature = base64UrlToArrayBuffer(parts[2])

// WebCrypto APIで検証
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
```

**WebCrypto API** はブラウザやCloudflare Workersで使える標準的な暗号化API。外部ライブラリ不要で署名検証ができる。

---

<br/>

## X.509証明書の解析

Googleから取得する公開鍵はPEM形式のX.509証明書として提供される。

### 証明書の形式

```
-----BEGIN CERTIFICATE-----
MIIDJjCCAg6gAwIBAgIIYS...（Base64エンコードされたバイナリ）
-----END CERTIFICATE-----
```

### 証明書からの公開鍵抽出

```typescript
async function importPublicKeyFromCert(pem: string): Promise<CryptoKey> {
  // 1. PEMヘッダー/フッターを削除
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  // 2. Base64デコードしてバイナリに変換
  const binaryDer = atob(pemContents)
  const bytes = new Uint8Array(binaryDer.length)
  for (let i = 0; i < binaryDer.length; i++) {
    bytes[i] = binaryDer.charCodeAt(i)
  }

  // 3. ASN.1 DER形式の証明書から公開鍵部分（SPKI）を抽出
  const spki = extractSpkiFromCertificate(bytes)

  // 4. WebCrypto APIでCryptoKeyオブジェクトに変換
  return await crypto.subtle.importKey(
    'spki',                                    // 形式
    spki,                                      // 公開鍵データ
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },  // アルゴリズム
    false,                                     // エクスポート不可
    ['verify']                                 // 検証用途
  )
}
```

---

<br/>

## 管理者認可の仕組み

トークンが有効でも、そのユーザーが「管理者かどうか」の確認が別途必要。

```typescript
async function checkAdminAuth(req: Request, env: Env): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)  // "Bearer "を除去
    const payload = await verifyFirebaseToken(token, env)

    if (payload?.email) {
      // 環境変数で設定した管理者メールリストと照合
      const adminEmails = (env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())

      if (adminEmails.includes(payload.email.toLowerCase())) {
        return true  // 管理者として認証成功
      }
    }
  }

  return false  // 管理者ではない
}
```

**環境変数の設定例（Cloudflare Dashboard）:**

```
ADMIN_EMAILS = "admin1@example.com,admin2@example.com"
FIREBASE_PROJECT_ID = "my-firebase-project"
```

---

<br/>

## セキュリティのベストプラクティス

### 実装されている対策一覧

| 対策 | 目的 | 実装箇所 |
|------|------|----------|
| RS256署名検証 | トークン偽造防止 | `verifyFirebaseToken()` |
| アルゴリズム固定（RS256） | ダウングレード攻撃防止 | ヘッダー検証 |
| 有効期限チェック（exp） | 期限切れトークン拒否 | ペイロード検証 |
| 発行者検証（iss） | 不正発行元トークン拒否 | ペイロード検証 |
| 対象者検証（aud） | 他プロジェクト向けトークン拒否 | ペイロード検証 |
| 公開鍵キャッシュ | パフォーマンス最適化 | `getGooglePublicKeys()` |
| CORS設定 | クロスサイトリクエスト制御 | `corsHeaders` |
| 管理者メールリスト | 認可制御 | `checkAdminAuth()` |

### やってはいけないこと

```typescript
// 署名を検証せずにペイロードを信用する
const payload = JSON.parse(atob(token.split('.')[1]))
if (payload.email === 'admin@example.com') {
  // 危険！誰でもこのペイロードを作れる
}

// アルゴリズムを動的に決める
const alg = header.alg  // 攻撃者が "none" を指定できてしまう

// 有効期限をチェックしない
// 一度発行されたトークンが永久に有効になってしまう
```

### 本番環境でのチェックリスト

- `FIREBASE_PROJECT_ID` が正しく設定されているか
- `ADMIN_EMAILS` に管理者のメールのみが含まれているか
- HTTPS経由でのみAPIにアクセスできるか
- 本番環境の秘密情報がログに出力されていないか
- 公開鍵のキャッシュが正しく動作しているか

---

<br/>

## トラブルシューティング

### よくあるエラーと対処法

| エラーメッセージ | 原因 | 対処法 |
|-----------------|------|--------|
| `Token expired` | トークンの有効期限切れ | フロントエンドで`getIdToken(true)`を呼んで再取得 |
| `Invalid issuer` | `FIREBASE_PROJECT_ID`の設定ミス | 環境変数を確認 |
| `Invalid audience` | 別プロジェクトのトークン | FirebaseプロジェクトIDを確認 |
| `Public key not found` | Google公開鍵の取得失敗 | ネットワーク接続を確認、キャッシュをクリア |
| `Invalid signature` | トークンが改ざんされている | 正規のログインフローを使用しているか確認 |

### デバッグ方法

```typescript
// トークンの中身を確認（開発時のみ）
const parts = token.split('.')
console.log('Header:', JSON.parse(atob(parts[0])))
console.log('Payload:', JSON.parse(atob(parts[1])))
```

**注意:** 本番環境ではトークンをログに出力しないこと。

---

<br/>

## 参考リンク

- [Firebase公式: IDトークンの検証](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [JWT.io: JWTのデバッグツール](https://jwt.io/)
- [MDN: Web Crypto API](https://developer.mozilla.org/ja/docs/Web/API/Web_Crypto_API)
- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
