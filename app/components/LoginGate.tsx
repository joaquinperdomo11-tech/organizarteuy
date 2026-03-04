"use client";
import { useState, useEffect } from "react";

const SESSION_KEY = "ml_dashboard_auth";
const PASSWORD    = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || "admin";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed]   = useState(false);
  const [input, setInput]     = useState("");
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [show, setShow]       = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved === "1") setAuthed(true);
    setLoading(false);
  }, []);

  const handleSubmit = () => {
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
    </div>
  );

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/20 mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="font-display font-bold text-brand-text text-2xl">ML Dashboard</h1>
          <p className="text-brand-sub text-sm mt-1 font-mono">Ingresá tu contraseña para continuar</p>
        </div>

        {/* Form */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-2 block">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={input}
                onChange={e => { setInput(e.target.value); setError(false); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                autoFocus
                className={`w-full bg-brand-dark border rounded-xl px-4 py-3 text-brand-text font-mono text-sm focus:outline-none transition-colors pr-10 ${
                  error ? "border-red-500/50 focus:border-red-500" : "border-brand-border focus:border-brand-yellow/50"
                }`}
              />
              <button
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-sub transition-colors text-xs"
              >
                {show ? "ocultar" : "ver"}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-xs font-mono mt-2">⚠ Contraseña incorrecta</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-brand-yellow text-brand-dark font-display font-bold py-3 rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-95"
          >
            Ingresar
          </button>
        </div>

        <p className="text-center text-brand-muted text-xs font-mono mt-6">
          La sesión se mantiene mientras el navegador esté abierto
        </p>
      </div>
    </div>
  );
}
