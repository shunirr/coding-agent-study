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

async function callLLM(
  config: Config,
  userMessage: string,
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
    messages: [{ role: "user", content: userMessage }],
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

  const userMessage = prompt("メッセージを入力してください:");
  if (!userMessage) {
    console.log("入力がありません。終了します。");
    return;
  }

  console.log("\n回答を生成中...\n");
  const reply = await callLLM(config, userMessage);
  console.log(reply);
}

main();
