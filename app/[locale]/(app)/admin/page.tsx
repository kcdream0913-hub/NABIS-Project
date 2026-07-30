import AdminDashboard from "./dashboard";

// Admin access is enforced upstream — the middleware redirects a signed-in
// non-admin (and a logged-out visitor to /login) before this renders, and
// admin/layout.tsx repeats the check as a fail-closed second layer. This page
// only renders the dashboard.
export default function AdminPage() {
  return <AdminDashboard />;
}
