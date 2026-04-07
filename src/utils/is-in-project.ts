import path from "node:path";
import { exists } from "./exists.ts";

export async function isInProject(dir: string): Promise<boolean> {
  if (await exists(path.join(dir, "package.json"))) {
    return true;
  }
  const parent = path.dirname(dir);
  if (parent === dir) {
    return false;
  }
  return await isInProject(parent);
}
