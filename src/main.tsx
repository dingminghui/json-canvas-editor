import { App } from "@/App";
import "@/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const container = document.querySelector("#root");

if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
