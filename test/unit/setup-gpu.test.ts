import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));
vi.mock("fs", () => ({
  default: { existsSync: vi.fn() },
}));

import { execSync } from "child_process";
import fs from "fs";
import { detectGpu } from "@/lib/setup/gpu";

const execSyncMock = vi.mocked(execSync);
const existsSyncMock = vi.mocked(fs.existsSync);

beforeEach(() => {
  execSyncMock.mockReset();
  existsSyncMock.mockReset();
});

describe("detectGpu", () => {
  it("parses name/driver from nvidia-smi output and maps driver version to CUDA + torch index URL", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.startsWith("where")) return "";
      return "NVIDIA GeForce RTX 4090, 566.03\n";
    });

    const gpu = detectGpu();

    expect(gpu).toEqual({
      found: true,
      name: "NVIDIA GeForce RTX 4090",
      driverVersion: "566.03",
      cudaVersion: "12.6",
      torchIndexUrl: "https://download.pytorch.org/whl/cu126",
    });
  });

  it("falls back to the well-known install-path candidates when nvidia-smi isn't on PATH (regression guard for #5)", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.startsWith("where")) throw new Error("not found");
      return "NVIDIA GeForce RTX 3060, 527.41\n";
    });
    existsSyncMock.mockImplementation(
      (p: unknown) => p === "C:\\Windows\\System32\\nvidia-smi.exe",
    );

    const gpu = detectGpu();

    expect(gpu.found).toBe(true);
    expect(gpu.name).toBe("NVIDIA GeForce RTX 3060");
    // The quoted, fully-qualified path must actually be used in the query command,
    // not silently fall through to a bare "nvidia-smi" that isn't on PATH.
    const queryCall = execSyncMock.mock.calls.find(([c]) =>
      String(c).includes("--query-gpu"),
    );
    expect(queryCall?.[0]).toContain('"C:\\Windows\\System32\\nvidia-smi.exe"');
  });

  it("returns found:false when nvidia-smi is unavailable everywhere", () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("command not found");
    });
    existsSyncMock.mockReturnValue(false);

    expect(detectGpu()).toEqual({ found: false, torchIndexUrl: "" });
  });

  it("returns found:false when nvidia-smi produces no output", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.startsWith("where")) return "";
      return "   \n";
    });

    expect(detectGpu()).toEqual({ found: false, torchIndexUrl: "" });
  });

  it("falls back to an empty torchIndexUrl for driver versions too old to map to a known CUDA/torch build", () => {
    execSyncMock.mockImplementation((cmd: unknown) => {
      const command = String(cmd);
      if (command.startsWith("where")) return "";
      return "Old GPU, 400.00\n";
    });

    const gpu = detectGpu();

    expect(gpu.found).toBe(true);
    expect(gpu.cudaVersion).toBe("11.7");
    expect(gpu.torchIndexUrl).toBe("");
  });
});
