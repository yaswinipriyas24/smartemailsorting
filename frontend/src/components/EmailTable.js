import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/dashboard.css";

function EmailTable({ hideConfidence = false }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendStatus, setSendStatus] = useState("");

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setError("You must login first");
          setLoading(false);
          return;
        }

        const res = await axios.get(
          "http://localhost:8000/emails?limit=50",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (Array.isArray(res.data.data)) {
          setEmails(res.data.data);
        } else {
          setEmails([]);
        }
      } catch (err) {
        console.error("Error fetching emails:", err);
        setError("Failed to load emails");
        setEmails([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, []);

  const getConfidenceColor = (confidence) => {
    if (!confidence || confidence <= 0.4) return "#dc2626";
    if (confidence <= 0.7) return "#f59e0b";
    return "#16a34a";
  };

  const getDeadlineStatus = (days) => {
    if (days == null) return "none";
    if (days < 0) return "overdue";
    if (days <= 2) return "near";
    return "safe";
  };

  const handleOpenEmail = (email) => {
    setSelectedEmail({
      ...email,
      sender: email.sender || "Unknown sender",
      to_email: email.to_email || "Not available",
      body: email.body || "Original email body is empty for this message."
    });
    setSendStatus("");
  };

  const handleCloseEmail = () => {
    setSelectedEmail(null);
    setReplyText("");
    setSendStatus("");
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    setSendStatus("Reply sent successfully (UI preview mode).");
    setReplyText("");
  };

  return (
    <div className="email-section">
      <h2 className="section-title">All Emails</h2>

      <table className="email-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Category</th>
            <th>Deadline</th>
            <th>Days Left</th>
            {!hideConfidence && <th>Confidence</th>}
            <th>Urgent</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={hideConfidence ? "5" : "6"} className="empty">
                Loading emails...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={hideConfidence ? "5" : "6"} className="error">
                {error}
              </td>
            </tr>
          ) : emails.length === 0 ? (
            <tr>
              <td colSpan={hideConfidence ? "5" : "6"} className="empty">
                No emails found
              </td>
            </tr>
          ) : (
            emails.map((email) => {
              const confidenceValue = email.confidence || 0;
              const percentage = (confidenceValue * 100).toFixed(1);
              const status = getDeadlineStatus(email.days_remaining);

              return (
                <tr
                  key={email.id}
                  onClick={() => handleOpenEmail(email)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="subject">{email.subject}</td>

                  <td>
                    <span className="badge category">
                      {email.category}
                    </span>
                  </td>

                  {/* Deadline Date */}
                  <td>
                    {email.deadline_date
                      ? new Date(email.deadline_date).toLocaleDateString()
                      : "—"}
                  </td>

                  {/* Days Remaining */}
                  <td>
                    {email.days_remaining != null ? (
                      <span className={`deadline-badge ${status}`}>
                        {email.days_remaining < 0
                          ? "Overdue"
                          : `${email.days_remaining} days`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>

                  {!hideConfidence && (
                    <td>
                      <div className="confidence-wrapper">
                        <div
                          className="confidence-bar"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              getConfidenceColor(confidenceValue),
                          }}
                        ></div>
                      </div>
                      <div className="confidence-text">
                        {percentage}%
                      </div>
                    </td>
                  )}

                  <td>
                    {email.urgent ? (
                      <span className="badge urgent">Urgent</span>
                    ) : (
                      <span className="badge normal">Normal</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selectedEmail && (
        <div className="email-modal">
          <div className="email-modal-content">
            <h3>{selectedEmail.subject}</h3>
            <p>
              <strong>From:</strong> {selectedEmail.sender}
            </p>
            <p>
              <strong>To:</strong> {selectedEmail.to_email}
            </p>
            <p>
              <strong>Category:</strong> {selectedEmail.category || "N/A"}
            </p>
            <hr />
            <div className="email-body">{selectedEmail.body}</div>

            <textarea
              placeholder="Write description/reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{
                width: "100%",
                minHeight: "120px",
                marginTop: "16px",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
            />

            {sendStatus && (
              <p style={{ marginTop: "10px", color: "#166534", fontWeight: 600 }}>
                {sendStatus}
              </p>
            )}

            <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
              <button className="sync-btn" onClick={handleSendReply}>
                Send
              </button>
              <button onClick={handleCloseEmail}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailTable;
