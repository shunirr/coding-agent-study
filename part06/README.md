# Part 6: フルツールセット

Part 5 をベースに、ファイルの書き込み・編集・ディレクトリ作成・テキスト検索を追加したフル機能のコーディングエージェントです。ツール定義と実行を `tools.ts` に分離しています。

## ポイント

- ツール定義・実行ロジックを別モジュール (`tools.ts`) に分離する設計
- ファイル編集ツール（`edit_file`）の実装パターン：元テキストの完全一致検索 → 置換
- 外部コマンド (`grep`) の呼び出しによる検索機能の実装

## 利用可能なツール

| ツール | 説明 | Deno API |
|--------|------|----------|
| `read_file` | ファイル読み取り | `Deno.readTextFile()` |
| `write_file` | ファイル書き込み | `Deno.writeTextFile()` |
| `edit_file` | 部分編集 (old_text → new_text) | `readTextFile` + `replace` + `writeTextFile` |
| `list_directory` | ディレクトリ一覧 | `Deno.readDir()` |
| `create_directory` | ディレクトリ作成 | `Deno.mkdir({ recursive: true })` |
| `search` | テキスト検索 | `Deno.Command("grep", ...)` |

## ファイル構成

- `main.ts` — メインスクリプト（Agent Loop）
- `tools.ts` — ツール定義 (`TOOLS`) と実行関数 (`executeTool`)
- `SYSTEM_PROMPT.md` — フルツール向けの詳細な作業プロセス指示
- `AGENTS.md` — プロジェクト固有のコンテキスト情報

## 実行

```bash
deno run --allow-net --allow-read --allow-write --allow-run main.ts
```

### 動作確認の例

```
あなた: hello.txt に挨拶を書いて
```

LLM が `write_file` ツールを使ってファイルを作成します。

## Deno のサンドボックスによる安全性

Deno はデフォルトでファイルシステムやネットワークへのアクセスを禁止しており、`--allow-*` フラグで明示的に許可する必要があります。このパーミッションモデルを活用すると、LLM がツール経由で行える操作をランタイムレベルで制限できます。

例えば、特定のディレクトリだけに書き込みを許可する場合:

```bash
deno run \
  --allow-net \
  --allow-read \
  --allow-write=./workspace \
  --allow-run \
  main.ts
```

- `--allow-read` — ファイル読み取りは全体を許可（コード読解に必要）
- `--allow-write=./workspace` — `./workspace` 配下のみ書き込み可能。LLM が意図しないパスに書き込もうとしても Deno が拒否する

このようにアプリケーション側でパーミッション制御を実装しなくても、Deno のサンドボックスだけである程度安全にエージェントを動かすことができます。

## Part 5 からの変更点

- ツール定義・実行を `tools.ts` に分離
- `write_file`, `edit_file`, `create_directory`, `search` ツールを追加
