import { mkdir, writeFile, rm } from "node:fs/promises";
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

export async function removeStoredOriginalDocument(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const allowedRoot = path.resolve(uploadDirectory);

  if (!absolutePath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error("Refusing to delete a file outside the upload directory.");
  }

  await rm(absolutePath, { force: true });
}
