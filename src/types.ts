export const PACKAGE_NAME = "pi-openai-fast-mode";
export const STATUS_KEY = PACKAGE_NAME;
export const DEFAULT_SERVICE_TIER = "priority";

export type FastModeConfig = {
  enabled: boolean;
};

export type ModelRef = {
  provider: string;
  id: string;
};

export type ConfigScope = "user" | "project";

export type ResolvedConfigPath = {
  scope: ConfigScope;
  path: string;
};
