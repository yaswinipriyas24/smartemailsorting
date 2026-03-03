import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

export default function LoginPage() {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const resetForm = (newView) => {
    setView(newView);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setSuccess("");
  };

  const formatError = (detail, defaultMsg) => {
    if (!detail) return defaultMsg;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => item?.msg).filter(Boolean);
      return messages.length ? messages.join(", ") : defaultMsg;
    }
    return detail.msg || defaultMsg;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const formData = new URLSearchParams();
      formData.append("username", normalizedEmail);
      formData.append("password", password);

      const response = await axios.post(
        "http://localhost:8000/auth/login",
        formData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const token = response.data.access_token;
      if (!token) throw new Error("No access token received");

      localStorage.setItem("token", token);
      setSuccess("Login successful! Redirecting...");

      // Enforce architecture: connect Gmail before allowing dashboard access
      const meRes = await axios.get("http://localhost:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const gmailConnected = !!meRes?.data?.gmail_connected;

      setTimeout(() => navigate(gmailConnected ? "/dashboard" : "/connect-gmail"), 800);
    } catch (err) {
      let errorMsg = err.response
        ? formatError(err.response.data.detail, "Invalid credentials")
        : "Cannot reach server. Ensure the Backend is running.";
      if (String(errorMsg).toLowerCase().includes("invalid credentials")) {
        errorMsg = "Invalid credentials. Check your email/password, or register if this is a new account.";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await axios.post("http://localhost:8000/auth/register", {
        email: normalizedEmail,
        username: normalizedEmail,
        password,
        confirm_password: confirmPassword
      });

      setSuccess("Registration successful! Please login.");
      setTimeout(() => resetForm("login"), 1400);
    } catch (err) {
      let errorMsg = err.response
        ? formatError(err.response.data.detail, "Registration failed")
        : "Cannot reach server. Ensure the Backend is running.";
      if (String(errorMsg).toLowerCase().includes("already registered")) {
        errorMsg = "This email is already registered. Please sign in from Login.";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await axios.post("http://localhost:8000/auth/forgot-password", {
        email: normalizedEmail,
        new_password: password,
        confirm_password: confirmPassword
      });

      setSuccess(response.data?.message || "Password reset successful. Please login.");
      setTimeout(() => resetForm("login"), 1300);
    } catch (err) {
      const errorMsg = err.response
        ? formatError(err.response.data.detail, "Password reset failed")
        : "Cannot reach server. Ensure the Backend is running.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <div className="auth-card">
        <h1 className="auth-brand">Smart Email Sorting</h1>
        <h2 className="auth-title">
          {view === "login"
            ? "Sign in to your account"
            : view === "register"
              ? "Create your account"
              : "Reset your password"}
        </h2>

        <form
          className="auth-form"
          onSubmit={
            view === "login"
              ? handleLogin
              : view === "register"
                ? handleRegister
                : handleForgotPassword
          }
        >
          <label className="auth-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />

          <label className="auth-label" htmlFor="auth-pass">
            {view === "forgot" ? "New Password" : "Password"}
          </label>
          <div className="auth-input-wrap">
            <input
              id="auth-pass"
              className="auth-input"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={view === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
            <button
              type="button"
              className="auth-toggle-pass"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {(view === "register" || view === "forgot") && (
            <>
              <label className="auth-label" htmlFor="auth-confirm">Confirm Password</label>
              <div className="auth-input-wrap">
                <input
                  id="auth-confirm"
                  className="auth-input"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  className="auth-toggle-pass"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </>
          )}

          {error && <div className="auth-msg auth-msg-error">{error}</div>}
          {success && <div className="auth-msg auth-msg-success">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className={`auth-submit ${view === "register" ? "register" : "login"} ${loading ? "disabled" : ""}`}
          >
            {loading
              ? "Processing..."
              : view === "login"
                ? "Login"
                : view === "register"
                  ? "Register"
                  : "Reset Password"}
          </button>
        </form>

        {view === "login" && (
          <div className="auth-forgot-wrap">
            <button
              className="auth-forgot-btn"
              onClick={() => resetForm("forgot")}
            >
              Forgot Password?
            </button>
          </div>
        )}

        <div className="auth-switch">
          <span>
            {view === "login"
              ? "New here?"
              : view === "register"
                ? "Already have an account?"
                : "Remember your password?"}
          </span>
          <button
            className="auth-switch-btn"
            onClick={() =>
              resetForm(
                view === "login"
                  ? "register"
                  : "login"
              )
            }
          >
            {view === "login" ? "Create an account" : "Sign in instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
