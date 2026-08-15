import path from "node:path";
import process from "node:process";
import { getAllExecutables } from "../common.ts";
import { Detector, type VersionDetectSource } from "../detector.ts";

const FILE_PRIORITY = ["package.json", ".jrmrc.json", "jrm.config.json"];

interface Candidate {
  name: string;
  source: VersionDetectSource;
}

function getDepth(dir: string): number {
  return dir.split(path.sep).filter(Boolean).length;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const dirA = path.dirname(a.source.configPath);
  const dirB = path.dirname(b.source.configPath);
  if (dirA !== dirB) {
    // Deeper directory is closer to cwd since detection walks upward.
    return getDepth(dirB) - getDepth(dirA);
  }
  const fileRankA = FILE_PRIORITY.indexOf(path.basename(a.source.configPath));
  const fileRankB = FILE_PRIORITY.indexOf(path.basename(b.source.configPath));
  if (fileRankA !== fileRankB) return fileRankA - fileRankB;
  return a.source.index - b.source.index;
}

export async function pmCommand(): Promise<void> {
  const names = getAllExecutables()
    .filter((executable) => executable.type === "packageManager")
    .map((executable) => executable.name);

  const best = (
    await Promise.all(
      names.map(async (name): Promise<Candidate | undefined> => {
        const result = await new Detector(
          name,
          "packageManager",
        ).detectVersionRange(process.cwd());
        return "versionRange" in result && result.source
          ? { name, source: result.source }
          : undefined;
      }),
    )
  )
    .filter((candidate) => candidate !== undefined)
    .toSorted(compareCandidates)
    .at(0);

  if (!best) {
    process.stderr.write(
      "Unable to determine the package manager for the current project/directory.\n",
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${best.name}\n`);
}
