import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";

import ClientDashboard from "./pages/ClientDashboard";
import ClientPlan from "./pages/ClientPlan";
import ClientProgram from "./pages/ClientProgram";
import ClientAssessment from "./pages/ClientAssessment";
import ClientGoals from "./pages/ClientGoals";
import ClientPastWorkouts from "./pages/ClientPastWorkouts";
import ClientProgress from "./pages/ClientProgress";
import ClientSetup from "./pages/ClientSetup";
import ClientSettings from "./pages/ClientSettings";

import TrainerDashboard from "./pages/TrainerDashboard";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import CreateClient from "./pages/CreateClient";
import CreateProgram from "./pages/CreateProgram";
import Program from "./pages/Program";
import Messages from "./pages/Messages";
import WorkoutTracker from "./pages/WorkoutTracker";
import WorkoutHistory from "./pages/WorkoutHistory";
import StartWorkout from "./pages/StartWorkout";
import CompletedWorkout from "./pages/CompletedWorkout";

type UserRole = "trainer" | "client";

function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const userRole = localStorage.getItem("coachsync-user-role") as UserRole | null;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/landing" element={<Landing />} />

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