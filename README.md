# RetinaGuard AI frontend

React + TypeScript + Vite interface prototype for the RetinaGuard AI research workflow.

## Run locally

1. Install Node.js LTS.
2. From this directory, run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend API root (for example, `http://localhost:8000/api/v1`).
4. Run `npm run dev` and open the URL printed by Vite.

When the API setting is absent or unreachable, the UI does not fabricate a screening result. It shows a connection/setup message. A connected backend must implement the `/health/ready`, `/screenings`, and `/screenings/{screening_id}` contracts in the development plan. API authentication has not yet been implemented in this UI and must be designed before connecting real patient data.

The browser checks the selected file's MIME type and 15 MB limit for convenience. These checks are not security controls; the backend must independently validate the image bytes and enforce upload limits. This UI is a research prototype, not a diagnostic tool.
