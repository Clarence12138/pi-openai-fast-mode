import { promises as fs, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { FastModeConfig, ResolvedConfigPath } from "./types";

export const DEFAULT_CONFIG: FastModeConfig = { enabled: false };

export function cloneConfig(config: FastModeConfig = DEFAULT_CONFIG): FastModeConfig {
  return { enabled: config.enabled };
}

export function normalizeConfig(
  raw: unknown,
  fallback: FastModeConfig = DEFAULT_CONFIG,
): FastModeConfig {
  // 旧配置中的 targets 不再参与判断，保留用户已有的开关状态。
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return cloneConfig(fallback);
  }
  const enabled = (raw as Record<string, unknown>).enabled;
  return { enabled: typeof enabled === "boolean" ? enabled : fallback.enabled };
}

export function parseConfigJson(
  json: string,
  fallback: FastModeConfig = DEFAULT_CONFIG,
): FastModeConfig {
  try {
    return normalizeConfig(JSON.parse(json), fallback);
  } catch {
    return cloneConfig(fallback);
  }
}

export function getUserConfigPath(agentDir: string = getAgentDir()): string {
  return join(agentDir, "extensions", "pi-openai-fast-mode", "config.json");
}

export function getProjectConfigPath(cwd: string): string {
  return join(resolve(cwd), ".pi", "pi-openai-fast-mode", "config.json");
}

export function isProjectLocalExtension(extensionDir: string | undefined, cwd: string): boolean {
  if (!extensionDir) return false;
  const projectPiDir = resolve(cwd, ".pi");
  const resolvedExtensionDir = resolve(extensionDir);
  return resolvedExtensionDir === projectPiDir || resolvedExtensionDir.startsWith(
    projectPiDir.endsWith(sep) ? projectPiDir : `${projectPiDir}${sep}`,
  );
}

export type SelectConfigPathOptions = {
  cwd: string;
  extensionDir?: string;
  agentDir?: string;
  exists?: (path: string) => boolean;
};

export function selectConfigPath({
  cwd, extensionDir, agentDir, exists = existsSync,
}: SelectConfigPathOptions): ResolvedConfigPath {
  const projectPath = getProjectConfigPath(cwd);
  if (exists(projectPath) || isProjectLocalExtension(extensionDir, cwd)) {
    return { scope: "project", path: projectPath };
  }
  return { scope: "user", path: getUserConfigPath(agentDir) };
}

export type LoadConfigOptions = Omit<SelectConfigPathOptions, "exists"> & {
  fallback?: FastModeConfig;
};
export type LoadedConfig = ResolvedConfigPath & { config: FastModeConfig };

export async function loadConfigFromPath(
  configPath: string,
  fallback: FastModeConfig = DEFAULT_CONFIG,
): Promise<FastModeConfig> {
  try {
    return parseConfigJson(await fs.readFile(configPath, "utf8"), fallback);
  } catch {
    return cloneConfig(fallback);
  }
}

export async function loadConfigForScope(options: LoadConfigOptions): Promise<LoadedConfig> {
  const selected = selectConfigPath(options);
  const config = await loadConfigFromPath(selected.path, options.fallback ?? DEFAULT_CONFIG);
  return { ...selected, config };
}

export async function saveConfigToPath(configPath: string, config: FastModeConfig): Promise<void> {
  const normalized = normalizeConfig(config);
  await fs.mkdir(dirname(configPath), { recursive: true });
  // 同目录临时文件原子替换，避免并发读取或中断时暴露半写入配置。
  const tempPath = `${configPath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, configPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export async function saveConfigForScope(
  options: SelectConfigPathOptions,
  config: FastModeConfig,
): Promise<ResolvedConfigPath> {
  const selected = selectConfigPath(options);
  await saveConfigToPath(selected.path, config);
  return selected;
}
