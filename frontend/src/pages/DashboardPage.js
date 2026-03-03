import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaEnvelope,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLink,
  FaSyncAlt,
  FaInbox
} from "react-icons/fa";
import "../styles/dashboard.css";

const ALL_CATEGORIES = [
  "Announcements",
  "Customer Support",
  "Deadlines",
  "General Communication",
  "Human Resources",
  "Invoices",
  "Legal",
  "Marketing",
  "Meetings",
  "Orders",
  "Payments",
  "Performance Reports",
  "Project Updates",
  "Recruitment",
  "Reminders",
  "Technical Issues",
  "Training"
];

const CATEGORY_ICONS = {
  Announcements: "📢",
  "Customer Support": "🎧",
  Deadlines: "⏰",
  "General Communication": "💬",
  "Human Resources": "👥",
  Invoices: "🧾",
  Legal: "⚖️",
  Marketing: "📈",
  Meetings: "📅",
  Orders: "📦",
  Payments: "💳",
  "Performance Reports": "📊",
  "Project Updates": "🛠️",
  Recruitment: "🧑‍💼",
  Reminders: "🔔",
  "Technical Issues": "🧰",
  Training: "🎓",
  All: "✨"
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [user, setUser] = useState({ email: "", role: "user", gmail_connected: false });
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [error, setError] = useState("");

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setError("Session expired. Please login again.");
    navigate("/login");
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  }, [navigate]);

  const startGoogleOAuth = useCallback(async () => {
    const freshToken = localStorage.getItem("token");
    if (!freshToken) {
      navigate("/login");
      return;
    }

    try {
      setOauthConnecting(true);
      setError("");
      const response = await axios.get("http://localhost:8000/gmail/connect", {
        headers: { Authorization: `Bearer ${freshToken}` }
      });
      const authUrl = response?.data?.auth_url;
      if (!authUrl) throw new Error("OAuth URL missing");
      window.location.assign(authUrl);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to start Gmail OAuth.";
      setError(String(detail));
      // Fallback path if direct OAuth URL bootstrap fails
      navigate("/connect-gmail");
    } finally {
      setOauthConnecting(false);
    }
  }, [navigate, handleUnauthorized]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const meRes = await axios.get("http://localhost:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(meRes.data || {});

      if (meRes?.data?.role === "admin") {
        navigate("/admin");
        return;
      }

      if (!meRes?.data?.gmail_connected) {
        navigate("/connect-gmail");
        return;
      }

      try {
        const emailsRes = await axios.get("http://localhost:8000/emails?limit=150", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEmails(Array.isArray(emailsRes?.data?.data) ? emailsRes.data.data : []);
      } catch (emailErr) {
        console.error("Emails load failed:", emailErr);
        setEmails([]);
        setError("Connected, but failed to load emails.");
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      console.error("Dashboard load failed:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load dashboard.";
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  }, [token, navigate, handleUnauthorized]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get("gmail_error");
    if (!oauthError) return;

    const map = {
      denied: "Google OAuth was denied. Please allow access to continue.",
      missing_params: "OAuth callback failed (missing parameters).",
      token_failed: "OAuth token exchange failed. Check Google OAuth client settings.",
      no_refresh_token: "OAuth did not return a refresh token. Reconnect Gmail and allow offline access.",
      sync_failed: "Gmail connected, but initial sync failed. Try Sync Emails again."
    };
    setError(map[oauthError] || `OAuth error: ${oauthError}`);
  }, [location.search]);

  const handleSync = async () => {
    if (syncing) return;
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setSyncing(true);
      setError("");

      // Always re-check on click to avoid stale frontend state.
      const meRes = await axios.get("http://localhost:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const connected = !!meRes?.data?.gmail_connected;
      setUser((prev) => ({ ...prev, ...meRes.data }));

      if (!connected) {
        setError("Gmail is not connected. Redirecting to OAuth...");
        await startGoogleOAuth();
        return;
      }

      const syncRes = await axios.post(
        "http://localhost:8000/sync-emails?limit=20",
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 300000 }
      );

      if (syncRes?.data?.status === "error") {
        const msg = String(syncRes?.data?.message || "Sync failed.");
        const normalized = msg.toLowerCase();
        if (
          normalized.includes("oauth") ||
          normalized.includes("refresh token") ||
          normalized.includes("gmail oauth not connected") ||
          normalized.includes("connect gmail")
        ) {
          setUser((prev) => ({ ...prev, gmail_connected: false }));
          await startGoogleOAuth();
          return;
        }
        setError(msg);
        return;
      }

      await loadDashboard();
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Sync failed";
      const normalized = String(msg).toLowerCase();
      if (
        normalized.includes("gmail oauth not connected") ||
        normalized.includes("refresh token") ||
        normalized.includes("invalid_grant") ||
        normalized.includes("connect gmail")
      ) {
        setUser((prev) => ({ ...prev, gmail_connected: false }));
        await startGoogleOAuth();
        return;
      }
      setError(String(msg));
    } finally {
      setSyncing(false);
    }
  };

  const handleResolve = async (emailId) => {
    try {
      await axios.patch(
        `http://localhost:8000/emails/${emailId}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: true, is_resolved: true } : e))
      );
      setSelectedEmail((prev) =>
        prev && prev.id === emailId ? { ...prev, is_read: true, is_resolved: true } : prev
      );
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setError("Failed to mark email as resolved.");
    }
  };

  const categories = useMemo(() => ["All", ...ALL_CATEGORIES], []);

  const filteredEmails = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      const byCategory = filter === "All" || email.category === filter;
      const bySearch =
        !search ||
        String(email.subject || "").toLowerCase().includes(search) ||
        String(email.sender || "").toLowerCase().includes(search) ||
        String(email.body || "").toLowerCase().includes(search);
      return byCategory && bySearch;
    });
  }, [emails, filter, searchQuery]);

  const stats = useMemo(() => {
    const total = emails.length;
    const urgent = emails.filter((e) => e.urgent).length;
    const resolved = emails.filter((e) => e.is_read || e.is_resolved).length;
    return { total, urgent, resolved };
  }, [emails]);

  if (loading) {
    return <div className="dashboard">Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 className="title" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: 0 }}>
            <FaInbox />
            Email Intelligence Dashboard
          </h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="close-btn" onClick={() => navigate("/profile")}>Profile</button>
            <button className="close-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <p className="user-subtitle">Monitor, prioritize, and resolve your inbox with confidence.</p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
          <span
            className={user.gmail_connected ? "connected" : "not-connected"}
            style={{ fontWeight: 700, color: user.gmail_connected ? "#166534" : "#b91c1c" }}
          >
            <FaLink style={{ marginRight: "6px" }} />
            {user.gmail_connected ? "Gmail Connected" : "Gmail Not Connected"}
          </span>
          <button
            className="reply-btn"
            onClick={startGoogleOAuth}
            disabled={oauthConnecting}
          >
            {oauthConnecting
              ? "Connecting..."
              : user.gmail_connected
                ? "Reconnect Gmail"
                : "Connect Gmail"}
          </button>
        </div>
      </div>

      {error && <div className="user-error" style={{ padding: "10px", marginBottom: "16px" }}>{error}</div>}

      {!user.gmail_connected && (
        <div className="insight-banner">
          Gmail OAuth not connected.
        </div>
      )}

      <div className="card-container">
        <div className="card">
          <div>
            <h3><FaEnvelope style={{ marginRight: "6px" }} />Total Emails</h3>
            <p>{stats.total}</p>
          </div>
        </div>
        <div className="card">
          <div>
            <h3><FaExclamationTriangle style={{ marginRight: "6px" }} />Urgent</h3>
            <p>{stats.urgent}</p>
          </div>
        </div>
        <div className="card">
          <div>
            <h3><FaCheckCircle style={{ marginRight: "6px" }} />Resolved</h3>
            <p>{stats.resolved}</p>
          </div>
        </div>
      </div>

      <div className="category-overview" style={{ alignItems: "center" }}>
        <div className="filter-container">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${filter === cat ? "active" : ""}`}
              onClick={() => setFilter(cat)}
            >
              <span style={{ marginRight: "6px" }}>{CATEGORY_ICONS[cat] || "•"}</span>
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ position: "relative", width: "320px" }}>
            <FaSearch
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
                fontSize: "14px"
              }}
            />
            <input
              type="text"
              placeholder="Search subject, sender, category, or body keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="reply-textarea"
              style={{ minHeight: "40px", width: "100%", marginTop: 0, paddingLeft: "34px" }}
            />
          </div>
          <button className="reply-btn" onClick={handleSync} disabled={syncing}>
            <FaSyncAlt style={{ marginRight: "6px" }} />
            {syncing ? "Syncing..." : "Sync Emails"}
          </button>
        </div>
      </div>

      <div className="email-section">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaInbox />
          Inbox
        </h2>
        <table className="email-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>From</th>
              <th>Category</th>
              <th>Deadline</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmails.length ? (
              filteredEmails.map((email) => (
                <tr key={email.id} className="user-email-row" onClick={() => setSelectedEmail(email)}>
                  <td>{email.subject || "(No Subject)"}</td>
                  <td>{email.sender || "Unknown sender"}</td>
                  <td><span className="badge category">{email.category || "General"}</span></td>
                  <td>
                    {email.deadline_date
                      ? new Date(email.deadline_date).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>
                    {email.urgent ? (
                      <span className="badge urgent">Urgent</span>
                    ) : (
                      <span className="badge normal">Normal</span>
                    )}
                  </td>
                  <td>
                    {email.is_read || email.is_resolved ? (
                      <span className="badge normal">Resolved</span>
                    ) : (
                      <span className="badge urgent">Open</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="close-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(email.id);
                      }}
                      disabled={email.is_read || email.is_resolved}
                    >
                      {email.is_read || email.is_resolved ? "Resolved" : "Mark Resolved"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty">No emails found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEmail && (
        <div className="email-modal" onClick={() => setSelectedEmail(null)}>
          <div className="email-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedEmail.subject || "(No Subject)"}</h3>
            <p><strong>From:</strong> {selectedEmail.sender || "Unknown sender"}</p>
            <p><strong>To:</strong> {selectedEmail.to_email || user.email}</p>
            <p><strong>Category:</strong> {selectedEmail.category || "General"}</p>
            <hr />
            <div className="email-body">{selectedEmail.body || "No body content available."}</div>
            <div className="modal-actions">
              <button
                className="reply-btn"
                onClick={() => handleResolve(selectedEmail.id)}
                disabled={selectedEmail.is_read || selectedEmail.is_resolved}
              >
                {selectedEmail.is_read || selectedEmail.is_resolved ? "Resolved" : "Mark as Resolved"}
              </button>
              <button className="close-btn" onClick={() => setSelectedEmail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
