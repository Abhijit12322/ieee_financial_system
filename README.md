# IEEE Event Expenses & Bookkeeping Manager

A modern, high-performance financial management web application built for IEEE Student Branches. Features real-time financial tracking, multi-layer host security verification, automated data logging, and seamless synchronization with Google Sheets and Neon PostgreSQL.

---

## 🏛️ System Architecture

The application adopts a **Decoupled Serverless Hybrid Architecture** designed for security, scalability, and ease of maintenance:

1. **Frontend Layer (React + Vite + Vanilla CSS)**: Single Page Application deployed on Vercel delivering a modern glassmorphic interface with reactive state management.
2. **Authentication & Security API (Vercel Serverless `/api/auth`)**: Handles user registration, SHA-256 passcode hashing, 2FA code generation, and session logging.
3. **Database Layer (Neon PostgreSQL)**: Serverless relational database holding user accounts, encrypted credentials, security parameters, and 60-day audit logs.
4. **Notification Gateway (Nodemailer + Gmail SMTP)**: Dispatches 6-digit authorization codes exclusively to the designated **Host Email**.
5. **Spreadsheet Engine (Google Apps Script `Code.gs`)**: Coordinates real-time reads and writes between the web app and Google Sheets for event expense and bookkeeping ledgers.

---

### 1. High-Level Component Topology

```mermaid
graph TD
    User([User Browser]) -->|HTTPS / UI Interactions| ReactApp[React SPA - Vercel]
    
    subgraph Authentication & Security System
        ReactApp -->|Auth Requests| VercelAPI[Vercel Serverless Function: /api/auth]
        VercelAPI -->|SQL Queries| NeonDB[(Neon PostgreSQL Database)]
        VercelAPI -->|SMTP TLS Port 587| GmailSMTP[Gmail SMTP Server]
        GmailSMTP -->|Dispatches 6-Digit OTP| HostEmail([Master Host Email Inbox])
    end
    
    subgraph Financial Spreadsheet Engine
        ReactApp -->|REST GET / POST| AppsScript[Google Apps Script: Code.gs]
        AppsScript -->|Read / Write Ledger Data| GoogleSheets[(Google Sheets Databases)]
    end
```

---

### 2. Registration & Host Authorization Sequence Flow

When a new user creates an account, access is held in a pending state (`is_verified = FALSE`) until the Host inputs the 6-digit verification code sent to their email inbox:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as Vercel Function (/api/auth)
    participant DB as Neon PostgreSQL
    participant SMTP as Gmail SMTP Server
    actor Host as Master Host Inbox

    User->>API: 1. Submit Registration (Email, Passcode, Security Question)
    API->>API: 2. Hash Passcode using SHA-256
    API->>DB: 3. Upsert User (is_verified = FALSE, OTP = random 6-digit)
    API->>SMTP: 4. Dispatch Email with OTP Code to HOST_EMAIL
    SMTP-->>Host: 5. Host Receives 6-Digit Verification Code
    API-->>User: 6. Prompt User for 6-Digit Authorization Code
    User->>Host: 7. Obtain 6-Digit Code from Host
    User->>API: 8. Submit Verification Code
    API->>DB: 9. Verify OTP & Expiry (Update is_verified = TRUE)
    DB-->>API: 10. Verification Confirmed
    API-->>User: 11. Complete Registration & Unlock Dashboard
```

---

### 3. Financial Spreadsheet Synchronization Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant AppsScript as Google Apps Script (Code.gs)
    participant Sheets as Google Sheets

    User->>AppsScript: 1. Request Event Expenses / Bookkeeping Data
    AppsScript->>Sheets: 2. Query Sheet Tabs (Expenses, Withdraws, Incomes)
    Sheets-->>AppsScript: 3. Return Raw Cell Matrices
    AppsScript-->>User: 4. Respond with JSON Formatted Ledger Items
    User->>AppsScript: 5. Save Modified Expense Row
    AppsScript->>Sheets: 6. Update Corresponding Sheet Cells & Calculate Totals
    Sheets-->>User: 7. Confirm Real-Time Sync Success
```

---

### 4. Database Relational Schema (ERD)

```mermaid
erDiagram
    USERS {
        VARCHAR_255 email PK "Primary Key"
        VARCHAR_255 passcode "SHA-256 Hashed Credential"
        VARCHAR_255 security_question "Recovery Question"
        VARCHAR_255 security_answer "Recovery Answer"
        VARCHAR_10 otp_code "Temporary 6-Digit Code"
        VARCHAR_50 otp_expiry "Timestamp (10-Min Expiry)"
        BOOLEAN is_verified "Authorization Flag"
    }

    LOGIN_LOGS {
        SERIAL id PK "Primary Key"
        VARCHAR_255 email "User Email"
        VARCHAR_50 action "Login / Logout"
        VARCHAR_50 timestamp "GMT+5:30 Timestamp"
    }

    YEARLY_SPREADSHEETS {
        SERIAL id PK "Primary Key"
        VARCHAR_20 year "Season Year"
        VARCHAR_50 module_type "Module Identifier"
        VARCHAR_255 spreadsheet_id "Spreadsheet ID"
        TEXT spreadsheet_url "Spreadsheet URL"
        VARCHAR_50 created_at "Creation Timestamp"
    }

    USERS ||--o{ LOGIN_LOGS : "logs activity for"
```

---

## 🔒 Security Model & Features

- **Host Gatekeeper Verification**: Registration requires explicit Host authorization via a 6-digit code. No code is ever sent to standard user inboxes.
- **SHA-256 Passcode Encryption**: All passcodes are hashed prior to storage in the relational database.
- **Direct Authorized Logins**: Once an account is authorized by the Host, subsequent logins proceed directly without secondary verification steps.
- **Automated 60-Day Log Pruning**: Serverless routines automatically purge entries in `login_logs` older than 60 days to preserve privacy and conserve storage.

---

## ⚙️ Environment Variables Reference

Copy `.env.example` to `.env` for local development. Configure these variables in your **Vercel Project Settings**:

```env
# Google Apps Script Web App URL (deployed from Code.gs)
VITE_GAS_URL=https://script.google.com/macros/s/your-deployment-id/exec

# Default Book Keeping Spreadsheet ID (fallback for Yearly Book Keeping module)
VITE_BOOKKEEPING_SS_ID=your-spreadsheet-id-for-book-keeping

# Neon Database Connection String (Direct SQL link for Vercel API)
DATABASE_URL=postgresql://neondb_owner:password@ep-host.neon.tech/neondb?sslmode=require

# Host Email (Receives all 2FA registration authorization codes)
HOST_EMAIL=host@example.com

# Direct Gmail SMTP Transporter Parameters
SENDER_EMAIL=your-sender-gmail-account@gmail.com
SENDER_PASSWORD=your-16-char-google-app-password
```

---

## 🚀 Installation & Deployment Guide

### 1. Neon PostgreSQL Database Setup
1. Create a PostgreSQL database instance on [Neon.tech](https://neon.tech/).
2. Copy your connection URI (`postgresql://...`).

### 2. Google Apps Script Setup
1. Open your Google Sheet, navigate to **Extensions** ➔ **Apps Script**.
2. Replace code with `Code.gs`and `appsscript.json`.
3. Select **Deploy** ➔ **New deployment** (Type: `Web app`, Execute as: `Me`, Access: `Anyone`).
4. Copy the Web App URL.

### 3. Vercel Deployment
1. Push this repository to GitHub.
2. Import into [Vercel](https://vercel.com).
3. Add the required Environment Variables under **Project Settings**.
4. Trigger Deployment.
