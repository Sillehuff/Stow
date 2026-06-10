import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializeFirebaseClient } from "@/lib/firebase/client";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { RootErrorBoundary } from "@/RootErrorBoundary";
import App from "@/App";
import "@/styles.css";

async function renderApp() {
  try {
    await initializeFirebaseClient();
  } catch (error) {
    console.error("Firebase initialization failed; rendering anyway", error);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

renderApp().catch((error) => {
  console.error("Failed to start Stow", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font-family:system-ui;padding:32px;text-align:center">' +
      "<h1>Stow couldn’t start</h1>" +
      "<p>Please reload. If you’re in a private window, try a regular one.</p>" +
      '<button onclick="location.reload()" style="padding:8px 20px">Reload</button></div>';
  }
});
