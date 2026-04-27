import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllExecutables } from "../common.ts";
import { envCommand } from "./env-command.ts";

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
}));

describe("envCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {};
    vi.mocked(process.stdout.write).mockClear();
    vi.mocked(getAllExecutables).mockReturnValue([
      {
        env: () => ({
          JRM_MULTISHELL_PATH_OF_NODE:
            "/home/testuser/.jrm/node/multishells/test",
        }),
      },
      {
        env: () => ({
          JRM_MULTISHELL_PATH_OF_PNPM:
            "/home/testuser/.jrm/pnpm/multishells/test",
        }),
      },
    ] as any[]);
  });

  it("should output zsh environment when SHELL is zsh", () => {
    process.env["SHELL"] = "/bin/zsh";

    envCommand();

    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(process.stdout.write).mock.calls[0]?.[0]).toBe(
      `export JRM_MULTISHELL_PATH_OF_NODE="/home/testuser/.jrm/node/multishells/test"
export JRM_MULTISHELL_PATH_OF_PNPM="/home/testuser/.jrm/pnpm/multishells/test"
jrm use
export PATH="$JRM_MULTISHELL_PATH_OF_NODE/bin:$JRM_MULTISHELL_PATH_OF_PNPM/bin:$PATH"

jrm__chpwd() {
  jrm use
}
autoload -Uz add-zsh-hook
add-zsh-hook chpwd jrm__chpwd
`,
    );
  });

  it("should output bash environment when SHELL is bash", () => {
    process.env["SHELL"] = "/bin/bash";

    envCommand();

    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(process.stdout.write).mock.calls[0]?.[0]).toBe(
      `export JRM_MULTISHELL_PATH_OF_NODE="/home/testuser/.jrm/node/multishells/test"
export JRM_MULTISHELL_PATH_OF_PNPM="/home/testuser/.jrm/pnpm/multishells/test"
jrm use
export PATH="$JRM_MULTISHELL_PATH_OF_NODE/bin:$JRM_MULTISHELL_PATH_OF_PNPM/bin:$PATH"

__jrmcd() {
  \\cd "$@" || return $?
  jrm use
}
alias cd=__jrmcd
`,
    );
  });

  it("should output bash environment when SHELL is empty or unset", () => {
    process.env["SHELL"] = "";

    envCommand();

    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(process.stdout.write).mock.calls[0]?.[0]).toBe(
      `export JRM_MULTISHELL_PATH_OF_NODE="/home/testuser/.jrm/node/multishells/test"
export JRM_MULTISHELL_PATH_OF_PNPM="/home/testuser/.jrm/pnpm/multishells/test"
jrm use
export PATH="$JRM_MULTISHELL_PATH_OF_NODE/bin:$JRM_MULTISHELL_PATH_OF_PNPM/bin:$PATH"

__jrmcd() {
  \\cd "$@" || return $?
  jrm use
}
alias cd=__jrmcd
`,
    );
  });

  it("should throw error for unsupported shell", () => {
    process.env["SHELL"] = "/bin/fish";

    expect(envCommand).toThrow("Unsupported shell: fish");
  });
});
