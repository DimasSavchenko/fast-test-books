import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./Shared/mobx.config";
import "./styles.css";
import { App } from "./App";

const rootElement = document.getElementById("root") as HTMLElement;
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
