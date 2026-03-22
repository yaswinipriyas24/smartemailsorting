# 📧 Smart Email Sorting System

> **AI-Powered Email Intelligence for Enhanced Productivity**

A comprehensive machine learning application that intelligently classifies, organizes, and prioritizes emails using advanced NLP techniques. Integrates seamlessly with Gmail and provides role-based dashboards for individual users and administrators.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

The **Smart Email Sorting System** is a full-stack web application designed to reduce information overload by intelligently organizing emails beyond traditional rule-based filtering. Using Machine Learning (TF-IDF + Logistic Regression, DistilBERT) and advanced NLP, the system:

- **Classifies** incoming emails into 17+ business categories
- **Detects** deadlines with intelligent date extraction
- **Prioritizes** urgent emails automatically
- **Isolates** data securely for multi-user environments
- **Provides** role-based analytics dashboards
- **Integrates** seamlessly with Gmail via OAuth2

**Use Cases:**
- Business professionals managing high email volumes
- Teams requiring centralized email intelligence
- Organizations needing deadline tracking
- Enterprises seeking data-driven email insights

---

## ✨ Key Features

### 1. **🔐 Advanced Authentication System**
   - User registration and login
   - OAuth2 password flow with JWT tokens
   - Role-based access control (Admin/User)
   - Secure password hashing (bcrypt)
   - Token expiration and refresh mechanisms

### 2. **📱 Gmail OAuth2 Integration**
   - Seamless Google OAuth2 authentication
   - Secure access token management
   - Automatic token refresh
   - Email sync with Gmail API
   - Revoke access controls

### 3. **🤖 AI Email Classification**
   - **Dual Model Approach:**
     - **TF-IDF + Logistic Regression** (Fast, baseline)
     - **DistilBERT Transformer** (Accurate, state-of-the-art)
   - Input: Subject + Body concatenation
   - 17+ predefined categories:
     - Invoices, Orders, Customer Support, Legal
     - HR, Meetings, Recruitment, Payments
     - Project Updates, Technical Issues, Marketing
     - Training, Announcements, Performance Reports
     - Reminders, Deadlines, General Communication
   - Output: Category + Confidence Score
   - Real-time batch processing

### 4. **📅 Deadline Intelligence Engine**
   - Regex-based deadline extraction
   - **Supported date formats:**
     - DD/MM/YYYY (e.g., 25/03/2026)
     - YYYY-MM-DD (e.g., 2026-03-25)
     - Long format (e.g., 12 Feb 2026)
   - **Calculated fields:**
     - `deadline_date`: Parsed date
     - `days_remaining`: Time to deadline
     - `is_overdue`: Boolean flag
   - **Auto-urgency marking:** ≤ 2 days = urgent
   - Background worker for deadline monitoring

### 5. **👥 Multi-User Isolation**
   - Each email linked to specific user
   - Unique constraint: `(email_id, user_id)`
   - Users can only view their emails
   - Admin access to global statistics
   - Separate audit logs per user

### 6. **📊 Role-Based Dashboards**

   **User Dashboard:**
   - Upcoming deadlines widget
   - Overdue alerts
   - Gmail connection status
   - Sync emails button
   - Categorized email table with filtering
   - Email search functionality

   **Admin Dashboard:**
   - Total emails processed
   - Urgent emails count
   - Category distribution charts
   - User activity logs
   - Model performance metrics
   - System health indicators

### 7. **🔄 Celery Background Tasks**
   - Asynchronous email sync
   - Deadline reminder scheduling
   - Model retraining triggers
   - Batch email classification
   - Long-running operation handling

### 8. **📈 Model MLOps System**
   - Model versioning and registry
   - Training pipeline orchestration
   - Data validation framework
   - Model performance tracking
   - Retraining automation
   - Artifact management

### 9. **🔍 Feedback & Continuous Learning**
   - User feedback collection
   - Model correction system
   - Performance monitoring
   - Metrics tracking
   - Admin event logging

### 10. **🛡️ Security Features**
   - CORS protection
   - HTTPS/TLS support
   - Environment-based secrets
   - Password hashing
   - JWT authentication
   - Email verification (optional)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Login│Dashboard│Gmail Connect│Email Table│Admin Panel  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Backend API (FastAPI + Uvicorn)               │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Routes Layer                                         │ │
│ │ - /auth (Register, Login, Token Refresh)            │ │
│ │ - /gmail (OAuth Callback, Sync, Status)             │ │
│ │ - /classify (Email Classification)                  │ │
│ │ - /feedback (User Corrections)                      │ │
│ │ - /dashboard (User/Admin Analytics)                 │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Core Services                                        │ │
│ │ - Email Fetcher (Gmail API)                         │ │
│ │ - Classification Pipeline (TF-IDF / DistilBERT)     │ │
│ │ - Deadline Extractor (Regex + NER)                  │ │
│ │ - Data Validator (MLOps)                            │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Database Abstraction (SQLAlchemy ORM)               │ │
│ │ - User Management                                    │ │
│ │ - Email Storage                                      │ │
│ │ - Model Registry                                     │ │
│ │ - Audit Logs                                         │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
├─────────────────────────────────────────────────────────┤
│ PostgreSQL Database │ Redis Cache │ Celery Worker       │
│ - Users             │ - Sessions  │ - Async Tasks       │
│ - Emails            │ - Cache     │ - Deadlines         │
│ - Models            │             │ - Retraining        │
│ - Audit Logs        │             │ - Notifications     │
└─────────────────────────────────────────────────────────┘
```

### **Microservices Breakdown**

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 19 + React Router | User interface |
| **Backend API** | FastAPI 0.128 + Uvicorn | REST API server |
| **Database** | PostgreSQL 16 | Data persistence |
| **Cache** | Redis 7 | Session/cache layer |
| **Task Queue** | Celery 5.6 + RabbitMQ | Async job processing |
| **Auth** | JWT + bcrypt | Security |
| **ML Models** | TF-IDF + Scikit-learn, DistilBERT + Transformers | Classification |
| **NLP** | spaCy (en_core_web_sm) | NER for deadline extraction |
| **Containerization** | Docker + Docker Compose | Deployment |

---

## 💻 Tech Stack

### **Backend**
- **Framework:** FastAPI 0.128.0
- **Server:** Uvicorn
- **Database:** PostgreSQL 16 + SQLAlchemy ORM
- **Authentication:** JWT + bcrypt
- **Async Task Queue:** Celery 5.6 + Redis
- **ML Models:**
  - TF-IDF + Logistic Regression (scikit-learn)
  - DistilBERT (transformers library)
- **NLP:** spaCy 3.8
- **Date Parsing:** dateparser 1.3.3
- **Gmail API:** google-auth-oauthlib, google-auth-httplib2
- **Validation:** Pydantic

### **Frontend**
- **Framework:** React 19.2.4
- **Routing:** React Router 7.13.0
- **HTTP Client:** Axios 1.13.5
- **CSS Framework:** Custom CSS modules + Tailwind
- **Icons:** React Icons 5.5.0
- **Build Tool:** React Scripts 5.0.1

### **DevOps**
- **Containerization:** Docker + Docker Compose
- **Runtime:** Python 3.11+, Node.js 18+
- **Reverse Proxy:** Nginx
- **Health Checks:** Custom endpoints

---

## 📂 Project Structure

```
smart_email_sorting/
├── 📌 Root Configuration
│   ├── docker-compose.yml          (Container orchestration)
│   ├── Dockerfile                  (Backend container)
│   ├── requirements.txt            (Python dependencies)
│   ├── .env.example                (Environment template)
│   ├── README.md                   (This file)
│   ├── DEPLOYMENT_NOTES.md         (Deployment guide)
│   └── LICENSE
│
├── 🔵 Backend (FastAPI Application)
│   ├── main.py                     (FastAPI application entry)
│   ├── database.py                 (SQLAlchemy setup)
│   ├── models.py                   (Database models)
│   ├── auth_utils.py               (JWT + password utilities)
│   ├── pipeline.py                 (Email classification pipeline)
│   │
│   ├── 📡 Routes (API Endpoints)
│   │   ├── routes/auth.py          (Register, Login, Token refresh)
│   │   ├── routes/gmail.py         (OAuth callback, Sync, Status)
│   │   ├── routes/classify.py      (Classification endpoint)
│   │   ├── routes/feedback.py      (User corrections)
│   │   └── routes/__init__.py
│   │
│   ├── 🤖 ML & Data Processing
│   │   ├── email_fetcher.py        (Gmail API integration)
│   │   ├── deadline_extractor.py   (Deadline extraction logic)
│   │   ├── ml_model.py             (Model inference)
│   │   ├── tfidf_train.py          (TF-IDF training)
│   │   ├── train_model.py          (DistilBERT training)
│   │   ├── baseline_model.py       (Baseline model script)
│   │   ├── check_dataset.py        (Dataset validation)
│   │   ├── deadline_extraction.py  (Deadline utilities)
│   │   └── generate_dataset.py     (Synthetic dataset generation)
│   │
│   ├── 📊 MLOps System
│   │   ├── mlops/
│   │   │   ├── pipeline.py         (Training pipeline orchestration)
│   │   │   ├── train.py            (Training execution)
│   │   │   ├── registry.py         (Model version registry)
│   │   │   ├── data_validation.py  (Dataset validation)
│   │   │   └── __init__.py
│   │   └── artifacts/              (Model storage)
│   │       ├── models/             (Trained model versions)
│   │       ├── registry.json       (Model metadata)
│   │       └── last_mlops_report.json
│   │
│   ├── 🔧 Background Tasks
│   │   ├── celery_worker.py        (Celery worker setup)
│   │   ├── tasks.py                (Async task definitions)
│   │   └── store_email.py          (Email persistence)
│   │
│   ├── 🔐 Integration
│   │   ├── gmail_oauth.py          (Google OAuth flow)
│   │   ├── sync_emails.py          (Email sync logic)
│   │   └── init_db.py              (Database initialization)
│   │
│   ├── 📚 Utilities & Testing
│   │   ├── test_fetch.py           (Email fetcher tests)
│   │   ├── test_ml_model.py        (Model inference tests)
│   │   ├── test_single_email.py    (Single email tests)
│   │   ├── credentials.json        (Gmail API credentials)
│   │   ├── token.json              (OAuth tokens)
│   │   └── __pycache__/
│   │
│   └── 📁 Data Directory
│       └── dataset/
│           └── emails.csv          (Training/validation data)
│
├── 🔴 Frontend (React Application)
│   ├── package.json                (NPM dependencies)
│   ├── nginx.conf                  (Nginx configuration)
│   ├── Dockerfile                  (Frontend container)
│   │
│   ├── 📄 Public Assets
│   │   ├── public/
│   │   │   ├── index.html          (HTML entry point)
│   │   │   └── manifest.json
│   │   └── build/
│   │       └── (Generated production build)
│   │
│   ├── 🎨 Source Code
│   │   ├── src/
│   │   │   ├── index.js            (React entry point)
│   │   │   ├── App.js              (Root component)
│   │   │   │
│   │   │   ├── 📄 Pages
│   │   │   │   ├── LandingPage.js  (Public landing)
│   │   │   │   ├── LoginPage.js    (User login)
│   │   │   │   ├── Register.js     (User registration)
│   │   │   │   ├── DashboardPage.js (User dashboard)
│   │   │   │   ├── AdminPage.js    (Admin dashboard)
│   │   │   │   ├── ConnectGmailPage.js (OAuth flow)
│   │   │   │   ├── ProfilePage.js  (User profile)
│   │   │   │   └── UserPage.js     (User management)
│   │   │   │
│   │   │   ├── 🧩 Components
│   │   │   │   └── EmailTable.js   (Reusable email table)
│   │   │   │
│   │   │   ├── 🎭 Styles
│   │   │   │   ├── App.css         (Main styles)
│   │   │   │   ├── auth.css        (Auth pages)
│   │   │   │   ├── dashboard.css   (Dashboard)
│   │   │   │   ├── landing.css     (Landing)
│   │   │   │   ├── table.css       (Table styles)
│   │   │   │   └── Auth.module.css
│   │   │   │
│   │   │   └── 🛠️ Utilities
│   │   │       ├── api.js          (Axios instance)
│   │   │       ├── authSession.js  (Auth session logic)
│   │   │       └── userPreferences.js (User prefs)
│   │   │
│   │   └── (Generated node_modules, .env files)
│   │
│   └── 📚 Tests & Config
│       ├── App.test.js
│       └── setupTests.js
│
├── 🔧 Scripts & Configuration
│   └── backend/scripts/
│       └── run_mlops_cycle.ps1     (MLOps pipeline PowerShell)
│
└── 📊 Documentation
    ├── README.md                   (This file)
    └── DEPLOYMENT_NOTES.md         (Deployment instructions)
```

---

## 🚀 Installation & Setup

### **Prerequisites**
- Python 3.9+ (virtual environment recommended)
- Node.js 16+ (for frontend)
- PostgreSQL 12+ (or use Docker)
- Redis 6+ (or use Docker)
- Docker & Docker Compose (recommended for full stack)
- Gmail API credentials (from Google Cloud Console)

### **Step 1: Clone Repository**
```bash
git clone https://github.com/yaswinipriyas24/smartemailsorting.git
cd smart_email_sorting
```

### **Step 2: Backend Setup**

#### Option A: Using Docker Compose (Recommended)
```bash
# Build and start all services
docker compose up -d --build

# Check service health
docker compose ps

# View logs
docker compose logs -f backend
```

#### Option B: Manual Setup

**Create virtual environment:**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Download SpaCy model:**
```bash
python -m spacy download en_core_web_sm
```

**Initialize database:**
```bash
# If using PostgreSQL locally
python backend/init_db.py
```

### **Step 3: Frontend Setup**

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`

---

## ⚙️ Configuration

### **Backend Configuration (.env)**

Create `.env` file in project root from `.env.example`:

```env
# ===== Application =====
APP_ENV=development              # development | production
DEBUG=True
PORT=8000

# ===== Security =====
SECRET_KEY=your-super-secret-key-change-this-in-production-12345
SECURITY_ALGORITHM=HS256

# ===== Database =====
DATABASE_URL=postgresql://smart_email:smart_email_password@localhost:5432/smart_email
# For Supabase:
# DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres

# ===== CORS & URLs =====
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001
BACKEND_BASE_URL=http://localhost:8000
FRONTEND_BASE_URL=http://localhost:3000

# ===== Gmail OAuth =====
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ===== Email Classification =====
MODEL_VERSION=tfidf-logreg-v1    # or distilbert-v1
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.5

# ===== Deadline Features =====
ENABLE_DEADLINE_WORKER=true
DEFAULT_REMINDER_WINDOW_HOURS=24  # Remind 24 hours before
REMINDER_POLL_SECONDS=300          # Check every 5 minutes

# ===== Celery (Background Tasks) =====
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# ===== Sentry (Optional Monitoring) =====
SENTRY_DSN=

# ===== Email Notifications (Optional) =====
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### **Frontend Configuration (.env)**

Create `frontend/.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_API_TIMEOUT=30000
```

### **Gmail OAuth Setup**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable **Gmail API** and **Google+ API**
4. Create OAuth 2.0 credentials (Desktop application)
5. Add authorized redirect URIs:
   - `http://localhost:8000/gmail/callback` (dev)
   - `https://yourdomain.com/gmail/callback` (prod)
6. Download as `credentials.json` and place in `backend/` folder

---

## ▶️ Running the Application

### **Using Docker Compose (Recommended)**

```bash
# Start all services
docker compose up -d --build

# Access endpoints
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# API Docs:  http://localhost:8000/docs (Swagger)
# Postgres:  localhost:5432
# Redis:     localhost:6379

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Remove volumes (clean slate)
docker compose down -v
```

### **Manual Execution**

**Terminal 1 - Backend:**
```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**Terminal 3 - Celery Worker (Optional):**
```bash
source venv/bin/activate
celery -A backend.celery_worker.celery_app worker --loglevel=info
```

**Terminal 4 - Celery Beat (Optional):**
```bash
source venv/bin/activate
celery -A backend.celery_worker.celery_app beat --loglevel=info
```

---

## 📚 API Documentation

### **Interactive API Docs**
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### **Authentication Endpoints**

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password_123"
}

Response: 201 Created
{
  "id": 1,
  "email": "user@example.com",
  "role": "user"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=secure_password_123

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

#### Refresh Token
```http
POST /auth/refresh
Authorization: Bearer <refresh_token>

Response: 200 OK
{
  "access_token": "new_token...",
  "token_type": "bearer"
}
```

### **Gmail Integration Endpoints**

#### OAuth Callback
```http
GET /gmail/callback?code=<auth_code>&state=<state>

Response: Redirects to frontend with token
```

#### Sync Emails
```http
POST /gmail/sync
Authorization: Bearer <access_token>

Response: 200 OK
{
  "synced": 50,
  "processed": 48,
  "failed": 2
}
```

#### Gmail Status
```http
GET /gmail/status
Authorization: Bearer <access_token>

Response: 200 OK
{
  "connected": true,
  "email": "user@gmail.com",
  "last_sync": "2026-03-22T10:30:00Z"
}
```

### **Email Classification Endpoints**

#### Classify Email
```http
POST /classify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "subject": "Invoice #12345 due next week",
  "body": "Please review and approve the attached invoice..."
}

Response: 200 OK
{
  "category": "Invoices",
  "confidence": 0.94,
  "deadline_date": "2026-03-29T00:00:00Z",
  "days_remaining": 7,
  "urgent": false
}
```

### **Feedback Endpoints**

#### Submit Correction
```http
POST /feedback/corrections
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email_id": 123,
  "correct_category": "Legal",
  "reason": "Model misclassified invoice as general communication"
}

Response: 201 Created
{
  "id": 456,
  "email_id": 123,
  "correct_category": "Legal"
}
```

### **Dashboard Endpoints**

#### User Dashboard
```http
GET /dashboard/user
Authorization: Bearer <access_token>

Response: 200 OK
{
  "total_emails": 250,
  "urgent_emails": 12,
  "upcoming_deadlines": 5,
  "category_distribution": {
    "Invoices": 45,
    "Orders": 35,
    ...
  }
}
```

#### Admin Dashboard
```http
GET /dashboard/admin
Authorization: Bearer <admin_token>

Response: 200 OK
{
  "total_users": 25,
  "total_emails": 5000,
  "urgent_emails": 200,
  "category_distribution": {...}
}
```

### **Health Check Endpoints**

#### Liveness Check
```http
GET /healthz

Response: 200 OK
{"status": "alive"}
```

#### Readiness Check (DB)
```http
GET /readyz

Response: 200 OK
{"status": "ready", "database": "connected"}
```

---

## 🗄️ Database Schema

### **Users Table**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(120) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  gmail_email VARCHAR(255),
  gmail_access_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expiry TIMESTAMP,
  role VARCHAR(20) DEFAULT 'user',  -- 'user' | 'admin'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Emails Table**
```sql
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  email_id VARCHAR(120) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  sender TEXT,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMP,
  category VARCHAR(50),
  confidence FLOAT,
  urgent BOOLEAN DEFAULT FALSE,
  deadline_date TIMESTAMP,
  days_remaining INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  is_processed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email_id, user_id)
);
```

### **Model Corrections Table**
```sql
CREATE TABLE model_corrections (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  predicted_category VARCHAR(50),
  correct_category VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Admin Event Log Table**
```sql
CREATE TABLE admin_event_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100),
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Retraining Runs Table**
```sql
CREATE TABLE retraining_runs (
  id SERIAL PRIMARY KEY,
  model_version VARCHAR(50),
  accuracy_before FLOAT,
  accuracy_after FLOAT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20),  -- 'pending' | 'running' | 'completed' | 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🛠️ Development Workflow

### **ML Model Training**

#### Generate Dataset
```bash
python backend/generate_dataset.py
# Creates: backend/dataset/emails.csv (15,300 synthetic emails)
```

#### Train TF-IDF Model
```bash
python backend/tfidf_train.py
# Saves: backend/tfidf_model.pkl
```

#### Train Baseline Model
```bash
python backend/baseline_model.py
# Outputs: Accuracy scores and classification report
```

#### Train DistilBERT Model
```bash
python backend/train_model.py
# Saves: backend/email_sort_model/tf_model.h5
```

#### Validate Dataset
```bash
python backend/check_dataset.py
# Validates data integrity and outputs statistics
```

#### Extract Deadlines
```bash
python backend/deadline_extraction.py
# Tests deadline extraction on dataset
```

### **MLOps Pipeline**

Run the complete MLOps cycle:
```bash
# PowerShell (Windows)
cd backend/scripts
./run_mlops_cycle.ps1

# Or manually:
python -m backend.mlops.pipeline
```

**Pipeline stages:**
1. Data Loading & Validation
2. Model Training
3. Model Evaluation
4. Registry Update
5. Report Generation

### **Testing**

```bash
# Run all tests
python -m pytest

# Test email fetcher
python backend/test_fetch.py

# Test ML model
python backend/test_ml_model.py

# Test single email classification
python backend/test_single_email.py
```

### **Code Structure Best Practices**

- **Routes:** Keep endpoints in `routes/` folder
- **Models:** Database models in `models.py`
- **Services:** Business logic in separate modules
- **Utilities:** Reusable functions in `auth_utils.py`, etc.
- **Tests:** Unit tests alongside modules

---

## 🚢 Deployment

### **Production Checklist**

- [ ] Set `APP_ENV=production` in `.env`
- [ ] Generate strong `SECRET_KEY`
- [ ] Set `DEBUG=False`
- [ ] Configure `CORS_ALLOW_ORIGINS` with actual domains
- [ ] Update `BACKEND_BASE_URL` and `FRONTEND_BASE_URL`
- [ ] Set up PostgreSQL database
- [ ] Set up Redis instance
- [ ] Configure Gmail OAuth credentials
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Configure backups

### **Docker Compose Deployment**

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Check health
docker compose ps
curl http://localhost:8000/healthz

# View logs
docker compose logs -f backend frontend
```

### **Cloud Deployment Examples**

**Heroku:**
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:standard-0
heroku config:set SECRET_KEY=your-secret-key
git push heroku main
```

**AWS ECS:**
```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag smart-email-backend <account>.dkr.ecr.us-east-1.amazonaws.com/smart-email:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/smart-email:latest

# Deploy via ECS
aws ecs create-service ...
```

**Google Cloud Run:**
```bash
gcloud run deploy smart-email \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=postgresql://...
```

---

## 🐛 Troubleshooting

### **Common Issues**

#### PostgreSQL Connection Error
```
ERROR: connection refused
SOLUTION: Ensure PostgreSQL is running
docker compose up -d db
# or
brew services start postgresql  # macOS
sudo service postgresql start   # Linux
```

#### Redis Connection Error
```
ERROR: Cannot connect to Redis
SOLUTION: Start Redis
docker compose up -d redis
# or
redis-server  # macOS
```

#### Gmail OAuth Redirect URI Mismatch
```
ERROR: Redirect URI mismatch
SOLUTION: Update Google Cloud Console
- Go to OAuth consent screen
- Add redirect URI: https://yourdomain.com/gmail/callback
```

#### Model Not Found
```
ERROR: Model file not found
SOLUTION: Train the model
python backend/tfidf_train.py
python backend/train_model.py
```

#### Frontend API Connection Error
```
ERROR: Cannot connect to API
SOLUTION: Check CORS settings in .env
CORS_ALLOW_ORIGINS should include frontend URL
```

#### Database Migration Issues
```
SOLUTION: Reinitialize database
docker compose down -v
docker compose up -d db
python backend/init_db.py
```

---

## 📝 Development Notes

### **Recent Improvements (March 2026)**

1. **Folder Structure Reorganization**
   - Moved root-level ML scripts to `backend/`
   - Created `backend/dataset/` for data files
   - Created `backend/scripts/` for utility scripts
   - Cleaned up root directory for clarity

2. **MLOps System Enhanced**
   - Model versioning and registry
   - Data validation framework
   - Training pipeline orchestration
   - Artifact management

3. **Deadline Intelligence**
   - Advanced regex-based extraction
   - Multiple date format support
   - Automatic urgency marking
   - Background deadline monitoring

4. **Security Improvements**
   - JWT token refresh mechanism
   - Role-based access control
   - Email verification support (optional)
   - Audit logging

5. **Multi-User Architecture**
   - Complete user isolation
   - Unique email-per-user constraints
   - Admin analytics dashboard
   - Activity tracking

---

## 🤝 Contributing

### **Contribution Guidelines**

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with meaningful commits
3. Add tests for new features
4. Update documentation
5. Submit pull request to `dev` branch

### **Code Standards**

- Follow PEP 8 for Python
- Use type hints where possible
- Write docstrings for functions/classes
- Add unit tests
- Keep components reusable

### **Reporting Issues**

Use GitHub Issues with:
- Clear problem description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Project Lead:** Yaswini Priya ([yaswinipriyas24](https://github.com/yaswinipriyas24))
- **Contributors:** (Add as needed)

---

## 🔗 Useful Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [Celery Documentation](https://docs.celeryproject.io/)
- [Docker Compose Guide](https://docs.docker.com/compose/)
- [spaCy NLP](https://spacy.io/)
- [scikit-learn Documentation](https://scikit-learn.org/)

---

## 📞 Support

For issues, questions, or suggestions:
- 📧 Email: [project contact]
- 🐛 GitHub Issues: [Open an issue](https://github.com/yaswinipriyas24/smartemailsorting/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yaswinipriyas24/smartemailsorting/discussions)

---

**Last Updated:** March 22, 2026  
**Version:** 1.2.0


# Database Models

## Email Model

* id
* email_id (unique per user)
* user_id (Foreign Key)
* sender
* subject
* body
* category
* confidence
* urgent
* deadline_date
* days_remaining
* is_read
* created_at

## User Model

* id
* email
* hashed_password
* role
* gmail_email
* gmail_access_token
* gmail_refresh_token
* gmail_token_expiry

## 🔁 Email Processing Pipeline

```mermaid
flowchart TD
    A[User Clicks Sync] --> B[Fetch Emails from Gmail API]
    B --> C[ML Classification - DistilBERT]
    C --> D[Deadline Extraction Engine]
    D --> E[Urgency Detection Logic]
    E --> F[Store Processed Email in Database]
    F --> G[Display Results in Dashboard]
```


# Installation Guide (End-to-End Setup)

## Step 1 — Clone Repository

```bash
git clone https://github.com/yaswinipriyas24/smartemailsorting.git
cd SMART_EMAIL_SORTING
```

## Step 2 — Backend Setup

### Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate   # Windows
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 3 — Environment Variables

Create `.env` file in root:

```
SECRET_KEY=your_jwt_secret
DATABASE_URL=your_database_url
```

⚠️ Do NOT commit `.env` or `credentials.json`.

## Step 4 — Google OAuth Setup

1. Go to Google Cloud Console
2. Create OAuth Client
3. Download `credentials.json`
4. Place it inside:

```
backend/credentials.json
```

5. Add redirect URI:

```
http://127.0.0.1:8000/gmail/callback
```

## Step 5 — Run Backend

```bash
uvicorn backend.main:app --reload
```

Open:

```
http://127.0.0.1:8000/docs
```

## Step 6 — Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at:

```terminal
http://localhost:3000
```

# Security Considerations

* JWT-based authentication
* Role-based authorization
* Gmail OAuth tokens stored securely
* Sensitive files excluded via `.gitignore`
* Unique email-user constraint prevents duplication

# MLOps Lifecycle (Production-Ready)

This project now includes an in-repo MLOps lifecycle for the TF-IDF production model:

1. Data validation
2. Training
3. Evaluation (accuracy + macro F1)
4. Model registry update (`backend/artifacts/registry.json`)
5. Conditional promotion to production

## Run Full MLOps Cycle

```bash
python -m backend.mlops.pipeline --min-f1 0.60
```

PowerShell helper:

```powershell
./scripts/run_mlops_cycle.ps1
```

Outputs:

* Model artifacts: `backend/artifacts/models/<run_id>/`
* Registry: `backend/artifacts/registry.json`
* Last report: `backend/artifacts/last_mlops_report.json`

## Inference Model Selection

`backend/ml_model.py` now loads the promoted production model from the registry.

Optional env flag:

* `MODEL_BACKEND=tfidf` (default, recommended)
* `MODEL_BACKEND=transformer` (attempts transformer load; falls back to TF-IDF)

# Technologies Used

### Backend

* FastAPI
* SQLAlchemy
* PostgreSQL / Supabase
* TensorFlow
* Transformers (DistilBERT)
* Google Gmail API

### Frontend

* React
* Axios
* React Router
* CSS

# Future Improvements

* Background task queue (Celery)
* Token auto-refresh logic
* Email sentiment analysis
* Real-time notifications
* Power BI dashboard export
* Docker deployment

# Celery + Redis (Async Email Sync)

The project now supports asynchronous Gmail sync using Celery workers backed by Redis.

## Docker services

`docker-compose.yml` includes:

* `redis` (broker/result backend)
* `celery_worker` (executes queued sync tasks)

Start stack:

```bash
docker compose up -d --build
```

## Async API endpoints

Queue sync job:

```http
POST /sync-emails/async?limit=20&clear_db=false
```

Check task status:

```http
GET /sync-emails/tasks/{task_id}
```

States include: `PENDING`, `STARTED`, `SUCCESS`, `FAILURE`.

# Problem Statement Addressed

Traditional email systems rely on:

* Chronological sorting
* Rule-based filters

This system improves by:

* Context-aware classification
* AI-based prioritization
* Deadline intelligence
* Multi-user isolation
* Analytics-driven dashboard


# Project Status

[X] Authentication Complete <br>
[X] ML Classification Complete <br>
[X] Deadline Detection Complete <br>
[X] Gmail OAuth Integrated <br>
[X] profile page <br>
[X] Register Page <br>
[X] Admin Interface <br>
[X] User Interface <br>
[X] Multi-user Architecture Stable <br>
[X] Dashboard Visualization Implemented <br>
[ ] Review Ready


# Developed By
|Name|Reg.No|
|----|------|
|**Indrasena Reddy Bala**|22X41A4210|
|**Bulla Vijay kumar**|22X41A4214|
|**Rajulapati Uday Malleshwar**|22X41A4245|
|**Yaswinipriya Sesetti**|22X41A4247|

AI-ML Department
2022-2026
