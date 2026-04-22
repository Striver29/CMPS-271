import { type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;

  if (!isSignedIn) return <Navigate to="/login" replace />;

  return children;
}
