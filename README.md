# ScalperBlock Demo

Run the demo backend and frontend locally.

Prerequisites
- Node.js (v16+)

Install dependencies and start:

```bash
npm install
npm start
```

By default the server runs on `http://localhost:3000` and serves the frontend from `public/`.

Environment
- `SB_SECRET` — optional JWT secret (defaults to `dev-secret-key`)
- `SB_ADMIN_EMAIL` — optional admin email; that account can approve/reject stores via the admin API

Notes
- This demo stores data in `data/users.json` and `data/stores.json` (file-based). For production use a database.

Developer
- after cloning, run `npm install` to install deps (including `nodemon` as a dev dep). Use `npm run dev` during development.
