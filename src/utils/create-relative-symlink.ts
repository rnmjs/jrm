import fs from "node:fs/promises";
import path from "node:path";

export async function createRelativeSymlink(target: string, source: string) {
  if (!path.isAbsolute(target)) {
    throw new TypeError(`Target path '${target}' is not an absolute path.`);
  }
  if (!path.isAbsolute(source)) {
    throw new TypeError(`Source path '${source}' is not an absolute path.`);
  }

  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.rm(source, { recursive: true }).catch(() => {
    /* do nothing */
  });
  await fs.symlink(path.relative(path.dirname(source), target), source);
}
