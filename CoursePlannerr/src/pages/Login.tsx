// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.ts";

const AUB_DOMAINS = ["@aub.edu.lb", "@mail.aub.edu"];
const isAubEmail = (address) => AUB_DOMAINS.some((d) => address.endsWith(d));

export default function Login() {
  const navigate = useNavigate();
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "true") {
      setSuccess("Email confirmed! You can now sign in.");
    }
  }, []);

  const resetBanners = () => { setError(""); setInfo(""); setSuccess(""); };
  const switchView = (v) => {
    resetBanners();
    setEmail(""); setPassword(""); setConfirmPassword("");
    setView(v);
  };

  const handleLogin = async (e) => {
    e.preventDefault(); resetBanners();
    if (!email || !password) { setError("Please fill in both fields."); return; }
    const norm = email.trim().toLowerCase();
    if (!isAubEmail(norm)) { setError("Only AUB email addresses are allowed."); return; }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: norm, password });
    setLoading(false);
    if (err) {
      if (err.message?.toLowerCase().includes("email not confirmed"))
        setInfo("Please verify your email first. Check your inbox, then come back to sign in.");
      else setError(err.message || "Sign-in failed. Check your credentials.");
      return;
    }
    if (!data?.user) { setError("Authentication failed."); return; }
    const { data: existing } = await supabase.from("users").select("id").eq("id", data.user.id).maybeSingle();
    if (!existing) await supabase.from("users").insert({ id: data.user.id, email: data.user.email });
    navigate("/");
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); resetBanners();
    if (!email || !password || !confirmPassword) { setError("Please fill in all fields."); return; }
    const norm = email.trim().toLowerCase();
    if (!isAubEmail(norm)) { setError("Only AUB email addresses are allowed."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", norm).maybeSingle();
    if (existingUser) {
      setLoading(false);
      setError("An account with this email already exists. Please sign in instead.");
      return;
    }
    const { error: err } = await supabase.auth.signUp({ email: norm, password });
    setLoading(false);
    if (err) { setError(err.message || "Sign-up failed."); return; }
    setSuccess(`Verification email sent to ${norm}. Click the link in your inbox, then come back to sign in.`);
  };

  const handleReset = async (e) => {
    e.preventDefault(); resetBanners();
    if (!email) { setError("Please enter your email."); return; }
    const norm = email.trim().toLowerCase();
    if (!isAubEmail(norm)) { setError("Only AUB email addresses are allowed."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(norm, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setLoading(false);
    if (err) { setError(err.message || "Could not send reset email."); return; }
    setSuccess(`Reset link sent to ${norm}. Check your inbox.`);
  };

  return (
    <>
      <style>{css}</style>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <div className="uf-page">
        <div className="uf-card">

          <div className="uf-logo">
            <div className="uf-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8 3l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="uf-logo-name">Uniflow</span>
          </div>

          {view !== "reset" && (
            <div className="uf-tabs">
              <button className={"uf-tab" + (view === "login" ? " active" : "")} onClick={() => switchView("login")}>Sign in</button>
              <button className={"uf-tab" + (view === "signup" ? " active" : "")} onClick={() => switchView("signup")}>Sign up</button>
            </div>
          )}

          {error   && <div className="uf-banner uf-banner--error">{error}</div>}
          {info    && <div className="uf-banner uf-banner--info">{info}</div>}
          {success && <div className="uf-banner uf-banner--success">{success}</div>}

          {view === "login" && (
            <form onSubmit={handleLogin} className="uf-form">
              <Field label="University email" type="email" placeholder="name@aub.edu.lb" value={email} onChange={setEmail} />
              <Field label="Password" type="password" placeholder="Enter password" value={password} onChange={setPassword} />
              <button type="submit" disabled={loading} className="uf-btn">{loading ? "Signing in…" : "Sign in"}</button>
              <button type="button" className="uf-ghost" onClick={() => switchView("reset")}>Forgot password?</button>
            </form>
          )}

          {view === "signup" && (
            <form onSubmit={handleSignUp} className="uf-form">
              <Field label="University email" type="email" placeholder="name@aub.edu.lb" value={email} onChange={setEmail} />
              <Field label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={setPassword} />
              <Field label="Confirm password" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={setConfirmPassword} />
              <button type="submit" disabled={loading} className="uf-btn">{loading ? "Creating account…" : "Create account"}</button>
            </form>
          )}

          {view === "reset" && (
            <form onSubmit={handleReset} className="uf-form">
              <p className="uf-reset-hint">Enter your AUB email and we'll send you a reset link.</p>
              <Field label="University email" type="email" placeholder="name@aub.edu.lb" value={email} onChange={setEmail} />
              <button type="submit" disabled={loading} className="uf-btn">{loading ? "Sending…" : "Send reset link"}</button>
              <button type="button" className="uf-ghost" onClick={() => switchView("login")}>Back to sign in</button>
            </form>
          )}

          <div className="uf-footer">© 2026 Uniflow · American University of Beirut</div>
        </div>
      </div>
    </>
  );
}

function Field({ label, type, placeholder, value, onChange }) {
  return (
    <div className="uf-field">
      <label className="uf-label">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="uf-input"
      />
    </div>
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
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .uf-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 40px 36px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  }
  .uf-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .uf-logo-mark {
    width: 32px; height: 32px; border-radius: 8px; background: #2563eb;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .uf-logo-name { font-size: 17px; font-weight: 600; color: #111827; }
  .uf-tabs { display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 28px; }
  .uf-tab {
    flex: 1; padding: 9px 0; background: none; border: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 500; color: #9ca3af;
    cursor: pointer; transition: all .2s;
  }
  .uf-tab:hover { color: #6b7280; }
  .uf-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
  .uf-form { display: flex; flex-direction: column; gap: 16px; }
  .uf-field { display: flex; flex-direction: column; gap: 6px; }
  .uf-label { font-size: 12px; font-weight: 500; color: #6b7280; }
  .uf-input {
    padding: 10px 13px; background: #f9fafb;
    border: 1px solid #e5e7eb; border-radius: 8px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; color: #111827; outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .uf-input::placeholder { color: #d1d5db; }
  .uf-input:hover { border-color: #d1d5db; }
  .uf-input:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .uf-btn {
    width: 100%; padding: 11px; background: #2563eb; border: none; border-radius: 8px;
    color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; font-weight: 600; cursor: pointer;
    transition: background .15s, transform .15s; margin-top: 2px;
  }
  .uf-btn:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
  .uf-btn:active:not(:disabled) { transform: translateY(0); }
  .uf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .uf-ghost {
    background: none; border: none; width: 100%; text-align: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: #9ca3af;
    cursor: pointer; transition: color .15s; margin-top: -4px;
  }
  .uf-ghost:hover { color: #2563eb; }
  .uf-reset-hint { font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 4px; }
  .uf-banner { padding: 11px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; margin-bottom: 4px; }
  .uf-banner--error   { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .uf-banner--info    { background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; }
  .uf-banner--success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }
  .uf-footer {
    margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6;
    text-align: center; font-size: 11px; color: #d1d5db;
  }
`;