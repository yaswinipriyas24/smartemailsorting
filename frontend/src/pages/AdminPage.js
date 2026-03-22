import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { getStoredPreferences, syncPreferencesFromProfile } from "../utils/userPreferences";
import { clearSession, getAuthToken } from "../utils/authSession";
import { apiUrl } from "../utils/api";

const CATEGORIES = [
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

export default function AdminPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [monitoring, setMonitoring] = useState(null);
  const [emails, setEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(
    getStoredPreferences().notificationEnabled
  );

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");

  // Feedback management state
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  const [adminReplies, setAdminReplies] = useState({});  // { [feedbackId]: { text, status } }

  const authHeaders = useMemo(() => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login");
  }, [navigate]);

  const loadAll = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const meRes = await axios.get(apiUrl("/auth/me"), { headers: authHeaders });
      if (meRes?.data?.role !== "admin") {
        navigate("/dashboard");
        return;
      }
      syncPreferencesFromProfile(meRes?.data);
      setNotificationEnabled(meRes?.data?.notification_enabled !== false);
      localStorage.setItem("role", "admin");

      const [monitoringRes, emailsRes, usersRes, feedbackRes] = await Promise.all([
        axios.get(apiUrl("/admin/monitoring"), { headers: authHeaders }),
        axios.get(apiUrl("/emails?limit=200"), { headers: authHeaders }),
        axios.get(apiUrl("/admin/users"), { headers: authHeaders }),
        axios.get(apiUrl("/feedback/admin/all"), { headers: authHeaders }).catch(() => ({ data: { data: [] } })),
      ]);

      setMonitoring(monitoringRes.data || null);
      setEmails(Array.isArray(emailsRes?.data?.data) ? emailsRes.data.data : []);
      setUsers(Array.isArray(usersRes?.data?.data) ? usersRes.data.data : []);
      setAllFeedbacks(Array.isArray(feedbackRes?.data?.data) ? feedbackRes.data.data : []);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        logout();
        return;
      }
      setError(err?.response?.data?.detail || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, logout, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const getOverrideFor = (email) => {
    const existing = overrides[email.id];
    if (existing) return existing;
    return {
      category: email.category || CATEGORIES[0],
      urgent: !!email.urgent
    };
  };

  const setOverrideField = (emailId, field, value, email) => {
    const baseline = getOverrideFor(email);
    setOverrides((prev) => ({
      ...prev,
      [emailId]: {
        ...baseline,
        ...prev[emailId],
        [field]: value
      }
    }));
  };

  const saveOverride = async (email) => {
    const selection = getOverrideFor(email);
    try {
      setError("");
      setSuccess("");
      await axios.put(
        apiUrl(`/admin/emails/${email.id}/override`),
        {
          category: selection.category,
          urgent: selection.urgent
        },
        { headers: authHeaders }
      );
      setSuccess(`Correction saved for email #${email.id}`);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save override");
    }
  };

  const runRetrain = async () => {
    try {
      setSyncing(true);
      setError("");
      setSuccess("");
      const res = await axios.post(apiUrl("/admin/retrain"), {}, { headers: authHeaders, timeout: 3600000 });
      setSuccess(res?.data?.message || "Retraining completed");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Retraining failed");
    } finally {
      setSyncing(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");
      await axios.post(
        apiUrl("/admin/users"),
        { email: newUserEmail, password: newUserPassword, role: newUserRole },
        { headers: authHeaders }
      );
      setSuccess("User created");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("user");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to create user");
    }
  };

  const updateUser = async (user) => {
    try {
      setError("");
      setSuccess("");
      await axios.patch(
        apiUrl(`/admin/users/${user.id}`),
        { role: user.role, is_active: user.is_active },
        { headers: authHeaders }
      );
      setSuccess(`Updated ${user.email}`);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update user");
    }
  };

  const removeUser = async (userId) => {
    try {
      setError("");
      setSuccess("");
      await axios.delete(apiUrl(`/admin/users/${userId}`), { headers: authHeaders });
      setSuccess("User removed");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to remove user");
    }
  };

  const updateLocalUser = (id, field, value) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  const setAdminReplyField = (feedbackId, field, value) => {
    setAdminReplies((prev) => ({
      ...prev,
      [feedbackId]: { status: "resolved", ...prev[feedbackId], [field]: value },
    }));
  };

  const resolveUserFeedback = async (feedbackId) => {
    const entry = adminReplies[feedbackId];
    if (!entry?.text?.trim()) {
      setError("Please type a reply before saving.");
      return;
    }
    try {
      setError("");
      setSuccess("");
      await axios.patch(
        apiUrl(`/feedback/${feedbackId}/resolve`),
        { admin_reply: entry.text.trim(), status: entry.status || "resolved" },
        { headers: authHeaders }
      );
      setSuccess(`Feedback #${feedbackId} updated.`);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update feedback");
    }
  };

  if (loading) return <div className="dashboard">Loading admin dashboard...</div>;

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div className="page-header-row">
          <h1 className="title" style={{ marginBottom: 0 }}>Admin Dashboard</h1>
          <div className="header-actions">
            <button className="close-btn" onClick={() => navigate("/profile")}>Profile</button>
            <button className="close-btn" onClick={logout}>Logout</button>
          </div>
        </div>
        <p className="user-subtitle">Monitor model health, correct classifications, retrain, and manage users.</p>
      </div>

      {error && notificationEnabled && <div className="user-error" style={{ padding: "10px", marginBottom: "14px" }}>{error}</div>}
      {success && notificationEnabled && <div className="insight-banner" style={{ marginBottom: "14px" }}>{success}</div>}

      <div className="card-container">
        <div className="card"><div><h3>Classification Accuracy</h3><p>{monitoring?.classification_accuracy ?? 0}%</p></div></div>
        <div className="card"><div><h3>Emails Processed</h3><p>{monitoring?.emails_processed ?? 0}</p></div></div>
        <div className="card"><div><h3>Urgent Detection Count</h3><p>{monitoring?.urgent_detection_count ?? 0}</p></div></div>
        <div className="card"><div><h3>Manual Overrides</h3><p>{monitoring?.manual_override_count ?? 0}</p></div></div>
      </div>

      <div className="email-section" style={{ marginTop: "20px" }}>
        <h2 className="section-title">Step 2: Model Monitoring</h2>
        <div className="upcoming-section">
          <h3 style={{ marginTop: 0 }}>Error Logs</h3>
          <div style={{ maxHeight: "230px", overflowY: "auto" }}>
            {monitoring?.error_logs?.length ? (
              monitoring.error_logs.map((log) => (
                <div key={log.id} style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 0" }}>
                  <strong>{log.level?.toUpperCase()}</strong> [{log.event_type}] - {log.message}
                </div>
              ))
            ) : (
              <div>No logs yet.</div>
            )}
          </div>

          <div style={{ marginTop: "14px", display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="reply-btn" onClick={runRetrain} disabled={syncing}>
              {syncing ? "Retraining..." : "Step 4: Retrain Model"}
            </button>
            {monitoring?.last_retraining && (
              <span>
                Last run: {monitoring.last_retraining.status} ({new Date(monitoring.last_retraining.started_at).toLocaleString()})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="email-section">
        <h2 className="section-title">Step 3: Manual Override</h2>
        <div className="table-wrap">
          <table className="email-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Current Category</th>
                <th>Override Category</th>
                <th>Current Urgent</th>
                <th>Override Urgent</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {emails.length ? (
                emails.slice(0, 100).map((email) => {
                  const selection = getOverrideFor(email);
                  return (
                    <tr key={email.id}>
                      <td>{email.id}</td>
                      <td>{email.subject || "(No Subject)"}</td>
                      <td>{email.category || "Unknown"}</td>
                      <td>
                        <select
                          className="reply-textarea"
                          style={{ minHeight: "42px", marginTop: 0 }}
                          value={selection.category}
                          onChange={(e) => setOverrideField(email.id, "category", e.target.value, email)}
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>{email.urgent ? "Yes" : "No"}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selection.urgent}
                          onChange={(e) => setOverrideField(email.id, "urgent", e.target.checked, email)}
                        />
                      </td>
                      <td>
                        <button className="reply-btn" onClick={() => saveOverride(email)}>Save Override</button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="empty">No emails to review.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="email-section">
        <h2 className="section-title">Step 5: User Management</h2>
        <div className="upcoming-section">
          <form onSubmit={createUser} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "10px" }}>
            <input
              className="reply-textarea"
              style={{ minHeight: "42px", marginTop: 0 }}
              placeholder="new.user@example.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
            />
            <input
              className="reply-textarea"
              type="password"
              style={{ minHeight: "42px", marginTop: 0 }}
              placeholder="Password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              required
            />
            <select
              className="reply-textarea"
              style={{ minHeight: "42px", marginTop: 0 }}
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button className="reply-btn" type="submit">Add User</button>
          </form>

          <div className="table-wrap" style={{ marginTop: "14px" }}>
            <table className="email-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Usage (Emails)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    <select
                      className="reply-textarea"
                      style={{ minHeight: "42px", marginTop: 0 }}
                      value={user.role}
                      onChange={(e) => updateLocalUser(user.id, "role", e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!user.is_active}
                      onChange={(e) => updateLocalUser(user.id, "is_active", e.target.checked)}
                    />
                  </td>
                  <td>{user.emails_processed}</td>
                  <td style={{ display: "flex", gap: "8px" }}>
                    <button className="reply-btn" onClick={() => updateUser(user)}>Save</button>
                    <button className="close-btn" onClick={() => removeUser(user.id)}>Remove</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="empty">No users found.</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── User Feedback Panel ── */}
      <div className="email-section" style={{ marginTop: "20px" }}>
        <h2 className="section-title">Step 6: User Feedback</h2>
        <div className="upcoming-section">
          {allFeedbacks.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No user feedback submitted yet.</p>
          ) : (
            allFeedbacks.map((fb) => {
              const reply = adminReplies[fb.id] || { text: fb.admin_reply || "", status: fb.status || "resolved" };
              return (
                <div
                  key={fb.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    marginBottom: "14px",
                    background: fb.status === "resolved" ? "#f0fdf4" : "#fffbeb",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span
                        style={{
                          background: fb.status === "resolved" ? "#22c55e" : "#f59e0b",
                          color: "#fff",
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {fb.status === "resolved" ? "Resolved" : "Pending"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>
                        {fb.user_email || `User #${fb.user_id}`}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {fb.created_at ? new Date(fb.created_at).toLocaleString() : ""}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 10px", color: "#334155" }}>{fb.message}</p>

                  <textarea
                    className="reply-textarea"
                    placeholder="Type your reply to this feedback..."
                    value={reply.text}
                    onChange={(e) => setAdminReplyField(fb.id, "text", e.target.value)}
                    rows={3}
                    maxLength={2000}
                    style={{ width: "100%", marginBottom: "8px" }}
                  />

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <select
                      className="reply-textarea"
                      style={{ minHeight: "36px", marginTop: 0, maxWidth: "160px" }}
                      value={reply.status}
                      onChange={(e) => setAdminReplyField(fb.id, "status", e.target.value)}
                    >
                      <option value="resolved">Mark Resolved</option>
                      <option value="pending">Keep Pending</option>
                    </select>
                    <button
                      className="reply-btn"
                      onClick={() => resolveUserFeedback(fb.id)}
                    >
                      Save Reply
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
