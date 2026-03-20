# Part 4: AGENTS.md でプロジェクト固有情報を注入

Part 3 のチャットループをベースに、カレントディレクトリの `AGENTS.md` からプロジェクト固有の情報を読み込んでシステムプロンプトに追加します。

## ポイント

- システムプロンプト（エージェントの基本的な振る舞い）とプロジェクトコンテキスト（固有情報）を分離する設計
- オプショナルなファイル読み込み（存在しない場合はスキップ）
- Claude Code の `CLAUDE.md` や Cursor の `.cursorrules` と同様のアプローチ

## ファイル構成

- `main.ts` — メインスクリプト
- `SYSTEM_PROMPT.md` — エージェントの基本的な振る舞い（Part 3 と同一）
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read main.ts
```

`AGENTS.md` はカレントディレクトリ（`./AGENTS.md`）から読み込まれます。任意のディレクトリで実行して、そのプロジェクトの `AGENTS.md` を読み込ませることができます。

## Part 3 からの変更点

- `AGENTS.md` の読み込み処理を追加（`try-catch` でオプショナル）
- システムプロンプトと AGENTS.md の内容を結合
