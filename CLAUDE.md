# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A step-by-step implementation of a coding agent in Deno. From Part 1 (single API call) to Part 11 (context window management), each part runs independently.

## Running

```bash
# Part 01-05
deno run --allow-net --allow-read part<NN>/main.ts

# Part 06-11 (additional permissions for file writes and command execution)
deno run --allow-net --allow-read --allow-write --allow-run part<NN>/main.ts
```

Configure `base_url`, `api_key`, and `model` in `config.yml` before running.

## Conventions

- Code comments in English
- UI and documentation in Japanese
- Commit messages in English
- Minimize external dependencies (currently only `jsr:@std/yaml`)

## Architecture

Each part copies the previous one and adds functionality. Common design patterns:

- **Config**: All parts load `../config.yml` via `import.meta.url` relative path. Skips Authorization header when `api_key` is empty (for local LLMs)
- **System Prompt**: Loaded from `SYSTEM_PROMPT.md` (Part 2+). Merged with `AGENTS.md` from the current directory if present (Part 4+, silently skipped if missing)
- **Agent Loop** (Part 5+): Loops until `finish_reason === "stop"`. On `"tool_calls"`, executes tools and returns results as `role: "tool"` messages
- **Tool separation** (Part 6+): `tools.ts` exports `TOOLS` (definition array) and `executeTool()`. Errors are returned as `{ content, is_error }` instead of thrown, letting the LLM decide recovery
- **Permission** (Part 7+): `confirm()` prompt before `write_file`, `edit_file`, `create_directory`, `bash`. Denied operations return `"Permission denied by user."` as tool result
- **Streaming** (Part 8+): SSE streaming with `TextDecoderStream` + line splitting. `delta.content` written to stdout token-by-token. `delta.tool_calls` accumulated by `index`
- **Bash tool** (Part 9+): `Deno.Command("bash", ["-c", command])` with `AbortSignal.timeout(30s)`
- **Token tracking** (Part 10+): `stream_options: { include_usage: true }` to get `usage` from streaming. Cumulative display per turn
- **Context management** (Part 11): `truncateHistory()` removes old messages while preserving system prompt and tool_call/tool result pairs. Triggered by `max_context_tokens` in config
