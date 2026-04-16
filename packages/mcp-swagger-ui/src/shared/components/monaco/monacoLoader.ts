import type * as Monaco from "monaco-editor";

type MonacoModule = typeof Monaco;

let monacoInstancePromise: Promise<MonacoModule> | null = null;
let monacoEnvironmentReady = false;

async function setupMonacoEnvironment() {
  if (monacoEnvironmentReady) {
    return;
  }

  const [
    { default: editorWorker },
    { default: jsonWorker },
    { default: cssWorker },
    { default: htmlWorker },
    { default: tsWorker },
  ] = await Promise.all([
    import("monaco-editor/esm/vs/editor/editor.worker?worker"),
    import("monaco-editor/esm/vs/language/json/json.worker?worker"),
    import("monaco-editor/esm/vs/language/css/css.worker?worker"),
    import("monaco-editor/esm/vs/language/html/html.worker?worker"),
    import("monaco-editor/esm/vs/language/typescript/ts.worker?worker"),
  ]);

  const target = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_: string, label: string) => Worker;
    };
  };

  target.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === "json") {
        return new jsonWorker();
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new cssWorker();
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new htmlWorker();
      }
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };

  monacoEnvironmentReady = true;
}

export async function ensureMonacoReady(): Promise<MonacoModule> {
  if (!monacoInstancePromise) {
    monacoInstancePromise = (async () => {
      await setupMonacoEnvironment();
      return import("monaco-editor");
    })();
  }

  return monacoInstancePromise;
}
