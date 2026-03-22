import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { apiUrl } from "../utils/api";

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

function UserPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [emails, setEmails] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [myFeedbacks, setMyFeedbacks] = useState([]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("http://localhost:8000/emails?limit=150", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        const data = res.data?.data || [];
        setEmails(data);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError("Failed to load emails.");
      })
      .finally(() => setLoading(false));

    // Load user's own feedback history
    axios
      .get(apiUrl("/feedback/my"), { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setMyFeedbacks(res.data?.data || []))
      .catch(() => {});
  }, [navigate, token]);

  const fetchMyFeedback = () => {
    axios
      .get(apiUrl("/feedback/my"), { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setMyFeedbacks(res.data?.data || []))
      .catch(() => {});
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSubmitting(true);
    setFeedbackSuccess("");
    setFeedbackError("");
    try {
      await axios.post(
        apiUrl("/feedback"),
        { message: feedbackText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedbackSuccess("Your feedback has been sent to the admin.");
      setFeedbackText("");
      fetchMyFeedback();
    } catch {
      setFeedbackError("Failed to send feedback. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      if (a.urgent !== b.urgent) {
        return Number(b.urgent) - Number(a.urgent);
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }, [emails]);

  const urgentCount = useMemo(
    () => emails.filter((e) => e.urgent).length,
    [emails]
  );

  const readCount = useMemo(
    () => emails.filter((e) => e.is_read).length,
    [emails]
  );

  const unreadCount = useMemo(
    () => emails.filter((e) => !e.is_read).length,
    [emails]
  );

  const filteredEmails = useMemo(() => {
    if (selectedCategory === "All") return sortedEmails;
    if (selectedCategory === "Urgent") return sortedEmails.filter((e) => e.urgent);
    if (selectedCategory === "Unread") return sortedEmails.filter((e) => !e.is_read);
    if (selectedCategory === "Read") return sortedEmails.filter((e) => e.is_read);
    return sortedEmails.filter((e) => e.category === selectedCategory);
  }, [selectedCategory, sortedEmails]);

  const categories = ["All", "Urgent", "Unread", "Read", ...ALL_CATEGORIES];

  const openEmail = (email) => {
    setSelectedEmail({
      ...email,
      sender: email.sender || "Unknown sender",
      body: email.body || "Email body preview is not available in this view."
    });

    if (!email.is_read) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
      );
    }
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    alert("Reply API is not available yet.");
    setReplyText("");
  };

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <h1 className="title">Smart Email Intelligence Dashboard</h1>
        <p className="user-subtitle">Track categories, open messages, and draft quick replies.</p>
      </div>

      {error && <p className="error user-error">{error}</p>}

      {urgentCount > 0 && (
        <div className="insight-banner">
          You have <strong>{urgentCount}</strong> urgent emails.
        </div>
      )}

      <div className="category-overview">
        <div className="category-card" onClick={() => setSelectedCategory("Unread")}>
          <h4>Unread</h4>
          <p>{unreadCount}</p>
        </div>

        <div className="category-card" onClick={() => setSelectedCategory("Read")}>
          <h4>Read</h4>
          <p>{readCount}</p>
        </div>
      </div>

      <div className="filter-container">
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${selectedCategory === category ? "active" : ""}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="email-section">
        <h2 className="section-title">{selectedCategory} Emails</h2>

        <table className="email-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Category</th>
              <th>Confidence</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="empty">
                  Loading...
                </td>
              </tr>
            ) : filteredEmails.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty">
                  No emails found
                </td>
              </tr>
            ) : (
              filteredEmails.map((email) => (
                <tr
                  key={email.id}
                  className="user-email-row"
                  onClick={() => openEmail(email)}
                >
                  <td
                    className="subject"
                    style={{ fontWeight: email.is_read ? "500" : "700" }}
                  >
                    {email.subject}
                  </td>

                  <td>
                    <span className="badge category">{email.category}</span>
                  </td>

                  <td>
                    {email.confidence
                      ? `${(email.confidence * 100).toFixed(1)}%`
                      : "0%"}
                  </td>

                  <td>
                    {email.urgent ? (
                      <span className="badge urgent">Urgent</span>
                    ) : (
                      <span className="badge normal">Normal</span>
                    )}
                  </td>

                  <td>
                    {email.is_read ? (
                      <span className="badge normal">Read</span>
                    ) : (
                      <span className="badge unread">Unread</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedEmail && (
        <div className="email-modal">
          <div className="email-modal-content">
            <h3>{selectedEmail.subject}</h3>
            <p>
              <strong>From:</strong> {selectedEmail.sender}
            </p>
            <hr />
            <div className="email-body">{selectedEmail.body}</div>

            <textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="reply-textarea"
            />

            <div className="modal-actions">
              <button className="reply-btn" onClick={handleReply}>Send Reply</button>

              <button className="close-btn" onClick={() => setSelectedEmail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Section ── */}
      <div className="email-section" style={{ marginTop: "32px" }}>
        <h2 className="section-title">Send Feedback to Admin</h2>
        <div className="upcoming-section">
          <p style={{ marginBottom: "10px", color: "#64748b" }}>
            Have a suggestion, issue, or question? Write to the admin below.
          </p>
          <form onSubmit={handleFeedbackSubmit}>
            <textarea
              className="reply-textarea"
              placeholder="Describe your feedback or issue..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              maxLength={2000}
              style={{ width: "100%", marginBottom: "10px" }}
            />
            {feedbackSuccess && (
              <div className="insight-banner" style={{ marginBottom: "8px" }}>
                {feedbackSuccess}
              </div>
            )}
            {feedbackError && (
              <div className="user-error" style={{ marginBottom: "8px" }}>
                {feedbackError}
              </div>
            )}
            <button
              type="submit"
              className="reply-btn"
              disabled={feedbackSubmitting || !feedbackText.trim()}
            >
              {feedbackSubmitting ? "Sending..." : "Send Feedback"}
            </button>
          </form>

          {myFeedbacks.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h3 style={{ marginBottom: "10px" }}>My Feedback History</h3>
              {myFeedbacks.map((fb) => (
                <div
                  key={fb.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    marginBottom: "12px",
                    background: fb.status === "resolved" ? "#f0fdf4" : "#fffbeb"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span
                      className="badge"
                      style={{
                        background: fb.status === "resolved" ? "#22c55e" : "#f59e0b",
                        color: "#fff",
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontSize: "12px"
                      }}
                    >
                      {fb.status === "resolved" ? "Resolved" : "Pending"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {fb.created_at ? new Date(fb.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 6px", fontWeight: 500 }}>{fb.message}</p>
                  {fb.admin_reply && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px 12px",
                        background: "#eff6ff",
                        borderRadius: "6px",
                        borderLeft: "3px solid #3b82f6"
                      }}
                    >
                      <strong style={{ fontSize: "12px", color: "#3b82f6" }}>Admin Reply:</strong>
                      <p style={{ margin: "4px 0 0" }}>{fb.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPage;
