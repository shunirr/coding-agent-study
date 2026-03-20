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

  // Load system prompt from file
  const systemPrompt = await Deno.readTextFile(
    new URL("./SYSTEM_PROMPT.md", import.meta.url),
  );

  const userMessage = prompt("メッセージを入力してください:");
  if (!userMessage) {
    console.log("入力がありません。終了します。");
    return;
  }

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  console.log("\n回答を生成中...\n");
  const reply = await callLLM(config, messages);
  console.log(reply);
}

main();
