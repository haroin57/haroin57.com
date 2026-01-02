/**
 * ブラウザで認証してからCMSにデプロイするスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/deploy-with-auth.ts
 *
 * 動作:
 *   1. ローカルサーバーを起動して認証ページを表示
 *   2. ユーザーがGoogleログインしてトークンを取得
 *   3. トークンを使用してCMSにデプロイ
 */

import '@dotenvx/dotenvx/config'
import http from 'http'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PORT = 3847
const ADMIN_SECRET = process.env.ADMIN_SECRET

// Firebase設定を環境変数から取得
const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
}

const AUTH_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMS Deploy - 認証</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      font-family: system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
    }
    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      max-width: 400px;
    }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #94a3b8; margin-bottom: 24px; line-height: 1.6; }
    button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #2563eb; }
    button:disabled { background: #475569; cursor: not-allowed; }
    .status {
      margin-top: 24px;
      padding: 12px;
      border-radius: 8px;
      display: none;
    }
    .status.success { display: block; background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .status.error { display: block; background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .status.loading { display: block; background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>CMS Deploy</h1>
    <p>Googleアカウントでログインして<br>記事をCMSにデプロイします</p>
    <button id="loginBtn" onclick="login()">Googleでログイン</button>
    <div id="status" class="status"></div>
  </div>

  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
    import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

    const firebaseConfig = ${JSON.stringify(FIREBASE_CONFIG)};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    window.login = async function() {
      const btn = document.getElementById('loginBtn');
      const status = document.getElementById('status');

      btn.disabled = true;
      status.className = 'status loading';
      status.textContent = 'ログイン中...';

      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const token = await result.user.getIdToken();

        status.textContent = 'デプロイ中...';

        const res = await fetch('/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = 'デプロイ完了！このウィンドウを閉じてください。';
        } else {
          throw new Error(data.error || 'デプロイに失敗しました');
        }
      } catch {
        status.className = 'status error';
        status.textContent = err.message;
        btn.disabled = false;
      }
    };
  </script>
</body>
</html>`

async function runDeploy(token: string): Promise<{ success: boolean; message: string }> {
  try {
    // 環境変数を設定してデプロイスクリプトを実行
    const env = {
      ...process.env,
      FIREBASE_ID_TOKEN: token,
      ADMIN_SECRET: ADMIN_SECRET,
    }

    const { stdout, stderr } = await execAsync(
      'node --experimental-strip-types scripts/deploy-posts.ts',
      { env, cwd: process.cwd() }
    )

    console.log(stdout)
    if (stderr) console.error(stderr)

    return { success: true, message: stdout }
  } catch (error) {
    const err = error as { message: string; stdout?: string; stderr?: string }
    console.error('Deploy error:', err.message)
    return { success: false, message: err.stderr || err.message }
  }
}

async function main() {
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.error('Error: Firebase環境変数が設定されていません')
    console.error('必要な環境変数: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID')
    process.exit(1)
  }

  if (!ADMIN_SECRET) {
    console.error('Error: ADMIN_SECRET環境変数が設定されていません')
    process.exit(1)
  }

  let deployComplete = false

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(AUTH_HTML)
      return
    }

    if (req.method === 'POST' && req.url === '/deploy') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const { token } = JSON.parse(body)
          console.log('\\n認証トークンを受信しました。デプロイを開始します...\\n')

          const result = await runDeploy(token)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))

          if (result.success) {
            deployComplete = true
            console.log('\\nデプロイが完了しました。サーバーを終了します。')
            setTimeout(() => {
              server.close()
              process.exit(0)
            }, 1000)
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Invalid request' }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`
    console.log(`\\n=== CMS Deploy ===`)
    console.log(`認証ページを開いています: ${url}`)
    console.log('ブラウザでGoogleログインしてデプロイを実行してください。\\n')

    // ブラウザを開く
    const command = process.platform === 'win32' ? 'start' :
                    process.platform === 'darwin' ? 'open' : 'xdg-open'
    exec(`${command} ${url}`)
  })

  // 5分でタイムアウト
  setTimeout(() => {
    if (!deployComplete) {
      console.log('\\nタイムアウトしました。')
      server.close()
      process.exit(1)
    }
  }, 5 * 60 * 1000)
}

main()
