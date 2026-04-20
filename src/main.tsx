import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializeFirebaseClient } from "@/lib/firebase/client";
import { AuthProvider } from "@/features/auth/AuthProvider";
import App from "@/App";
import "@/styles.css";

function renderInitFailure(error: unknown) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <p>Stow couldn’t finish startup.</p>
          <p className="muted">
            Refresh and try again. If this keeps happening in local QA, restart the Firebase emulators and confirm the web app is using the local emulator settings.
          </p>
          {import.meta.env.DEV && error instanceof Error ? (
            <pre className="banner error" style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
          ) : null}
        </div>
      </div>
    </React.StrictMode>
  );
}

async function boot() {
  try {
    await initializeFirebaseClient();
  } catch (error) {
    renderInitFailure(error);
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

void boot();
