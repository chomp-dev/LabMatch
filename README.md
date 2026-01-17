# LabMatch

Swipeable professor discovery + outreach generation for college research.

## Project Overview
LabMatch helps college students discover professors and research opportunities at their college by crawling university/lab pages with an agentic “intent-based” scraper. If the scraper is blocked, LabMatch visually indicates the block and recommends installing the Chrome Extension, which scrapes from the user’s real browser session for higher success rates.

## Architecture
- **Frontend**: React Native (Expo) - Mobile app for students.
- **Backend**: FastAPI - Crawler orchestrator, API, and Extension ingest.
- **Database**: Supabase (Postgres) - Auth, Data, Storage.
- **Extension**: Chrome Extension (Manifest v3) - Fallback for blocked sites.

## Directory Structure
- `/frontend`: React Native Expo application.
- `/backend`: FastAPI Python application.
- `/extension`: Chrome Extension source code.

## Setup Instructions

### Prerequisites
- Node.js & npm
- Python 3.9+
- Supabase Account

### 1. Supabase Setup
- Create a new project on Supabase.
- Run the SQL scripts provided in `/backend/schema.sql` in the Supabase SQL Editor to create tables.
- Get your **Project URL** and **Service Role Key** (or Anon Key depending on RLS).

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt

# Create .env based on .env.example
# MUST set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
cp .env.example .env
```

Run the server:
```bash
uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.

### 3. Chrome Extension Setup
- Open Chrome and navigate to `chrome://extensions`.
- Enable **Developer mode** (toggle in top right).
- Click **Load unpacked**.
- Select the `/extension` folder from this repository.
- Pin the extension to your toolbar.
- The extension communicates with `http://localhost:8000/ingest`. Ensure the backend is running.

### 4. Frontend Setup
```bash
cd frontend
npm install
# Create .env based on .env.example if needed
npx expo start
```
Scan the QR code with your phone (Expo Go app) or run on an emulator.
