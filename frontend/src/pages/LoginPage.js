import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/**
 * A combined Auth component that handles both Login and Registration.
 * It uses standard OAuth2 form-data for login and JSON for registration.
 * This component replaces the separate Login and Register pages for a streamlined user experience.
 */
export default function LoginPage() {
  const [view, setView] = useState("login"); // 'login' or 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const resetForm = (newView) => {
    setView(newView);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  /**
   * Helper to format error details from Backend response
   */
  const formatError = (detail, defaultMsg) => {
    if (!detail) return defaultMsg;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => item?.msg).filter(Boolean);
      return messages.length ? messages.join(", ") : defaultMsg;
    }
    return detail.msg || defaultMsg;
  };

  /**
   * Handle Login (OAuth2 Password Flow Requirement)
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Backend expects application/x-www-form-urlencoded for OAuth2
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await axios.post(
        "http://localhost:8000/auth/login",
        formData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const token = response.data.access_token;
      if (!token) {
        throw new Error("No access token received!");
      }

      localStorage.setItem("token", token);
      setSuccess("Login successful! Redirecting...");

      // Use navigate for redirection after a short delay
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (err) {
      const errorMsg = err.response
        ? formatError(err.response.data.detail, "Invalid credentials")
        : "Cannot reach server. Ensure the Backend is running.";
      setError(errorMsg);
      console.error("🔴 Login Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Registration
   */
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
      await axios.post("http://localhost:8000/auth/register", {
        email,
        username: email,
        password,
        confirm_password: confirmPassword,
      });

      setSuccess("Registration successful! Please login.");
      setTimeout(() => resetForm("login"), 2000);
    } catch (err) {
      const errorMsg = err.response
        ? formatError(err.response.data.detail, "Registration failed")
        : "Cannot reach server. Ensure the Backend is running.";
      setError(errorMsg);
      console.error("🔴 Registration Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // The styling uses Tailwind CSS classes. Ensure your project is configured for it.
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {view === "login" ? "Sign in to your account" : "Create your account"}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={view === "login" ? handleLogin : handleRegister}>
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Confirm Password (Registration Only) */}
            {view === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Status Messages */}
            {error && <div className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</div>}
            {success && <div className="text-sm text-green-600 bg-green-100 p-3 rounded-md">{success}</div>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-all 
                ${loading 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : view === "login" 
                    ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" 
                    : "bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                }`}
            >
              {loading ? "Processing..." : view === "login" ? "Login" : "Register"}
            </button>
          </form>

          {/* View Toggle */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {view === "login" ? "New here?" : "Already have an account?"}
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => resetForm(view === "login" ? "register" : "login")}
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                {view === "login" ? "Create an account" : "Sign in instead"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}