import { registerTool, type ToolExecutor } from "./index.js";
import { evaluateTool } from "./evaluate.js";
import { snapshotTool } from "./snapshot.js";

const multiSnapshotTool: ToolExecutor = {
  name: "multi_snapshot",
  async execute(params, ctx) {
    const tabIds = params.tabIds as number[] | undefined;
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      throw new Error("multi_snapshot: tabIds is required");
    }

    const results = [];
    for (const tabId of tabIds) {
      try {
        const tree = await snapshotTool.execute({ ...params, _tabId: tabId }, ctx);
        results.push({ tabId, tree });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ tabId, error });
      }
    }
    return { results };
  },
};

const batchEvalTool: ToolExecutor = {
  name: "batch_eval",
  async execute(params, ctx) {
    const tabIds = params.tabIds as number[] | undefined;
    const code = params.code as string;
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      throw new Error("batch_eval: tabIds is required");
    }
    if (!code) throw new Error("batch_eval: code is required");

    const results = [];
    for (const tabId of tabIds) {
      try {
        const value = await evaluateTool.execute({ ...params, _tabId: tabId }, ctx);
        results.push({ tabId, value });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ tabId, error });
      }
    }
    return { results };
  },
};

registerTool(multiSnapshotTool);
registerTool(batchEvalTool);
