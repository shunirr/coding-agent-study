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
| [Part 1](./part1/) | シンプルな API 呼び出し | OpenAI 互換 API の基本的なリクエスト/レスポンス |
| [Part 2](./part2/) | システムプロンプト | `role: "system"` によるモデルの振る舞い定義 |
| [Part 3](./part3/) | 会話履歴付きチャット | メッセージの蓄積による文脈の維持 |
| [Part 4](./part4/) | プロジェクト固有情報の注入 | AGENTS.md によるコンテキスト注入 |
| [Part 5](./part5/) | Tool Use + Agent Loop | ツール定義と実行ループ |
| [Part 6](./part6/) | フルツールセット | ファイル操作・検索の完全なツール群 |
| [Part 7](./part7/) | パーミッション確認 | 破壊的操作前のユーザー確認 |

## ディレクトリ構成

```
coding-agent/
  config.yml               # API 設定ファイル（共通）
  part1/main.ts            # シンプルな API 呼び出し
  part2/
    main.ts                # システムプロンプト付き
    SYSTEM_PROMPT.md
  part3/
    main.ts                # 会話履歴付きチャット
    SYSTEM_PROMPT.md
  part4/
    main.ts                # AGENTS.md でプロジェクト固有情報を注入
    SYSTEM_PROMPT.md
    AGENTS.md
  part5/
    main.ts                # Tool Use (read_file, list_directory)
    SYSTEM_PROMPT.md
    AGENTS.md
  part6/
    main.ts                # フルツールセット
    tools.ts               # ツール定義・実行
    SYSTEM_PROMPT.md
    AGENTS.md
  part7/
    main.ts                # パーミッション確認付き
    tools.ts               # ツール定義・実行
    SYSTEM_PROMPT.md
    AGENTS.md
```

## ライセンス

[MIT License](./LICENSE)
