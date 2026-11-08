# How FocusFlow works

A full walkthrough of the project, so every team member can understand and explain each part.

## 1. The idea

The user watches a YouTube video (or reads a text) while the webcam measures how focused they are.
Our twist is **rewind points**: when focus drops, the site does not just show an alert. It remembers the moment
the user started to drift and offers a "Rewind to 3:42" button. A colored bar under the video (green / yellow / red)
shows where the user was focused. At the end there is a chart and a list of parts worth watching again.

## 2. Architecture

```
Browser
 ├─ camera → MediaPipe (478 face points, 10 times per second)
 ├─ window of 100 frames (10 s) → v4_2.onnx model → score 0..1   (all in the browser!)
 └─ sends to the server only: { position: time in the video, score }
        │  /api/...
        ▼
 nginx (client container, port 3000) ──/api──► FastAPI (server container, port 8000) ──► MongoDB
```

* **3 containers:** `client` (nginx serving the React build), `server` (FastAPI) and `mongo`.
* The client always calls the relative address `/api`. In Docker, nginx forwards it to the server.
  In the cloud (assignment 4) the Load Balancer does the same. So the same code works in both places, unchanged.

## 3. A session, step by step

| # | What happens | Where in the code |
|---|---|---|
| 1 | User clicks "I agree – turn on camera and start session" | `client/src/pages/Watch.jsx` → `startSession` |
| 2 | The browser asks for camera permission (`getUserMedia`) | `client/src/focus/useFocusTracker.js` → `start` |
| 3 | MediaPipe and the model are loaded (once) | `focus/landmarker.js`, `focus/model.js` |
| 4 | The server opens a new session | `POST /api/sessions` → `server/app/routers/sessions.py` |
| 5 | Every 100 ms: MediaPipe extracts 478 points (x, y, z) from the frame; the last 100 frames are kept | `useFocusTracker.js` → `frameTimer` |
| 6 | Every 5 s: if at least half the window has a face, the model runs; otherwise "No face detected" | `runModel` |
| 7 | The model returns a raw 0–1 score; it is calibrated and shown as 0–100 with a color | `focus/calibration.js`, `components/ScoreCard.jsx` |
| 8 | Score + video time are sent to the server and stored | `POST /api/sessions/{id}/readings` |
| 9 | A score below 0.4 after a normal one creates a rewind point (10 s before the reading) | `Watch.jsx` → `onScore`, `utils.js` → `findDriftPoints` |
| 10 | "End session": the server closes it and computes the average; the user sees the summary | `POST /api/sessions/{id}/end`, `pages/SessionDetail.jsx` |

**Why 10 seconds back?** Each score describes the 10 seconds before it (100 frames), so the drop
started roughly 10 seconds before the low reading.

## 4. The model

* File: `client/public/models/v4_2.onnx`. Input shape `[1, 100, 478, 3]`. Outputs:
  * `regression_scores`: attention 0–1. This is what we use.
  * `classification_logits`: 5 levels. Stored as `level`, not displayed.
  * `attention_weights`: weight per frame. Not used yet (an idea for the final project).
* We verified the browser returns **exactly** the same score as Python onnxruntime (`0.34063` on the same input), in about 30 ms.
* **Input format (important finding).** The model starts with a per-frame normalization (LayerNorm over all
  1434 numbers), so it ignores overall size, but NOT where the face is. We tested three formats:
  * `raw` (points relative to the whole camera frame) and `crop` (relative to a square face crop) kept the
    score stuck at about 13-22, whatever the user did.
  * `nose`: the face crop, then every point minus the nose tip (point 1). Only this one reacts to head pose,
    so it is what we use (`client/src/focus/normalize.js`).
  We found this by building a synthetic face from MediaPipe's canonical face mesh, rotating it (straight /
  turned / looking down), and running the model in Python; then confirmed with real webcam sessions.
  Open `/watch/<id>?debug=1` to see all three side by side.
* **Calibration.** Even with the right input, the model's raw score stays in a narrow range (about 0.2-0.6),
  because it was trained on labels like 0.30 / 0.50 / 0.70 and pulls toward the middle. Real tests gave:
  focused 0.46, looking down 0.35, head turned 0.30. `client/src/focus/calibration.js` stretches this range to
  0-100 for display (0.46 → 82, 0.35 → 35, 0.30 → 20). Both values are saved: `score` (shown) and `raw_score`.
  Labels: below 40 = low focus (alert), 40-65 = medium, 65+ = focused.
* **Why v4_2?** It is the recommended model, and it has both the 5-level classification and attention weights.
  Limitation: it is a statistical estimate, so a single score can be noisy. That is why we show trends and
  rewind points instead of reacting harshly to one reading.

## 5. File map

```
server/app/
  main.py          app setup, error format ({"detail": ...}), /health
  config.py        all settings from environment variables (MONGODB_URI, JWT_SECRET...)
  db.py            MongoDB connection and indexes
  security.py      bcrypt for passwords, JWT for tokens
  deps.py          get_current_user: checks the token on every protected request
  schemas.py       input validation (pydantic): email, password, YouTube link...
  serialize.py     JSON output (allowed fields only, never the password hash)
  routers/         auth.py, users.py, content.py, sessions.py
server/tests/      8 tests covering the whole API, including user isolation
client/src/
  api.js           all server calls + 401 handling
  auth.jsx         login state (token kept in localStorage)
  focus/           camera, MediaPipe, model, YouTube player
  pages/           Home, Login, Register, Library, Watch, History, SessionDetail, Profile
  components/      FocusTimeline (colored bar), FocusChart (chart), ScoreCard
client/nginx/      nginx config (including forwarding /api to the server)
```

## 6. Security (summary; details in PROJECT_INFO)

* **Passwords:** bcrypt, random salt per password, cost 12. The hash is never returned.
* **Token:** JWT (HS256), valid 60 minutes. Each token has a unique id (`jti`):
  * **Logout** puts the token on a revoked list in the DB (auto-deleted when it would expire anyway).
  * **Password change** increments `token_version`, so every older token stops working.
* **Brute-force protection:** 5 wrong passwords for one email → login blocked for 15 minutes.
  bcrypt runs even for unknown emails, so response time does not reveal who is registered.
* **Data isolation:** every query filters by the `user_id` from the token, never from the request body.
  Another user's item returns 404, as if it does not exist.
* **XSS:** React renders text as text and never runs pasted HTML. Only YouTube links are accepted, normalized.
* **Privacy:** camera images never leave the browser. Only numbers are sent to the server.

## 7. Decisions you will be asked about

| Question | Our answer |
|---|---|
| Why run the model in the browser, not the server? | Privacy (face data stays on the device), a light and cheap server, and no server load per user. |
| Why MongoDB? | A session with its list of readings fits naturally in one document; Atlas has a free tier for the cloud. |
| Why FastAPI? | Automatic input validation, docs at `/api/docs`, and it is the assignment's recommendation. |
| What if there is no face? | If fewer than half of the 100 frames have a face, the model is not run and "No face detected" is shown. |
| Why does the score not reach 100? | The model was trained on labels such as 0.70 = engaged and its raw output stays in a narrow range, so we calibrated the display from real tests and keep the raw value too. |
| Why every 5 seconds and not 10? | A sliding window: always the last 10 seconds, but updating more often reacts faster. |
| What is a session? | One viewing of an item: it starts at the consent click and ends with "End session" or when leaving the page. |
