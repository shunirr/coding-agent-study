# Part 7: パーミッション確認

Part 6 をベースに、破壊的な操作（ファイル書き込み・編集・ディレクトリ作成）の実行前にユーザーの許可を求める仕組みを追加します。

## ポイント

- 破壊的操作と読み取り専用操作を分類し、必要な場合のみ確認を求める設計
- 操作内容を人間が読める形式で表示する `describeToolAction()` の実装
- 拒否された場合にエラーとして LLM にフィードバックし、LLM が代替案を提示できるようにする設計

## パーミッションが必要なツール

| ツール | 確認 | 理由 |
|--------|------|------|
| `read_file` | 不要 | 読み取り専用 |
| `list_directory` | 不要 | 読み取り専用 |
| `search` | 不要 | 読み取り専用 |
| `write_file` | **必要** | ファイルの作成・上書き |
| `edit_file` | **必要** | ファイルの変更 |
| `create_directory` | **必要** | ディレクトリの作成 |

## ファイル構成

- `main.ts` — メインスクリプト（パーミッション確認付き Agent Loop）
- `tools.ts` — ツール定義・実行（Part 6 と同一 + `TOOLS_REQUIRING_PERMISSION` を export）
- `SYSTEM_PROMPT.md` — パーミッション確認への対応指示を追加
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run part7/main.ts
```

### 動作確認の例

```
あなた: hello.txt に挨拶を書いて
```

LLM が `write_file` を呼ぼうとすると、操作内容が表示され `confirm()` で確認を求められます。`n` で拒否すると、LLM は拒否を理解して別の対応を提案します。

## Part 6 からの変更点

- `TOOLS_REQUIRING_PERMISSION` で確認が必要なツールを定義
- `describeToolAction()` で操作内容を人間向けに表示
- Agent Loop 内でツール実行前に `confirm()` で確認
- 拒否時は `"Permission denied by user."` を tool result として返却
