import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { MotionPrefsProvider } from "./contexts/MotionPrefs";
import ErrorBoundary from "./components/ErrorBoundary";
// fonte servida pelo próprio app (sem enviar o IP dos usuários a terceiros)
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
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