import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/styles/global.css";
import "@/styles/animations.css";

const root = createRoot(document.getElementById("root")!);
const app = <App />;

// Exercise effect cleanup/remount behavior during local development while keeping
// the production request path single-pass.
root.render(import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app);
