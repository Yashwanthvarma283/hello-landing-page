import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("Vite main.tsx is executing!");

createRoot(document.getElementById("root")!).render(<App />);

// Remove any previously registered app service worker so cached HTML can never
// pin users to an old build. Update prompts are handled by <UpdatePrompt />.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {});
}
