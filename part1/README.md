# Part 1: シンプルな API 呼び出し

OpenAI 互換 API に1回だけリクエストを送り、レスポンスを表示するもっともシンプルな例です。

## ポイント

- `fetch` で `/v1/chat/completions` に POST リクエストを送る方法
- リクエストボディの構造 (`model`, `messages`)
- レスポンスから `choices[0].message.content` を取り出す方法
- `api_key` が未設定の場合に Authorization ヘッダーを省略する処理

## 実行

```bash
deno run --allow-net --allow-read part1/main.ts
```

## 動作の流れ

1. `config.yml` から API 設定を読み込む
2. `prompt()` でユーザーの入力を受け取る
3. LLM API にリクエストを送信
4. レスポンスを表示して終了
