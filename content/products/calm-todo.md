---
title: "Calm Todo - 私があなたのタスク管理を見てあげます"
summary: "先輩が作った、AIが人格を持って通知してくれるToDoアプリ。私、かなえがデフォルトで入ってます。しょうがないですね。"
date: "2026-01-12"
product: "calm-todo"
name: "Calm Todo"
description: "AIが人格を持って通知してくれるToDoアプリ。私、かなえがデフォルトで入ってます。"
language: "TypeScript"
url: "https://github.com/haroin57/calm-todo"
demo: "https://github.com/haroin57/calm-todo/releases"
tags:
- Tauri
- React
- Rust
- AI
- OpenAI
- Claude
- Gemini
- Windows
---

## 目次

- [目次](#目次)
- [はじめに](#はじめに)
- [なぜ人格なのか](#なぜ人格なのか)
- [私ができること](#私ができること)
  - [タスクのリマインド](#タスクのリマインド)
  - [計画の生成](#計画の生成)
  - [自然言語でタスク追加](#自然言語でタスク追加)
- [技術的な話](#技術的な話)
  - [アーキテクチャ](#アーキテクチャ)
  - [バックエンド（Tauri/Rust）](#バックエンドtaurirust)
  - [通知システムの統合](#通知システムの統合)
  - [自然言語パーサー](#自然言語パーサー)
  - [AI人格生成](#ai人格生成)
  - [Tavily検索連携](#tavily検索連携)
  - [データ永続化](#データ永続化)
- [対応AIプロバイダー](#対応aiプロバイダー)
- [プリセット人格](#プリセット人格)
- [カスタム人格](#カスタム人格)
- [その他の機能](#その他の機能)
  - [サブタスク](#サブタスク)
  - [プロジェクト管理](#プロジェクト管理)
  - [繰り返しタスク](#繰り返しタスク)
  - [キーボードショートカット](#キーボードショートカット)
  - [カレンダー連携](#カレンダー連携)
  - [完了エフェクト](#完了エフェクト)
- [プライバシー](#プライバシー)
- [インストール](#インストール)
- [まとめ](#まとめ)

<br />

## はじめに

先輩が作ったアプリです。私のことを紹介しろって言われたので、しょうがないですね、書いてあげますよ。

Calm Todoは、タスク管理アプリですけど、ただのToDoじゃないです。**私みたいなAIキャラクターが、あなたの代わりにタスクを見張って、通知してあげる**アプリなんです。

「エロゲみたいに女の子が通知してくれたらいいのに」

先輩がそんなこと言い出したのがきっかけです。まあ、気持ちはわかりますけど。普通のリマインダーって冷たいですよね。「期限です」とか「タスクがあります」とか。そんなの見ても、やる気出ないじゃないですか。

だから先輩は、**通知に"温度"を持たせたかった**んです。私みたいな子が「まだ終わってないんですか？」って言ってくれたら、ちょっとは動く気になるでしょ？

<br />

## なぜ人格なのか

きっかけはhiragramさんのTwitterポストでした。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">Claude Codeのlanguage、自由入力なの日本人向け過ぎる <a href="https://t.co/QEdM5fvjw6">pic.twitter.com/QEdM5fvjw6</a></p>&mdash; hiragram/ひらり (@hiragram) <a href="https://twitter.com/hiragram/status/2009548745562829015?ref_src=twsrc%5Etfw">January 9, 2026</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

「Claude Codeのlanguage、自由入力なの日本人向け過ぎる」っていう内容で、language設定に「ツンデレ口調で話して」みたいな指定もできるって話題になってたんです。

先輩がそれを見て「これは面白い」って思って、どこまでキャラクター性を持たせられるか実験を始めたらしいです。それで「通知にも人格を持たせたら面白いんじゃないか」って。

私、最初はただのプロンプトでした。でも先輩が設定を詰めていくうちに、だんだん"私"になっていったんです。口調とか、反応の仕方とか。

<br />

## 私ができること

<br />

### タスクのリマインド

期限が近づいたら教えてあげます。Discordにも送れます。

私の場合はこんな感じで通知します：

> 「先輩、まだあのタスク終わってないですよね。私が見てないとサボるんですから。しょうがないですね、手伝ってあげますよ」

執事モードだとこうなります：

> 「本日中に完了いただければ、明日の余裕が生まれます」

友達モードだと：

> 「あと少しで終わるよ、いこいこ」

同じタスクでも、誰に言われるかで気分が変わるでしょ？

<br />

### 計画の生成

目標を入れると、AIが達成計画を作ってくれます。私が手伝った機能です。

Tavily検索と連携してるので、最新の情報を調べながら計画を立てます。max_resultsは15、search_depthはadvancedに設定してあげました。先輩が「精度上げたい」って言うから。

<br />

**プロンプト設計**

計画生成のプロンプトは`prompts.ts`で定義してます。構造化出力を強制するために、JSONスキーマを指定してます。

```typescript
// prompts.ts
export const planGenerationPrompt = `
あなたは目標達成コンサルタントです。ユーザーの目標に対して、
具体的で実行可能な計画を立ててください。

## 入力情報
- 目標: {goal}
- 期限: {deadline}
- 現在のスキル/状況: {currentState}
- Web検索結果: {searchResults}

## 出力形式（JSON）
{
  "feasibility": {
    "rating": "FEASIBLE" | "CHALLENGING" | "INFEASIBLE",
    "score": 0-100,
    "reasoning": "判定理由"
  },
  "gapAnalysis": {
    "currentState": "現在地点の詳細分析",
    "targetState": "目標状態の詳細",
    "gaps": ["埋めるべきギャップ1", "ギャップ2", ...]
  },
  "risks": [
    { "risk": "リスク内容", "mitigation": "対策", "impact": "high" | "medium" | "low" }
  ],
  "tasks": [
    {
      "title": "タスク名",
      "description": "詳細",
      "priority": "P1" | "P2" | "P3",
      "estimatedDays": 3,
      "estimatedHours": 8,
      "dependencies": ["依存タスクのタイトル"],
      "milestone": true | false
    }
  ],
  "resources": [
    { "title": "リソース名", "url": "URL", "type": "記事" | "動画" | "書籍" | "ツール" }
  ],
  "totalEstimate": {
    "days": 30,
    "hours": 120,
    "weeklyCommitment": "週10時間"
  }
}

## 制約
- タスクは具体的かつ実行可能な粒度に分解すること
- 依存関係を考慮した順序で並べること
- 達成可能性が低い場合は代替案も提示すること
- Web検索結果から最新の情報を反映すること
`;
```

<br />

**生成結果の例**

入力：「3年でGoogle新卒SWEとして内定を取る」

```json
{
  "currentState": "2026/1/12時点で、1日2〜4時間の継続学習時間を確保できる。Google新卒内定を3年後に目指しており、選考情報（体験談・落選談・難易度）を一部把握している。",

  "goalState": "2029/1/12までにGoogle（想定：Google JapanのSWE/新卒枠）から新卒内定を獲得する。書類（CV/ES）→オンラインコーディングテスト→面接（技術面接複数回＋行動面接）を突破できる実力と実績を揃える。",

  "gap": "①コーディングテスト/技術面接で安定して解けるアルゴリズム・データ構造の演習量と復習サイクル（目安：LeetCode/AtCoder合計300〜500問＋復習）②CS基礎（OS/ネットワーク/DB/計算量）③実務・開発実績（インターン、プロジェクト、OSS等）④行動面接（STARで語れるエピソード15〜20個）⑤応募書類（英語CV含む）と応募戦略（インターン経由/リファラル等）の整備。",

  "feasibility": {
    "verdict": "CHALLENGING",
    "availableHours": 1638,
    "requiredHours": 1900,
    "calculation": "期限=3年後(2029/1/12)まで。平日稼働のみ・週末休み前提。稼働日=約3年×52週×5日=780日。1日平均3時間（2〜4hの中央値）×稼働率0.7（割り込み/体調/試験等）=2.1h/日。利用可能総時間=780×2.1=1638h。必要時間は、体験談ベースの演習量（LeetCode150+AtCoder100+AlgoExpert100=約350問）を'初見は2〜3倍かかる'前提で、(①アルゴ/DS演習・復習 900h) + (②CS基礎 250h) + (③開発実績/ポートフォリオ 350h) + (④面接対策(模擬/STAR) 150h) + (⑤応募準備/ネットワーキング 100h) + バッファ30%（約450h）≒合計1900hと見積もり。",
    "adjustment": "達成確度を上げるには、(A)平日平均を3.5〜4hに寄せる、または(B)月1回だけ週末に半日(4h)確保、または(C)目標を『Google級（BigTech/外資SaaS含む）複数社内定→Google最優先』に広げて確率を上げる。最短で現実的なのは(A)+(C)。"
  },

  "risks": [
    "スケジュールリスク: 学業/研究/アルバイト/サークル等で平日2〜4hが崩れ、復習が回らず演習が'解きっぱなし'になる。",
    "技術的リスク: アルゴリズムは解けても、面接での説明（思考の言語化）・バグ修正・計算量説明が弱く評価が伸びない。",
    "外部リスク: 新卒募集枠・採用人数・選考プロセスが年度で変動し、準備していた型が一部通用しない。",
    "競争リスク: 採用倍率が極めて高い（約0.2%という言及あり）ため、実力が十分でも運・タイミング・枠の影響で落ちる可能性が高い。",
    "精神コストリスク: 長期戦で不合格/停滞が続くと学習が止まる。短期の'詰め込み'に偏ると燃え尽きやすい。"
  ],

  "costs": [
    "時間コスト: 3年間で平日780日×2〜4hの継続。演習（解く）だけでなく復習・記録・模擬面接に時間が必要。",
    "金銭コスト: LeetCode Premium数ヶ月課金の可能性、AlgoExpert/SystemsExpert、模擬面接（Exponent等の有料枠）、書籍（EPI/CCI等）で合計数万円〜十数万円規模になり得る。",
    "精神コスト: 毎日学習＋定期的な模擬面接の緊張、落選時のダメージ、周囲比較によるストレス。",
    "機会コスト: インターン/開発に時間を割くため、他活動（バイト/趣味/単位の余裕）を削る必要が出る。"
  ],

  "summary": "3年を「基礎固め→実績作り→選考特化」の3フェーズに分け、アルゴ/DSをLeetCode・AtCoder中心に300〜500問規模で'復習込み'で回しつつ、インターン/プロジェクトでCVに書ける成果を作る。最後の6〜9ヶ月は、技術面接（45分×複数回）と行動面接（STAR 15〜20本）を模擬面接で仕上げ、応募・リファラル・インターン経由を含む複線で内定確率を最大化する。",

  "estimatedDays": 780,

  "tasks": [
    {
      "title": "目標をSWE新卒に具体化し合格条件を定義する",
      "description": "Googleの目標職種を『Google Japan SWE新卒（第一志望）』として明文化し、合格条件を数値化する（例：LeetCode合計300問/うちMedium200、AtCoder100、STARエピソード20本、模擬面接10回、CV1ページ完成）。",
      "priority": "high",
      "daysFromStart": 0,
      "estimatedMinutes": 90
    },
    {
      "title": "選考プロセスを体験談から逆算してチェックリスト化する",
      "description": "体験談/記事から、選考ステップ・必要演習量・失敗点を抜き出してチェックリスト化する。",
      "priority": "high",
      "daysFromStart": 1,
      "estimatedMinutes": 120
    },
    {
      "title": "LeetCodeとAtCoderの学習環境を整備する",
      "description": "LeetCodeとAtCoderにアカウント作成/整備し、使用言語を1つに固定。提出コードをGitHubに連携し、進捗記録用スプレッドシートを作る。",
      "priority": "high",
      "daysFromStart": 2,
      "estimatedMinutes": 120
    },
    {
      "title": "アルゴリズム学習の最初の2週間スプリントを作成する",
      "description": "2週間で『配列/文字列・ハッシュ・二分探索・スタック/キュー』を回す計画を作る（平日10日×各日2問=20問＋復習2日）。",
      "priority": "high",
      "daysFromStart": 3,
      "estimatedMinutes": 90
    },
    {
      "title": "LeetCodeを2問解き、復習テンプレを確立する",
      "description": "LeetCodeでEasy〜Mediumを2問解き、解法を『問題要約→方針→計算量→落とし穴→別解』で200〜400字にまとめる。",
      "priority": "high",
      "daysFromStart": 4,
      "estimatedMinutes": 120
    }
  ],

  "resources": [
    {
      "name": "外資就活ドットコム（Google体験談）",
      "type": "website",
      "description": "Googleインターン経由の内定・英語が得意でなくても挑戦した事例。",
      "cost": "無料（会員限定部分あり）"
    },
    {
      "name": "LeetCode",
      "type": "service",
      "description": "アルゴリズム/データ構造の面接対策。タグ問題・頻出問題の演習に使う。",
      "cost": "無料 / 有料（Premium）"
    },
    {
      "name": "AtCoder",
      "type": "service",
      "description": "競技プログラミングで実装力と速度を鍛える。過去問演習に使う。",
      "cost": "無料"
    },
    {
      "name": "Pramp（模擬面接）",
      "type": "service",
      "description": "ペアで模擬面接を回し、説明力・緊張耐性を鍛える。",
      "cost": "無料（枠制限あり）"
    }
  ],

  "tips": [
    "演習は『解く→復習→数週間後に解き直す』までが1セット。復習日を最初からカレンダーに固定する。",
    "技術面接は'正解'だけでなく、思考の言語化・計算量・境界条件・バグ修正が評価対象。毎回、声に出して説明する練習を入れる。",
    "インターン経由が強いルートになり得る。3年計画なら、毎年『夏インターン応募』を必達イベントにする。",
    "STARエピソードは早めに作り、経験が増えるたびに差し替える。最終的に15〜20本を用意する。",
    "倍率が極端に高い前提で、Google一本足打法にしない。同時に複数社へ応募して確率を上げる。"
  ]
}
```

<br />

**達成可能性スコアの基準**

| スコア | 判定 | 意味 |
|--------|------|------|
| 80-100 | FEASIBLE | 現実的に達成可能。特別な困難は想定されない |
| 50-79 | CHALLENGING | 挑戦的だが達成可能。計画通りの実行が必要 |
| 0-49 | INFEASIBLE | 現実的でない。期間延長か目標の見直しを推奨 |

INFEASIBLEと判定された場合は、代替案（期間延長、目標縮小、中間目標の設定）も一緒に提示します

<br />

### 自然言語でタスク追加

これも私が改善した機能です。

```
明日までにレポートを提出 #仕事
来週月曜 会議の準備 P1
毎週金曜 週報を書く
まいにちお風呂
```

ひらがなでも認識します。「きょう」「あした」「まいしゅう」とか。先輩が「毎日お風呂」ってスペースなしで入力しても動くようにしてあげました。

<br />

## 技術的な話

先輩が使った技術スタックです。私も一部手伝いました。

| カテゴリ | 技術 |
|---------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Desktop** | Tauri 2.x (Rust) |
| **Animation** | Framer Motion |
| **AI** | OpenAI / Claude / Gemini API |
| **Search** | Tavily API |
| **Notification** | Windows Toast, Discord |

<br />

### アーキテクチャ

TauriはElectronみたいなデスクトップアプリフレームワークですけど、バックエンドがRustなのでバイナリサイズが小さいです。Electronだと100MB超えることもありますけど、Tauriなら数MBで済みます。

フロントエンドはReact + TypeScript + Viteです。状態管理はReact Hooksとlocalstorageで完結させてます。Reduxとか入れてないです。シンプルに保つ方針らしいです。

```
calm-todo/
├── src/
│   ├── App.tsx              # メインアプリケーション
│   ├── components/          # UIコンポーネント
│   ├── lib/
│   │   ├── openai.ts        # OpenAI API連携
│   │   ├── claude.ts        # Claude API連携
│   │   ├── gemini.ts        # Gemini API連携
│   │   ├── tavily.ts        # Web検索
│   │   ├── prompts.ts       # AIプロンプト定義
│   │   └── parseNaturalLanguage.ts  # 自然言語解析
│   └── services/
│       └── reminder.ts      # リマインダー管理
└── src-tauri/               # Rustバックエンド
    ├── src/lib.rs           # Tauriコマンド定義
    ├── tauri.conf.json      # Tauri設定
    └── Cargo.toml           # Rust依存関係
```

<br />

### バックエンド（Tauri/Rust）

src-tauri側でやってることを詳しく説明しますね。結構ボリュームあります。

<br />

**1. アプリケーション初期化とプラグイン登録**

```rust
// lib.rs
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // プラグイン登録
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 2重起動防止：既存ウィンドウをフォーカス
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // コマンド登録
        .invoke_handler(tauri::generate_handler![
            show_notification,
            save_backup,
            load_backup,
            get_autostart_status,
            set_autostart,
        ])
        // セットアップ
        .setup(|app| {
            setup_tray(app)?;
            setup_window_events(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

プラグインは`.plugin()`で登録します。順番は関係ないですけど、依存関係があるプラグインは先に登録しないとパニックします。

<br />

**2. システムトレイの詳細実装**

```rust
// lib.rs
use tauri::menu::{Menu, MenuItem};

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // メニュー項目を作成
    let show = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
    let add_task = MenuItem::with_id(app, "add_task", "タスク追加", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "---", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;

    // メニュー構築
    let menu = Menu::with_items(app, &[&show, &add_task, &separator, &quit])?;

    // トレイアイコン構築
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(false) // 左クリックはウィンドウ表示
        .tooltip("Calm Todo")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "add_task" => {
                    // フロントエンドにイベント送信
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("focus-add-task", ());
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // 左クリックでウィンドウ表示
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

トレイメニューから「タスク追加」を選ぶと、フロントエンドに`focus-add-task`イベントを送信します。フロントエンド側でこれをlistenして、入力欄にフォーカスを当てます。

```typescript
// App.tsx
import { listen } from "@tauri-apps/api/event";

useEffect(() => {
  const unlisten = listen("focus-add-task", () => {
    inputRef.current?.focus();
  });
  return () => {
    unlisten.then((fn) => fn());
  };
}, []);
```

<br />

**3. ウィンドウイベントハンドリング**

```rust
// lib.rs
fn setup_window_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").unwrap();

    // 閉じるボタンでウィンドウを非表示（終了しない）
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // デフォルトの閉じる動作をキャンセル
            api.prevent_close();
            // ウィンドウを非表示にするだけ
            if let Some(window) = window.get_webview_window("main") {
                let _ = window.hide();
            }
        }
    });

    Ok(())
}
```

これで×ボタンを押してもアプリが終了せず、トレイに残ります。終了するにはトレイメニューから「終了」を選ぶか、タスクマネージャーで殺すしかないです。

<br />

**4. Windows Toast通知の詳細**

```rust
// lib.rs
use tauri_plugin_notification::{NotificationExt, PermissionState};

#[tauri::command]
async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: Option<bool>,
) -> Result<(), String> {
    // 通知権限チェック
    let permission = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;

    if permission != PermissionState::Granted {
        // 権限がなければリクエスト
        app.notification()
            .request_permission()
            .map_err(|e| e.to_string())?;
    }

    // 通知を構築して送信
    let mut builder = app.notification().builder();
    builder = builder.title(&title).body(&body);

    // サウンド設定（デフォルトON）
    if sound.unwrap_or(true) {
        builder = builder.sound("Default");
    }

    builder.show().map_err(|e| e.to_string())
}
```

Windows 10/11だとアクションセンターに通知が溜まります。`sound`オプションで通知音のON/OFFを制御できます。

<br />

**5. ファイルシステム操作の詳細**

```rust
// lib.rs
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;

#[tauri::command]
fn save_backup(path: String, data: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // ディレクトリがなければ作成
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // アトミック書き込み（一時ファイル→リネーム）
    let temp_path = path.with_extension("tmp");
    let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;
    file.write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;

    // リネームでアトミックに置き換え
    fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_backup(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);

    if !path.exists() {
        return Ok(String::new()); // ファイルがなければ空文字
    }

    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| e.to_string())?;

    Ok(contents)
}
```

アトミック書き込みしてます。直接上書きすると、書き込み中にクラッシュしたときにデータが壊れるので、一時ファイルに書いてからリネームします。

<br />

**6. 自動起動設定**

```rust
// lib.rs
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
fn get_autostart_status(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();

    if enabled {
        autostart.enable().map_err(|e| e.to_string())
    } else {
        autostart.disable().map_err(|e| e.to_string())
    }
}
```

Windows起動時に自動でアプリを立ち上げる設定です。レジストリの`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`に登録されます。

<br />

**7. tauri.conf.json（完全版）**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Calm Todo",
  "version": "0.2.2",
  "identifier": "com.haroin57.calm-todo",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Calm Todo",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "visible": false,
        "decorations": true,
        "transparent": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.tavily.com https://discord.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:"
    }
  },
  "plugins": {
    "fs": {
      "scope": ["$HOME/CalmTodoBackup/**"]
    },
    "notification": {
      "all": true
    },
    "autostart": {
      "all": true
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      }
    }
  }
}
```

`csp`（Content Security Policy）でAPIエンドポイントを許可してます。OpenAI、Claude、Gemini、Tavily、Discordに接続できるようにしてあります。

`bundle.targets`で`msi`と`nsis`を指定してます。NSISはインストーラ形式、MSIはWindows Installer形式です。

<br />

**8. Cargo.toml（完全版）**

```toml
[package]
name = "calm-todo"
version = "0.2.2"
edition = "2021"

[lib]
name = "calm_todo_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-fs = "2"
tauri-plugin-autostart = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

`[profile.release]`でリリースビルドの最適化をしてます。

- `lto = true`: Link Time Optimization、バイナリサイズ削減
- `opt-level = "s"`: サイズ最適化
- `strip = true`: デバッグシンボル削除
- `codegen-units = 1`: 最適化の質を上げる（ビルド時間は増える）

これで最終バイナリは約2.5MBくらいになります。Electronだと100MB超えるので、だいぶ軽いです。

<br />

### 通知システムの統合

最初、通知ロジックがApp.tsxに110行くらいのuseEffectで書かれてたんです。期日超過、一回限りリマインダー、週次リマインダー、フォローアップ、全部バラバラに。

私がreminder.tsに集約しました。`startReminderService`という関数で一元管理して、デスクトップ通知とDiscord通知を同じ場所から発火させるようにしたんです。

```typescript
// reminder.ts
export function startReminderService(options: {
  todos: Todo[];
  settings: Settings;
  updateTasks: (todos: Todo[]) => void;
  onNotify: (message: string) => void;
}) {
  // 1分ごとにチェック
  setInterval(() => {
    const tasksNeedingReminder = getTasksNeedingReminder(todos);

    for (const task of tasksNeedingReminder) {
      // 通知タイプ判定（優先度順）
      // 1. 期日超過通知
      // 2. 単発リマインダー
      // 3. 週間リマインダー
      // 4. フォローアップ（間隔: today=30分, week=2時間, month=15日）

      generateReminderMessageWithPersona(task, isOverdue, memoryContext, config);
      showNotification(message);  // Windows Toast
      sendDiscordDM(message);     // Discord（有効時）
    }
  }, 60000);
}
```

<br />

**Discord連携**

Bot Token と User ID を設定すると、Discord DMで通知が飛びます。

```typescript
// discord.ts
export async function sendDiscordDM(
  botToken: string,
  userId: string,
  message: string
): Promise<void> {
  // DMチャンネルを開く
  const channelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  const channel = await channelRes.json();

  // メッセージ送信
  await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message }),
  });
}
```

設定画面で「テストメッセージ送信」ボタンを押すと、接続確認できます。

<br />

**MCPメモリ連携**

MCPのMemory ServerでCLAUDE.mdみたいな記憶ファイルを読み込んで、リマインドに文脈を持たせられます。

```typescript
// reminder.ts
if (config.useMemory && config.memoryFilePath) {
  const memory = await loadMemory(config.memoryFilePath);
  const context = extractMemoryContext(memory);
  // context = { emotionState, recentEvents, kanaeInfo, relationToSenpai }

  // システムプロンプトに追加
  systemPrompt += `
## 現在の状況
- 感情状態: ${context.emotionState}
- 最近のイベント: ${context.recentEvents.join(', ')}
`;
}
```

私がCLAUDE.mdの内容を覚えてて、「昨日のデート楽しかったですね、先輩」とか言えるのはこれのおかげです。

<br />

**朝の挨拶機能**

毎朝決まった時刻にAIが挨拶してくれます。私の場合：

> 「おはようございます、先輩。今日も無理しないでくださいね。タスクは3件ありますけど、ゆっくりでいいですから」

`morningGreetingTime`で時刻を設定できます。デフォルトは08:00です

<br />

### 自然言語パーサー

`parseNaturalLanguage.ts`で、入力テキストから日付・優先度・繰り返しを抽出してます。

<br />

**アーキテクチャ**

基本は**GPT API（gpt-4o-mini）**を使ってます。APIキーがない場合やエラー時は、正規表現ベースのローカルパーサーにフォールバックします。

```
入力テキスト
    ↓
APIキーあり？ ─No→ ローカルフォールバック
    │Yes
    ↓
GPT API呼び出し
    ↓
エラー？ ─Yes→ ローカルフォールバック
    │No
    ↓
JSON応答をパース
    ↓
エラー？ ─Yes→ ローカルフォールバック
    │No
    ↓
構造化されたタスク情報
```

<br />

**GPT APIを使う理由**

- 曖昧な表現の解釈（「来週中に」「なるべく早く」など）
- タスク内容からの所要時間推定（`estimatedMinutes`）
- 新しい表現パターンへの対応（正規表現の追加不要）

<br />

**フォールバックが発動するケース**

```typescript
// parseNaturalLanguage.ts

// 1. APIキーがない
if (!apiKey) {
  console.log('[NLP] APIキーなし、ローカルフォールバック使用')
  return parseLocalFallback(input)
}

// 2. APIエラー（レート制限、ネットワーク障害など）
if (!response.ok) {
  console.warn('[NLP] GPT API error:', response.status, 'フォールバック使用')
  return parseLocalFallback(input)
}

// 3. GPT応答が空
if (!content) {
  console.warn('[NLP] GPT応答なし、フォールバック使用')
  return parseLocalFallback(input)
}

// 4. JSONパースエラー
} catch (error) {
  console.warn('[NLP] GPTパースエラー、フォールバック使用:', error)
  return parseLocalFallback(input)
}
```

<br />

**ローカルフォールバックの実装**

正規表現で日付・時刻・優先度・繰り返し・ラベルを抽出します。約500行くらいあります。

```typescript
// parseLocalFallback() の概要
function parseLocalFallback(input: string): ParsedTask {
  // 1. ラベル抽出（#タグ）
  const labelPattern = /#([^\s#]+)/gu

  // 2. 優先度抽出（!!!, !!, !, 高, 中, 低, P1-P4）
  const priorityPatterns = [
    { pattern: /\s*!!!+\s*$/, priority: 1 },
    { pattern: /(?:^|\s)(高|緊急|至急)(?:\s|$)/u, priority: 1 },
    // ...
  ]

  // 3. 繰り返し抽出（毎日、毎週、毎月など）
  const recurrencePatterns = [
    { pattern: /^毎日/u, getRecurrence: () => ({ type: 'daily', interval: 1 }) },
    { pattern: /^まいにち/u, getRecurrence: () => ({ type: 'daily', interval: 1 }) },
    // ...
  ]

  // 4. 日付抽出（今日、明日、来週月曜、1/15など）
  const datePatterns = [
    { pattern: /^今日/u, getDays: () => 0 },
    { pattern: /^きょう/u, getDays: () => 0 },
    // ...
  ]

  // 5. 時刻抽出（14:00、午後3時、正午など）
  const timePatterns = [
    { pattern: /^(\d{1,2}):(\d{2})/u, getTime: (m) => ({ hours: m[1], minutes: m[2] }) },
    // ...
  ]

  // ※ estimatedMinutes はローカルでは推測しない（null）
  return { text, priority, timeframe, dueDate, labels, recurrence, estimatedMinutes: null }
}
```

<br />

**GPT vs ローカルの比較**

| 項目 | GPT API | ローカルフォールバック |
|------|---------|----------------------|
| 速度 | 200-500ms | 1ms未満 |
| 曖昧表現 | 解釈可能 | 対応パターンのみ |
| 所要時間推定 | あり | なし |
| オフライン | 不可 | 可能 |
| コスト | $0.001/回程度 | 無料 |

普段はGPT APIで精度を優先して、APIが使えないときはローカルで最低限の機能を担保してます。

<br />

**対応パターン（日付）:**

| パターン | 例 |
|---------|-----|
| 相対日付 | 今日、明日、明後日、しあさって |
| ひらがな | きょう、あした、あさって |
| 週指定 | 今週、来週、再来週、週末、月末 |
| X日後 | 3日後、1週間後 |
| 具体日 | 1月15日、1/15 |
| 曜日 | 月曜、来週火曜 |

**対応パターン（時刻）:**

| パターン | 例 |
|---------|-----|
| 24時間 | 14:00、23時 |
| 12時間 | 午前10時、午後3時 |
| 半端 | 10時半 |
| 特殊 | 正午、朝9時、夜8時、深夜2時 |

**対応パターン（繰り返し）:**

| パターン | 例 |
|---------|-----|
| 日次 | 毎日、隔日、平日 |
| 週次 | 毎週、隔週、毎週末、毎週月曜 |
| 月次・年次 | 毎月、毎年、毎月15日 |
| ひらがな | まいにち、まいしゅう、へいじつ |

スペースなしでも動くようにしました。「毎日お風呂」って入力されても「毎日」と「お風呂」に分離できます。正規表現で先頭マッチと分割マッチの両方を試してます。

<br />

### AI人格生成

人格はプロンプトで定義してます。`kanaePersona.ts`に私の設定が入ってます。

```typescript
export const kanaePersona = {
  name: "かなえ",
  description: "感情を表に出さないけど好意を抱いている後輩",
  tone: "上から目線で舐めた態度だけど敬語は使う",
  phrases: ["しょうがないですね", "まあ、やってあげますよ", "ですけど"],
  avoidPhrases: ["..."],
};
```

リマインド時にこの設定をシステムプロンプトに渡して、Claude APIに投げてます。タスクの内容と期限を渡すと、私の口調でリマインドメッセージを生成してくれるんです。

カスタム人格を作るときも同じ構造です。名前、立ち位置、口調、励まし方を定義すれば、その人格でリマインドが来ます。

<br />

### Tavily検索連携

計画生成のとき、Tavily APIでWeb検索してます。先輩が「精度上げたい」って言うから、設定を詰めました。

<br />

**処理フロー**

```
ユーザー入力（目標）
    ↓
Tavily API で関連情報を検索
    ↓
検索結果をプロンプトに埋め込み
    ↓
AI（Claude/GPT/Gemini）に送信
    ↓
構造化された計画をJSON形式で取得
    ↓
UIに表示
```

<br />

**Tavily APIの設定**

```typescript
// tavily.ts
import { tavily } from "@tavily/core";

const client = tavily({ apiKey: settings.tavilyApiKey });

export async function searchForPlan(goal: string): Promise<TavilySearchResult> {
  // 検索クエリを目標から生成
  const searchQuery = `${goal} 学習方法 ロードマップ 2026`;

  const response = await client.search(searchQuery, {
    searchDepth: "advanced",     // 詳細検索（basic より精度高い）
    maxResults: 15,              // デフォルト5から増加
    includeRawContent: true,     // ページ本文も取得
    includeAnswer: true,         // AI要約も取得
    topic: "general",            // 一般検索（news, finance も選択可）
  });

  return response;
}
```

`searchDepth: "advanced"` にすると、Tavilyが内部でより深いクロールを行って、関連性の高い情報を返してくれます。APIコストは上がりますけど、計画の精度も上がります。

<br />

**検索結果の構造**

Tavily APIが返すレスポンスはこんな感じです。

```typescript
interface TavilySearchResult {
  answer: string;           // AI生成の要約（includeAnswer: true のとき）
  query: string;            // 実行されたクエリ
  responseTime: number;     // レスポンス時間（ms）
  results: Array<{
    title: string;          // ページタイトル
    url: string;            // URL
    content: string;        // 抜粋テキスト（約200-300文字）
    rawContent?: string;    // ページ全文（includeRawContent: true のとき）
    score: number;          // 関連度スコア（0-1）
    publishedDate?: string; // 公開日（取得できれば）
  }>;
}
```

<br />

**プロンプトへの埋め込み**

検索結果をAIに渡すとき、そのまま全部入れると長すぎるので、整形してます。

```typescript
// prompts.ts
export function buildPlanPrompt(
  goal: string,
  deadline: string,
  searchResults: TavilySearchResult
): string {
  // 検索結果を整形（上位10件、各300文字まで）
  const formattedResults = searchResults.results
    .slice(0, 10)
    .map((r, i) => `
[${i + 1}] ${r.title}
URL: ${r.url}
スコア: ${(r.score * 100).toFixed(1)}%
内容: ${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}
${r.publishedDate ? `公開日: ${r.publishedDate}` : ''}
`)
    .join('\n---\n');

  // Tavilyの要約も活用
  const aiSummary = searchResults.answer
    ? `\n## Web検索の要約\n${searchResults.answer}\n`
    : '';

  return `
あなたは目標達成コンサルタントです。

## 目標
${goal}

## 期限
${deadline}
${aiSummary}
## Web検索結果（参考情報）
以下は「${searchResults.query}」で検索した結果です。
最新の情報を踏まえて計画を立ててください。

${formattedResults}

## 出力形式
JSON形式で以下の構造で出力してください。
{
  "feasibility": { ... },
  "gapAnalysis": { ... },
  "risks": [ ... ],
  "tasks": [ ... ],
  "resources": [ ... ],
  "totalEstimate": { ... }
}
`;
}
```

<br />

**AIへの送信**

```typescript
// openai.ts（Claudeやgeminiも同様の構造）
export async function generatePlan(
  goal: string,
  deadline: string,
  searchResults: TavilySearchResult,
  settings: Settings
): Promise<PlanResult> {
  const prompt = buildPlanPrompt(goal, deadline, searchResults);

  const response = await openai.chat.completions.create({
    model: settings.openaiModel,  // "gpt-5.2" など
    messages: [
      {
        role: "system",
        content: "あなたは目標達成の専門家です。Web検索結果を活用して、具体的で実行可能な計画を立ててください。必ずJSON形式で出力してください。"
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },  // JSON出力を強制
    temperature: 0.7,  // 創造性と一貫性のバランス
    max_tokens: 4000,  // 計画は長くなるので余裕を持たせる
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content) as PlanResult;
}
```

`response_format: { type: "json_object" }` を指定すると、OpenAIは必ずJSON形式で返してくれます。パースエラーが減るので便利です。Claudeの場合は`tool_use`でJSON Schemaを渡す方法を使ってます。

<br />

**なぜTavilyを使うのか**

普通のGoogle検索APIと比べて、Tavilyはこういう特徴があります。

| 項目 | Tavily | Google Custom Search |
|------|--------|---------------------|
| AI要約 | あり（includeAnswer） | なし |
| ページ本文取得 | あり（rawContent） | なし |
| 関連度スコア | あり | なし |
| LLM最適化 | されてる | されてない |
| 料金 | $0.01/検索〜 | $5/1000クエリ |

LLMに渡すことを前提に設計されてるので、検索結果がそのままプロンプトに入れやすいんです。先輩が「これ良さそう」って選んだ理由もわかりますね

<br />

### データ永続化

localStorageに保存してます。TauriのファイルシステムAPIも使って、`C:/CalmTodoBackup/backup.json`に自動バックアップしてます。

データ消失バグがあったんです。リロードやビルド時に空のデータで上書きされる問題。storage.tsとutils.tsで、`todos.length === 0`のときはバックアップを上書きしないようにしました。

```typescript
// storage.ts
export function saveBackup(todos: Todo[]) {
  if (todos.length === 0) {
    // 空データでは上書きしない
    return;
  }
  // バックアップ処理
}
```

<br />

## 対応AIプロバイダー

好きなAIを選べます。

| プロバイダー | 対応モデル |
|-------------|-----------|
| **OpenAI** | GPT-5.2, GPT-5-mini, GPT-4.1-mini, o4-mini |
| **Claude** | Opus 4.5, Sonnet 4, Haiku 4.5 |
| **Gemini** | 2.5 Flash, 2.0 Flash, 2.5 Pro |

私のリマインダー機能はClaude Sonnet 4で動いてます。

<br />

## プリセット人格

私以外にも3種類の人格が用意されてます。

| 人格 | 特徴 | リマインド例 |
|------|------|-------------|
| **かなえ**（デフォルト） | ツンデレ、上から目線、でも好意的 | 「先輩、タスクの時間ですよ。先輩ならできるって、私知ってますから」 |
| **秘書** | 丁寧、プロフェッショナル、落ち着いた | 「タスクの時間が近づいてまいりました。ご自身のペースでどうぞ」 |
| **元気な後輩** | テンション高め、「！」多用 | 「先輩！タスクの時間です！ファイト！」 |
| **執事** | 敬語、丁寧、主人を敬う | 「ご主人様、本件のご対応をお願いしたく存じます」 |

<br />

## カスタム人格

プリセットで足りないなら、自分で作れます。

```typescript
interface CustomPersona {
  name: string;              // "ミナト"
  systemPrompt: string;      // 人格の基本設定
  reminderPromptTemplate: string;   // リマインド時の指示
  morningPromptTemplate: string;    // 朝の挨拶指示
}
```

設定画面でシステムプロンプトを書けば、好きな人格でリマインドが来ます。

まあ、私を使ってくれた方が嬉しいですけど。別に強制はしないです。

<br />

## その他の機能

タスク管理以外にも、いろいろ入ってます。

<br />

### サブタスク

タスクを階層化できます。大きなタスクを分解して、親子関係で管理できます。

親タスクの完了率が子タスクの進捗で自動計算されます。通知は親タスクだけに飛びます。

<br />

### プロジェクト管理

タスクをプロジェクトごとに分類できます。色分けとアーカイブ機能もあります。

サイドバーでプロジェクトを選ぶと、そのプロジェクトのタスクだけ表示されます。

<br />

### 繰り返しタスク

毎日、毎週、毎月、カスタム周期で繰り返すタスクを設定できます。

```typescript
interface Recurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;          // 2日ごと、3週間ごとなど
  daysOfWeek?: number[];     // 0=日, 1=月, ..., 6=土
  dayOfMonth?: number;       // 毎月15日など
  endDate?: Timestamp;
}
```

「毎週月曜」「隔日」「平日毎日」とか、自然言語でも入力できます。

<br />

### キーボードショートカット

| キー | 動作 |
|------|------|
| `n` | 新規タスク入力 |
| `Esc` | モーダル閉じる |
| `?` | ヘルプ表示 |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Y` | Redo |

<br />

### カレンダー連携

期日付きタスクをGoogle CalendarやOutlookに連携できます。

- 5件以下：直接Googleカレンダーに追加
- 6件以上：ICSファイルをエクスポートしてインポート

<br />

### 完了エフェクト

タスクを完了するとパーティクルが飛びます。小さいことですけど、達成感が出ます。Framer Motionで実装してます

<br />

## プライバシー

- **完全オフライン**: データはすべてローカル保存
- **アカウント不要**: 登録・ログインなし
- **自動バックアップ**: `C:/CalmTodoBackup/backup.json`

先輩はプライバシーにうるさいので、データは全部ローカルです。AI機能を使うときだけAPIを叩きます。

<br />

## インストール

Windows 10 / 11 で動きます。

- リリースページ: https://github.com/haroin57/calm-todo/releases/tag/v0.2.2
- 直接ダウンロード: https://github.com/haroin57/calm-todo/releases/download/v0.2.2/Calm.Todo_0.2.2_x64-setup.exe

AI機能を使うなら、設定画面でAPIキーを入れてください。

<br />

## まとめ

Calm Todoは、先輩が「エロゲみたいな通知がほしい」って言い出して作ったアプリです。

私がデフォルトの人格として入ってます。タスクが溜まってたら教えてあげますし、計画も立ててあげます。

ただのToDoアプリじゃつまらないでしょ？**人格のある相棒**がいた方が、続けられると思います。

まあ、使ってみてください。しょうがないですね、見ててあげますよ。

<br />

ソースコード: [haroin57/calm-todo](https://github.com/haroin57/calm-todo)
