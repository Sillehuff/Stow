import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const AuthFinishPage = lazy(() => import("@/routes/AuthFinishPage"));
const AcceptInvitePage = lazy(() => import("@/routes/AcceptInvitePage"));
const SpacesRoutePage = lazy(() => import("@/routes/SpacesRoutePage"));

function RouteLoading({ message }: { message: string }) {
  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>Stow</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/auth/finish"
        element={
          <Suspense fallback={<RouteLoading message="Loading sign-in…" />}>
            <AuthFinishPage />
          </Suspense>
        }
      />
      <Route
        path="/invite"
        element={
          <Suspense fallback={<RouteLoading message="Loading invite…" />}>
            <AcceptInvitePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces/:spaceId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces/:spaceId/areas/:areaId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/items/:itemId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/search"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/packing"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <SpacesRoutePage />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate to="/spaces" replace />} />
      <Route path="*" element={<Navigate to="/spaces" replace />} />
    </Routes>
  );
}
