# Part 11: コンテキストウィンドウ管理

Part 10 をベースに、コンテキストウィンドウの上限に近づいたとき、古い会話履歴を自動的に切り詰めて会話を継続する仕組みを追加します。

## ポイント

- `config.yml` の `max_context_tokens` でトークン上限を設定
- `estimateTokens()`: 文字数ベースの簡易推定（1 token ≈ 3 文字）。Part 10 の実測 `usage.prompt_tokens` があればそちらを優先
- `truncateHistory()`: 古いメッセージを先頭から削除
  - system メッセージ（index 0）は常に保持
  - **tool_call と対応する tool result は必ずペアで削除**（片方だけ残すと API エラー）
  - 切り詰め時にサマリーメッセージを挿入: `{ role: "system", content: "（以前の会話履歴は省略されました）" }`
- 切り詰め発生時にユーザーに通知

## 設定

`config.yml` に `max_context_tokens` を追加:

```yaml
base_url: "http://127.0.0.1:1234/v1/"
api_key: ""
model: "qwen3.5-9b-mlx"
max_context_tokens: 8000
```

## tool_call / tool result のペア削除

OpenAI 互換 API では、assistant メッセージの `tool_calls[].id` と `role: "tool"` メッセージの `tool_call_id` が対応している必要があります。片方だけ残すと API エラーになるため、切り詰め時にはペアで削除します。

```
messages[1]: { role: "assistant", tool_calls: [{ id: "call_abc", ... }] }  ← セットで削除
messages[2]: { role: "tool", tool_call_id: "call_abc", ... }               ← セットで削除
messages[3]: { role: "user", content: "..." }                              ← 個別に削除可能
```

## ファイル構成

- `main.ts` — メインスクリプト（コンテキスト管理ロジック追加）
- `tools.ts` — ツール定義・実行（Part 9 と同一）
- `SYSTEM_PROMPT.md` — システムプロンプト
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run main.ts
```

### 動作確認の例

```
あなた: (長い会話を繰り返す)

[コンテキスト切り詰め: 上限 8,000 トークンに収めるため、古い履歴を削除しました]
```

## Part 10 からの変更点

- `Config` に `max_context_tokens` を追加
- `estimateTokens()` 関数を追加（文字数ベースの簡易推定）
- `truncateHistory()` 関数を追加（tool_call/tool result ペア削除対応）
- `callLLM()` 呼び出し前に `truncateHistory()` を実行
- 切り詰め発生時にユーザーへ通知
