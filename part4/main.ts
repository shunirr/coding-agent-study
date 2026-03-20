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

// --- LLM API ---

type Message = { role: "system" | "user" | "assistant"; content: string };

async function callLLM(
  config: Config,
  messages: Message[],
): Promise<string> {
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
  return data.choices[0].message.content;
}

// --- Main ---

async function main() {
  const config = await loadConfig();

  // Load base system prompt
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

  // Combine into system message
  const systemMessage = agentsContext
    ? `${systemPrompt}\n\n## Project Context\n\n${agentsContext}`
    : systemPrompt;

  // Initialize conversation with system prompt
  const messages: Message[] = [
    { role: "system", content: systemMessage },
  ];

  // Note: No conversation history limit is implemented for educational simplicity.

  console.log("チャットを開始します。終了するには Ctrl+C を押してください。\n");

  if (agentsContext) {
    console.log("(AGENTS.md を読み込みました)\n");
  }

  while (true) {
    const userMessage = prompt("あなた:");
    if (!userMessage) {
      continue;
    }

    messages.push({ role: "user", content: userMessage });

    const reply = await callLLM(config, messages);
    messages.push({ role: "assistant", content: reply });

    console.log(`\nアシスタント: ${reply}\n`);
  }
}

main();
