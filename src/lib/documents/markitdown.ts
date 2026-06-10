import { spawn } from "node:child_process";
import path from "node:path";

export type MarkItDownConversionResult = {
  ok: boolean;
  markdown: string | null;
  error: string | null;
};

type PythonMarkItDownResponse = {
  ok?: boolean;
  markdown?: unknown;
  error?: unknown;
};

export async function convertDocumentWithMarkItDown(absolutePath: string): Promise<MarkItDownConversionResult> {
  const scriptPath = path.join(process.cwd(), "scripts", "convert_with_markitdown.py");

  return new Promise((resolve) => {
    const pythonExecutable = process.env.MARKITDOWN_PYTHON ?? "python3";
    const child = spawn(pythonExecutable, [scriptPath, absolutePath], {
      cwd: process.cwd(),
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        markdown: null,
        error: error.message
      });
    });

    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim()) as PythonMarkItDownResponse;

        if (parsed.ok === true && typeof parsed.markdown === "string") {
          resolve({
            ok: true,
            markdown: parsed.markdown,
            error: null
          });
          return;
        }

        resolve({
          ok: false,
          markdown: null,
          error: typeof parsed.error === "string" ? parsed.error : stderr || "MarkItDown conversion failed."
        });
      } catch {
        resolve({
          ok: false,
          markdown: null,
          error: stderr || stdout || "MarkItDown returned invalid output."
        });
      }
    });
  });
}
