import {
  DEFAULT_SERVICE_TIER,
  type FastModeConfig,
  type ModelRef,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toModelRef(model: unknown): ModelRef | undefined {
  if (!isRecord(model)) return undefined;

  const { provider, id } = model;
  if (typeof provider !== "string" || typeof id !== "string") return undefined;
  if (!provider || !id) return undefined;

  return { provider, id };
}

export function isGptModel(model: ModelRef | undefined): boolean {
  // 只检查最后一个路径段，支持路由前缀，但不把路径中含 gpt 的其他模型误判为 GPT。
  const name = model?.id.split("/").at(-1);
  return name !== undefined && /^gpt-[a-z0-9][a-z0-9._:-]*$/i.test(name);
}

export function applyFastModePayload(
  payload: unknown,
  serviceTier: string,
): unknown | undefined {
  if (!isRecord(payload)) return undefined;

  return {
    ...payload,
    service_tier: serviceTier || DEFAULT_SERVICE_TIER,
  };
}

export function getFastModePayload(
  config: FastModeConfig,
  model: ModelRef | undefined,
  payload: unknown,
): unknown | undefined {
  if (!config.enabled || !isGptModel(model)) return undefined;

  return applyFastModePayload(payload, DEFAULT_SERVICE_TIER);
}
