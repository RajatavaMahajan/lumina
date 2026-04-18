<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d53a56d4-f638-4355-940d-9821592df68f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   `APP_AUTH_USERNAME=your_username`
   `APP_AUTH_PASSWORD=your_password`
   `APP_PORT=3001`
3. Run the app (web + API):
   `npm run dev`
4. Open the app at `http://localhost:5173`

## Persistent Shared Storage

This app now stores data on the server in `data/store.json`.

- Any browser/device that logs in with the same credentials will see the same data.
- Login uses HTTP Basic Auth (name + password).
- To ship with your own preloaded data, edit `data/store.json` before delivery.
- API runs on `http://localhost:3001` by default.
