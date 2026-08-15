import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper para renovar o access_token se estiver perto de expirar
async function getValidToken(connection: any, supabase: any): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();

  // Se expira em menos de 5 minutos, renova com o refresh_token
  if (expiresAt - now < 5 * 60 * 1000 && connection.refresh_token) {
    const clientId = Deno.env.get("IFOOD_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET") || "";

    const res = await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "refresh_token",
        clientId,
        clientSecret,
        refreshToken: connection.refresh_token,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const newAccess = data.accessToken || data.access_token;
      const newRefresh = data.refreshToken || data.refresh_token || connection.refresh_token;
      const expiresIn = Number(data.expiresIn || data.expires_in || 21600);
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await supabase
        .from("ifood_connections")
        .update({
          access_token: newAccess,
          refresh_token: newRefresh,
          token_expires_at: newExpiresAt,
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return newAccess;
    }
  }

  return connection.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Auth verification
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { company_id, mode = "preview" } = body; // mode: 'preview' (apenas resumo) ou 'execute' (gravar banco)

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca conexão da empresa
    const { data: connection, error: connErr } = await adminClient
      .from("ifood_connections")
      .select("*")
      .eq("company_id", company_id)
      .eq("status", "connected")
      .single();

    if (connErr || !connection) {
      return new Response(
        JSON.stringify({ error: "Estabelecimento não possui conexão ativa com o iFood. Conecte primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getValidToken(connection, adminClient);
    const merchantId = connection.merchant_id;

    // 2. Busca catálogo oficial do iFood (Catalogs API)
    const catalogsRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let catalogId = "DEFAULT";
    if (catalogsRes.ok) {
      const catalogs = await catalogsRes.json();
      if (Array.isArray(catalogs) && catalogs.length > 0) {
        const activeCat = catalogs.find((c: any) => c.status === "AVAILABLE" || c.status === "ACTIVE") || catalogs[0];
        catalogId = activeCat.catalogId || activeCat.id || catalogId;
      }
    }

    // 3. Busca Categorias do Catálogo Oficial
    const categoriesRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let ifoodCategories: any[] = [];
    if (categoriesRes.ok) {
      ifoodCategories = await categoriesRes.json();
    }

    // 4. Busca Grupos de Opções (Option Groups) do Catálogo
    const optionGroupsRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/option-groups`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let ifoodOptionGroups: any[] = [];
    if (optionGroupsRes.ok) {
      ifoodOptionGroups = await optionGroupsRes.json();
    }

    // Processamento de itens do cardápio
    let totalCategories = ifoodCategories.length;
    let totalItemsFound = 0;
    let newItemsCount = 0;
    let updatedItemsCount = 0;
    let totalOptionsCount = 0;
    const processedProducts: any[] = [];

    // Busca produtos existentes vinculados para calcular novos vs atualizados
    const { data: existingProducts } = await adminClient
      .from("products")
      .select("id, external_id, name")
      .eq("company_id", company_id)
      .eq("external_source", "ifood");

    const existingMap = new Map((existingProducts || []).map((p: any) => [p.external_id, p]));

    for (const cat of ifoodCategories) {
      const catName = cat.name || "Geral";
      const catId = cat.id || cat.categoryId;
      const items = cat.items || cat.products || [];

      for (const item of items) {
        totalItemsFound++;
        const extId = item.id || item.productId;
        const name = item.name || item.title || "Item iFood";
        const description = item.description || item.details || null;
        const price = Number(item.price?.value || item.price || 0);
        const imageUrl = item.imagePath || item.imageUrl || (item.resources && item.resources[0]?.path) || null;
        const isActive = item.status === "AVAILABLE" || item.status === "ACTIVE" || item.available !== false;

        const isExisting = existingMap.has(extId);
        if (isExisting) {
          updatedItemsCount++;
        } else {
          newItemsCount++;
        }

        processedProducts.push({
          external_source: "ifood",
          external_id: extId,
          external_category_id: catId,
          company_id,
          name,
          description,
          category: catName,
          price,
          image_url: imageUrl,
          is_active: isActive,
          option_groups: item.optionGroups || item.shifts || [],
        });
      }
    }

    // Se estiver em modo PREVIEW, retorna o resumo para o modal de revisão do lojista
    if (mode === "preview") {
      return new Response(
        JSON.stringify({
          preview: true,
          merchant_name: connection.merchant_name,
          categories_count: totalCategories,
          products_found: totalItemsFound,
          products_created: newItemsCount,
          products_updated: updatedItemsCount,
          options_count: ifoodOptionGroups.length,
          sample_categories: ifoodCategories.slice(0, 5).map((c: any) => c.name),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODO EXECUTE: Realiza o UPSERT no Banco de Dados
    let savedProducts = 0;
    let savedOptionGroups = 0;
    let savedOptions = 0;
    const errors: string[] = [];

    for (const prod of processedProducts) {
      try {
        const { option_groups, ...productData } = prod;

        // 1. UPSERT do produto
        let localProductId: string | null = null;
        const existing = existingMap.get(prod.external_id);

        if (existing) {
          const { data: upd, error: updErr } = await adminClient
            .from("products")
            .update({
              name: productData.name,
              description: productData.description,
              category: productData.category,
              price: productData.price,
              image_url: productData.image_url,
              is_active: productData.is_active,
              external_category_id: productData.external_category_id,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select("id")
            .single();

          if (updErr) throw updErr;
          localProductId = upd.id;
        } else {
          const { data: ins, error: insErr } = await adminClient
            .from("products")
            .insert({
              ...productData,
              last_synced_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (insErr) throw insErr;
          localProductId = ins.id;
        }

        savedProducts++;

        // 2. Processa Grupos de Complementos e Opções do Item
        if (localProductId && Array.isArray(option_groups) && option_groups.length > 0) {
          for (const og of option_groups) {
            const ogExtId = og.id || og.optionGroupId;
            const ogName = og.name || "Opções";
            const minOpts = Number(og.min || og.minOptions || 0);
            const maxOpts = Number(og.max || og.maxOptions || 1);
            const required = minOpts > 0;

            // Busca ou insere grupo de complementos
            const { data: existingOg } = await adminClient
              .from("product_option_groups")
              .select("id")
              .eq("product_id", localProductId)
              .eq("external_id", ogExtId)
              .maybeSingle();

            let localGroupId = existingOg?.id;

            if (existingOg) {
              await adminClient
                .from("product_option_groups")
                .update({
                  name: ogName,
                  min_options: minOpts,
                  max_options: maxOpts,
                  required,
                })
                .eq("id", existingOg.id);
            } else {
              const { data: newOg } = await adminClient
                .from("product_option_groups")
                .insert({
                  product_id: localProductId,
                  name: ogName,
                  min_options: minOpts,
                  max_options: maxOpts,
                  required,
                  external_source: "ifood",
                  external_id: ogExtId,
                })
                .select("id")
                .single();

              localGroupId = newOg?.id;
            }

            savedOptionGroups++;

            // Opções / adicionais
            const options = og.options || og.items || [];
            for (const opt of options) {
              const optExtId = opt.id || opt.optionId;
              const optName = opt.name || opt.title || "Opção";
              const optPrice = Number(opt.price?.value || opt.price || 0);
              const optActive = opt.status === "AVAILABLE" || opt.status === "ACTIVE" || opt.available !== false;

              if (localGroupId) {
                const { data: existingOpt } = await adminClient
                  .from("product_options")
                  .select("id")
                  .eq("group_id", localGroupId)
                  .eq("external_id", optExtId)
                  .maybeSingle();

                if (existingOpt) {
                  await adminClient
                    .from("product_options")
                    .update({
                      name: optName,
                      price: optPrice,
                      is_active: optActive,
                    })
                    .eq("id", existingOpt.id);
                } else {
                  await adminClient
                    .from("product_options")
                    .insert({
                      group_id: localGroupId,
                      name: optName,
                      price: optPrice,
                      is_active: optActive,
                      external_source: "ifood",
                      external_id: optExtId,
                    });
                }
                savedOptions++;
              }
            }
          }
        }
      } catch (err: any) {
        errors.push(`Erro no item ${prod.name}: ${err.message}`);
      }
    }

    // 5. Registra Log da Importação
    await adminClient.from("ifood_import_logs").insert({
      company_id,
      merchant_id: merchantId,
      operation: "import",
      status: errors.length === 0 ? "success" : errors.length < processedProducts.length ? "partial" : "failed",
      categories_count: totalCategories,
      products_found: totalItemsFound,
      products_created: newItemsCount,
      products_updated: updatedItemsCount,
      options_count: savedOptions,
      errors_count: errors.length,
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    });

    // 6. Atualiza conexão com data da última sincronização
    await adminClient
      .from("ifood_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: errors.length === 0 ? "success" : "partial",
        last_sync_error: errors.length > 0 ? errors[0] : null,
      })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cardápio importado com sucesso!",
        summary: {
          categories_count: totalCategories,
          products_imported: savedProducts,
          products_created: newItemsCount,
          products_updated: updatedItemsCount,
          option_groups_created: savedOptionGroups,
          options_created: savedOptions,
          errors_count: errors.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Import Exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
