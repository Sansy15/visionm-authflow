import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import DatasetManager from "@/pages/DatasetManager";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import NotFound from "@/pages/NotFound";
import MainLayout from "@/layouts/MainLayout";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { useProfile } from "@/hooks/useProfile";
import { LoadingState } from "@/components/pages/LoadingState";

// New pages
import { ProjectsPage } from "@/pages/ProjectsPage";
import { TeamMembersPage } from "@/pages/TeamMembersPage";
import { TeamInvitationsPage } from "@/pages/TeamInvitationsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SettingsWorkspacePage } from "@/pages/SettingsWorkspacePage";
import { SettingsBillingPage } from "@/pages/SettingsBillingPage";
import { SettingsUsagePage } from "@/pages/SettingsUsagePage";
import { AccountPage } from "@/pages/AccountPage";
import { AccountProfilePage } from "@/pages/AccountProfilePage";
import { AccountSecurityPage } from "@/pages/AccountSecurityPage";
import { AccountPreferencesPage } from "@/pages/AccountPreferencesPage";
import PredictionPage from "@/pages/PredictionPage";
import PredictionHistoryDetailsPage from "@/pages/PredictionHistoryDetailsPage";
import { saveLastRoute, getLastRoute } from "@/utils/routePersistence";

// Protected routes component - gates routes behind authentication
const ProtectedRoutes = () => {
  const navigate = useNavigate();
  const { sessionReady, user, loading } = useProfile();
  const location = useLocation();
  const hasRestoredRouteRef = useRef(false);

  // Redirect to auth if session is ready but no user
  useEffect(() => {
    if (sessionReady && !user) {
      navigate("/auth", { replace: true });
    }
  }, [sessionReady, user, navigate]);

  // Persist the last visited protected route for resume-on-return behavior
  useEffect(() => {
    if (!sessionReady || !user) return;
    // Only track routes inside the protected app (already enforced by routing),
    // and avoid storing the auth or landing page paths.
    const path = `${location.pathname}${location.search}${location.hash}`;
    saveLastRoute(path);
  }, [sessionReady, user, location.pathname, location.search, location.hash]);

  // On first load after session is ready, if user lands on the generic dashboard,
  // try to restore a more specific last route (e.g. a particular dashboard subpage).
  useEffect(() => {
    if (!sessionReady || !user) return;
    if (hasRestoredRouteRef.current) return;

    if (location.pathname === "/dashboard") {
      const lastRoute = getLastRoute();
      if (lastRoute && lastRoute !== "/dashboard") {
        hasRestoredRouteRef.current = true;
        navigate(lastRoute, { replace: true });
      }
    }
  }, [sessionReady, user, location.pathname, navigate]);

  // Show loading while session is being hydrated
  if (!sessionReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  // Don't render routes if no user (redirect will happen)
  if (sessionReady && !user) {
    return null;
  }

  // Render routes only when session is ready and user exists
  return (
    <Routes>
      {/* App pages with header/sidebar */}
      <Route element={<MainLayout />}>
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Projects */}
        <Route path="/dashboard/projects" element={<ProjectsPage />} />
        
        {/* Prediction */}
        <Route path="/project/prediction" element={<PredictionPage />} />
        <Route path="/project/prediction/history/:inferenceId" element={<PredictionHistoryDetailsPage />} />
        
        {/* Team */}
        <Route path="/dashboard/team" element={<TeamMembersPage />} />
        <Route path="/dashboard/team/members" element={<TeamMembersPage />} />
        <Route path="/dashboard/team/invitations" element={<TeamInvitationsPage />} />
        
        {/* Settings */}
        <Route path="/dashboard/settings" element={<SettingsPage />} />
        <Route path="/dashboard/settings/workspace" element={<SettingsWorkspacePage />} />
        <Route path="/dashboard/settings/billing" element={<SettingsBillingPage />} />
        <Route path="/dashboard/settings/usage" element={<SettingsUsagePage />} />
        
        {/* Account */}
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/profile" element={<AccountProfilePage />} />
        <Route path="/account/security" element={<AccountSecurityPage />} />
        <Route path="/account/preferences" element={<AccountPreferencesPage />} />
        
        {/* Dataset Manager - keep existing routes for backward compatibility */}
        <Route path="/datasets" element={<DatasetManager />} />
        <Route path="/dataset/:id" element={<DatasetManager />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Protected app wrapper - provides ProfileProvider context
const ProtectedApp = () => {
  return (
    <ProfileProvider>
      <ProtectedRoutes />
    </ProfileProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Protected app pages - all routes under /dashboard, /account, /dataset, etc. */}
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
