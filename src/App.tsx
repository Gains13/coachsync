import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import ClientDashboard from "./pages/ClientDashboard";
import ClientPlan from "./pages/ClientPlan";
import ClientProgram from "./pages/ClientProgram";
import ClientAssessment from "./pages/ClientAssessment";
import ClientGoals from "./pages/ClientGoals";
import ClientPastWorkouts from "./pages/ClientPastWorkouts";
import ClientProgress from "./pages/ClientProgress";
import ClientSetup from "./pages/ClientSetup";
import ClientSettings from "./pages/ClientSettings";
import ClientLogActivity from "./pages/ClientLogActivity";
import ClientRepeatHistoricalWorkout from "./pages/ClientRepeatHistoricalWorkout";
import ClientHistoricalWorkoutDetails from "./pages/ClientHistoricalWorkoutDetails";

import TrainerDashboard from "./pages/TrainerDashboard";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import TrainerClientPreview from "./pages/TrainerClientPreview";
import CreateClient from "./pages/CreateClient";
import CreateProgram from "./pages/CreateProgram";
import TrainerPlans from "./pages/TrainerPlans";
import EditPublishedWorkout from "./pages/EditPublishedWorkout";
import ImportProgram from "./pages/ImportProgram";
import Program from "./pages/Program";
import Messages from "./pages/Messages";
import WorkoutTracker from "./pages/WorkoutTracker";
import WorkoutHistory from "./pages/WorkoutHistory";
import StartWorkout from "./pages/StartWorkout";
import CompletedWorkout from "./pages/CompletedWorkout";

type UserRole = "trainer" | "client";

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname, search]);

  return null;
}

function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const userRole = localStorage.getItem("coachsync-user-role") as
    | UserRole
    | null;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/client"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientDashboard />
            </RequireRole>
          }
        />

        <Route
          path="/client-setup"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientSetup />
            </RequireRole>
          }
        />

        <Route
          path="/client-settings"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientSettings />
            </RequireRole>
          }
        />

        <Route
          path="/client-plan"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientPlan />
            </RequireRole>
          }
        />

        <Route
          path="/client-log-activity"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientLogActivity />
            </RequireRole>
          }
        />

        <Route
          path="/client-assessment"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientAssessment />
            </RequireRole>
          }
        />

        <Route
          path="/client-goals"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientGoals />
            </RequireRole>
          }
        />

        <Route
          path="/client-past-workouts"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientPastWorkouts />
            </RequireRole>
          }
        />

        <Route
          path="/client-historical-workout/:historicalWorkoutId"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientHistoricalWorkoutDetails />
            </RequireRole>
          }
        />

        <Route
          path="/repeat-historical-workout/:historicalWorkoutId"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientRepeatHistoricalWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/client-progress"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientProgress />
            </RequireRole>
          }
        />

        <Route
          path="/client-program"
          element={
            <RequireRole allowedRoles={["client"]}>
              <ClientProgram />
            </RequireRole>
          }
        />

        <Route
          path="/client-messages"
          element={
            <RequireRole allowedRoles={["client"]}>
              <Messages />
            </RequireRole>
          }
        />

        <Route
          path="/start-workout"
          element={
            <RequireRole allowedRoles={["client"]}>
              <StartWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/workout-history/:submissionId"
          element={
            <RequireRole allowedRoles={["client", "trainer"]}>
              <CompletedWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/trainer"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <TrainerDashboard />
            </RequireRole>
          }
        />

        <Route
          path="/clients"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <Clients />
            </RequireRole>
          }
        />

        <Route
          path="/clients/:clientUserId"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <ClientDetails />
            </RequireRole>
          }
        />

        <Route
          path="/trainer/client-preview/:clientUserId/*"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <TrainerClientPreview />
            </RequireRole>
          }
        />

        <Route
          path="/create-client"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <CreateClient />
            </RequireRole>
          }
        />

        <Route
          path="/create-program"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <CreateProgram />
            </RequireRole>
          }
        />

        <Route
          path="/training-plans"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <TrainerPlans />
            </RequireRole>
          }
        />

        <Route
          path="/edit-workout/:workoutId"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <EditPublishedWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/import-program"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <ImportProgram />
            </RequireRole>
          }
        />

        <Route
          path="/program"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <Program />
            </RequireRole>
          }
        />

        <Route
          path="/messages"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <Messages />
            </RequireRole>
          }
        />

        <Route
          path="/workout-tracker"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <WorkoutTracker />
            </RequireRole>
          }
        />

        <Route
          path="/workout-history"
          element={
            <RequireRole allowedRoles={["trainer"]}>
              <WorkoutHistory />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}