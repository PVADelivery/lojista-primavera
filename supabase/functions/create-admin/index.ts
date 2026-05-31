import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Service-role client for privileged operations
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1) Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use a request-scoped client to validate the JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Verify the caller is an admin (server-side check against user_roles)
    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");

    if (roleErr || !roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Validate input
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      phone,
      document,
      role,
      vehicle,
      licensePlate,
      commissionRate,
      companyName,
      address,
      regionId,
    } = body;

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "email, password e role são obrigatórios" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter ao menos 8 caracteres" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const validRoles = ["admin", "driver", "company", "customer"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Role inválido" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Check if user exists
    const { data: existingUserId, error: rpcError } = await supabase.rpc("get_user_id_by_email", { p_email: email });
    
    let userId = existingUserId;

    if (userId) {
      // User exists! Check if they already have the role.
      const { data: existingRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", role).maybeSingle();
      if (existingRole) {
         return new Response(JSON.stringify({ error: "Usuário já cadastrado neste painel com este e-mail." }), {
           status: 200,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }
      
      // Update password so they can log in with the new credentials
      const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(userId, { password: password });
      if (updateAuthErr) {
        return new Response(JSON.stringify({ error: "Erro ao atualizar credenciais do usuário existente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new user
      const { data: authData, error: createErr } = await supabase.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || "", role: role },
        });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = authData.user.id;
    }

    // Update profile with active status (admin-created users skip approval)
    await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: fullName || "",
      phone: phone || null,
      document: document || null,
      status: "active",
      role: role,
    });

    // Assign role
    await supabase.from("user_roles").insert({ user_id: userId, role });

    if (role === "driver") {
      await supabase.from("delivery_drivers").upsert({
        user_id: userId,
        full_name: fullName || "",
        phone: phone || null,
        vehicle_type: vehicle || "motorcycle",
        vehicle_plate: licensePlate || null,
        commission_rate: commissionRate ?? 15,
        created_by_admin_id: userData.user.id,
        status: "active", // CRITICAL FIX: Ensure driver is born active so they can see deliveries!
      });
    }

    if (role === "company") {
      await supabase.from("companies").insert({
        user_id: userId,
        name: companyName || fullName || "",
        phone: phone || null,
        email: email || null,
        address: address || null,
        region_id: regionId || null,
        created_by_admin_id: userData.user.id,
      });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno ao criar usuário" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
