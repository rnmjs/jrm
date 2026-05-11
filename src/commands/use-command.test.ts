import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllExecutables, getExecutable } from "../common.ts";
import { useCommand } from "./use-command.ts";

vi.mock("node:process", () => ({
  default: {
    env: {},
    stdout: {
      write: vi.fn(),
    },
  },
}));

vi.mock("../common.ts", () => ({
  getAllExecutables: vi.fn(),
  getExecutable: vi.fn(),
}));

function makeExecutable(name: string, useImpl?: (...args: any[]) => any) {
  return {
    name,
    use: useImpl ?? vi.fn().mockResolvedValue("1.0.0"),
  };
}

describe("useCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {};
    vi.mocked(process.stdout.write).mockClear();
  });

  it("should use all executables when specs is empty", async () => {
    const node = makeExecutable("node");
    const pnpm = makeExecutable("pnpm");
    vi.mocked(getAllExecutables).mockReturnValue([pnpm, node] as any[]);

    await useCommand([]);

    expect(pnpm.use).toHaveBeenCalledWith(undefined, undefined);
    expect(node.use).toHaveBeenCalledWith(undefined, undefined);
    expect(process.stdout.write).toHaveBeenCalledWith("Using pnpm@1.0.0\n");
    expect(process.stdout.write).toHaveBeenCalledWith("Using node@1.0.0\n");
  });

  it("should use specified executables with version ranges", async () => {
    const node = makeExecutable("node");
    vi.mocked(getExecutable).mockReturnValue(node as any);

    await useCommand([{ name: "node", versionRange: ">=18.0.0" }]);

    expect(getExecutable).toHaveBeenCalledWith("node");
    expect(node.use).toHaveBeenCalledWith(">=18.0.0", undefined);
    expect(process.stdout.write).toHaveBeenCalledWith("Using node@1.0.0\n");
  });

  it("should pass flags to executable.use", async () => {
    const node = makeExecutable("node");
    vi.mocked(getExecutable).mockReturnValue(node as any);

    await useCommand([{ name: "node", versionRange: "20.0.0" }], { yes: true });

    expect(node.use).toHaveBeenCalledWith("20.0.0", { yes: true });
  });

  it("should not write output when use returns undefined", async () => {
    const node = makeExecutable("node", vi.fn().mockResolvedValue(undefined));
    vi.mocked(getAllExecutables).mockReturnValue([node] as any[]);

    await useCommand([]);

    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it("should continue processing after an executable fails and throw AggregateError", async () => {
    const nodeError = new Error("node install failed");
    const node = makeExecutable("node", vi.fn().mockRejectedValue(nodeError));
    const pnpm = makeExecutable("pnpm");
    vi.mocked(getAllExecutables).mockReturnValue([pnpm, node] as any[]);

    await expect(useCommand([])).rejects.toThrow(AggregateError);
    await expect(useCommand([])).rejects.toThrow(
      "Some executables failed to use.",
    );

    expect(pnpm.use).toHaveBeenCalled();
    expect(node.use).toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith("Using pnpm@1.0.0\n");
  });

  it("should collect all errors in AggregateError", async () => {
    const err1 = new Error("first error");
    const err2 = new Error("second error");
    vi.mocked(getAllExecutables).mockReturnValue([
      makeExecutable("node", vi.fn().mockRejectedValue(err1)),
      makeExecutable("pnpm", vi.fn().mockRejectedValue(err2)),
    ] as any[]);

    let caught: AggregateError | null = null;
    try {
      await useCommand([]);
    } catch (error) {
      caught = error as AggregateError;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect(caught?.errors).toHaveLength(2);
    expect(caught?.errors[0]).toBe(err1);
    expect(caught?.errors[1]).toBe(err2);
  });

  it("should handle multiple specs with mixed package managers and runtimes", async () => {
    const pnpm = makeExecutable("pnpm", vi.fn().mockResolvedValue("10.0.0"));
    const yarn = makeExecutable("yarn", vi.fn().mockResolvedValue("4.0.0"));
    const node = makeExecutable("node", vi.fn().mockResolvedValue("22.0.0"));
    const bun = makeExecutable("bun", vi.fn().mockResolvedValue("1.0.0"));
    vi.mocked(getExecutable)
      .mockReturnValueOnce(pnpm as any)
      .mockReturnValueOnce(yarn as any)
      .mockReturnValueOnce(node as any)
      .mockReturnValueOnce(bun as any);

    await useCommand([
      { name: "pnpm", versionRange: "10.0.0" },
      { name: "yarn", versionRange: "4.0.0" },
      { name: "node", versionRange: ">=22.0.0" },
      { name: "bun", versionRange: "1.0.0" },
    ]);

    expect(pnpm.use).toHaveBeenCalledWith("10.0.0", undefined);
    expect(yarn.use).toHaveBeenCalledWith("4.0.0", undefined);
    expect(node.use).toHaveBeenCalledWith(">=22.0.0", undefined);
    expect(bun.use).toHaveBeenCalledWith("1.0.0", undefined);
    expect(process.stdout.write).toHaveBeenCalledWith("Using pnpm@10.0.0\n");
    expect(process.stdout.write).toHaveBeenCalledWith("Using yarn@4.0.0\n");
    expect(process.stdout.write).toHaveBeenCalledWith("Using node@22.0.0\n");
    expect(process.stdout.write).toHaveBeenCalledWith("Using bun@1.0.0\n");
  });

  it("should not throw when all executables succeed", async () => {
    vi.mocked(getAllExecutables).mockReturnValue([
      makeExecutable("node"),
    ] as any[]);

    await expect(useCommand([])).resolves.toBeUndefined();
  });
});
