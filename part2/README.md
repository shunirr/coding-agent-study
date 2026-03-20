# Part 2: システムプロンプト

Part 1 をベースに、`role: "system"` メッセージを追加してモデルの振る舞いを定義します。

## ポイント

- `role: "system"` でモデルの振る舞いを指示する方法
- システムプロンプトをファイル (`SYSTEM_PROMPT.md`) に切り出すことで管理を容易にする設計
- `import.meta.url` を使ったスクリプト相対パスでのファイル読み込み

## ファイル構成

- `main.ts` — メインスクリプト
- `SYSTEM_PROMPT.md` — システムプロンプトの定義

## 実行

```bash
deno run --allow-net --allow-read part2/main.ts
```

## Part 1 からの変更点

- `SYSTEM_PROMPT.md` からシステムプロンプトを読み込む処理を追加
- `messages` 配列の先頭に `role: "system"` メッセージを追加
