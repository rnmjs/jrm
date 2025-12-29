import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface DownloadOptions {
  onProgress?: (received: number, total?: number) => void;
}

export async function download(
  url: string,
  destination: string,
  options?: DownloadOptions,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Failed to fetch ${url}. Status: ${response.status}.`);
  }

  const contentLength = response.headers.get("content-length");
  let received = 0;
  const progressTransform = new Transform({
    transform: (chunk, _encoding, callback) => {
      received += chunk.length;
      options?.onProgress?.(
        received,
        contentLength ? Number(contentLength) : undefined,
      );
      callback(null, chunk);
    },
  });

  const fileName = path.basename(new URL(url).pathname);
  const outputPath = path.join(destination, fileName);
  await pipeline(
    response.body,
    progressTransform,
    fs.createWriteStream(outputPath),
  );
}
