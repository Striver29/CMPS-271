import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabase } from "../hooks/useSupabase.ts";
import { useAppUser } from "../hooks/useAppUser.ts";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const supabase = useSupabase();
  const { appUserId, loading } = useAppUser();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!appUserId) {
      navigate("/login");
      return;
    }

    async function checkAdmin() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", appUserId)
          .single();
        if (profile?.is_admin) {
          setAllowed(true);
        } else {
          navigate("/");
        }
      } catch {
        navigate("/login");
      } finally {
        setChecking(false);
      }
    }

    checkAdmin();
  }, [appUserId, loading, navigate, supabase]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--muted)",
          fontSize: 14,
        }}
      >
        Checking access…
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}
