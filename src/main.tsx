import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("🚀 main.tsx loaded");
console.log("📦 Importing App component...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("❌ Root element not found!");
    throw new Error("Root element #root not found in DOM");
  }
  console.log("✅ Root element found:", rootElement);

  console.log("🎨 Creating React root...");
  const root = createRoot(rootElement);
  console.log("✅ React root created");

  console.log("🖼️ Rendering <App /> component...");
  root.render(<App />);
  console.log("✅ React app mounted successfully");

} catch (err) {
  console.error("❌ Failed to mount React app:", err);
  // Mostrar error en pantalla para debug
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
    <h2>ERROR MOUNTING REACT APP</h2>
    <pre>${err.message}</pre>
    <pre>${err.stack}</pre>
  </div>`;
}