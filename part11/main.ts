import { parse as parseYaml } from "jsr:@std/yaml";
import { TOOLS, TOOLS_REQUIRING_PERMISSION, executeTool } from "./tools.ts";

// --- Config ---

interface Config {
  base_url: string;
  api_key?: string;
  model: string;
  max_context_tokens?: number;
}

async function loadConfig(): Promise<Config> {
  const text = await Deno.readTextFile(
    new URL("../config.yml", import.meta.url),
  );
  return parseYaml(text) as Config;
}

// --- Types ---

// deno-lint-ignore no-explicit-any
type Message = Record<string, any>;

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

// --- Permission ---

function describeToolAction(
  name: string,
  args: Record<string, string>,
): string {
  switch (name) {
    case "write_file":
      return `ファイルを書き込みます: ${args.path}\n内容:\n${(args.content || "").slice(0, 200)}${(args.content || "").length > 200 ? "..." : ""}`;
    case "edit_file":
      return `ファイルを編集します: ${args.path}\n置換前: ${args.old_text}\n置換後: ${args.new_text}`;
    case "create_directory":
      return `ディレクトリを作成します: ${args.path}`;
    case "bash":
      return `コマンドを実行します: ${args.command}`;
    default:
      return `${name} を実行します: ${JSON.stringify(args)}`;
  }
}

// --- Context Window Management ---

/**
 * Estimate token count from a message.
 * Rough heuristic: ~4 characters per token for English, ~2 for CJK.
 * Uses a simple average of ~3 characters per token.
 */
function estimateTokens(messages: Message[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    if (msg.content) {
      totalChars += String(msg.content).length;
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        totalChars += (tc.function?.name || "").length;
        totalChars += (tc.function?.arguments || "").length;
      }
    }
  }
  // Rough estimate: 1 token ≈ 3 characters
  return Math.ceil(totalChars / 3);
}

/**
 * Truncate conversation history to fit within token limit.
 * - System message (index 0) is always preserved.
 * - tool_call and corresponding tool result messages are deleted as pairs.
 * - Inserts a summary message when truncation occurs.
 */
function truncateHistory(
  messages: Message[],
  maxTokens: number,
  lastPromptTokens?: number,
): boolean {
  // Use actual prompt_tokens if available, otherwise estimate
  const currentTokens = lastPromptTokens ?? estimateTokens(messages);

  if (currentTokens <= maxTokens) {
    return false;
  }

  const targetTokens = Math.floor(maxTokens * 0.75); // Aim for 75% to avoid frequent truncation

  // Build a set of tool_call_ids from assistant messages for pair matching
  // We need to identify which tool results belong to which assistant messages
  // so we can delete them together

  // Find deletable ranges: skip system (index 0), work from index 1 forward
  while (estimateTokens(messages) > targetTokens && messages.length > 2) {
    // Find the first non-system message to remove
    const idx = 1;
    const msg = messages[idx];

    if (msg.role === "assistant" && msg.tool_calls) {
      // Collect tool_call IDs from this assistant message
      const callIds = new Set<string>();
      for (const tc of msg.tool_calls) {
        callIds.add(tc.id);
      }

      // Remove the assistant message
      messages.splice(idx, 1);

      // Remove all corresponding tool result messages
      for (let i = idx; i < messages.length; ) {
        if (messages[i].role === "tool" && callIds.has(messages[i].tool_call_id)) {
          callIds.delete(messages[i].tool_call_id);
          messages.splice(i, 1);
        } else {
          // Stop looking once we hit a non-matching message after consuming some
          // (tool results should be contiguous after the assistant message)
          if (callIds.size === 0) break;
          i++;
        }
      }
    } else if (msg.role === "tool") {
      // Orphaned tool result (shouldn't happen, but handle gracefully)
      messages.splice(idx, 1);
    } else {
      // user or assistant (without tool_calls) - simply remove
      messages.splice(idx, 1);
    }
  }

  // Insert summary message after system prompt
  messages.splice(1, 0, {
    role: "system",
    content: "（以前の会話履歴は省略されました）",
  });

  return true;
}

// --- LLM API (Streaming with Usage Tracking) ---

async function callLLM(
  config: Config,
  messages: Message[],
): Promise<{ message: Message; finish_reason: string; usage?: Usage }> {
  const url = `${config.base_url}chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.api_key) {
    headers["Authorization"] = `Bearer ${config.api_key}`;
  }

  const body = {
    model: config.model,
    messages,
    tools: TOOLS,
    stream: true,
    stream_options: { include_usage: true },
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  // Parse SSE stream
  let content = "";
  let finishReason = "";
  let usage: Usage | undefined;
  // deno-lint-ignore no-explicit-any
  const toolCalls: Record<number, any> = {};
  const encoder = new TextEncoder();
  let contentStarted = false;

  const reader = response.body!
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      let chunk;
      try {
        chunk = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      // Extract usage from the final chunk
      if (chunk.usage) {
        usage = {
          prompt_tokens: chunk.usage.prompt_tokens,
          completion_tokens: chunk.usage.completion_tokens,
        };
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta || {};

      // Content delta - stream to stdout token by token
      if (delta.content) {
        if (!contentStarted) {
          await Deno.stdout.write(encoder.encode("\nアシスタント: "));
          contentStarted = true;
        }
        content += delta.content;
        await Deno.stdout.write(encoder.encode(delta.content));
      }

      // Tool calls delta - accumulate chunks by index
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function?.name) {
            toolCalls[idx].function.name += tc.function.name;
          }
          if (tc.function?.arguments) {
            toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }

      // Finish reason
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }
  }

  // Add newline after streamed content
  if (contentStarted) {
    await Deno.stdout.write(encoder.encode("\n"));
  }

  // Build the assembled message
  const message: Message = { role: "assistant", content: content || null };
  const toolCallArray = Object.values(toolCalls);
  if (toolCallArray.length > 0) {
    message.tool_calls = toolCallArray;
  }

  return { message, finish_reason: finishReason, usage };
}

// --- Token Display ---

function formatTokens(n: number): string {
  return n.toLocaleString();
}

// --- Agent Loop ---

async function agentLoop(
  config: Config,
  messages: Message[],
  totalUsage: { prompt_tokens: number; completion_tokens: number },
): Promise<string> {
  // Track last known prompt_tokens for more accurate truncation
  let lastPromptTokens: number | undefined;

  while (true) {
    // Truncate history if needed before calling LLM
    if (config.max_context_tokens) {
      const truncated = truncateHistory(
        messages,
        config.max_context_tokens,
        lastPromptTokens,
      );
      if (truncated) {
        console.log(
          `\n[コンテキスト切り詰め: 上限 ${formatTokens(config.max_context_tokens)} トークンに収めるため、古い履歴を削除しました]`,
        );
      }
    }

    const { message, finish_reason, usage } = await callLLM(config, messages);

    // Add assistant message to history
    messages.push(message);

    // Accumulate token usage and update last known prompt tokens
    if (usage) {
      lastPromptTokens = usage.prompt_tokens;
      totalUsage.prompt_tokens += usage.prompt_tokens;
      totalUsage.completion_tokens += usage.completion_tokens;
      const total = usage.prompt_tokens + usage.completion_tokens;
      const cumulative = totalUsage.prompt_tokens + totalUsage.completion_tokens;
      console.log(
        `[トークン: 入力 ${formatTokens(usage.prompt_tokens)} / 出力 ${formatTokens(usage.completion_tokens)} / 小計 ${formatTokens(total)} | 累計 ${formatTokens(cumulative)}]`,
      );
    }

    // Content is already displayed via streaming

    if (finish_reason === "stop") {
      return message.content || "";
    }

    // Process tool calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Check if permission is required
        if (TOOLS_REQUIRING_PERMISSION.has(toolName)) {
          console.log(`\n${describeToolAction(toolName, toolArgs)}`);
          const granted = confirm("この操作を許可しますか?");

          if (!granted) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Permission denied by user.",
            });
            console.log("[操作が拒否されました]");
            continue;
          }
        }

        console.log(`\n[ツール実行: ${toolName}(${JSON.stringify(toolArgs)})]`);

        const result = await executeTool(toolName, toolArgs);

        if (result.is_error) {
          console.log(`[エラー: ${result.content}]`);
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.content,
        });
      }
    }
  }
}

// --- Main ---

async function main() {
  const config = await loadConfig();

  // Load system prompt
  const systemPrompt = await Deno.readTextFile(
    new URL("./SYSTEM_PROMPT.md", import.meta.url),
  );

  // Load project-specific context (optional)
  let agentsContext = "";
  try {
    agentsContext = await Deno.readTextFile("./AGENTS.md");
  } catch {
    // AGENTS.md is optional
  }

  const systemMessage = agentsContext
    ? `${systemPrompt}\n\n## Project Context\n\n${agentsContext}`
    : systemPrompt;

  const messages: Message[] = [
    { role: "system", content: systemMessage },
  ];

  // Cumulative token usage across all turns
  const totalUsage = { prompt_tokens: 0, completion_tokens: 0 };

  const maxTokensInfo = config.max_context_tokens
    ? `、コンテキスト上限 ${formatTokens(config.max_context_tokens)} トークン`
    : "";
  console.log(
    `コーディングエージェントを開始します（コンテキスト管理対応${maxTokensInfo}）。終了するには Ctrl+C を押してください。\n`,
  );

  while (true) {
    const userMessage = prompt("あなた:");
    if (!userMessage) {
      continue;
    }

    messages.push({ role: "user", content: userMessage });

    try {
      await agentLoop(config, messages, totalUsage);
      console.log(); // Extra spacing
    } catch (error) {
      console.error(
        `\nエラー: ${error instanceof Error ? error.message : error}\n`,
      );
      messages.pop();
    }
  }
}

main();
