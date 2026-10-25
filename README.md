# catotag

catotag is a web application for tagging key moments of a football match in real time and exporting them as an XML timeline that video editing and analysis software can import directly.

It is designed for match analysts who record a match on camera. While the recording runs, the analyst follows a match clock in the application and taps predefined tag buttons such as *Goal* or *Offside*. Each tap stores a clip window around that moment, for example from 15 seconds before the tap to 10 seconds after it. When the match is over, the exported XML file provides a complete, labelled timeline of the match, so the highlight edit can be produced without searching through the footage by hand.

## How it works

1. **Define tags.** On the *Tags* page, create the tags you need. Each tag has a name, a color, a group and an optional clip window (seconds before and after the tap).
2. **Design the button layout.** Arrange the tag buttons on a free-form grid, similar to a Sportscode code window. Buttons can be moved and resized, and the column count can be adjusted.
3. **Tag the match.** On the *Match* page, start the clock together with the recording and tap a tag button whenever the corresponding event happens.
4. **Export.** Enter the team names and download the XML file. On mobile devices the system share sheet is offered, so the file can be sent directly to cloud storage, e-mail or another application.

## Features

### Tagging
- Match clock based on wall-clock time. The elapsed time stays correct when the browser tab is in the background, the screen is locked or the page is reloaded.
- Large, touch-friendly tag buttons showing each tag's clip window.
- Clip window per tag, with a configurable default for tags that do not define their own.
- Immediate feedback on every tap: vibration (on supported devices), a visual highlight and a notification with an *Undo* action.
- List of tagged moments with a compact timeline. Any entry can be deleted, and deletions can be undone.
- The screen stays on while the clock is running (Screen Wake Lock API; requires HTTPS).

### Tags and layout
- Free-form button grid with drag-to-move, resize handles, width and height steppers and an adjustable column count (2 to 8).
- Overlapping buttons are prevented. Tags without an explicit position are placed automatically, with each group starting on a new row.
- Presets store a complete tag set together with its layout and can be applied at any time.

### Reliability
- Offline-first: all data is stored on the device and the application works without a network connection.
- The current match is saved automatically after every change and restored when the application is reopened.

### Accounts and cloud backup (optional)
- Users can create an account to back up their tags, layout, default clip window, presets and matches.
- Changes are uploaded in the background. When the device is offline, changes are queued and uploaded once the connection returns.
- Signing in on another device restores the data. If the same settings were changed on two devices, the user chooses which version to keep.
- Every match is stored separately, and the XML of any saved match can be downloaded from the *Account* page.
- Users can permanently delete their account and all associated data.

## Export format

The exported file follows the timeline schema used by common video analysis tools. Each tagged moment becomes one `instance`, with start and end times in seconds from the start of the match:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<file>
  <SORT_INFO>
    <sort_type>sort order</sort_type>
  </SORT_INFO>
  <ALL_INSTANCES>
    <instance>
      <ID>0</ID>
      <code>GOAL</code>
      <start>1335.000</start>
      <end>1360.000</end>
      <label>
        <group>Event</group>
        <text>GOAL</text>
      </label>
    </instance>
  </ALL_INSTANCES>
</file>
```

Files are named after the teams and the date, for example `HOME_vs_AWAY_2026-10-25.xml`.

## Architecture

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, Tailwind CSS (Create React App) | User interface, tagging, local storage, XML generation, background synchronisation |
| Backend | FastAPI, SQLAlchemy | User accounts, authentication, storage of settings and matches |
| Database | SQLite (development) or PostgreSQL (production) | Persistent storage for accounts and backups |

The frontend is fully functional without the backend. The backend is only used for accounts and cloud backup.

### Project structure

```
backend/
  main.py            Application setup, CORS and security headers
  config.py          Configuration loaded from environment variables / .env
  auth.py            Password hashing, JWT issuing and validation, login throttling
  routers.py         User registration, profile and account deletion
  sync.py            Settings and match backup endpoints
  models.py          Database models
  tests/             API and security tests (pytest)
frontend/
  src/pages/         Match, Tags and Account pages
  src/components/    Layout editor, icons and shared UI elements
  src/lib/           Storage, synchronisation, API client, layout and XML helpers
```

## Getting started

### Requirements
- Node.js 18 or later
- Python 3.10 or later

### Backend

```bash
cd backend
cp .env.example .env              # then set SECRET_KEY (see below)
python3 -m venv venv
venv/bin/pip install -r requirements-dev.txt
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

A suitable `SECRET_KEY` can be generated with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm start
```

The application is then available at `http://localhost:3000`. If `REACT_APP_API_URL` is not set, the frontend connects to port 8000 on the host that served the page. This allows a phone on the same local network to use the application at `http://<computer-ip>:3000` during development.

### Tests

```bash
cd backend
venv/bin/python -m pytest tests
```

## Configuration

Configuration is read from environment variables. During development they can be placed in `backend/.env` and `frontend/.env.local`. These files are excluded from version control; templates are provided as `.env.example`.

### Backend

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(required)* | Key used to sign access tokens. The backend does not start without it. |
| `DATABASE_URL` | `sqlite:///./catotag.db` | Database connection. Example for PostgreSQL: `postgresql+psycopg://USER:PASSWORD@HOST:5432/catotag` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Session lifetime in minutes. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of frontend origins allowed to call the API. |
| `CORS_ORIGIN_REGEX` | *(empty)* | Optional pattern for additional origins, intended for local network development only. |
| `ENABLE_DOCS` | `true` | Enables the interactive API documentation at `/docs`. |
| `SQL_ECHO` | `false` | Logs every SQL statement. |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | Same host as the page, port 8000 | Base URL of the backend. Required in production. |

Frontend variables are embedded in the build and visible to users. They must not contain secrets.

## Security

- **Passwords** are hashed with bcrypt and are never stored or logged in plain text.
- **Authentication** uses JSON Web Tokens signed with `SECRET_KEY`. Forged and expired tokens are rejected.
- **Data isolation:** every request identifies the user from the access token only. Matches are stored per user, so one user can never read, modify or delete another user's data.
- **Brute-force protection:** after five failed sign-in attempts for the same IP address and username within 15 minutes, further attempts are refused for the rest of that period. Response times do not reveal whether a username exists.
- **Input validation and limits:** registration data is validated, and request sizes are limited (512 KB for settings, 2 MB per match, 1,000 matches per user).
- **Transport and browser policies:** CORS is restricted to the configured origins, API responses are not cached, and standard security headers are set.
- **Account deletion** requires the password and permanently removes the account together with all of its data.

These guarantees are covered by the automated tests in `backend/tests/test_api.py`.

## Deployment

Before deploying to production:

- Serve both the frontend and the backend over **HTTPS**. This protects credentials and tokens in transit and is also required for the screen wake lock and the share sheet.
- Generate a new `SECRET_KEY` for production and never reuse the development key.
- Use a persistent, backed-up PostgreSQL database. SQLite is intended for local development only.
- Set `ENABLE_DOCS=false`, leave `CORS_ORIGIN_REGEX` empty and set `CORS_ORIGINS` to the production frontend address only.
- Set `REACT_APP_API_URL` to the public backend address when building the frontend.
- Sign-in throttling is kept in the memory of a single process. When running several backend instances, move it to a shared store such as Redis.
- Access tokens are kept in the browser's local storage. Do not load third-party scripts into the application.

## History

The first version of this project was a Flask prototype. It is preserved in the Git history.
