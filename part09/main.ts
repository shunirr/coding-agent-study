import { parse as parseYaml } from "jsr:@std/yaml";
import { TOOLS, TOOLS_REQUIRING_PERMISSION, executeTool } from "./tools.ts";

// --- Config ---

interface Config {
  base_url: string;
  api_key?: string;
  model: string;
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

// --- LLM API (Streaming) ---

async function callLLM(
  config: Config,
  messages: Message[],
): Promise<{ message: Message; finish_reason: string }> {
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

  return { message, finish_reason: finishReason };
}

// --- Agent Loop ---

async function agentLoop(config: Config, messages: Message[]): Promise<string> {
  while (true) {
    const { message, finish_reason } = await callLLM(config, messages);

    // Add assistant message to history
    messages.push(message);

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

  console.log(
    "コーディングエージェントを開始します（bash ツール対応）。終了するには Ctrl+C を押してください。\n",
  );

  while (true) {
    const userMessage = prompt("あなた:");
    if (!userMessage) {
      continue;
    }

    messages.push({ role: "user", content: userMessage });

    try {
      await agentLoop(config, messages);
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
