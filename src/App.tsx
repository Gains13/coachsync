import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";

import ClientDashbord from "./pages/ClientDashboard";
import ClientPlan from "./pages/ClientPlan";
import ClientProgram from "./pages/ClientProgram";
import ClientAssessment from "./pages/ClientAssessment";
import ClientGoals from "./pages/ClientGoals";
import ClientPastWorkouts from "./pages/ClientPastWorkouts";
import ClientProgress from "./pages/ClientProgress";

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

function RequireRole({
  allowedRole,
  children,
}: {
  allowedRole: "trainer" | "client";
  children: ReactNode;
}) {
  const userRole = localStorage.getItem("coachsync-user-role");

  if (userRole !== allowedRole) {
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
            <RequireRole allowedRole="client">
              <ClientDashbord />
            </RequireRole>
          }
        />

        <Route
          path="/client-plan"
          element={
            <RequireRole allowedRole="client">
              <ClientPlan />
            </RequireRole>
          }
        />

        <Route
          path="/client-assessment"
          element={
            <RequireRole allowedRole="client">
              <ClientAssessment />
            </RequireRole>
          }
        />

        <Route
          path="/client-goals"
          element={
            <RequireRole allowedRole="client">
              <ClientGoals />
            </RequireRole>
          }
        />

        <Route
          path="/client-past-workouts"
          element={
            <RequireRole allowedRole="client">
              <ClientPastWorkouts />
            </RequireRole>
          }
        />

        <Route
          path="/client-progress"
          element={
            <RequireRole allowedRole="client">
              <ClientProgress />
            </RequireRole>
          }
        />

        <Route
          path="/client-program"
          element={
            <RequireRole allowedRole="client">
              <ClientProgram />
            </RequireRole>
          }
        />

        <Route
          path="/start-workout"
          element={
            <RequireRole allowedRole="client">
              <StartWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/workout-history/:submissionId"
          element={
            <RequireRole allowedRole="client">
              <CompletedWorkout />
            </RequireRole>
          }
        />

        <Route
          path="/trainer"
          element={
            <RequireRole allowedRole="trainer">
              <TrainerDashboard />
            </RequireRole>
          }
        />

        <Route
          path="/clients"
          element={
            <RequireRole allowedRole="trainer">
              <Clients />
            </RequireRole>
          }
        />

        <Route
          path="/clients/:clientUserId"
          element={
            <RequireRole allowedRole="trainer">
              <ClientDetails />
            </RequireRole>
          }
        />

        <Route
          path="/create-client"
          element={
            <RequireRole allowedRole="trainer">
              <CreateClient />
            </RequireRole>
          }
        />

        <Route
          path="/create-program"
          element={
            <RequireRole allowedRole="trainer">
              <CreateProgram />
            </RequireRole>
          }
        />

        <Route
          path="/program"
          element={
            <RequireRole allowedRole="trainer">
              <Program />
            </RequireRole>
          }
        />

        <Route
          path="/messages"
          element={
            <RequireRole allowedRole="trainer">
              <Messages />
            </RequireRole>
          }
        />

        <Route
          path="/workout-tracker"
          element={
            <RequireRole allowedRole="trainer">
              <WorkoutTracker />
            </RequireRole>
          }
        />

        <Route
          path="/workout-history"
          element={
            <RequireRole allowedRole="trainer">
              <WorkoutHistory />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}