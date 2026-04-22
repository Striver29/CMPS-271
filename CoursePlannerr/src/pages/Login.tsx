import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useClerk, useSignIn, useSignUp, useUser } from "@clerk/clerk-react";
import { allowedUniFlowEmailText, isAllowedUniFlowEmail } from "../utils/authDomains";

type AuthView = "login" | "signup";

function getAuthErrorMessage(error: unknown) {
  const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  return clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || clerkError.message || "Something went wrong. Please try again.";
}

function CustomSignIn({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedUniFlowEmail(normalizedEmail)) {
      setError(`Use an email ending in ${allowedUniFlowEmailText}.`);
      return;
    }

    if (!isLoaded) return;
    setSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
        strategy: "password",
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      } else {
        setError("Sign in needs one more step. Please check your Clerk authentication settings.");
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="uf-auth-form" onSubmit={handleSubmit}>
      <div className="uf-auth-heading">
        <h1>Sign in to UniFlow</h1>
        <p>Use your approved AUB email.</p>
      </div>
      {error && <div className="uf-banner uf-banner--error">{error}</div>}
      <label className="uf-field">
        <span>Email address</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@mail.aub.edu" autoComplete="email" required />
      </label>
      <label className="uf-field">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
      </label>
      <button className="uf-submit" type="submit" disabled={submitting || !isLoaded}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
      <div className="uf-auth-switch">
        Don&apos;t have an account? <button type="button" onClick={onSwitchToSignUp}>Sign up</button>
      </div>
    </form>
  );
}

function CustomSignUp({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedUniFlowEmail(normalizedEmail)) {
      setError(`UniFlow only accepts ${allowedUniFlowEmailText} emails.`);
      return;
    }

    if (!isLoaded) return;
    setSubmitting(true);
    try {
      const result = await signUp.create({
        emailAddress: normalizedEmail,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!isLoaded) return;

    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      } else {
        setError("Verification worked, but Clerk still needs another signup requirement completed.");
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <form className="uf-auth-form" onSubmit={handleVerify}>
        <div className="uf-auth-heading">
          <h1>Verify your email</h1>
          <p>Enter the code sent to {email.trim().toLowerCase()}.</p>
        </div>
        {error && <div className="uf-banner uf-banner--error">{error}</div>}
        <label className="uf-field">
          <span>Verification code</span>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button className="uf-submit" type="submit" disabled={submitting || !isLoaded}>
          {submitting ? "Verifying..." : "Verify email"}
        </button>
      </form>
    );
  }

  return (
    <form className="uf-auth-form" onSubmit={handleCreateAccount}>
      <div className="uf-auth-heading">
        <h1>Create your UniFlow account</h1>
        <p>Only AUB emails can sign up.</p>
      </div>
      <div className="uf-banner uf-banner--info">Use {allowedUniFlowEmailText}.</div>
      {error && <div className="uf-banner uf-banner--error">{error}</div>}
      <label className="uf-field">
        <span>Email address</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@mail.aub.edu" autoComplete="email" required />
      </label>
      <label className="uf-field">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="uf-submit" type="submit" disabled={submitting || !isLoaded}>
        {submitting ? "Creating account..." : "Create account"}
      </button>
      <div className="uf-auth-switch">
        Already have an account? <button type="button" onClick={onSwitchToSignIn}>Sign in</button>
      </div>
    </form>
  );
}

export default function Login() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [view, setView] = useState<AuthView>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "signup" : "login";
  });
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;
  const isAllowedEmail = isAllowedUniFlowEmail(email);
  const unauthorized = new URLSearchParams(window.location.search).get("unauthorized") === "domain";
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
            {isAllowedEmail ? (
              <Navigate to="/" replace />
            ) : (
              <div className="uf-domain-block">
                <div className="uf-domain-title">University email required</div>
                <p>
                  UniFlow only allows accounts ending in {allowedUniFlowEmailText}. Please sign out
                  and use your AUB email.
                </p>
                <button className="uf-domain-button" onClick={() => signOut({ redirectUrl: "/login" })}>
                  Sign out
                </button>
              </div>
            )}
          </SignedIn>

          <SignedOut>
            <div className="uf-tabs">
              <button className={"uf-tab" + (view === "login" ? " active" : "")} onClick={() => setView("login")}>Sign in</button>
              <button className={"uf-tab" + (view === "signup" ? " active" : "")} onClick={() => setView("signup")}>Sign up</button>
            </div>

            {success && <div className="uf-banner uf-banner--success">{success}</div>}
            {unauthorized && (
              <div className="uf-banner uf-banner--error">
                Use an email ending in {allowedUniFlowEmailText}.
              </div>
            )}

            {view === "login" ? (
              <CustomSignIn onSwitchToSignUp={() => setView("signup")} />
            ) : (
              <CustomSignUp onSwitchToSignIn={() => setView("login")} />
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
  .uf-banner--error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
  .uf-banner--info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
  .uf-domain-block {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 8px;
    padding: 16px;
    line-height: 1.5;
  }
  .uf-domain-title { font-weight: 800; margin-bottom: 6px; color: #7f1d1d; }
  .uf-domain-block p { margin: 0 0 14px; font-size: 13px; }
  .uf-domain-button {
    border: 0;
    border-radius: 8px;
    background: #991b1b;
    color: #fff;
    padding: 9px 16px;
    font-weight: 800;
    cursor: pointer;
  }
  .uf-auth-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .uf-auth-heading {
    text-align: center;
    margin: 10px 0 8px;
  }
  .uf-auth-heading h1 {
    margin: 0;
    color: #111827;
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: 0;
  }
  .uf-auth-heading p {
    margin: 8px 0 0;
    color: #6b7280;
    font-size: 14px;
    line-height: 1.4;
  }
  .uf-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .uf-field span {
    color: #1f2937;
    font-size: 13px;
    font-weight: 800;
  }
  .uf-field input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    color: #111827;
    background: #fff;
    padding: 11px 12px;
    font: inherit;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .uf-field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }
  .uf-submit {
    border: 0;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    padding: 11px 16px;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
    transition: background .15s, transform .15s;
  }
  .uf-submit:hover:not(:disabled) {
    background: #1d4ed8;
    transform: translateY(-1px);
  }
  .uf-submit:disabled {
    opacity: .65;
    cursor: not-allowed;
  }
  .uf-auth-switch {
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
  .uf-auth-switch button {
    border: 0;
    background: none;
    color: #2563eb;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
    padding: 0;
  }
  .uf-footer {
    margin-top: 24px; padding-top: 20px; border-top: 1px solid #f3f4f6;
    text-align: center; font-size: 11px; color: #9ca3af;
  }
`;
