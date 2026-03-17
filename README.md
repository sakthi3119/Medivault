# MediVault — Digital Health Record Manager (Hackathon Build)

This README is written as a **learning + “judge Q&A prep” doc**. You can paste it into Claude/ChatGPT and ask follow-up questions about any section.

## What this project is

**MediVault** is a digital health record manager where:
- A **patient** can **upload** medical records (PDF/image/DOCX) to Cloudinary, store metadata in MongoDB, and browse them in a dashboard + timeline.
- A **patient** can generate **time-limited share links** (tokens) to share selected records (or all records) with a doctor via a **public read-only page**.
- A **doctor** account exists for authentication/roles, but the current UI is primarily patient-focused (timeline/share are patient-only).

## Tech stack (free-tier friendly)

- **Backend**: Node.js + Express, MongoDB Atlas (Mongoose), JWT auth, bcrypt password hashing, Cloudinary storage, Helmet, CORS, Rate limiting
- **Frontend**: React + Vite, Tailwind CSS, React Router, Axios, React Hook Form
- **Design system**: Healthcare “Clinical Refined Dark”
  - Primary: `#0E7490`
  - Background: `#0F172A`
  - Surface: `#1E293B`
  - Accent: `#22D3EE`
  - Fonts: **Instrument Serif** (headings) + **DM Sans** (body)

## Repository structure

```text
mediavault/
  backend/
    src/
      config/        cloudinary upload setup
      controllers/   auth, records, access tokens
      middleware/    JWT auth + RBAC
      models/        User, Record, AccessToken
      routes/        /api/auth /api/records /api/access
      utils/         AppError + asyncHandler + jwt helper
      server.js      Express app bootstrap
  frontend/
    src/
      api/           axios instance + interceptors
      components/    Navbar, ProtectedRoute, RecordCard, UploadModal, BrandPanel
      context/       AuthContext (login/register/logout/me/profile)
      hooks/         useRecords (records/stats/timeline helpers)
      pages/         Login, Register, Dashboard, Timeline, ShareRecords, SharedView, Profile
      utils/         recordTypes constants
```

## Backend implementation (how it works)

### Environment variables

Create `backend/.env` (copy from `.env.example`) and set:
- **`MONGODB_URI`**: MongoDB Atlas connection string (`mongodb://...` or `mongodb+srv://...`)
- **`JWT_SECRET`**: secret string used to sign JWTs
- **`JWT_EXPIRES_IN`**: JWT lifetime (e.g. `7d`)
- **`CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET`**
- **`CLIENT_URL`**: your frontend URL for CORS (local: `http://localhost:5173`)
- **`NODE_ENV`**: `development` or `production`

### Security + platform middleware

Implemented in `backend/src/server.js`:
- **Helmet**: basic security headers
- **CORS**: allows requests from `CLIENT_URL`
- **Rate limiting**
  - Global: **100 requests / 15 minutes**
  - Auth routes: **20 requests / 15 minutes**
  - `/health` is intentionally **not rate-limited** (useful for Render health checks)

### Authentication flow (JWT)

Files:
- `backend/src/middleware/auth.js`
- `backend/src/controllers/authController.js`

How it works:
- On **register/login**, backend returns `{ token, user }`
- Frontend stores token in `localStorage`
- Axios interceptor sends: `Authorization: Bearer <token>`
- Backend middleware `protect()`:
  - extracts Bearer token
  - verifies signature via `JWT_SECRET`
  - loads the user from MongoDB
  - attaches `req.user`
- RBAC:
  - `restrictTo("patient")` / `restrictTo("doctor")`
  - shortcuts: `patientOnly`, `doctorOnly`

### Data models (Mongoose)

#### `User`
Path: `backend/src/models/User.js`
- Fields: `name, email, password, role(patient|doctor), specialization, dateOfBirth, bloodGroup, phone, address, isActive`
- Password:
  - **hashed** using bcrypt in a pre-save hook
  - excluded from queries by default (`select: false`)
- Methods:
  - `comparePassword(candidate)`
  - `toJSON()` removes `password`

#### `Record`
Path: `backend/src/models/Record.js`
- Linked to patient: `patient` → `User`
- Fields include:
  - metadata: `title, type, description, doctorName, hospitalName, recordDate, tags[]`
  - file info: `fileUrl, filePublicId, fileName, fileSize, mimeType`
  - `isArchived`
- `type` enum matches the hackathon spec (`Lab Report`, `Prescription`, etc.)

#### `AccessToken` (share link)
Path: `backend/src/models/AccessToken.js`
- Fields:
  - `patient`, `token` (uuid), `recordIds[]`, `allRecords`
  - optional: `doctorEmail`, `label`
  - lifecycle: `expiresAt`, `usedAt`, `isRevoked`, `accessCount`
- Method:
  - `isValid()` checks: not revoked + not expired

### Cloudinary upload flow

Path: `backend/src/config/cloudinary.js`
- Uses `multer` + `multer-storage-cloudinary`
- Accepts: **JPG/PNG/PDF/DOCX**
- Max size: **10MB**
- Folder: `mediavault/{userId}`

What happens on upload:
1. Patient calls `POST /api/records` with `multipart/form-data`
2. Multer uploads file to Cloudinary
3. Controller creates a `Record` with:
   - `fileUrl`: Cloudinary URL
   - `filePublicId`: Cloudinary public id (used for delete)

### API endpoints (implemented)

#### Auth
- `POST /api/auth/register`
  - validates doctor requires `specialization`
  - creates user + returns JWT
- `POST /api/auth/login`
  - checks password via bcrypt
  - returns JWT + user
- `GET /api/auth/me` (protected)
- `PUT /api/auth/profile` (protected)

#### Records (patient-only behavior enforced in controller)
- `GET /api/records`
  - filters: `type`, `search`, `archived`
  - pagination: `page`, `limit`
  - sorting: `sort` (default `-recordDate`)
- `GET /api/records/:id`
- `POST /api/records` (multipart with `file`)
- `PUT /api/records/:id` (metadata only)
- `DELETE /api/records/:id`
  - deletes DB record
  - also attempts Cloudinary delete using `filePublicId`
- `GET /api/records/timeline`
  - groups records by **year → month**
- `GET /api/records/stats`
  - aggregates counts by `type`
  - returns `recent` last 5 by date

#### Access / sharing
- `GET /api/access/shared/:token` (**PUBLIC**)
  - validates token exists + not expired + not revoked
  - returns:
    - patient privacy: **first name only**
    - record list
  - increments `accessCount`, sets `usedAt` on first access
- `POST /api/access` (protected)
  - creates new share token (uuid)
  - supports **allRecords** or specific `recordIds[]`
  - expiry via `expiresIn` (supports `1h`, `24h`, `7d`, etc.)
- `GET /api/access` (protected) list tokens
- `PATCH /api/access/:token/revoke` (protected)

### Error handling style

- Uses `AppError` for friendly operational errors
- Global handler returns `{ message }` (no stack traces to the client)

## Frontend implementation (how it works)

### Environment variables

Create `frontend/.env` (copy from `.env.example`) and set:
- **`VITE_API_URL`**: backend URL
  - local: `http://localhost:5000`
  - Render: `https://<your-service>.onrender.com`

### Axios instance + auth interceptors

Path: `frontend/src/api/axios.js`
- Request interceptor:
  - reads token from `localStorage`
  - sets `Authorization: Bearer <token>`
- Response interceptor:
  - on **401**, clears `token` + `user`
  - redirects to `/login`

### Auth state management

Path: `frontend/src/context/AuthContext.jsx`
- Stores `token` + `user` in state and mirrors them to `localStorage`
- Methods:
  - `login(email, password)`
  - `register(data)`
  - `logout()`
  - `refreshMe()` (calls `/api/auth/me`)
  - `updateUser(data)` (calls `/api/auth/profile`)

### Routing + role-based access

Path: `frontend/src/App.jsx`
- `/login`, `/register` public
- `/shared/:token` public (read-only)
- Protected routes (must be logged in): `/dashboard`, `/profile`
- Patient-only: `/timeline`, `/share`

Implementation:
- `ProtectedRoute` uses auth context and optional `roles` prop.

### Pages (what each does)

- **Login** (`src/pages/Login.jsx`)
  - split-screen layout + brand panel
  - uses `react-hook-form`
  - on success → `/dashboard`
- **Register** (`src/pages/Register.jsx`)
  - role toggle Patient/Doctor
  - specialization field required if Doctor
  - on success → `/dashboard`
- **Dashboard** (`src/pages/Dashboard.jsx`)
  - shows stats bar (total + top type counts)
  - filter chips by record type + search input
  - record grid using `RecordCard`
  - floating + button opens `UploadModal`
- **Upload modal** (`src/components/UploadModal.jsx`)
  - drag & drop file upload
  - builds `FormData` and posts to `/api/records`
  - shows upload progress
- **Timeline** (`src/pages/Timeline.jsx`)
  - fetches `/api/records/timeline`
  - year collapsible sections
  - month group listing
  - uses `IntersectionObserver` reveal animations
- **ShareRecords** (`src/pages/ShareRecords.jsx`)
  - lists existing tokens (active/expired) with copy link + revoke
  - create new share link:
    - “All records” toggle
    - select records if not all
    - optional doctor email + label
    - expiry dropdown (1h/6h/24h/48h/7d)
- **SharedView** (`src/pages/SharedView.jsx`)
  - public page that calls `/api/access/shared/:token`
  - read-only grid, with “expires in” countdown
  - shows proper error state if expired/revoked
- **Profile** (`src/pages/Profile.jsx`)
  - edit name/phone/address/bloodGroup/dob
  - shows simple stats for patient (total records + last record date)

## End-to-end workflow (the main demo story)

### 1) Patient signs up
1. Open frontend → Register as Patient
2. Backend creates user, returns JWT
3. Frontend stores token + user locally

### 2) Patient uploads a record
1. Dashboard → click “+”
2. UploadModal sends `multipart/form-data` to `POST /api/records`
3. Backend uploads file to Cloudinary, saves record metadata in MongoDB
4. Dashboard refreshes list + stats

### 3) Patient views timeline
1. Timeline page calls `GET /api/records/timeline`
2. Backend aggregates + groups by year/month
3. UI renders collapsible years with animated nodes

### 4) Patient shares records via a link
1. Share page → choose “all records” or select a few
2. Choose expiry duration
3. Frontend calls `POST /api/access`
4. Backend creates a uuid token in MongoDB with expiry
5. Frontend shows link: `/shared/<token>`

### 5) Doctor opens the public link
1. No login required
2. SharedView calls `GET /api/access/shared/:token`
3. Backend validates token, returns patient first name + records
4. Token `accessCount` increments; UI shows expiry countdown

## How to run locally

### Backend
Copy `backend/.env.example` → `backend/.env` and fill env vars.

```bash
cd mediavault/backend
npm install
npm run dev
```

Health check:
- `GET http://localhost:5000/health`

### Frontend
Copy `frontend/.env.example` → `frontend/.env`.

```bash
cd mediavault/frontend
npm install
npm run dev
```

Open:
- `http://localhost:5173`

## Deployment summary (free tier)

- **MongoDB Atlas (M0)**:
  - whitelist `0.0.0.0/0` for Render (hackathon-only convenience)
- **Cloudinary**:
  - put credentials in backend env vars on Render
- **Backend (Render)**:
  - build: `npm install`
  - start: `node src/server.js`
- **Frontend (Vercel)**:
  - set `VITE_API_URL` to Render backend URL

## Judge Q&A cheat-sheet (short answers)

- **How do you secure records?**
  - Records are protected by JWT auth; only the patient who owns a record can fetch/update/delete it. Passwords are hashed (bcrypt). Share links are time-limited and revocable.

- **What happens when a patient uploads a file?**
  - File is uploaded to Cloudinary via multer storage; DB stores metadata + Cloudinary URL/public id. Deleting a record removes it from DB and attempts Cloudinary deletion.

- **How does sharing work?**
  - A share token (uuid) is created with expiry. The public endpoint validates token, returns records, and increments access count. Patient can revoke anytime.

- **How do you prevent unauthorized access to tokens?**
  - Tokens are random UUIDs, expire automatically, and can be revoked. The endpoint does not require auth, but it enforces validity checks and returns minimal patient identity.

- **What if the user’s JWT expires?**
  - Backend returns 401; frontend interceptor clears storage and redirects to login.

- **Why Cloudinary instead of storing files in MongoDB?**
  - MongoDB is better for metadata; Cloudinary handles file storage/delivery efficiently and keeps DB smaller.

---

If you want, tell me the exact hackathon rubric (security / UX / innovation / scalability), and I’ll add a “why this architecture” section and a 2-minute demo script.

