import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const uploadDirectory = path.join(process.cwd(), "data", "uploads");
const uploadPathPrefix = path.join("data", "uploads");

function safeFilename(filename: string) {
  const parsed = path.parse(filename);
  const safeBase = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "document";
  return `${safeBase}${parsed.ext.toLowerCase()}`;
}

export async function storeOriginalDocument(file: File, originalFilename: string) {
  await mkdir(uploadDirectory, { recursive: true });

  const storedFilename = `${crypto.randomUUID()}-${safeFilename(originalFilename)}`;
  const absolutePath = path.join(uploadDirectory, storedFilename);
  const relativePath = path.join(uploadPathPrefix, storedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return {
    absolutePath,
    relativePath
  };
}
