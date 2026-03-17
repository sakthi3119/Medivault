import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Navbar } from "./components/Navbar.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Timeline from "./pages/Timeline.jsx";
import ShareRecords from "./pages/ShareRecords.jsx";
import SharedView from "./pages/SharedView.jsx";
import Profile from "./pages/Profile.jsx";

function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-background text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/shared/:token" element={<SharedView />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <AppShell>
              <Dashboard />
            </AppShell>
          }
        />
        <Route
          path="/profile"
          element={
            <AppShell>
              <Profile />
            </AppShell>
          }
        />
      </Route>

      <Route element={<ProtectedRoute roles={["patient"]} />}>
        <Route
          path="/timeline"
          element={
            <AppShell>
              <Timeline />
            </AppShell>
          }
        />
        <Route
          path="/share"
          element={
            <AppShell>
              <ShareRecords />
            </AppShell>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

