import { describe, expect, it, vi } from "vitest";
import { isGptModel, applyFastModePayload, getFastModePayload, toModelRef } from "../src/payload";
import {
  canSetTuiStatus, clearFastStatus, createFastIndicatorFactory,
  getRightAlignedStatusLine, getStatusText, updateFastStatus,
} from "../src/status";
import { STATUS_KEY } from "../src/types";

const config = { enabled: true };

const gptIds = [
  "gpt-4", "gpt-4o", "gpt-5.4", "gpt-6-astra", "gpt-6-astra-preview",
  "cpr/gpt-6-astra", "router/cpr/gpt-5.6-sol", "GPT-6-ASTRA",
  "gpt-5.4:priority", "gpt-5.4_custom",
];
const otherIds = [
  "claude-sonnet-4", "gemini-3.6-flash", "deepseek-flash", "grok-4.7", "o3",
  "custom/claude", "not-gpt-5.4", "mygpt-4", "gpt", "gpt-", "",
  "gpt-5.4/claude", "cpr/gpt-6-astra/", "gpt-5.4 claude",
];

describe.each(["openai", "openai-codex", "cpr", "magpie", "new-provider"])("model recognition on %s", provider => {
  it.each(gptIds)("enables priority and status for %s without targets", id => {
    const model = { provider, id };
    const payload = { model: id, messages: [], service_tier: "auto" };
    expect(isGptModel(model)).toBe(true);
    expect(getFastModePayload(config, model, payload)).toEqual({ ...payload, service_tier: "priority" });
    expect(payload.service_tier).toBe("auto");
    expect(getStatusText(config, model)).toBe("fast");
    expect(getFastModePayload({ enabled: false }, model, payload)).toBeUndefined();
    expect(getStatusText({ enabled: false }, model)).toBeUndefined();
  });

  it.each(otherIds)("leaves %s untouched and hides status", id => {
    const model = { provider, id };
    const payload = { model: id, service_tier: "flex" };
    expect(isGptModel(model)).toBe(false);
    expect(getFastModePayload(config, model, payload)).toBeUndefined();
    expect(payload.service_tier).toBe("flex");
    expect(getStatusText(config, model)).toBeUndefined();
  });
});

describe("payload boundaries", () => {
  it("does nothing without a model", () => {
    expect(isGptModel(undefined)).toBe(false);
    expect(getFastModePayload(config, undefined, {})).toBeUndefined();
    expect(getStatusText(config, undefined)).toBeUndefined();
  });

  it("converts Pi model refs and rejects malformed refs", () => {
    expect(toModelRef({ provider: "magpie", id: "cpr/gpt-6-astra", name: "GPT" }))
      .toEqual({ provider: "magpie", id: "cpr/gpt-6-astra" });
    for (const value of [null, [], { provider: "openai" }, { provider: "", id: "gpt-4" }]) {
      expect(toModelRef(value)).toBeUndefined();
    }
  });

  it("injects without mutating the original payload", () => {
    const payload = { model: "gpt-4", messages: [], service_tier: "auto" };
    const result = applyFastModePayload(payload, "priority");
    expect(result).toEqual({ ...payload, service_tier: "priority" });
    expect(result).not.toBe(payload);
    expect(payload.service_tier).toBe("auto");
    expect(applyFastModePayload({}, "")).toEqual({ service_tier: "priority" });
  });

  it.each([null, [], "payload"])("ignores non-record payload %j", payload => {
    expect(getFastModePayload(config, { provider: "magpie", id: "cpr/gpt-4" }, payload)).toBeUndefined();
  });
});

describe("status rendering", () => {
  it("right aligns and handles narrow widths", () => {
    expect(getRightAlignedStatusLine("fast", 10)).toBe("      fast");
    expect(getRightAlignedStatusLine("fast", 4)).toBe("fast");
    expect(getRightAlignedStatusLine("fast", 2)).toBe("fa");
    expect(getRightAlignedStatusLine("fast", 0)).toBe("");
    expect(createFastIndicatorFactory("fast")().render(8)).toEqual(["    fast"]);
  });

  it("uses a below-editor widget and clears it", () => {
    const setStatus = vi.fn();
    const setWidget = vi.fn();
    const ctx = { hasUI: true, mode: "tui", ui: { setStatus, setWidget } };
    updateFastStatus(ctx, config, { provider: "magpie", id: "cpr/gpt-6-astra" });
    expect(setWidget).toHaveBeenLastCalledWith(STATUS_KEY, expect.any(Function), { placement: "belowEditor" });
    expect(setWidget.mock.calls[0]![1]().render(8)).toEqual(["    fast"]);
    clearFastStatus(ctx);
    expect(setWidget).toHaveBeenLastCalledWith(STATUS_KEY, undefined, { placement: "belowEditor" });
    expect(setStatus).toHaveBeenLastCalledWith(STATUS_KEY, undefined);
  });

  it("falls back to footer status and hides for non-GPT models", () => {
    const setStatus = vi.fn();
    const ctx = { hasUI: true, mode: "tui", ui: { setStatus } };
    updateFastStatus(ctx, config, { provider: "custom", id: "gpt-4" });
    expect(setStatus).toHaveBeenLastCalledWith(STATUS_KEY, "fast");
    updateFastStatus(ctx, config, { provider: "custom", id: "claude" });
    expect(setStatus).toHaveBeenLastCalledWith(STATUS_KEY, undefined);
    clearFastStatus(ctx);
    expect(setStatus).toHaveBeenLastCalledWith(STATUS_KEY, undefined);
  });

  it("does not render outside TUI", () => {
    const setStatus = vi.fn();
    for (const ctx of [
      { hasUI: false, mode: "tui", ui: { setStatus } },
      { hasUI: true, mode: "print", ui: { setStatus } },
    ]) {
      expect(canSetTuiStatus(ctx)).toBe(false);
      updateFastStatus(ctx, config, { provider: "openai", id: "gpt-4" });
    }
    expect(setStatus).not.toHaveBeenCalled();
  });
});
