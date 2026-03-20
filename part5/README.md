# Part 5: Tool Use + Agent Loop

Part 4 をベースに、LLM がツールを呼び出してファイルシステムを操作できるようにします。Agent Loop パターンにより、LLM が自律的にツールを使って情報を収集します。

## ポイント

- OpenAI tools format でのツール定義方法
- `finish_reason` による Agent Loop の制御（`"tool_calls"` → ツール実行、`"stop"` → 終了）
- `role: "tool"` と `tool_call_id` によるツール結果の返却方法
- ツールエラーを例外ではなく結果として LLM に返すことで、LLM 自身にリカバリーを判断させる設計

## 利用可能なツール

| ツール | 説明 |
|--------|------|
| `read_file` | ファイルの内容を読み取る |
| `list_directory` | ディレクトリの一覧を取得する |

## ファイル構成

- `main.ts` — メインスクリプト（ツール定義・実行・Agent Loop を含む）
- `SYSTEM_PROMPT.md` — ツール使用を指示するシステムプロンプト
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read main.ts
```

### 動作確認の例

```
あなた: part5/main.ts の内容を説明して
```

LLM が `read_file` ツールを使ってファイルを読み取り、内容を説明します。

## Part 4 からの変更点

- ツール定義（`read_file`, `list_directory`）を追加
- `executeTool()` 関数でツール実行を処理
- `agentLoop()` で LLM ↔ ツール間の実行ループを実装
