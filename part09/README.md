# Part 9: Bash ツール

Part 8 をベースに、汎用シェルコマンド実行ツール `bash` を追加します。Part 6 の `search` ツールで使った `Deno.Command` を汎用化する形です。

## ポイント

- `Deno.Command("bash", { args: ["-c", command] })` による汎用コマンド実行
- `AbortSignal.timeout()` による 30 秒タイムアウト制御
- stdout + stderr を結合して返し、終了コードが 0 以外なら `is_error: true`
- パーミッション確認の対象として `bash` を追加

## 利用可能なツール

| ツール | 説明 | 確認 |
|--------|------|------|
| `read_file` | ファイル読み取り | 不要 |
| `list_directory` | ディレクトリ一覧 | 不要 |
| `search` | テキスト検索 | 不要 |
| `write_file` | ファイル書き込み | **必要** |
| `edit_file` | ファイル編集 | **必要** |
| `create_directory` | ディレクトリ作成 | **必要** |
| `bash` | シェルコマンド実行 | **必要** |

## ファイル構成

- `main.ts` — メインスクリプト（`describeToolAction` に bash ケースを追加）
- `tools.ts` — ツール定義・実行（bash ツール追加）
- `SYSTEM_PROMPT.md` — bash ツールの利用ガイドラインを追記
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run main.ts
```

### 動作確認の例

```
あなた: ls -la を実行して
```

LLM が `bash` ツールを使い、パーミッション確認の後にコマンドが実行されます。

## Part 8 からの変更点

- `tools.ts` に `bash` ツールの定義と実行を追加
- `TOOLS_REQUIRING_PERMISSION` に `"bash"` を追加
- `describeToolAction()` に bash ケースを追加（実行コマンドをそのまま表示）
- `SYSTEM_PROMPT.md` に bash ツールのガイドラインを追記
