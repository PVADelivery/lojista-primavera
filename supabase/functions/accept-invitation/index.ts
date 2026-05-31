import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token, email, password, fullName, phone, document } = body ?? {};

    if (!token || !password || !fullName) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate invitation
    const { data: invitation, error: invErr } = await admin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (invErr) throw invErr;
    if (!invitation) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalEmail = email || invitation.email;

    // Create user (auto-confirm)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: invitation.role },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    // Update profile
    await admin.from("profiles").update({
      full_name: fullName,
      phone: phone ?? null,
      document: document ?? null,
      role: invitation.role,
    }).eq("user_id", userId);

    // Assign role safely
    const { data: existingRoles } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", invitation.role);
    if (!existingRoles || existingRoles.length === 0) {
      await admin.from("user_roles").insert({ user_id: userId, role: invitation.role });
    }

    if (invitation.role === "driver") {
      const { data: existingDriver } = await admin.from("delivery_drivers").select("id").eq("user_id", userId).maybeSingle();
      if (!existingDriver) {
         await admin.from("delivery_drivers").insert({ 
           user_id: userId, 
           full_name: fullName, 
           phone: phone || null,
           created_by_admin_id: invitation.invited_by || null,
         });
      } else {
         await admin.from("delivery_drivers").update({ 
           full_name: fullName, 
           phone: phone || null,
           created_by_admin_id: invitation.invited_by || null,
         }).eq("user_id", userId);
      }
    }
    if (invitation.role === "company") {
      const correctName = body.companyName || fullName;
      const { data: existingCompany } = await admin.from("companies").select("id").eq("user_id", userId).maybeSingle();
      if (!existingCompany) {
        await admin.from("companies").insert({ 
          user_id: userId, 
          name: correctName, 
          email: finalEmail, 
          phone: phone || null,
          created_by_admin_id: invitation.invited_by || null,
        });
      } else {
        await admin.from("companies").update({ 
          name: correctName, 
          email: finalEmail, 
          phone: phone || null,
          created_by_admin_id: invitation.invited_by || null,
        }).eq("user_id", userId);
      }
    }

    // Mark invitation accepted
    await admin.from("invitations").update({ status: "accepted" }).eq("token", token);

    return new Response(JSON.stringify({ success: true, role: invitation.role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("accept-invitation error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
