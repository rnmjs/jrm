import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { download } from "./download.ts";
import { exists } from "./exists.ts";

describe("download", () => {
  const testDir = path.join(import.meta.dirname, "../../test-downloads");
  const testUrl = "https://example.com/bytes/32";
  const testContent = new Uint8Array(32).fill(0xab);

  const mockFetchOk = (body: Uint8Array = testContent) => {
    const stream = new ReadableStream({
      start: (controller) => {
        const chunkSize = 8;
        for (let i = 0; i < body.length; i += chunkSize) {
          controller.enqueue(body.slice(i, i + chunkSize));
        }
        controller.close();
      },
    });
    return vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "content-length": String(body.length) },
      }),
    );
  };

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true });
    vi.unstubAllGlobals();
  });

  it("should download a file successfully", async () => {
    vi.stubGlobal("fetch", mockFetchOk());

    await download(testUrl, testDir);

    const fileName = path.basename(new URL(testUrl).pathname);
    const downloadedFilePath = path.join(testDir, fileName);

    expect(await exists(downloadedFilePath)).toBe(true);
    const stats = await fs.stat(downloadedFilePath);
    expect(stats.size).toBe(testContent.length);
  });

  it("should call onProgress callback during download", async () => {
    vi.stubGlobal("fetch", mockFetchOk());
    const progressUpdates: Array<{
      received: number;
      total: number | undefined;
    }> = [];

    await download(testUrl, testDir, {
      onProgress: (received, total) => {
        progressUpdates.push({ received, total });
      },
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    const lastUpdate = progressUpdates[progressUpdates.length - 1];
    expect(lastUpdate?.received).toBe(testContent.length);
    expect(lastUpdate?.total).toBe(testContent.length);
  });

  it("should throw error for invalid URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    const invalidUrl = "https://example.com/status/404";

    await expect(download(invalidUrl, testDir)).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  it("should create file with correct name from URL", async () => {
    vi.stubGlobal("fetch", mockFetchOk());

    await download(testUrl, testDir);

    const expectedFileName = path.basename(new URL(testUrl).pathname);
    const downloadedFilePath = path.join(testDir, expectedFileName);

    expect(await exists(downloadedFilePath)).toBe(true);
    expect(path.basename(downloadedFilePath)).toBe(expectedFileName);
  });

  it("should skip download when onResponse returns false", async () => {
    vi.stubGlobal("fetch", mockFetchOk());

    await download(testUrl, testDir, {
      onResponse: () => false,
    });

    const fileName = path.basename(new URL(testUrl).pathname);
    const downloadedFilePath = path.join(testDir, fileName);

    expect(await exists(downloadedFilePath)).toBe(false);
  });
});
