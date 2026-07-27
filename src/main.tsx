import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/styles/global.css";
import "@/styles/animations.css";

const root = createRoot(document.getElementById("root")!);
const app = <App />;

// StrictMode double-mounts effects in production too; that raced pioneers landing
// fetches and could overwrite a good ranking snapshot with an empty ok:true response.
root.render(import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app);
