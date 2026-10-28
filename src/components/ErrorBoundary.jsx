import { Component } from "react";
import { TriangleAlert, RefreshCw } from "lucide-react";

const RELOAD_FLAG = "sinco:chunk-reload";

/** Falha típica depois de um deploy: a aba antiga pede um chunk que não existe mais. */
function isChunkError(error) {
  const msg = String(error?.message || error || "");
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(msg);
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // ponto único para plugar monitoramento (Sentry etc.) depois
    console.error("[ErrorBoundary]", error, info?.componentStack);

    if (isChunkError(error)) {
      // recarrega uma vez; se repetir, mostra a tela de erro
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          return;
        }
      } catch {
        /* sem sessionStorage: segue para a tela de erro */
      }
    }
  }

  componentDidUpdate() {
    if (!this.state.error) {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignora */
      }
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkError(error);
    return (
      <div className="error-screen" role="alert">
        <div className="error-card">
          <span className="error-icon"><TriangleAlert size={28} /></span>
          <h1>{chunk ? "Nova versão disponível" : "Algo deu errado"}</h1>
          <p>
            {chunk
              ? "O painel foi atualizado enquanto esta aba estava aberta. Recarregue para continuar."
              : "Ocorreu um erro inesperado nesta tela. Seus dados já salvos não foram perdidos."}
          </p>
          <div className="error-actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Recarregar
            </button>
            {!chunk && (
              <button type="button" className="btn btn--ghost" onClick={this.reset}>
                Tentar de novo
              </button>
            )}
          </div>
          {import.meta.env.DEV && <pre className="error-detail">{String(error?.stack || error)}</pre>}
        </div>
      </div>
    );
  }
}
