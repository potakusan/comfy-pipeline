import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));
vi.mock("fs", () => ({
  default: { existsSync: vi.fn() },
}));
vi.mock("@/lib/setup/config", () => ({
  getComfyUIPath: vi.fn(() => "C:\\ComfyUI"),
  getComfyUIUrl: vi.fn(() => "http://localhost:8188"),
}));

import { execFileSync, execSync } from "child_process";
import fs from "fs";
import {
  checkAutomosaicVenv,
  checkComfyUIInstalled,
  checkComfyUIVenv,
  checkGit,
  checkPyTorch,
  checkPython,
  getAutomosaicVenvPython,
  getComfyUIVenvPython,
} from "@/lib/setup/checker";

const execSyncMock = vi.mocked(execSync);
const execFileSyncMock = vi.mocked(execFileSync);
const existsSyncMock = vi.mocked(fs.existsSync);

beforeEach(() => {
  execSyncMock.mockReset();
  execFileSyncMock.mockReset();
  existsSyncMock.mockReset();
});

describe("checkPython", () => {
  it("reports installed:true with the parsed version and resolved executable path", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.includes("--version")) return "Python 3.12.4\n";
      if (command.includes("sys.executable")) return "C:\\Python312\\python.exe\n";
      throw new Error(`unexpected command: ${command}`);
    });

    expect(checkPython()).toEqual({
      installed: true,
      version: "3.12.4",
      path: "C:\\Python312\\python.exe",
    });
  });

  it("tries the next candidate command when one fails, instead of stopping at the first failure", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.startsWith("python --version")) throw new Error("not found");
      if (command.startsWith("python3 --version")) return "Python 3.11.9\n";
      if (command.includes("sys.executable")) return "/usr/bin/python3\n";
      throw new Error(`unexpected command: ${command}`);
    });

    expect(checkPython()).toMatchObject({ installed: true, version: "3.11.9" });
  });

  it("reports installed:false when no candidate command produces a parseable version", () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });

    expect(checkPython()).toEqual({ installed: false });
  });
});

describe("checkGit", () => {
  it("parses the version out of 'git version X.Y.Z' output", () => {
    execSyncMock.mockReturnValue("git version 2.47.1\n");
    expect(checkGit()).toEqual({ installed: true, version: "2.47.1" });
  });

  it("includes the trailing dot before a Windows-style '.windows.N' suffix, since [\\d.]+ is greedy (documents current behavior, not asserting it's ideal)", () => {
    execSyncMock.mockReturnValue("git version 2.47.1.windows.1\n");
    expect(checkGit()).toEqual({ installed: true, version: "2.47.1." });
  });

  it("reports installed:false when git isn't available", () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(checkGit()).toEqual({ installed: false });
  });
});

describe("checkComfyUIInstalled", () => {
  it("is installed when main.py exists under the configured ComfyUI path", () => {
    existsSyncMock.mockReturnValue(true);
    expect(checkComfyUIInstalled()).toEqual({ installed: true, path: "C:\\ComfyUI" });
  });

  it("is not installed when main.py is missing", () => {
    existsSyncMock.mockReturnValue(false);
    expect(checkComfyUIInstalled()).toEqual({ installed: false });
  });
});

describe("checkPyTorch", () => {
  it("reports the torch version and CUDA availability from the two printed lines", () => {
    execFileSyncMock.mockReturnValue("2.5.1+cu124\nTrue\n");
    expect(checkPyTorch("C:\\ComfyUI\\venv\\Scripts\\python.exe")).toEqual({
      installed: true,
      version: "2.5.1+cu124",
      detail: "CUDA有効",
    });
  });

  it("reports CPU only when torch.cuda.is_available() prints False", () => {
    execFileSyncMock.mockReturnValue("2.5.1\nFalse\n");
    expect(checkPyTorch("python")).toMatchObject({ installed: true, detail: "CPU only" });
  });

  it("reports not installed when the import fails", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("ModuleNotFoundError");
    });
    expect(checkPyTorch("python")).toEqual({ installed: false });
  });
});

describe("venv path helpers + existence checks", () => {
  it("uses the Windows venv layout for getComfyUIVenvPython on win32", () => {
    if (process.platform === "win32") {
      expect(getComfyUIVenvPython()).toBe("C:\\ComfyUI\\venv\\Scripts\\python.exe");
    }
  });

  it("checkComfyUIVenv reflects fs.existsSync for the resolved venv python path", () => {
    existsSyncMock.mockReturnValue(true);
    expect(checkComfyUIVenv()).toEqual({
      installed: true,
      path: getComfyUIVenvPython(),
    });

    existsSyncMock.mockReturnValue(false);
    expect(checkComfyUIVenv()).toEqual({ installed: false });
  });

  it("checkAutomosaicVenv reflects fs.existsSync for the resolved venv python path", () => {
    existsSyncMock.mockReturnValue(true);
    expect(checkAutomosaicVenv()).toEqual({
      installed: true,
      path: getAutomosaicVenvPython(),
    });

    existsSyncMock.mockReturnValue(false);
    expect(checkAutomosaicVenv()).toEqual({ installed: false });
  });
});
