import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import EmailTable from "../components/EmailTable";
import "../styles/dashboard.css";
import { FaEnvelope, FaExclamationTriangle, FaSync, FaLink } from "react-icons/fa";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const startGoogleOAuth = useCallback(async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await axios.get("http://localhost:8000/gmail/connect", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const authUrl = response?.data?.auth_url;
      if (!authUrl) {
        throw new Error("OAuth URL not returned");
      }
      window.location.href = authUrl;
    } catch (oauthErr) {
      console.error("Gmail OAuth start failed:", oauthErr);
      setError("Unable to start Google OAuth. Check backend credentials.json and try again.");
    }
  }, [token, navigate]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      try {
        const userRes = await axios.get("http://localhost:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const connected = userRes?.data?.gmail_connected ?? !!userRes?.data?.gmail_email;
        setGmailConnected(connected);
      } catch {
        setGmailConnected(false);
      }

      try {
        const statsRes = await axios.get("http://localhost:8000/stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(statsRes.data);
      } catch (e) {
        console.warn("Stats fetch failed", e);
      }

      try {
        const upcomingRes = await axios.get("http://localhost:8000/emails/upcoming", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rawData = upcomingRes.data.data || [];
        const sorted = rawData.sort(
          (a, b) => (a.days_remaining ?? 9999) - (b.days_remaining ?? 9999)
        );
        setUpcoming(sorted);
      } catch {
        setUpcoming([]);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const shouldStartOAuth = (rawError) => {
    const msg = String(rawError || "").toLowerCase();
    return (
      msg.includes("invalid_grant") ||
      msg.includes("token has been expired") ||
      msg.includes("connect gmail before syncing emails") ||
      msg.includes("gmail oauth not connected") ||
      msg.includes("connect gmail first") ||
      msg.includes("no gmail refresh token") ||
      msg.includes("refresh token") ||
      msg.includes("unauthorized")
    );
  };

  const handleSync = async () => {
    if (!token) return;

    try {
      setSyncing(true);
      setError(null);

      // Check connection first to avoid long waits when Gmail isn't linked.
      const meRes = await axios.get("http://localhost:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const isConnected = meRes?.data?.gmail_connected ?? !!meRes?.data?.gmail_email;
      setGmailConnected(isConnected);

      if (!isConnected) {
        setError("Gmail is not connected. Redirecting to Google OAuth...");
        await startGoogleOAuth();
        return;
      }

      const response = await axios.post(
        "http://localhost:8000/sync-emails?limit=10",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 180000
        }
      );

      // Backend may return HTTP 200 with { status: "error", message: "..." }
      if (response?.data?.status && response.data.status !== "success") {
        const apiError = response?.data?.message || "Sync failed.";
        if (shouldStartOAuth(apiError)) {
          setGmailConnected(false);
          setError("Gmail authorization required. Redirecting to Google...");
          await startGoogleOAuth();
          return;
        }
        setError(String(apiError));
        return;
      }

      await fetchDashboard();
    } catch (err) {
      const rawError =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to sync emails.";

      console.error("Sync failed:", rawError);

      if (shouldStartOAuth(rawError)) {
        setGmailConnected(false);
        setError("Gmail authorization required. Redirecting to Google...");
        await startGoogleOAuth();
        return;
      }

      if (String(rawError).toLowerCase().includes("timeout")) {
        setError("Sync is taking longer than expected. Please wait and try again.");
        return;
      }

      setError(String(rawError));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchDashboard();
  }, [token, fetchDashboard, navigate]);

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
      <h1 className="title">Smart Email Sorting Dashboard</h1>

      {error && <p className="error" style={{ color: "red" }}>{error}</p>}

      <div className="gmail-status" style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px" }}>
        <span
          className={gmailConnected ? "connected" : "not-connected"}
          style={{ color: gmailConnected ? "green" : "red", fontWeight: "bold" }}
        >
          {gmailConnected ? "Gmail Connected" : "Gmail Not Connected"}
        </span>

        <button className="sync-btn" onClick={handleSync} disabled={syncing}>
          <FaSync /> {syncing ? " Syncing..." : " Sync Emails"}
        </button>

        {!gmailConnected && (
          <button
            onClick={startGoogleOAuth}
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
        )}
      </div>

      {safeUpcoming.length > 0 && (overdueCount > 0 || nearCount > 0) && (
        <div className="insight-banner" style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "5px", marginBottom: "20px" }}>
          {overdueCount > 0 && (
            <span style={{ color: "#856404", marginRight: "15px" }}>
              <strong>{overdueCount}</strong> overdue email(s).
            </span>
          )}
          {nearCount > 0 && (
            <span style={{ color: "#856404" }}>
              <strong>{nearCount}</strong> due within 48 hours.
            </span>
          )}
        </div>
      )}

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

      <EmailTable />
    </div>
  );
}

export default Dashboard;
