import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializeFirebaseClient } from "@/lib/firebase/client";
import { AuthProvider } from "@/features/auth/AuthProvider";
import App from "@/App";
import "@/styles.css";

void initializeFirebaseClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
