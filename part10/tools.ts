// --- Types ---

export interface ToolResult {
  content: string;
  is_error?: boolean;
}

// --- Tool Definitions (OpenAI tools format) ---

export const TOOLS = [
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
      name: "write_file",
      description: "Write content to a file, creating it if it doesn't exist",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description:
        "Edit a file by replacing old_text with new_text. The old_text must match exactly.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          old_text: {
            type: "string",
            description: "Exact text to find and replace",
          },
          new_text: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_text", "new_text"],
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
  {
    type: "function" as const,
    function: {
      name: "create_directory",
      description: "Create a directory (and parent directories if needed)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to create" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search",
      description: "Search for a text pattern in files using grep",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Text pattern to search for",
          },
          path: {
            type: "string",
            description:
              "Directory or file to search in (default: current directory)",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bash",
      description:
        "Execute a shell command using bash. Use this for general-purpose command execution such as running scripts, installing packages, or performing system operations.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
];

// --- Permission categories ---

export const TOOLS_REQUIRING_PERMISSION = new Set([
  "write_file",
  "edit_file",
  "create_directory",
  "bash",
]);

// --- Tool Execution ---

const BASH_TIMEOUT_MS = 30_000;

export async function executeTool(
  name: string,
  args: Record<string, string>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "read_file": {
        const content = await Deno.readTextFile(args.path);
        return { content };
      }

      case "write_file": {
        await Deno.writeTextFile(args.path, args.content);
        return { content: `Successfully wrote to ${args.path}` };
      }

      case "edit_file": {
        const original = await Deno.readTextFile(args.path);
        if (!original.includes(args.old_text)) {
          return {
            content: `Error: old_text not found in ${args.path}`,
            is_error: true,
          };
        }
        const updated = original.replace(args.old_text, args.new_text);
        await Deno.writeTextFile(args.path, updated);
        return { content: `Successfully edited ${args.path}` };
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

      case "create_directory": {
        await Deno.mkdir(args.path, { recursive: true });
        return { content: `Successfully created directory ${args.path}` };
      }

      case "search": {
        const searchPath = args.path || ".";
        const command = new Deno.Command("grep", {
          args: ["-rn", args.pattern, searchPath],
          stdout: "piped",
          stderr: "piped",
        });
        const { stdout, stderr } = await command.output();
        const out = new TextDecoder().decode(stdout);
        const err = new TextDecoder().decode(stderr);
        if (err) {
          return { content: `Error: ${err}`, is_error: true };
        }
        return { content: out || "No matches found." };
      }

      case "bash": {
        const command = new Deno.Command("bash", {
          args: ["-c", args.command],
          stdout: "piped",
          stderr: "piped",
          signal: AbortSignal.timeout(BASH_TIMEOUT_MS),
        });
        const result = await command.output();
        const stdout = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);
        const output = (stdout + stderr).trim();

        if (!result.success) {
          return {
            content: output || `Command exited with code ${result.code}`,
            is_error: true,
          };
        }
        return { content: output || "(no output)" };
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
