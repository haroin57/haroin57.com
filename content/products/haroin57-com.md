---
title: "haroin57.com — 記事と制作物、日々の記録をまとめる個人サイト"
summary: "React 19とTypeScriptを土台に、Markdown生成・ビルド時SSR・Cloudflare Workers APIを組み合わせた個人サイトの構成と実装。"
date: "2026-11-17"
product: "haroin57-com"
tags:
- React
- TypeScript
- Vite
- Cloudflare
---

## このサイトで扱うもの

haroin57.comは、技術記事、制作物、写真、プロフィールをまとめる個人サイトです。コンテンツを読むための画面に加えて、掲示板や日々の習慣を記録する機能も同じサイトに置いています。

記事の本文はリポジトリ内のMarkdownで管理し、閲覧画面はReactで実装しています。更新頻度の低いコンテンツはビルドで用意し、アクセス数や掲示板、習慣の実績といった変化するデータはCloudflare WorkersのAPIで扱う構成です。

## 実装に使っている技術

| 領域 | リポジトリの構成 |
| --- | --- |
| 画面 | React 19、TypeScript、React Router 7 |
| スタイル | Tailwind CSS 3.4、CSS変数による色やサーフェスの管理 |
| ビルド | `vite`を`rolldown-vite@7.2.5`へのnpm aliasとして指定 |
| Reactのコンパイル | `babel-plugin-react-compiler`をReact 19向けに設定 |
| Markdown | gray-matter、remark、rehypeの生成処理 |
| HTML生成 | `react-dom/server`とビルド後のプリレンダースクリプト |
| 配信 | Cloudflare PagesとWorkers |
| データ保存 | Workers KV、D1。R2の画像ストレージ用bindingも設定 |

パッケージが入っていることと、その機能がすべて公開されていることは分けて考えています。例えば、現在のスタイル基盤はTailwind CSS 3系です。また、R2や記事用D1の設定はありますが、現在のWorkerエントリにはCMS APIのルート処理はありません。

## Markdownを公開画面へ届ける流れ

記事は`content/posts/`、制作物の解説は`content/products/`に保存しています。各Markdownには、タイトル、概要、日付、タグなどをfrontmatterとして記述します。制作物の記事では`product`で対象のプロダクトを指定します。

`npm run build`では型チェックの後、記事と制作物の生成スクリプトを実行します。生成処理はfrontmatterと本文を読み取り、MarkdownをHTMLに変換し、画面から参照するJSONを書き出します。

```text
content/posts/*.md
  → scripts/deploy-posts.ts --gen-json
  → src/data/posts.json

content/products/*.md
  → scripts/gen-product-posts.ts
  → src/data/product-posts.json / products.json
```

生成処理には表などを扱うGFM、数式用のremark-mathとrehype-katex、コード表示用のrehype-pretty-codeなどを組み込んでいます。目次用の情報もJSONに含め、記事詳細の表示に使います。

このページも同じ経路で生成されます。表示を修正するときはMarkdownまたは生成スクリプトを変更し、生成JSONを直接編集しない運用です。

## クライアントの画面遷移とビルド時SSR

ブラウザ内のルーティングはReact Routerで処理します。`AnimatedRoutes.tsx`にクライアント用のルートを定義し、`ServerRoutes.tsx`にもSSR用のルートを置いています。画面ごとの動的importに加え、`preloadRoutes.ts`で遷移先のコンポーネントを事前に読み込める構成です。

ビルドはクライアント用ファイルの生成だけでは終わりません。`src/entry-server.tsx`をSSR向けにビルドし、`scripts/prerender.ts`が対象URLを`StaticRouter`と`renderToString`に渡して、ルートごとのHTMLを書き出します。対象はトップ、Home、記事一覧、制作物一覧、写真と、生成データから列挙した記事・制作物の詳細ページです。

これはビルド時のHTML生成です。閲覧リクエストごとにReactを実行するSSRサーバーを常駐させる構成にはしていません。プリレンダー対象外の画面には、Pagesの`_redirects`によるSPAフォールバックを使います。

## Workersが担当する動的な処理

`src/workers/index.ts`でAPIのパスを判定し、処理を各モジュールに振り分けます。現在の入口にはPV、Good、BBS、CyaniteのWebhook、習慣トラッカーのルートがあります。

| 保存先 | 役割 |
| --- | --- |
| `HAROIN_PV`（KV） | アクセス数やGood、レート制限に使うデータ |
| `BBS_DB`（D1） | スレッドと投稿を持つ掲示板 |
| `HABIT_DB`（D1） | 習慣の実績と非公開To-Do |
| `POSTS_DB`（D1） | 記事・制作物用に設定されたDB |
| `CMS_IMAGES`（R2） | 画像用に設定されたバケット |

BBSはスレッド一覧、スレッド作成、返信、管理者による削除を扱います。管理者認証には`ADMIN_SECRET`を使用します。通常のAPIではOrigin/Refererの確認を通し、習慣APIではiOSショートカットからの利用に合わせてBearer認証を使います。

CMSについては、記事の取得先を表す定数やデプロイスクリプト、DBの初期化SQLが残っています。一方、現在のWorkerには`/api/cms/*`の実装がありません。したがって、今回の構成説明では、動作するCMS管理画面があるとは扱いません。記事や制作物の公開データはMarkdownからの生成経路で更新します。

## 日々の実績を確認するIf-Then Habit

[公開ログ](/habit)には、過去365日のヒートマップ、累計実績、連続達成日数、直近30日間のログとメモを表示します。旧`/logs`からは`/habit`へ転送します。Webサイトは閲覧専用で、記録フォームやトークン保存、To-Do操作、X投稿文の作成UIはありません。

記録APIはiOSショートカットなどの外部クライアント向けに維持しています。Bearer認証を使ってクイック記録や夜の総括、非公開To-Doを更新できます。記録日はJST午前4時で切り替えます。翌日To-Doは公開ログには含めません。

## 変更と確認の単位

画面、API、記事の元原稿を同じリポジトリで管理することで、機能を追加したときに、その使い方や制作物の解説も一緒に更新できます。

変更後の最低条件は`npm run build`の成功です。このコマンドでTypeScript、MarkdownからJSONへの生成、クライアントビルド、SSRビルド、プリレンダーをまとめて確認します。習慣APIには、日付境界、認証、加算、To-Do保存のロールバック、公開データの範囲を確認するテストも用意しています。

PagesのフロントエンドとWorkerのAPIは別々にデプロイします。新しいDBを使う機能にはSQLの適用とsecretの設定も必要です。If-Then Habitの構成と導入手順は`docs/habit/README.md`に記載しています。

ソースコードは[GitHubのharoin57/haroin57.com](https://github.com/haroin57/haroin57.com)で公開しています。
