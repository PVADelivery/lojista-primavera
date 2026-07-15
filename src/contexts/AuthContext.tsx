import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "company" | "driver" | "customer";
type Status = "pending" | "active" | "rejected";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: Status;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  userStatus: Status | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  refresh: () => Promise<void>;
  rolesLoaded: boolean;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      // 1. Tenta buscar as roles usando a função segura (ignora RLS)
      const { data: rpcRoles, error: rpcError } = await supabase.rpc("get_my_roles");
      
      let userRoles: Role[] = [];

      if (!rpcError && rpcRoles) {
        // Se a função existir e rodar com sucesso, usamos o resultado dela.
        userRoles = rpcRoles.map((r: any) => r.role as Role);
      } else {
        // 2. FALLBACK SE A FUNÇÃO AINDA NÃO FOI CRIADA NO BANCO:
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        ]);
        
        userRoles = (rolesRes.data?.map((r) => r.role as Role)) ?? [];
        
        // Fallback antigo do profile
        if (userRoles.length === 0 && (profileRes.data as any)?.role) {
          userRoles = [(profileRes.data as any).role as Role];
        }
      }

      // ATUALIZA O PERFIL PARA OUTROS USOS DA APLICAÇÃO
      const { data: profileData } = await supabase.from("profiles").select("user_id,full_name,avatar_url,phone,status").eq("user_id", userId).maybeSingle();

      setRoles(userRoles);
      setProfile(profileData as Profile ?? null);
    } catch (e) {
      console.error("Auth: error fetching user data", e);
      setRoles([]);
      setProfile(null);
    } finally {
      setRolesLoaded(true);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchUserData(sess.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
        setRolesLoaded(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/business`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro no signOut:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("delete_user_account");
    if (error) throw error;
    await signOut();
  };

  const refresh = async () => {
    if (user) await fetchUserData(user.id);
  };

  const hasRole = (r: Role) => roles.includes(r);

  return (
    <Ctx.Provider
      value={{
        user, session, profile, roles,
        userStatus: profile?.status ?? null,
        loading, signIn, signUp, signOut, deleteAccount, hasRole, refresh, rolesLoaded,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
