import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Setup from "./pages/Setup";
import AdminPanel from "./pages/AdminPanel";
import BidView from "./pages/BidView";
import Dashboard from "./pages/Dashboard";
import TeamPage from "./pages/TeamPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/setup" replace />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/bid/:teamId" element={<BidView />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </BrowserRouter>
  );
}
