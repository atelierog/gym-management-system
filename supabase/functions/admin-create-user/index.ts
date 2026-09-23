import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  const token = auth.replace(/^Bearer\s+/, "");
  const { data: { user: actor }, error: ae } = await admin.auth.getUser(token);
  if (ae || !actor) return json({ error: "Unauthorized" }, 401);

  const { data: actorProfile } = await admin
    .from("profiles")
    .select("gym_id,role")
    .eq("id", actor.id)
    .single();

  if (!actorProfile || actorProfile.role !== "admin")
    return json({ error: "Admin access required" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON request" }, 400);
  }

  const {
    login_id,
    full_name,
    role = "member",
    phone,
    email: customerEmail,
    password
  } = body;

  if (!login_id || !full_name || !password || !["member", "trainer"].includes(String(role)))
    return json(
      { error: "login_id, full_name, password and valid role are required" },
      400
    );

  if (String(password).length < 8)
    return json({ error: "Password must be at least 8 characters" }, 400);

  const normalizedLogin = String(login_id).trim();
  const authEmail = normalizedLogin.toLowerCase() + "@gymos.local";
  const normalizedCustomerEmail =
    String(customerEmail || "").trim().toLowerCase() || null;

  const { data: newUser, error: ue } = await admin.auth.admin.createUser({
    email: authEmail,
    password: String(password),
    email_confirm: true
  });

  if (ue) return json({ error: ue.message }, 400);

  const { data: profile, error: pe } = await admin
    .from("profiles")
    .insert({
      id: newUser.user.id,
      gym_id: actorProfile.gym_id,
      login_id: normalizedLogin,
      full_name: String(full_name).trim(),
      role: String(role),
      status: "active",
      phone: phone ? String(phone).trim() : null,
      email: normalizedCustomerEmail,
      password_change_required: true,
      password_reset_at: new Date().toISOString()
    })
    .select()
    .single();

  if (pe) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return json({ error: pe.message }, 400);
  }

  await admin.from("audit_logs").insert({
    gym_id: actorProfile.gym_id,
    actor_id: actor.id,
    action: "create_account",
    entity: String(role),
    entity_id: profile.id,
    details: { login_id: profile.login_id }
  });

  return json({ profile });
});