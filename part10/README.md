# Part 10: Token 使用量の追跡

Part 9 をベースに、API レスポンスの `usage` フィールドからトークン使用量を追跡・表示する機能を追加します。

## ポイント

- streaming リクエストに `stream_options: { include_usage: true }` を追加
- `callLLM()` の戻り値に `usage` を追加（`{ prompt_tokens, completion_tokens }`）
- 各ターン終了時にトークン使用量を表示
- LM Studio 等で usage が返らない場合はスキップ（表示しない）

## トークン表示

各ターンの応答後に以下の形式で表示されます:

```
[トークン: 入力 1,234 / 出力 567 / 小計 1,801 | 累計 3,456]
```

- **入力**: そのターンの prompt_tokens
- **出力**: そのターンの completion_tokens
- **小計**: そのターンの合計
- **累計**: セッション開始からの全ターン合計

## ファイル構成

- `main.ts` — メインスクリプト（usage 追跡ロジック追加）
- `tools.ts` — ツール定義・実行（Part 9 と同一）
- `SYSTEM_PROMPT.md` — システムプロンプト
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run main.ts
```

### 動作確認の例

```
あなた: こんにちは

アシスタント: こんにちは！何かお手伝いできることはありますか？
[トークン: 入力 245 / 出力 18 / 小計 263 | 累計 263]
```

会話を続けると累計が増えていき、Part 11（コンテキスト管理）でなぜ履歴の切り詰めが必要かを体感できます。

## Part 9 からの変更点

- `stream_options: { include_usage: true }` をリクエストに追加
- streaming パース時に `chunk.usage` を抽出
- `callLLM()` の戻り値に `usage` を追加
- `agentLoop()` で `totalUsage` を累計し、各ターン後に表示
