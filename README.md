# コーディングエージェント段階的実装

LLM API を通じてコーディングエージェントを段階的に構築する実験的プロジェクトです。

各パートは独立して動作し、段階的に機能が追加されていく構成になっています。

## 技術スタック

- **ランタイム**: Deno
- **LLM API**: OpenAI 互換 `/v1/chat/completions`
- **外部ライブラリ**: `@std/yaml`（YAML パース）のみ

## セットアップ

1. [Deno](https://deno.land/) をインストール
2. `config.yml` を編集して LLM API の接続先を設定

```yaml
base_url: "http://127.0.0.1:1234/v1/"  # LM Studio 等
api_key: ""                              # 空の場合 Authorization ヘッダーを送信しない
model: "gemma-3-12b-it"
```

## 各パートの概要

| パート | 内容 | 主なポイント |
|--------|------|------------|
| [Part 01](./part01/) | シンプルな API 呼び出し | OpenAI 互換 API の基本的なリクエスト/レスポンス |
| [Part 02](./part02/) | システムプロンプト | `role: "system"` によるモデルの振る舞い定義 |
| [Part 03](./part03/) | 会話履歴付きチャット | メッセージの蓄積による文脈の維持 |
| [Part 04](./part04/) | プロジェクト固有情報の注入 | AGENTS.md によるコンテキスト注入 |
| [Part 05](./part05/) | Tool Use + Agent Loop | ツール定義と実行ループ |
| [Part 06](./part06/) | フルツールセット | ファイル操作・検索の完全なツール群 |
| [Part 07](./part07/) | パーミッション確認 | 破壊的操作前のユーザー確認 |
| [Part 08](./part08/) | Streaming (SSE) | トークン単位のリアルタイム出力 |
| [Part 09](./part09/) | Bash ツール | 汎用シェルコマンド実行 |
| [Part 10](./part10/) | Token 使用量の追跡 | API レスポンスの usage 累計表示 |
| [Part 11](./part11/) | コンテキストウィンドウ管理 | 会話履歴の自動切り詰め |

## ディレクトリ構成

```
coding-agent/
  config.yml               # API 設定ファイル（共通）
  part01/main.ts           # シンプルな API 呼び出し
  part02/
    main.ts                # システムプロンプト付き
    SYSTEM_PROMPT.md
  part03/
    main.ts                # 会話履歴付きチャット
    SYSTEM_PROMPT.md
  part04/
    main.ts                # AGENTS.md でプロジェクト固有情報を注入
    SYSTEM_PROMPT.md
    AGENTS.md
  part05/
    main.ts                # Tool Use (read_file, list_directory)
    SYSTEM_PROMPT.md
    AGENTS.md
  part06/
    main.ts                # フルツールセット
    tools.ts               # ツール定義・実行
    SYSTEM_PROMPT.md
    AGENTS.md
  part07/
    main.ts                # パーミッション確認付き
    tools.ts               # ツール定義・実行
    SYSTEM_PROMPT.md
    AGENTS.md
  part08/
    main.ts                # ストリーミング対応
    tools.ts               # ツール定義・実行（Part 07 と同一）
    SYSTEM_PROMPT.md
    AGENTS.md
  part09/
    main.ts                # bash ツール対応
    tools.ts               # bash ツール追加
    SYSTEM_PROMPT.md       # bash ガイドライン追記
    AGENTS.md
  part10/
    main.ts                # トークン使用量追跡
    tools.ts               # ツール定義・実行（Part 09 と同一）
    SYSTEM_PROMPT.md
    AGENTS.md
  part11/
    main.ts                # コンテキストウィンドウ管理
    tools.ts               # ツール定義・実行（Part 09 と同一）
    SYSTEM_PROMPT.md
    AGENTS.md
```

## ライセンス

[MIT License](./LICENSE)
