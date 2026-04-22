import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react";

type AuthView = "login" | "signup";

const clerkAppearance = {
  elements: {
    rootBox: "uf-clerk-root",
    cardBox: "uf-clerk-card",
    card: "uf-clerk-card",
    headerTitle: "uf-clerk-title",
    headerSubtitle: "uf-clerk-subtitle",
    socialButtons: "uf-clerk-hidden",
    socialButtonsBlock: "uf-clerk-hidden",
    socialButtonsBlockButton: "uf-clerk-hidden",
    dividerRow: "uf-clerk-hidden",
    formButtonPrimary: "uf-clerk-primary",
    footerActionLink: "uf-clerk-link",
  },
};

export default function Login() {
  const [view, setView] = useState<AuthView>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "signup" : "login";
  });
  const [success] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("confirmed") === "true"
      ? "Email confirmed! You can now sign in."
      : "";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("confirmed")) return;

    params.delete("confirmed");
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="uf-page">
        <div className="uf-card">
          <div className="uf-logo">
            <div className="uf-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8 3l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="uf-logo-name">UniFlow</span>
          </div>

          <SignedIn>
            <Navigate to="/" replace />
          </SignedIn>

          <SignedOut>
            <div className="uf-tabs">
              <button className={"uf-tab" + (view === "login" ? " active" : "")} onClick={() => setView("login")}>Sign in</button>
              <button className={"uf-tab" + (view === "signup" ? " active" : "")} onClick={() => setView("signup")}>Sign up</button>
            </div>

            {success && <div className="uf-banner uf-banner--success">{success}</div>}

            {view === "login" ? (
              <SignIn appearance={clerkAppearance} routing="hash" />
            ) : (
              <SignUp appearance={clerkAppearance} routing="hash" />
            )}
          </SignedOut>

          <div className="uf-footer">© 2026 UniFlow · American University of Beirut</div>
        </div>
      </div>
    </>
  );
}

const css = `
  .uf-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f4;
    padding: 40px 20px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .uf-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 36px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  }
  .uf-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .uf-logo-mark {
    width: 32px; height: 32px; border-radius: 8px; background: #2563eb;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .uf-logo-name { font-size: 17px; font-weight: 700; color: #111827; }
  .uf-tabs { display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 18px; }
  .uf-tab {
    flex: 1; padding: 9px 0; background: none; border: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    font-family: inherit; font-size: 13px; font-weight: 600; color: #9ca3af;
    cursor: pointer; transition: color .2s, border-color .2s;
  }
  .uf-tab:hover { color: #6b7280; }
  .uf-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
  .uf-banner { padding: 11px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
  .uf-banner--success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }
  .uf-footer {
    margin-top: 24px; padding-top: 20px; border-top: 1px solid #f3f4f6;
    text-align: center; font-size: 11px; color: #9ca3af;
  }
  .uf-clerk-root { width: 100%; }
  .uf-clerk-card {
    width: 100%;
    max-width: none;
    box-shadow: none;
    border: 0;
    padding: 0;
  }
  .uf-card .cl-cardBox,
  .uf-card .cl-card,
  .uf-card .cl-header,
  .uf-card .cl-main,
  .uf-card .cl-form,
  .uf-card .cl-formFields,
  .uf-card .cl-formField,
  .uf-card .cl-formButtonPrimary,
  .uf-card .cl-footer,
  .uf-card .cl-footerAction {
    margin-top: 0 !important;
  }
  .uf-card .cl-card,
  .uf-card .cl-main,
  .uf-card .cl-form,
  .uf-card .cl-formFields {
    gap: 12px !important;
  }
  .uf-card .cl-header {
    padding: 0 0 10px !important;
  }
  .uf-card .cl-headerTitle {
    margin: 0 0 4px !important;
    line-height: 1.15 !important;
  }
  .uf-card .cl-headerSubtitle {
    margin: 0 !important;
    line-height: 1.35 !important;
  }
  .uf-card .cl-main {
    padding-top: 0 !important;
    transform: translateY(-18px);
  }
  .uf-card .cl-formField {
    padding-top: 0 !important;
  }
  .uf-card .cl-formButtonPrimary {
    margin-top: 2px !important;
  }
  .uf-card .cl-footer {
    transform: translateY(-10px);
  }
  .uf-clerk-title { color: #111827; }
  .uf-clerk-subtitle { color: #6b7280; }
  .uf-clerk-hidden,
  .uf-card :is(.cl-socialButtons, .cl-socialButtonsBlock, .cl-socialButtonsBlockButton, .cl-dividerRow) {
    display: none !important;
  }
  .uf-clerk-primary {
    background: #2563eb;
    border-radius: 8px;
    font-weight: 700;
  }
  .uf-clerk-primary:hover { background: #1d4ed8; }
  .uf-clerk-link { color: #2563eb; font-weight: 700; }
`;
