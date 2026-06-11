import { registerTool, getTabId, type ToolExecutor } from "./index.js";

interface RuntimeEvaluateResult {
  result: {
    type: string;
    subtype?: string;
    value?: unknown;
    unserializableValue?: string;
    description?: string;
  };
  exceptionDetails?: { text: string };
}

function maybeParseJson(value: unknown, parseJson: boolean): unknown {
  if (!parseJson || typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function structuredValue(result: RuntimeEvaluateResult["result"], parseJson: boolean): Record<string, unknown> {
  const isUndefined = result.type === "undefined";
  const value = isUndefined ? null : maybeParseJson(result.value ?? result.unserializableValue ?? null, parseJson);

  return {
    value,
    type: result.type,
    subtype: result.subtype,
    isNull: result.subtype === "null",
    isUndefined,
  };
}

export const evaluateTool: ToolExecutor = {
  name: "evaluate",
  async execute(params, ctx) {
    const code = params.code as string;
    const parseJson = params.parse_json === true;
    const structured = params.structured === true;
    if (!code) throw new Error("evaluate: code is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    const result = await ctx.cdp.send<RuntimeEvaluateResult>("Runtime.evaluate", {
      expression: code,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(`evaluate: ${result.exceptionDetails.text}`);
    }

    if (structured) {
      return structuredValue(result.result, parseJson);
    }
    return maybeParseJson(result.result.value, parseJson);
  },
};

registerTool(evaluateTool);
