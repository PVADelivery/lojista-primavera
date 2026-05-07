import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMyCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
}
