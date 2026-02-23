// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.ts";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 🔒 Allow only AUB domains
    const isAubEmail =
      normalizedEmail.endsWith("@aub.edu.lb") ||
      normalizedEmail.endsWith("@mail.aub.edu");

    if (!isAubEmail) {
      setError("Only AUB students can sign in.");
      return;
    }

    setLoading(true);

    // 1️⃣ Try login
    let { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    let user = data?.user;

    // 2️⃣ If login fails → try signup
    if (loginError) {
      const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

      if (signupError) {
        setError(signupError.message);
        setLoading(false);
        return;
      }

      user = signupData?.user;
    }

    if (!user) {
      setError("Authentication failed.");
      setLoading(false);
      return;
    }

    // 3️⃣ Insert into users table if not exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingUser) {
      await supabase.from("users").insert({
        id: user.id,
        email: user.email,
      });
    }

    setLoading(false);
    navigate("/");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1E1E1E",
        padding: "40px 20px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#2C2C2C",
          borderRadius: "14px",
          padding: "45px 40px",
          boxShadow: "0 15px 35px rgba(0,0,0,0.5)",
          border: "1px solid #3A3A3A",
          color: "#FFFFFF",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "35px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              color: "#CCCCCC",
              fontWeight: "700",
            }}
          >
            Student Portal
          </h1>
          <p style={{ marginTop: "10px", fontSize: "14px", color: "#AAAAAA" }}>
            Sign in to manage courses and calculate your GPA
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", color: "#BBBBBB" }}>
              University Email
            </label>
            <input
              type="email"
              placeholder="name@aub.edu.lb"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #555",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "#1E1E1E",
                color: "#FFFFFF",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", color: "#BBBBBB" }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #555",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "#1E1E1E",
                color: "#FFFFFF",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#444",
                color: "#fff",
                padding: "10px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "13px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#555555",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Processing..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: "30px",
            textAlign: "center",
            fontSize: "12px",
            color: "#888",
          }}
        >
          © 2026 AUB GPA System
        </div>
      </div>
    </div>
  );
}