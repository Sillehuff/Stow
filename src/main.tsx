import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializeFirebaseClient } from "@/lib/firebase/client";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { RootErrorBoundary } from "@/RootErrorBoundary";
import App from "@/App";
import "@/styles.css";

async function renderApp() {
  await initializeFirebaseClient();

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

void renderApp();
