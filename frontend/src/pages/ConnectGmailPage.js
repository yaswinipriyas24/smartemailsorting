import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { apiUrl } from "../utils/api";
import { clearSession, getAuthToken } from "../utils/authSession";

function ConnectGmailPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = getAuthToken();
      if (!token) {
        clearSession();
        navigate("/login");
        return;
      }
      
      // Get OAuth URL from backend
      const response = await axios.get(
        apiUrl("/gmail/connect"),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("🔗 OAuth URL:", response.data.auth_url);
      
      // Redirect to Google OAuth consent screen
      window.location.href = response.data.auth_url;
      
    } catch (err) {
      console.error("❌ Failed to get OAuth URL:", err);
      const errorMsg = err.response?.data?.detail || "Failed to initiate Gmail connection.";
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Connect Your Gmail</h2>
      <p>Click below to authorize Smart Email Sorting to access your Gmail inbox.</p>

      <form onSubmit={handleConnect} style={{ maxWidth: "400px", margin: "0 auto" }}>
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
          {loading ? "Connecting..." : "Connect Gmail with OAuth"}
        </button>
      </form>

      <button 
        onClick={() => navigate("/dashboard")}
        style={{ 
            marginTop: "20px", 
            background: "none", 
            border: "none", 
            color: "#666", 
            textDecoration: "underline", 
            cursor: "pointer" 
        }}
      >
        Cancel & Go Back
      </button>
    </div>
  );
}

export default ConnectGmailPage;
