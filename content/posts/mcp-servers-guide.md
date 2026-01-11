---
title: "Claude CodeにMCPサーバーを導入したら開発体験が激変した"
summary: "Model Context Protocol（MCP）を使ってClaude Codeに外部ツールを接続してみた話。Web検索、ドキュメント取得、GitHub操作などが自動化できて便利すぎる"
date: "2026-01-11"
tags:
  - Claude Code
  - MCP
  - LLM
  - 開発効率化
---

## 目次

- [目次](#目次)
- [はじめに](#はじめに)
- [MCPとは](#mcpとは)
- [導入のきっかけ](#導入のきっかけ)
- [実際に導入したMCPサーバーたち](#実際に導入したmcpサーバーたち)
  - [Tavily — Web検索](#tavily--web検索)
  - [Context7 — ライブラリドキュメント取得](#context7--ライブラリドキュメント取得)
  - [GitHub — リポジトリ操作](#github--リポジトリ操作)
  - [Playwright — ブラウザ自動化](#playwright--ブラウザ自動化)
- [設定方法](#設定方法)
- [実際の使用例](#実際の使用例)
- [なぜMCPが便利なのか](#なぜmcpが便利なのか)
- [注意点](#注意点)
- [まとめ](#まとめ)

<br/>

## はじめに

Claude Codeは本来、ソフトウェア開発を支援するためのCLIツールだ。しかし、デフォルトの状態では「外部との接続」が限られている。最新のドキュメントを参照したり、Web検索したりすることができない。

本記事では、**MCP（Model Context Protocol）** を使ってClaude Codeに外部ツールを接続し、開発体験を大幅に向上させる方法を紹介する。

<br/>

## MCPとは

**Model Context Protocol（MCP）** は、2024年末にAnthropicが発表したオープン標準プロトコルだ。簡単に言うと、LLMを外部のツールやデータソースに接続するための共通規格である。

従来のLLMは「凍った百科事典」のようなもので、学習した時点の知識しか持っていなかった。最新のライブラリのドキュメントを聞いても古い情報が返ってきたり、「それは私の知識にありません」と言われたりすることがあった。

MCPを使うと、LLMがリアルタイムでWebを検索したり、最新のドキュメントを取得したり、GitHubのリポジトリを操作したりできるようになる。

**MCPの構成要素:**

| コンポーネント | 役割 |
|---------------|------|
| MCP Client | AIアプリケーション側（Claude Code、Cursorなど） |
| MCP Server | 外部サービスとの接続を担当（Tavily、GitHubなど） |
| Transport | 通信方式（stdio、HTTP等） |

要はLLM専用のAPI規格みたいなものだと理解している。

<br/>

## 導入のきっかけ

Claude Codeを使っていて、ドキュメントを調べる作業が面倒だと感じていた。

例えばNext.js 15の新機能について聞くと、Claude Codeは「私の知識は2024年4月までなので、最新の情報は公式ドキュメントを確認してください」みたいな返答をしてくる。結局自分でドキュメントを調べて、その内容をコピペしてClaude Codeに渡す、という作業が発生していた。

```
ユーザー: Next.js 15のApp Routerでミドルウェアを設定したい

Claude Code: 申し訳ありませんが、私の知識は2024年4月までのため、
Next.js 15の最新情報については公式ドキュメントをご確認ください。
```

これが地味にストレスで、何か解決策がないかと調べていたら、MCPサーバーという仕組みがあることを知った。設定してみたら想像以上に便利で、もう手放せなくなっている。

<br/>

## 実際に導入したMCPサーバーたち

現在使っているMCPサーバーを紹介する。

### Tavily — Web検索

**Tavily** はAI向けに最適化されたWeb検索エンジンだ。Claude Codeに「最新の〇〇について調べて」と言うと、勝手にWeb検索して情報を取得してくれる。

**できること:**
- リアルタイムWeb検索
- ニュース検索（日数指定可能）
- 特定ドメインに限定した検索
- Webページからのコンテンツ抽出

**設定:**

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-mcp@latest"],
      "env": {
        "TAVILY_API_KEY": "your-tavily-key"
      }
    }
  }
}
```

無料プランでも月1000回くらいは使えるので、個人開発なら十分だ。

### Context7 — ライブラリドキュメント取得

**Context7** は、プログラミングライブラリの最新ドキュメントを取得するMCPサーバーだ。これがあると、LLMの知識カットオフ問題がほぼ解消される。

**できること:**
- 最新のライブラリドキュメント取得
- コード例の取得
- バージョン指定でのドキュメント検索

**対応ライブラリ:**
React、Vue、Next.js、Rails、Django、Supabase、Prisma、TailwindCSS、その他多数

**設定:**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

CLAUDE.mdに以下のルールを追加しておくと、いちいち「use context7」と書かなくても自動で使ってくれるようになる。

```markdown
Always use Context7 MCP when I need library/API documentation,
code generation, setup or configuration steps.
```

### GitHub — リポジトリ操作

**GitHub MCP** は、GitHubのリポジトリ、Issue、PRをClaude Codeから直接操作できるようにするサーバーだ。

**できること:**
- Issue一覧の取得・作成・更新
- PR一覧の取得・コメント
- コミット履歴の確認
- ブランチ操作

**設定:**

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token"
      }
    }
  }
}
```

正直、これはなくても困らないかもしれないが、あると便利だ。特にOSSのコードを読むときに、Issueを確認しながら作業できるのが良い。

### Playwright — ブラウザ自動化

**Playwright MCP** は、ブラウザ操作を自動化するサーバーだ。

**できること:**
- Webページのスクリーンショット取得
- フォーム入力・送信
- ページ遷移とDOM操作
- コンソールエラーの取得

**設定:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

E2Eテストを書くときや、Webスクレイピング的なことをしたいときに便利だ。

<br/>

## 設定方法

Claude CodeでMCPサーバーを設定するには、`~/.claude.json`（グローバル設定）を編集する。

**設定ファイルの例:**

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-mcp@latest"],
      "env": {
        "TAVILY_API_KEY": "your-tavily-key"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

**設定後の確認:**

設定後、Claude Codeを再起動すればMCPサーバーが有効になる。

```bash
# コマンドラインで確認
claude mcp list

# Claude Code内で確認
/mcp
```

APIキーが必要なサーバーもあるので、各サービスのサイトで取得しておく必要がある。TavilyもContext7も無料プランがあるので、試すだけなら費用はかからない。

<br/>

## 実際の使用例

以下は実際の会話例だ。

---

**例1: 最新ドキュメントを参照したコード生成**

```
ユーザー: Next.js 15のApp Routerでミドルウェアを設定したい

Claude Code: [Context7でNext.js 15のドキュメントを取得]

最新のNext.js 15ドキュメントによると、ミドルウェアは以下のように設定します。

// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 認証チェックなどの処理
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
```

---

**例2: エラーの解決策をWeb検索**

```
ユーザー: このエラーの解決方法を調べて
Error: ENOENT: no such file or directory, open '.env.local'

Claude Code: [TavilyでWeb検索]

このエラーは.env.localファイルが存在しないために発生しています。
Stack OverflowやGitHub Issueの情報によると、以下の対処法があります：

1. プロジェクトルートに.env.localを作成
2. .env.exampleがあればコピーして使用
3. 環境変数が不要な場合は空ファイルでもOK
```

---

**例3: GitHubのIssueを確認しながら作業**

```
ユーザー: このリポジトリの認証関連のIssueを見せて

Claude Code: [GitHub MCPでIssue検索]

認証関連のオープンIssueが3件見つかりました：

1. #234 - OAuth認証でリダイレクトが失敗する
2. #198 - セッションタイムアウトが短すぎる
3. #156 - 二要素認証の実装リクエスト

#234が最近更新されていて、workaroundも提案されています。
```

---

<br/>

## なぜMCPが便利なのか

この仕組みが便利な理由は以下の3点だ。

1. **知識カットオフの解消** - LLMの学習時点の知識に縛られず、最新情報にアクセスできる。新しいライブラリやフレームワークを使う際に特に有効

2. **コンテキストスイッチの削減** - 以前は「Claude Codeに質問→古い情報→自分でドキュメント検索→コピペして再質問」というフローだったが、MCPがあれば一発で最新情報を踏まえた回答が得られる

3. **外部サービスとのシームレスな連携** - GitHub、Web検索、ブラウザ操作などを、すべてClaude Codeの中から実行できる。ターミナルとブラウザを行き来する必要がなくなる

特にContext7の効果が大きい。新しいライブラリを触るときのハードルがかなり下がった。「Supabaseで認証を実装したい」と言えば、最新のドキュメントを参照してコードを書いてくれる。

<br/>

## 注意点

使っていて気づいた注意点をいくつか挙げておく。

- **APIキーの管理** - TavilyやGitHubのAPIキーを設定ファイルに書くことになるので、管理には気をつけたほうがいい。`.claude.json`をgitにコミットしないように注意

- **トークン消費** - MCPツールの出力はトークンを消費する。ドキュメントを取得するたびにコンテキストが膨らんでいくので、不要なサーバーは無効化しておいたほうがいい

- **レート制限** - 外部APIにはレート制限がある。Tavilyは無料プランだと月1000回くらいの制限があるので、ヘビーに使う場合は有料プランを検討する

- **信頼性** - MCPサーバー経由で取得した情報が必ずしも正確とは限らない。特にWeb検索の結果は玉石混交なので、重要な情報は自分でも確認したほうが安全だ

<br/>

## まとめ

MCPを導入してから、Claude Codeでの開発体験が明らかに向上した。

| サーバー | 用途 | おすすめ度 |
|---------|------|----------|
| Context7 | ライブラリドキュメント取得 | ★★★★★ |
| Tavily | 最新情報の検索 | ★★★★☆ |
| GitHub | リポジトリ・Issue操作 | ★★★☆☆ |
| Playwright | ブラウザ自動化 | ★★★☆☆ |

設定も難しくないので、Claude Codeを使っている人は試してみることをおすすめする。特にContext7は導入コストが低い割に効果が大きいので、まずはこれだけでも入れてみるといいと思う。

MCPは2025年以降、Goldman Sachs、Microsoft、Replitなど多くの企業が採用を進めている。エコシステムがどんどん広がっているので、今後も新しいサーバーが出てくるのが楽しみだ。
