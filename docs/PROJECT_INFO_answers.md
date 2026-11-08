# תשובות מוכנות ל-PROJECT_INFO.docx

העתיקו כל תשובה לעמודה "התשובה שלכם" בקובץ ה-Word. מה שמסומן ב-`<<...>>` צריך להשלים.

## פרטים כלליים
| שדה | תשובה |
|---|---|
| project_name | FocusFlow – Rewind |
| authors | `<<email1@grunitech...,email2@...,email3@...>>` |
| one_sentence_description | Watch a YouTube video while the webcam measures your attention in the browser; when focus drops, the site marks the moment and offers to rewind you exactly to where you drifted. |

## תוכן
| שדה | תשובה |
|---|---|
| main_content_type | video |
| what_is_a_content_item | A YouTube video with a title (any youtube.com/watch, youtu.be or shorts link). Also supported: pasted text for reading (scroll-based position). |
| sample_content_type | video |
| sample_content_for_testing | https://www.youtube.com/watch?v=aircAruvnKk |
| interface_language | hebrew |

## טכנולוגיה
| שדה | תשובה |
|---|---|
| backend_framework | FastAPI (Python 3.12) + uvicorn |
| frontend_framework | React 18 + Vite, served by nginx |
| database | MongoDB 7, as a container in Compose with a volume |
| what_is_measured | Attention (the recommended model). Score 0–1 shown as 0–100: below 40 = low focus (red), 40–60 = medium (yellow), 60+ = focused (green). |
| models_used | MediaPipe Face Landmarker (478 points, browser) + v4_2.onnx attention model via onnxruntime-web (browser). Nothing runs on the server. |
| model_highlights | Sliding 10-second window re-scored every 5 seconds; "rewind points" turn score drops into clickable moments in the video; colored attention timeline under the video; verified identical output to Python onnxruntime. |
| changes_to_recommended_api | Same paths and fields. Additions: readings accept optional `level` (model class 0–4); sessions list also returns `content_title`, `content_type`, `ended_at`, `reading_count`. Extra alias `GET /api/health`. Login is rate-limited (429). |

## שימוש באתר
| שדה | תשובה |
|---|---|
| how_to_register | Home page → "הרשמה בחינם" → display name, email, password (8+ chars with a letter and a digit) twice → then log in. |
| what_is_a_session | same |
| how_to_start_a_session | Library → add a YouTube link (title optional) → "התחלת סשן" on the item → "אני מסכים/ה – הפעלת מצלמה והתחלת סשן". The video starts playing. |
| camera_notes | Default camera; if more than one camera exists a selector appears (virtual cameras such as OBS work). Camera turns on only after clicking the consent button; the preview shows the detected face points. |
| where_the_score_appears | Watch screen, right panel: big number 0–100 with a colored bar and label; plus a colored timeline under the video. History → session: chart + average. |
| seconds_until_first_score | 10 (then a new score every 5 seconds) |
| low_focus_reaction | Score below 40: an orange alert "נראה שהריכוז ירד" with a button to rewind the video to 10 seconds before the drop; the moment is added to the "נקודות חזרה" list and marked on the timeline. |
| how_to_end_a_session | "סיום סשן" button (red) → session summary page; also listed under "היסטוריה" with its average score. Leaving the page also ends it. |

## הרצה
| שדה | תשובה |
|---|---|
| run_command | docker compose up |
| setup_notes | Client: http://localhost:3000 · Server: http://localhost:8000/health · API docs: /api/docs. YouTube must be reachable from the browser. First model load takes a few seconds. |

## אבטחה והגנה על נתונים
| שדה | תשובה |
|---|---|
| password_storage | bcrypt (Python `bcrypt` library), cost factor 12, random per-password salt stored inside the hash. The password and the hash are never returned in any response and never logged; responses are built from an explicit field list. |
| password_rules | Minimum 8 characters, at least one letter and one digit, max 72 bytes (bcrypt limit). Checked in the client and enforced again on the server: weak password → 422 with a clear message, nothing is saved. |
| token_handling | JWT (HS256, PyJWT), valid 60 minutes, contains user id, a unique `jti` and a `token_version`. Stored in localStorage, sent as `Authorization: Bearer`. Logout: the `jti` is stored in a revoked-tokens collection (MongoDB TTL index deletes it when it would expire) → token rejected. Expired → 401 and the client goes to the login page. Password change: `token_version` is incremented → all older tokens stop working. |
| access_control | FastAPI dependency `get_current_user` on every protected route: verifies signature + expiry, checks the revoked list, loads the user and compares `token_version`. Missing/invalid/expired/revoked token → 401 `{"detail": ...}`. |
| data_isolation | Every query filters by `user_id` taken from the token, never from the request body (e.g. `find_one({_id, user_id})`). Another user's content or session → 404 "not found", the same as a non-existent id (does not reveal existence). Invalid ids → 404. |
| input_validation | Pydantic schemas with `extra="forbid"`: email (EmailStr), password rules, title 1–200 chars, YouTube links only via a strict regex and normalized to `https://www.youtube.com/watch?v=ID`, text 20–50,000 chars, score 0–1, position ≥ 0. MongoDB queries are built from typed values only (no string concatenation → no injection). XSS: React escapes all text (no `dangerouslySetInnerHTML`); headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy: camera=(self)`. |
| camera_and_face_data | Camera starts only after the explicit consent button. Frames and face landmarks stay in the browser memory (last 10 seconds only) and are never sent or stored. Only the score, the video position and the model level are sent. Stopped and released on session end or when leaving the page. Deleting the account deletes all sessions and scores. |
| secrets_handling | No secrets in code, images or GitHub: values come from environment variables (`.env`, git-ignored and docker-ignored). JWT_SECRET is optional locally (random per start); in the cloud all secrets come from Google Secret Manager. |
| extra_account_security | Brute-force protection: 5 wrong passwords per email → login blocked for 15 minutes (429), stored in MongoDB so it works across server instances. Constant-time-ish login (bcrypt runs even for unknown emails) and one generic error message. Token revocation on logout and on password change. Server runs as a non-root user in Docker. |

## מצב הפרויקט
| שדה | תשובה |
|---|---|
| works_fully | Register, login, logout, profile (rename, change password, delete account), library (YouTube + text, add/delete), sessions with camera + in-browser model, no-face detection, low-focus alert with rewind, attention timeline, history with chart and trend, user isolation, mobile layout |
| partially_works_or_missing | `<<fill in honestly after your own testing>>` |
| known_issues | Scores are a statistical estimate over 10 seconds and can be noisy. Some YouTube videos block embedding; the site shows a clear message. |

## הפרויקט שלכם
| שדה | תשובה |
|---|---|
| plugin | none |
| extra_features | Rewind points (jump back to where focus dropped), colored attention timeline under the video, session chart, attention trend across sessions, text reading content type, profile (name, password, delete), brute-force protection, token revocation |
| what_makes_it_yours | Instead of only measuring attention, FocusFlow acts on it: every drop in focus becomes a clickable "rewind point", so the learner goes back exactly to what they missed, during the session and later from the history. |
