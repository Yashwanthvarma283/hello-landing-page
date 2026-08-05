import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerOfflineSupport } from "./lib/register-sw";

console.log("Vite main.tsx is executing!");

createRoot(document.getElementById("root")!).render(<App />);

// Offline app-shell caching (production only, never in Lovable preview/dev).
registerOfflineSupport();
