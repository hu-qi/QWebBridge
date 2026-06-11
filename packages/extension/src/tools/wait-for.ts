import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const waitForTool: ToolExecutor = {
  name: "wait_for",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const text = params.text as string | undefined;
    const state = (params.state as string | undefined) || "visible";
    const timeout = typeof params.timeout === "number" ? params.timeout : 30_000;

    if (!selector) throw new Error("wait_for: selector is required");
    if (!["visible", "hidden", "removed"].includes(state)) {
      throw new Error("wait_for: state must be visible, hidden, or removed");
    }

    await ctx.cdp.attach(await getTabId(params, ctx));

    const marker = `qweb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await ctx.cdp.send<{
      result: { value: { success: boolean; found: boolean; elapsed_ms: number; error?: string; marked?: boolean } };
      exceptionDetails?: { text: string };
    }>("Runtime.evaluate", {
      expression: `(() => new Promise((resolve) => {
        const selector = ${JSON.stringify(selector)};
        const text = ${JSON.stringify(text ?? "")};
        const state = ${JSON.stringify(state)};
        const timeout = ${JSON.stringify(timeout)};
        const marker = ${JSON.stringify(marker)};
        const started = Date.now();

        const isVisible = (el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            rect.width > 0 &&
            rect.height > 0;
        };

        const findMatch = () => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.find((el) => !text || (el.textContent || '').includes(text)) || null;
        };

        const check = () => {
          const el = findMatch();
          const visible = el ? isVisible(el) : false;
          const matched =
            state === 'removed' ? !el :
            state === 'hidden' ? !el || !visible :
            !!el && visible;

          if (matched) {
            if (el && state === 'visible') {
              el.setAttribute('data-qweb-wait-ref', marker);
            }
            resolve({ success: true, found: !!el, elapsed_ms: Date.now() - started, marked: !!el && state === 'visible' });
            return true;
          }
          if (Date.now() - started >= timeout) {
            resolve({
              success: false,
              found: false,
              elapsed_ms: Date.now() - started,
              error: 'wait_for timeout after ' + timeout + 'ms',
            });
            return true;
          }
          return false;
        };

        if (check()) return;
        const observer = new MutationObserver(() => {
          if (check()) observer.disconnect();
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        const interval = setInterval(() => {
          if (check()) {
            clearInterval(interval);
            observer.disconnect();
          }
        }, 100);
      }))()`,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) throw new Error(`wait_for: ${result.exceptionDetails.text}`);

    const value = result.result.value;
    if (value.marked) {
      const doc = await ctx.cdp.send<{ root: { nodeId: number } }>("DOM.getDocument");
      const node = await ctx.cdp.send<{ nodeId: number }>("DOM.querySelector", {
        nodeId: doc.root.nodeId,
        selector: `[data-qweb-wait-ref="${marker}"]`,
      });
      if (node.nodeId) {
        const described = await ctx.cdp.send<{ node: { backendNodeId: number } }>("DOM.describeNode", {
          nodeId: node.nodeId,
        });
        const ref = `e${Date.now()}`;
        ctx.refs.set(ref, described.node.backendNodeId);
        return { ...value, ref: `@${ref}` };
      }
    }

    return value;
  },
};

registerTool(waitForTool);
