import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import EmailTable from "../components/EmailTable";
import "../styles/dashboard.css";
import {
  FaEnvelope,
  FaExclamationTriangle,
  FaSync,
  FaLink
} from "react-icons/fa";

function Dashboard() {
  // State Initialization
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]); // Safety: Initialized as empty array
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // -------------------------------------------------
  // Fetch Dashboard Data
  // -------------------------------------------------
  const fetchDashboard = useCallback(async () => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    try {
      setLoading(true);
      setError(null);

      // 1. Check Gmail Connection Status
      try {
        const userRes = await axios.get("http://localhost:8000/auth/me", { headers });
        setGmailConnected(!!userRes.data.gmail_email);
      } catch (e) {
        setGmailConnected(false);
      }

      // 2. Fetch Administrative Stats
      try {
        const statsRes = await axios.get("http://localhost:8000/stats", { headers });
        setStats(statsRes.data);
      } catch (e) {
        console.warn("Stats fetch failed", e);
      }

      // 3. Fetch Upcoming Deadlines
      try {
        const upcomingRes = await axios.get("http://localhost:8000/emails/upcoming", { headers });
        const rawData = upcomingRes.data.data || [];
        const sorted = rawData.sort(
          (a, b) => (a.days_remaining ?? 9999) - (b.days_remaining ?? 9999)
        );
        setUpcoming(sorted);
      } catch (e) {
        setUpcoming([]); // Fallback to avoid crashes
      }

    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // -------------------------------------------------
  // Sync Pipeline Trigger
  // -------------------------------------------------
  const handleSync = async () => {
    if (!token) return;
    try {
      setSyncing(true);
      setError(null);
      const response = await axios.post(
        "http://localhost:8000/sync-emails?limit=20",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("✅ Sync response:", response.data);
      await fetchDashboard(); // Refresh data after sync
      setError(null); // Clear error on success
    } catch (err) {
      console.error("❌ Sync failed:", err.response?.data || err.message);
      let errorMsg = err.response?.data?.detail || "Failed to sync emails. Check Gmail connection.";

      // Detect invalid_grant (expired/revoked token)
      const errorString = typeof errorMsg === "object" ? JSON.stringify(errorMsg) : String(errorMsg);
      if (errorString.includes("invalid_grant") || errorString.includes("Token has been expired")) {
        setGmailConnected(false); // Reset state to allow reconnection
        errorMsg = "Gmail connection expired. Please reconnect.";
      }

      setError(errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------
  // Authentication Guard & Initial Load
  // -------------------------------------------------
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchDashboard();
  }, [token, fetchDashboard, navigate]);

  // -------------------------------------------------
  // Deadline Logic (Safety Protected)
  // -------------------------------------------------
  const safeUpcoming = Array.isArray(upcoming) ? upcoming : [];

  const overdueCount = safeUpcoming.filter(
    (e) => e.days_remaining != null && e.days_remaining < 0
  ).length;

  const nearCount = safeUpcoming.filter(
    (e) =>
      e.days_remaining != null &&
      e.days_remaining >= 0 &&
      e.days_remaining <= 2
  ).length;

  if (loading) {
    return (
      <div className="dashboard" style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1 className="title">📧 Smart Email Sorting Dashboard</h1>

      {error && <p className="error" style={{ color: "red" }}>{error}</p>}

      {/* Gmail Status & Controls */}
      <div className="gmail-status" style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        {gmailConnected ? (
          <>
            <span className="connected" style={{ color: 'green', fontWeight: 'bold' }}>
              🟢 Gmail Connected
            </span>
            <button className="sync-btn" onClick={handleSync} disabled={syncing}>
              <FaSync /> {syncing ? " Syncing..." : " Sync Emails"}
            </button>
          </>
        ) : (
          <>
            <span className="not-connected" style={{ color: 'red', fontWeight: 'bold' }}>
              🔴 Gmail Not Connected
            </span>
            <button 
                onClick={() => navigate("/connect-gmail")}
                style={{
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    padding: "8px 15px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                }}
            >
                <FaLink /> Connect Gmail
            </button>
          </>
        )}
      </div>

      {/* Deadline Alert Banner */}
      {safeUpcoming.length > 0 && (overdueCount > 0 || nearCount > 0) && (
        <div className="insight-banner" style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "5px", marginBottom: "20px" }}>
          {overdueCount > 0 && (
            <span style={{ color: "#856404", marginRight: "15px" }}>
              🔴 <strong>{overdueCount}</strong> overdue email(s).
            </span> 
          )}
          {nearCount > 0 && (
            <span style={{ color: "#856404" }}>
              🟠 <strong>{nearCount}</strong> due within 48 hours.
            </span>
          )}
        </div>
      )}

      {/* Stats Cards Overview */}
      {stats && (
        <div className="card-container">
          <div className="card">
            <FaEnvelope className="icon blue" />
            <div>
              <h3>Total Emails</h3>
              <p>{stats.total_emails}</p>
            </div>
          </div>
          <div className="card">
            <FaExclamationTriangle className="icon red" />
            <div>
              <h3>Urgent Emails</h3>
              <p>{stats.urgent_emails}</p>
            </div>
          </div>
        </div>
      )}

      {/* Email List Table */}
      <EmailTable />
    </div>
  );
}

export default Dashboard;