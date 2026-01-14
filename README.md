# Finance Tracker PWA

A privacy-focused, personal finance tracker built with React and TypeScript that uses your own Google Sheet as the database. Designed to run as a Progressive Web App (PWA) on your mobile device.

## Features

- **Net Worth Tracking**: Visualise your net worth over time.
- **Privacy First**: Data lives in your own Google Sheet. No third-party servers.
- **Google Sheets Integration**: Seamlessly saves transactions and snapshots.
- **Statement Ingestion**:
  - Drag-and-drop parsing for **UOB One** PDF statements.
  - Automatic categorization of income and expenses.
- **Mobile First**: Optimized for install on iOS and Android via "Add to Home Screen".

## Setup

### 1. Google Sheets Setup

Create a new Google Sheet with the following three tabs (case-sensitive):

1.  **Transactions**
    *   Columns (A-H): `ID`, `Date`, `Account ID`, `Type`, `Category`, `Amount`, `Description`, `Tag`
2.  **Accounts**
    *   Columns (A-D): `ID`, `Institution`, `Name`, `Type`
3.  **Snapshots**
    *   Columns (A-C): `Date`, `Account ID`, `Balance`

### 2. Service Account

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a project and enable the **Google Sheets API**.
3.  Create a **Service Account** and generate a JSON key.
4.  **Important**: Share your Google Sheet with the `client_email` found in your JSON key (give "Editor" access).

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
# Paste the ENTIRE content of your JSON key file here (single line)
VITE_GOOGLE_SERVICE_ACCOUNT_KEY='{"type": "service_account", ...}'
```

## Running Locally

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start the development server:
    ```bash
    npm run dev
    ```

3.  Open `http://localhost:5173` in your browser.

## Deployment

To build for production:

```bash
npm run build
```
