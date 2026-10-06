import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG, cloneConfig, getProjectConfigPath, getUserConfigPath,
  isProjectLocalExtension, loadConfigFromPath, normalizeConfig, parseConfigJson,
  saveConfigToPath, selectConfigPath,
} from "../src/config";

const tempDirs: string[] = [];
async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-openai-fast-mode-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe("config normalization", () => {
  it("starts disabled and clones independently", () => {
    expect(DEFAULT_CONFIG).toEqual({ enabled: false });
    const copy = cloneConfig();
    copy.enabled = true;
    expect(DEFAULT_CONFIG.enabled).toBe(false);
  });

  it.each([null, "bad", [], {}, { enabled: "yes" }])("falls back for %j", raw => {
    expect(normalizeConfig(raw)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig(raw, { enabled: true })).toEqual({ enabled: true });
  });

  it.each([true, false])("ignores legacy targets and preserves enabled=%s", enabled => {
    for (const targets of [[], "bad", [{ provider: "custom", model: "claude", serviceTier: "flex" }]]) {
      expect(normalizeConfig({ enabled, targets })).toEqual({ enabled });
    }
  });

  it("falls back on invalid JSON", () => {
    expect(parseConfigJson("not-json")).toEqual(DEFAULT_CONFIG);
  });
});

describe("config JSON IO", () => {
  it("falls back for missing or malformed files", async () => {
    const path = join(await makeTempDir(), "config.json");
    expect(await loadConfigFromPath(path)).toEqual(DEFAULT_CONFIG);
    await writeFile(path, "{");
    expect(await loadConfigFromPath(path)).toEqual(DEFAULT_CONFIG);
  });

  it("loads legacy config and persists only the toggle", async () => {
    const path = join(await makeTempDir(), "config.json");
    await writeFile(path, JSON.stringify({ enabled: true, targets: [] }));
    const config = await loadConfigFromPath(path);
    expect(config).toEqual({ enabled: true });
    await saveConfigToPath(path, config);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ enabled: true });
  });

  it("creates directories and replaces config without leftover temp files", async () => {
    const dir = join(await makeTempDir(), "nested");
    const path = join(dir, "config.json");
    await saveConfigToPath(path, { enabled: false });
    await saveConfigToPath(path, { enabled: true });
    expect(await readdir(dir)).toEqual(["config.json"]);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ enabled: true });
  });

  it("never exposes a partial file to concurrent readers", async () => {
    const path = join(await makeTempDir(), "config.json");
    const expected = { enabled: true };
    await saveConfigToPath(path, expected);
    const reader = async () => {
      for (let i = 0; i < 30; i++) {
        expect(JSON.parse(await readFile(path, "utf8"))).toEqual(expected);
      }
    };
    const writer = async () => {
      for (let i = 0; i < 10; i++) await saveConfigToPath(path, expected);
    };
    await Promise.all([...Array.from({ length: 20 }, reader), ...Array.from({ length: 20 }, writer)]);
  });
});

describe("persistence scope selection", () => {
  it("uses user state for a global extension without project config", () => {
    expect(selectConfigPath({
      cwd: "/repo", agentDir: "/agent", extensionDir: "/agent/npm/fast/src", exists: () => false,
    })).toEqual({ scope: "user", path: getUserConfigPath("/agent") });
  });

  it("uses existing project config even with a global extension", () => {
    expect(selectConfigPath({
      cwd: "/repo", agentDir: "/agent", extensionDir: "/agent/npm/fast/src",
      exists: path => path === getProjectConfigPath("/repo"),
    })).toEqual({ scope: "project", path: getProjectConfigPath("/repo") });
  });

  it("uses project state for project-local installs", () => {
    expect(selectConfigPath({
      cwd: "/repo", extensionDir: "/repo/.pi/npm/fast/src", exists: () => false,
    })).toEqual({ scope: "project", path: getProjectConfigPath("/repo") });
  });

  it("detects project-local directories without matching sibling prefixes", () => {
    expect(isProjectLocalExtension("/repo/.pi/extensions/fast", "/repo")).toBe(true);
    expect(isProjectLocalExtension("/repo/.pi", "/repo")).toBe(true);
    expect(isProjectLocalExtension("/repo/.pi-other/fast", "/repo")).toBe(false);
    expect(isProjectLocalExtension(undefined, "/repo")).toBe(false);
  });
});
