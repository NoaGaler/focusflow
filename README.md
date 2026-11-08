# FocusFlow

A learning site that measures attention through the webcam while you watch a YouTube video
(or read a text), and **takes you back to the exact moment you lost focus** ("rewind points").

- **Client:** React + Vite, served by nginx (port 3000). MediaPipe Face Landmarker and the
  attention model (`v4_2.onnx`, onnxruntime-web) run **in the browser**: face data never leaves the computer.
- **Server:** FastAPI (Python), port 8000. Users, content, sessions and scores. `GET /health`.
- **Database:** MongoDB.

## Run

```bash
cp .env.example .env
docker compose up
```

Client: http://localhost:3000 · Health: http://localhost:8000/health · API docs: http://localhost:8000/api/docs

Developers (build from source): `docker compose up --build`

## Development without Docker

```bash
# server
cd server && pip install -r requirements.txt
MONGODB_URI=mongodb://localhost:27017 uvicorn app.main:app --reload --port 8000
# tests (needs MongoDB)
MONGODB_URI=mongodb://localhost:27017 python -m pytest -q tests

# client (forwards /api to localhost:8000)
cd client && npm install && npm run dev
```

## Layout

```
server/            FastAPI app (app/routers: auth, users, content, sessions) + tests
client/            React app; src/focus = camera, MediaPipe, ONNX model, YouTube player
client/nginx/      nginx config: serves the site, forwards /api when API_UPSTREAM is set
submission/        files for the assignment 3 zip
docs/              explanations (Hebrew), PROJECT_INFO answers, cloud guide
.github/workflows  builds and pushes the Docker images (linux/amd64) to Docker Hub
```

Secrets are never committed: `.env` is git-ignored, and in the cloud they come from Secret Manager.
