/** Load Canny SDK once (https://developers.canny.io/install/widget/web) */

type CannyFn = ((command: "render", options: CannyRenderOptions) => void) & {
  q?: unknown[];
};

export type CannyRenderOptions = {
  boardToken: string;
  basePath?: string | null;
  ssoToken?: string | null;
  theme?: "light" | "dark" | "auto";
};

declare global {
  interface Window {
    Canny?: CannyFn;
  }
}

const SDK_ID = "canny-jssdk";
const SDK_SRC = "https://sdk.canny.io/sdk.js";

let sdkPromise: Promise<void> | null = null;

export function loadCannySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Canny && typeof window.Canny === "function") return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SDK_ID)) {
      const wait = () => {
        if (window.Canny) resolve();
        else setTimeout(wait, 50);
      };
      wait();
      return;
    }

    if (!window.Canny) {
      const stub: CannyFn = ((...args: unknown[]) => {
        stub.q = stub.q || [];
        stub.q.push(args);
      }) as CannyFn;
      stub.q = [];
      window.Canny = stub;
    }

    const script = document.createElement("script");
    script.id = SDK_ID;
    script.async = true;
    script.src = SDK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Canny SDK."));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export function renderCannyBoard(options: CannyRenderOptions) {
  if (!window.Canny) throw new Error("Canny SDK not loaded.");
  window.Canny("render", options);
}
