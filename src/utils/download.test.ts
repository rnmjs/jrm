import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { download } from "./download.ts";
import { exists } from "./exists.ts";

describe("download", () => {
  const testDir = path.join(import.meta.dirname, "../../test-downloads");
  const testUrl = "https://httpbin.org/bytes/1024"; // 1KB test file

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true });
  });

  it("should download a file successfully", async () => {
    await download(testUrl, testDir);

    const fileName = path.basename(new URL(testUrl).pathname);
    const downloadedFilePath = path.join(testDir, fileName);

    expect(await exists(downloadedFilePath)).toBe(true);
    const stats = await fs.stat(downloadedFilePath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("should call onProgress callback during download", async () => {
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
    expect(lastUpdate?.received).toBeGreaterThan(0);
  });

  it("should throw error for invalid URL", async () => {
    const invalidUrl = "https://httpbin.org/status/404";

    await expect(download(invalidUrl, testDir)).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  it("should create file with correct name from URL", async () => {
    await download(testUrl, testDir);

    const expectedFileName = path.basename(new URL(testUrl).pathname);
    const downloadedFilePath = path.join(testDir, expectedFileName);

    expect(await exists(downloadedFilePath)).toBe(true);
    expect(path.basename(downloadedFilePath)).toBe(expectedFileName);
  });
});
