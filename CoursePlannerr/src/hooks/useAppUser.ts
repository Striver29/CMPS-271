import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useSupabase } from "./useSupabase";

type AppUserState = {
  appUserId: string | null;
  clerkUserId: string | null;
  email: string | null;
  loading: boolean;
};

type UserRow = {
  id: string;
};

function getPrimaryEmail(user: ReturnType<typeof useUser>["user"]) {
  return user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;
}

const AppUserContext = createContext<AppUserState | null>(null);

export function AppUserProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const { isLoaded, user } = useUser();
  const clerkUserId = user?.id ?? null;
  const email = getPrimaryEmail(user);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncUser() {
      if (!isLoaded) return;

      if (!clerkUserId || !email) {
        setAppUserId(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: existing, error: selectError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle<UserRow>();

      if (cancelled) return;

      if (existing?.id) {
        setAppUserId(existing.id);
        setLoading(false);
        if (!selectError) {
          void supabase
            .from("users")
            .update({ email })
            .eq("id", existing.id);
        }
        return;
      }

      if (selectError) {
        console.error("Could not look up Supabase user for Clerk user:", selectError);
        setAppUserId(null);
        setLoading(false);
        return;
      }

      const { data: existingByEmail, error: emailSelectError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle<UserRow>();

      if (cancelled) return;

      if (existingByEmail?.id) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ clerk_user_id: clerkUserId })
          .eq("id", existingByEmail.id);

        if (cancelled) return;

        if (updateError) {
          console.error("Could not attach Clerk user to existing Supabase user:", updateError);
          setAppUserId(null);
        } else {
          setAppUserId(existingByEmail.id);
        }
        setLoading(false);
        return;
      }

      if (emailSelectError) {
        console.error("Could not look up Supabase user by email:", emailSelectError);
        setAppUserId(null);
        setLoading(false);
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from("users")
        .upsert(
          {
            clerk_user_id: clerkUserId,
            email,
          },
          {
            onConflict: "clerk_user_id",
            ignoreDuplicates: true,
          },
        )
        .select("id")
        .maybeSingle<UserRow>();

      if (cancelled) return;

      if (created?.id) {
        setAppUserId(created.id);
      } else {
        const { data: rowAfterConflict } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_user_id", clerkUserId)
          .maybeSingle<UserRow>();

        if (rowAfterConflict?.id) {
          setAppUserId(rowAfterConflict.id);
        } else {
          const { data: emailRowAfterConflict } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle<UserRow>();

          if (emailRowAfterConflict?.id) {
            await supabase
              .from("users")
              .update({ clerk_user_id: clerkUserId })
              .eq("id", emailRowAfterConflict.id);
            setAppUserId(emailRowAfterConflict.id);
          } else {
            console.error("Could not create Supabase user for Clerk user:", insertError);
            setAppUserId(null);
          }
        }
      }
      setLoading(false);
    }

    syncUser();

    return () => {
      cancelled = true;
    };
  }, [supabase, isLoaded, clerkUserId, email]);

  const value = {
    appUserId,
    clerkUserId,
    email,
    loading,
  };

  return createElement(AppUserContext.Provider, { value }, children);
}

export function useAppUser(): AppUserState {
  const appUser = useContext(AppUserContext);
  if (!appUser) {
    throw new Error("useAppUser must be used inside AppUserProvider.");
  }
  return appUser;
}
