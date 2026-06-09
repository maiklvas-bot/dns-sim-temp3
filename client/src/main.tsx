import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/themes.css";
import "./styles/shared-controls.css";
import "./styles/admin.css";
import "./styles/assessor.css";
import "./styles/simulation.css";
import "./styles/responsive.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
