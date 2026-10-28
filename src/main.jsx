import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { MotionPrefsProvider } from "./contexts/MotionPrefs";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <MotionPrefsProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MotionPrefsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);