import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useSupabase } from "../hooks/useSupabase.ts";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const supabase = useSupabase();
  const { isLoaded, user } = useUser();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      navigate("/login");
      return;
    }

    async function checkAdmin() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
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
  }, [isLoaded, navigate, supabase, user]);

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
