import { registerTool, resolveToolTarget } from "./index.js";

registerTool({
  name: "upload",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const filePath = params.filePath as string | undefined;
    const files = params.files as string[] | undefined;
    if (!selector) throw new Error("upload: selector is required");
    const paths = files ?? (filePath ? [filePath] : []);
    if (paths.length === 0) throw new Error("upload: filePath or files is required");

    const { tabId, ref: resolvedRef } = await resolveToolTarget(params, ctx, selector);
    return ctx.cdp.run(tabId, async (tab) => {
      let nodeId: number;
      if (ctx.refs.isRef(selector)) {
        const refName = selector.startsWith("@") ? selector.slice(1) : selector;
        const entry = resolvedRef ?? ctx.refs.get(tabId, refName);
        if (!entry) throw new Error(`upload: unknown ref "${selector}"`);
        let result: { nodeIds: number[] } | undefined;
        try {
          result = await tab.send<{ nodeIds: number[] }>("DOM.pushNodesByBackendIdsToFrontend", {
            backendNodeIds: [entry.backendDOMNodeId],
          });
        } catch (error) {
          if (!resolvedRef) throw error;
          ctx.refs.rejectDetached(selector);
        }
        if (!result?.nodeIds || result.nodeIds.length === 0) {
          if (resolvedRef) ctx.refs.rejectDetached(selector);
          throw new Error("upload: could not resolve ref to nodeId");
        }
        nodeId = result.nodeIds[0];
      } else {
        const docResult = await tab.send<{ root: { nodeId: number } }>("DOM.getDocument");
        const queryResult = await tab.send<{ nodeId: number }>("DOM.querySelector", {
          nodeId: docResult.root.nodeId,
          selector,
        });
        if (!queryResult.nodeId || queryResult.nodeId === 0) {
          throw new Error(`upload: element not found: ${selector}`);
        }
        nodeId = queryResult.nodeId;
      }

      await tab.send("DOM.setFileInputFiles", {
        nodeId,
        files: paths,
      });

      return { success: true };
    });
  },
});
