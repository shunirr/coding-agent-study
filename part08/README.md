# Part 8: Streaming (SSE)

Part 7 をベースに、Server-Sent Events によるストリーミング出力を実装します。LLM のレスポンスがトークン単位でリアルタイムに表示されるようになります。

## ポイント

- `callLLM()` のリクエストに `stream: true` を追加し、SSE レスポンスをパースする実装
- `TextDecoderStream` + 行分割による `data:` 行の読み取り
- `delta.content` をトークン単位で `Deno.stdout.write()` に出力（改行なし）
- `delta.tool_calls` のチャンク結合: `index` で tool_call を識別し、`function.name` と `function.arguments` の断片を文字列連結
- `[DONE]` による完了検知
- 戻り値の型は Part 7 と同じ `{ message, finish_reason }` を維持（streaming の詳細を内部に閉じる）

## ファイル構成

- `main.ts` — メインスクリプト（ストリーミング対応 callLLM + Agent Loop）
- `tools.ts` — ツール定義・実行（Part 7 と同一）
- `SYSTEM_PROMPT.md` — システムプロンプト
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run main.ts
```

### 動作確認の例

```
あなた: 自己紹介してください
```

トークンが 1 つずつ画面に表示されます。非ストリーミング（Part 7）では応答全体が一度に表示されていたのとの違いを確認できます。

## SSE のデータ形式

OpenAI 互換 API のストリーミングレスポンスは以下の形式です:

```
data: {"choices":[{"delta":{"content":"こん"},"finish_reason":null}]}
data: {"choices":[{"delta":{"content":"にちは"},"finish_reason":null}]}
data: {"choices":[{"delta":{},"finish_reason":"stop"}]}
data: [DONE]
```

ツール呼び出し時は `delta.tool_calls` にチャンクが分割されて届きます:

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xxx","function":{"name":"read_file","arguments":""}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\":"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"hello.txt\"}"}}]}}]}
```

## Part 7 からの変更点

- `callLLM()` を streaming 対応に全面書き換え
- SSE レスポンスのパース処理を追加（バッファリング、行分割、JSON パース）
- Agent Loop 内の表示ロジックを変更（streaming 中にリアルタイム表示するため、完了後の再表示を削除）
