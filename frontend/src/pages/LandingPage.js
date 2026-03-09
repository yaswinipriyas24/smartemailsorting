import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";
import smartEmailLogo from "../assets/smart-email-logo.svg";

export default function LandingPage() {
  const navigate = useNavigate();
  const techStack = [
    "React",
    "FastAPI",
    "scikit-learn",
    "PostgreSQL",
    "Celery",
    "Redis",
    "JWT",
    "Gmail OAuth",
  ];

  useEffect(() => {
    const containers = document.querySelectorAll(
      ".landing-hero, .landing-marquee, .landing-card, .landing-section-head, .landing-step, .landing-panel, .landing-cta-band"
    );

    containers.forEach((container) => {
      const textNodes = container.querySelectorAll(
        "h1, h2, h3, p, li, .landing-kicker, .landing-step-num, .landing-tag, .landing-metric strong, .landing-metric span, button, .landing-marquee-track span"
      );

      textNodes.forEach((node, index) => {
        node.classList.add("scroll-reveal-text");
        node.style.setProperty("--reveal-delay", `${index * 80}ms`);
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("reveal-active");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.24,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    containers.forEach((container) => observer.observe(container));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-shell">
      <div className="landing-noise" />

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-inline-head">
            <div className="landing-brand-wrap">
              <img src={smartEmailLogo} alt="Smart Email Sorting logo" className="landing-logo" />
              <div className="landing-brand">Smart Email Sorting</div>
            </div>
            <div className="landing-nav-actions">
              <button className="landing-btn ghost" onClick={() => navigate("/login")}>Login</button>
              <button className="landing-btn solid" onClick={() => navigate("/login?mode=register")}>Start Free</button>
            </div>
          </div>

          <p className="landing-kicker">AI-Powered Inbox Intelligence</p>
          <h1>Prioritize what matters. Resolve faster. Stay in control.</h1>
          <p className="landing-sub">
            Smart Email Sorting classifies your inbox, detects urgent deadlines, and gives teams
            a clear action dashboard with user and admin workflows.
          </p>

          <div className="landing-metrics">
            <div className="landing-metric">
              <strong>75%</strong>
              <span>Less manual sorting effort</span>
            </div>
            <div className="landing-metric">
              <strong>&lt; 1 min</strong>
              <span>To surface urgent threads</span>
            </div>
            <div className="landing-metric">
              <strong>24/7</strong>
              <span>Continuous inbox monitoring</span>
            </div>
          </div>

          <div className="landing-cta-row">
            <button className="landing-btn solid lg" onClick={() => navigate("/login?mode=register")}>Get Started</button>
            <button
              className="landing-btn ghost lg"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Product
            </button>
          </div>
        </section>

        <section className="landing-marquee" aria-label="Tech stack">
          <div className="landing-marquee-track">
            {techStack.map((item) => (
              <span key={`a-${item}`}>{item}</span>
            ))}
            {techStack.map((item) => (
              <span key={`b-${item}`}>{item}</span>
            ))}
          </div>
        </section>

        <section id="features" className="landing-grid">
          <article className="landing-card">
            <span className="landing-tag">Automation</span>
            <h3>Classification Engine</h3>
            <p>
              Automatically categorizes emails into business-ready buckets like invoices,
              meetings, customer support, and legal.
            </p>
          </article>

          <article className="landing-card">
            <span className="landing-tag warm">Critical Focus</span>
            <h3>Urgency Detection</h3>
            <p>
              Flags critical emails using urgency signals so teams can respond before deadlines
              are missed.
            </p>
          </article>

          <article className="landing-card">
            <span className="landing-tag blue">Team Visibility</span>
            <h3>User Dashboard</h3>
            <p>
              Search, filter, resolve, and visualize inbox activity with clean analytics and
              actionable status insights.
            </p>
          </article>

          <article className="landing-card">
            <span className="landing-tag">Governance</span>
            <h3>Admin Control Center</h3>
            <p>
              Monitor model accuracy, apply manual overrides, retrain periodically, and manage
              users with role-based access.
            </p>
          </article>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <p className="landing-kicker">How It Works</p>
            <h2>From raw inbox data to actionable decisions</h2>
          </div>
          <div className="landing-steps">
            <article className="landing-step">
              <span className="landing-step-num">01</span>
              <h3>Connect Gmail Securely</h3>
              <p>
                OAuth-based authorization links your mailbox without exposing passwords.
              </p>
            </article>
            <article className="landing-step">
              <span className="landing-step-num">02</span>
              <h3>Classify and Score</h3>
              <p>
                The ML pipeline predicts category and confidence for each incoming email.
              </p>
            </article>
            <article className="landing-step">
              <span className="landing-step-num">03</span>
              <h3>Detect Deadlines</h3>
              <p>
                Date extraction and urgency logic surface what needs attention first.
              </p>
            </article>
            <article className="landing-step">
              <span className="landing-step-num">04</span>
              <h3>Drive Team Action</h3>
              <p>
                Dashboards and role-specific controls help users and admins close tasks faster.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section landing-section-split">
          <article className="landing-panel">
            <p className="landing-kicker">Why Teams Use It</p>
            <h2>Built for day-to-day execution</h2>
            <ul className="landing-list">
              <li>Faster triage for high-volume inboxes</li>
              <li>Clear visibility into urgent and overdue communication</li>
              <li>Consistent workflows for users and administrators</li>
              <li>Reduced manual sorting and follow-up overhead</li>
            </ul>
          </article>
          <article className="landing-panel">
            <p className="landing-kicker">Security & Reliability</p>
            <h2>Production-ready foundation</h2>
            <ul className="landing-list">
              <li>JWT authentication and role-based access controls</li>
              <li>User-level data isolation by design</li>
              <li>Audit-friendly dashboard and analytics layer</li>
              <li>Retraining-ready ML workflow for continuous improvement</li>
            </ul>
          </article>
        </section>

        <section className="landing-cta-band">
          <div>
            <h2>Start transforming your inbox operations today</h2>
            <p>
              Launch quickly with secure onboarding, intelligent routing, and deadline-aware automation.
            </p>
          </div>
          <button className="landing-btn solid lg" onClick={() => navigate("/login?mode=register")}>
            Create Your Workspace
          </button>
        </section>
      </main>
    </div>
  );
}
