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
  FaInbox,
  FaChartPie,
  FaChartLine,
} from "react-icons/fa";
import "../styles/dashboard.css";
import { getStoredPreferences, syncPreferencesFromProfile } from "../utils/userPreferences";

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
  const [fullSyncing, setFullSyncing] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [user, setUser] = useState({ email: "", role: "user", gmail_connected: false });
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [error, setError] = useState("");
  const [deadlineAlerts, setDeadlineAlerts] = useState({
    count: 0,
    overdue_count: 0,
    due_soon_count: 0,
    data: []
  });
  const [notificationEnabled, setNotificationEnabled] = useState(
    getStoredPreferences().notificationEnabled
  );
  const [urgentAlertEnabled, setUrgentAlertEnabled] = useState(
    getStoredPreferences().urgentAlertEnabled
  );

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

  const handleTestNotification = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("This browser does not support notifications.");
      return;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      setError("Notification permission denied. Enable browser notifications to test.");
      return;
    }

    new Notification("Sample Deadline Reminder", {
      body: "Demo: A deadline is approaching. Please review and resolve urgent emails."
    });
    setError("");
  }, []);

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
      syncPreferencesFromProfile(meRes?.data);
      setNotificationEnabled(meRes?.data?.notification_enabled !== false);
      setUrgentAlertEnabled(meRes?.data?.urgent_alert_enabled !== false);
      if (meRes?.data?.default_category_view) {
        setFilter((prev) =>
          prev === meRes.data.default_category_view ? prev : meRes.data.default_category_view
        );
      }

      if (meRes?.data?.role === "admin") {
        navigate("/admin");
        return;
      }

      if (!meRes?.data?.gmail_connected) {
        navigate("/connect-gmail");
        return;
      }

      try {
        const [emailsRes, deadlineRes] = await Promise.all([
          axios.get("http://localhost:8000/emails?limit=150", {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get("http://localhost:8000/notifications/deadlines?lookahead_hours=24", {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setEmails(Array.isArray(emailsRes?.data?.data) ? emailsRes.data.data : []);
        setDeadlineAlerts({
          count: Number(deadlineRes?.data?.count || 0),
          overdue_count: Number(deadlineRes?.data?.overdue_count || 0),
          due_soon_count: Number(deadlineRes?.data?.due_soon_count || 0),
          data: Array.isArray(deadlineRes?.data?.data) ? deadlineRes.data.data : []
        });
      } catch (emailErr) {
        console.error("Emails load failed:", emailErr);
        setEmails([]);
        setDeadlineAlerts({ count: 0, overdue_count: 0, due_soon_count: 0, data: [] });
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

  useEffect(() => {
    if (!notificationEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [notificationEnabled]);

  useEffect(() => {
    if (!notificationEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const reminderKey = `deadline-notify-${todayKey}`;
    if (localStorage.getItem(reminderKey)) return;

    if (deadlineAlerts.overdue_count > 0) {
      new Notification("Deadline Alert", {
        body: `${deadlineAlerts.overdue_count} deadline(s) are over. Resolve now.`
      });
      localStorage.setItem(reminderKey, "1");
      return;
    }

    if (deadlineAlerts.due_soon_count > 0) {
      new Notification("Upcoming Deadline", {
        body: `${deadlineAlerts.due_soon_count} email(s) have deadline within 24 hours.`
      });
      localStorage.setItem(reminderKey, "1");
    }
  }, [deadlineAlerts.overdue_count, deadlineAlerts.due_soon_count, notificationEnabled]);

  const handleSync = async () => {
    if (syncing || fullSyncing) return;
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

  const handleFullSync = async () => {
    if (syncing || fullSyncing) return;
    if (!token) {
      navigate("/login");
      return;
    }

    const ok = window.confirm(
      "This will clear stored emails and re-sync from Gmail to refresh status. Continue?"
    );
    if (!ok) return;

    try {
      setFullSyncing(true);
      setError("");

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

      await axios.post(
        "http://localhost:8000/sync-emails?limit=200&clear_db=true",
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 }
      );

      await loadDashboard();
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Full sync failed";
      const normalized = String(msg).toLowerCase();
      if (
        normalized.includes("invalid_grant") ||
        normalized.includes("refresh token") ||
        normalized.includes("token has been expired or revoked") ||
        normalized.includes("gmail oauth not connected") ||
        normalized.includes("connect gmail")
      ) {
        setUser((prev) => ({ ...prev, gmail_connected: false }));
        setError("Gmail authorization expired. Redirecting to reconnect...");
        await startGoogleOAuth();
        return;
      }
      setError(String(msg));
    } finally {
      setFullSyncing(false);
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

  const analytics = useMemo(() => {
    const byCategory = {};
    for (const email of emails) {
      const key = email.category || "Uncategorized";
      byCategory[key] = (byCategory[key] || 0) + 1;
    }
    const categoryRows = Object.entries(byCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const topCategories = categoryRows.slice(0, 6);
    const maxCategoryCount = topCategories[0]?.count || 1;

    const today = new Date();
    const dayBuckets = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - idx));
      d.setHours(0, 0, 0, 0);
      return { date: d, label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    const bucketMap = new Map(dayBuckets.map((d) => [d.date.getTime(), d]));

    for (const email of emails) {
      const raw = email.received_at || email.created_at;
      if (!raw) continue;
      const dt = new Date(raw);
      dt.setHours(0, 0, 0, 0);
      const bucket = bucketMap.get(dt.getTime());
      if (bucket) bucket.count += 1;
    }

    const maxDaily = Math.max(...dayBuckets.map((d) => d.count), 1);
    const chartWidth = 420;
    const chartHeight = 120;
    const points = dayBuckets.map((d, i) => {
      const x = (i / (dayBuckets.length - 1 || 1)) * chartWidth;
      const y = chartHeight - (d.count / maxDaily) * chartHeight;
      return `${x},${y}`;
    }).join(" ");

    const urgentPercent = stats.total ? Math.round((stats.urgent / stats.total) * 100) : 0;

    return {
      topCategories,
      maxCategoryCount,
      dayBuckets,
      dailyPoints: points,
      chartWidth,
      chartHeight,
      urgentPercent,
    };
  }, [emails, stats.total, stats.urgent]);

  const canShowNotifications = notificationEnabled;
  const canShowUrgentAlerts = notificationEnabled && urgentAlertEnabled;
  const hasActiveSearch = searchQuery.trim().length > 0;

  if (loading) {
    return <div className="dashboard">Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div className="page-header-row">
          <h1 className="title header-title">
            <FaInbox />
            Email Intelligence Dashboard
          </h1>
          <div className="header-actions">
            <button className="reply-btn" onClick={handleTestNotification}>Test Notification</button>
            <button className="close-btn" onClick={() => navigate("/profile")}>Profile</button>
            <button className="close-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <p className="user-subtitle">Monitor, prioritize, and resolve your inbox with confidence.</p>
        <div className="status-row">
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

      {error && canShowNotifications && <div className="user-error" style={{ padding: "10px", marginBottom: "16px" }}>{error}</div>}

      {!user.gmail_connected && canShowNotifications && (
        <div className="insight-banner">
          Gmail OAuth not connected.
        </div>
      )}

      {canShowUrgentAlerts && stats.urgent > 0 && (
        <div className="insight-banner" style={{ marginBottom: "16px" }}>
          You have {stats.urgent} urgent emails that need attention.
        </div>
      )}

      {canShowNotifications && deadlineAlerts.overdue_count > 0 && (
        <div className="insight-banner" style={{ marginBottom: "12px", borderLeftColor: "#dc2626", color: "#fecaca" }}>
          {deadlineAlerts.overdue_count} deadline{deadlineAlerts.overdue_count > 1 ? "s are" : " is"} over.
          Please resolve immediately.
        </div>
      )}

      {canShowNotifications && deadlineAlerts.due_soon_count > 0 && (
        <div className="insight-banner" style={{ marginBottom: "16px" }}>
          {deadlineAlerts.due_soon_count} email{deadlineAlerts.due_soon_count > 1 ? "s have" : " has"} deadline within 24 hours.
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

      <div className="viz-grid">
        <div className="upcoming-section viz-card">
          <h3 className="viz-title"><FaChartPie /> Category Distribution</h3>
          {analytics.topCategories.length ? (
            <div className="viz-bars">
              {analytics.topCategories.map((row) => (
                <div key={row.name} className="viz-bar-row">
                  <div className="viz-bar-meta">
                    <span>{row.name}</span>
                    <span>{row.count}</span>
                  </div>
                  <div className="viz-bar-track">
                    <div
                      className="viz-bar-fill"
                      style={{ width: `${(row.count / analytics.maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="viz-empty">No category data yet.</p>
          )}
        </div>

        <div className="upcoming-section viz-card">
          <h3 className="viz-title"><FaChartPie /> Urgency Split</h3>
          <div className="urgency-ring-wrap">
            <div
              className="urgency-ring"
              style={{
                background: `conic-gradient(#dc2626 ${analytics.urgentPercent}%, #22c55e ${analytics.urgentPercent}% 100%)`
              }}
            >
              <div className="urgency-ring-center">
                <strong>{analytics.urgentPercent}%</strong>
                <span>Urgent</span>
              </div>
            </div>
            <div className="urgency-legend">
              <div><span className="legend-dot urgent-dot" />Urgent: {stats.urgent}</div>
              <div><span className="legend-dot normal-dot" />Normal: {Math.max(stats.total - stats.urgent, 0)}</div>
            </div>
          </div>
        </div>

        <div className="upcoming-section viz-card viz-wide">
          <h3 className="viz-title"><FaChartLine /> 7-Day Email Volume</h3>
          {analytics.dayBuckets.some((d) => d.count > 0) ? (
            <>
              <div className="trend-svg-wrap">
                <svg viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`} className="trend-svg" preserveAspectRatio="none">
                  <polyline className="trend-line" points={analytics.dailyPoints} />
                </svg>
              </div>
              <div className="trend-labels">
                {analytics.dayBuckets.map((d) => (
                  <div key={d.label} className="trend-label">
                    <span>{d.label}</span>
                    <strong>{d.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="viz-empty">No trend data in the last 7 days.</p>
          )}
        </div>
      </div>

      <div className="category-overview category-overview-top">
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

        <div className="toolbar-actions">
          <div className="search-wrap">
            <FaSearch
              className="search-icon"
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
          <button className="close-btn" onClick={handleFullSync} disabled={syncing || fullSyncing}>
            {fullSyncing ? "Refreshing..." : "Full Sync (Refresh Status)"}
          </button>
        </div>
      </div>

      <div className="email-section">
        <h2 className="section-title section-title-row">
          <FaInbox />
          Inbox
        </h2>
        {filteredEmails.length === 0 ? (
          <div className="upcoming-section empty-state-panel">
            <h3>{hasActiveSearch ? "No matching emails" : "Inbox is empty"}</h3>
            <p>
              {hasActiveSearch
                ? "Try different keywords or remove filters."
                : "Sync your mailbox to fetch and classify the latest emails."}
            </p>
            {!hasActiveSearch && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="reply-btn" onClick={handleSync} disabled={syncing || fullSyncing}>
                  {syncing ? "Syncing..." : "Sync Emails"}
                </button>
                <button className="close-btn" onClick={handleFullSync} disabled={syncing || fullSyncing}>
                  {fullSyncing ? "Refreshing..." : "Full Sync (Refresh Status)"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
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
                {filteredEmails.map((email) => (
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
                      {email.is_read || email.is_resolved ? (
                        <span className="empty">-</span>
                      ) : (
                        <button
                          className="close-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(email.id);
                          }}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
