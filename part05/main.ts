import { parse as parseYaml } from "jsr:@std/yaml";

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

interface ToolResult {
  content: string;
  is_error?: boolean;
}

// --- Tool Definitions ---

const tools = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the contents of a file at the given path",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_directory",
      description: "List files and directories at the given path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list (default: current directory)",
          },
        },
        required: [],
      },
    },
  },
];

// --- Tool Execution ---

async function executeTool(
  name: string,
  args: Record<string, string>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "read_file": {
        const content = await Deno.readTextFile(args.path);
        return { content };
      }
      case "list_directory": {
        const path = args.path || ".";
        const entries: string[] = [];
        for await (const entry of Deno.readDir(path)) {
          const suffix = entry.isDirectory ? "/" : "";
          entries.push(`${entry.name}${suffix}`);
        }
        return { content: entries.join("\n") };
      }
      default:
        return { content: `Unknown tool: ${name}`, is_error: true };
    }
  } catch (error) {
    return {
      content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      is_error: true,
    };
  }
}

// --- LLM API ---

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
    tools,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return {
    message: data.choices[0].message,
    finish_reason: data.choices[0].finish_reason,
  };
}

// --- Agent Loop ---

async function agentLoop(config: Config, messages: Message[]): Promise<string> {
  while (true) {
    const { message, finish_reason } = await callLLM(config, messages);

    // Add assistant message to history (includes tool_calls if any)
    messages.push(message);

    // Display assistant's reasoning text if present
    if (message.content) {
      console.log(`\nアシスタント: ${message.content}`);
    }

    if (finish_reason === "stop") {
      return message.content || "";
    }

    // Process tool calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

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
    "コーディングエージェントを開始します。終了するには Ctrl+C を押してください。\n",
  );

  while (true) {
    const userMessage = prompt("あなた:");
    if (!userMessage) {
      continue;
    }

    messages.push({ role: "user", content: userMessage });

    try {
      const reply = await agentLoop(config, messages);
      console.log(`\nアシスタント: ${reply}\n`);
    } catch (error) {
      console.error(`\nエラー: ${error instanceof Error ? error.message : error}\n`);
      messages.pop();
    }
  }
}

main();
