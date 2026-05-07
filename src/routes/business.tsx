import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BusinessLayout } from "@/components/business/BusinessLayout";

export const Route = createFileRoute("/business")({
  component: () => (
    <ProtectedRoute requiredRole="company">
      <BusinessLayout>
        <Outlet />
      </BusinessLayout>
    </ProtectedRoute>
  ),
});
