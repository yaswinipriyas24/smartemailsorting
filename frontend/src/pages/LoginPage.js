import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
// Based on your folder structure: src/pages/LoginPage.js needs src/styles/App.css
import "../styles/App.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const formatError = (detail) => {
    if (!detail) {
      return "Invalid credentials";
    }

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item && item.msg)
        .filter(Boolean);
      return messages.length ? messages.join(", ") : "Invalid credentials";
    }

    if (detail.msg) {
      return detail.msg;
    }

    return "Invalid credentials";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Send Login Request as OAuth2 form data to match backend
      // Endpoint: http://localhost:8000/auth/login
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await axios.post(
        "http://localhost:8000/auth/login",
        formData,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
      );

      // 2. Extract Token from JSON response
      const token = response.data.access_token;
      if (!token) {
        throw new Error("No access token received!");
      }

      // 3. Save to Local Storage for PrivateRoute guard in App.js
      localStorage.setItem("token", token);

      // 4. Redirect to Dashboard upon success
      navigate("/dashboard");
      
    } catch (err) {
      console.error("🔴 Login Failed:", err);
      
      if (err.response) {
        // Handle specific server errors (e.g., 401 Unauthorized)
        setError(formatError(err.response.data.detail));
      } else {
        // Handle network errors
        setError("Cannot reach server. Ensure the Backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin} style={{ display: "inline-block", textAlign: "left", width: "300px" }}>
        <div style={{ marginBottom: "10px" }}>
          <label>Email:</label><br/>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <label>Password:</label><br/>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>

        {error && <p style={{ color: "red", fontSize: "14px", marginBottom: "10px" }}>{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", 
            padding: "10px", 
            backgroundColor: loading ? "#cccccc" : "#007bff", 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer" 
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;