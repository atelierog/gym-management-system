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
    login_id: requestedLoginId,
    full_name,
    role = "member",
    phone,
    email: customerEmail,
    password
  } = body;

  const normalizedRole = String(role).trim().toLowerCase();
  if (!full_name || !password || !["member", "trainer"].includes(normalizedRole)) {
    return json({ error: "full_name, password and valid role are required" }, 400);
  }

  const normalizedPhone = String(phone || "").trim();
  const normalizedCustomerEmail = String(customerEmail || "").trim().toLowerCase();
  if (!normalizedPhone) return json({ error: "Phone is required" }, 400);
  if (!normalizedCustomerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCustomerEmail)) {
    return json({ error: "A valid email address is required" }, 400);
  }

  const passwordMissing: string[] = [];
  if (String(password).length < 8) passwordMissing.push("at least 8 characters");
  if (!/[A-Z]/.test(String(password))) passwordMissing.push("1 uppercase letter");
  if (!/[a-z]/.test(String(password))) passwordMissing.push("1 lowercase letter");
  if (!/[0-9]/.test(String(password))) passwordMissing.push("1 number");
  if (!/[^A-Za-z0-9]/.test(String(password))) passwordMissing.push("1 special character");
  if (passwordMissing.length) {
    return json({ error: "Temporary password must contain " + passwordMissing.join(", ") + "." }, 400);
  }

  let normalizedLogin = String(requestedLoginId || "").trim();
  if (!normalizedLogin) {
    const { data: generatedId, error: idError } = await admin.rpc("allocate_login_id", {
      p_role: normalizedRole,
      p_gym_id: actorProfile.gym_id
    });
    if (idError || !generatedId) {
      return json({ error: idError?.message || "Could not generate account ID" }, 500);
    }
    normalizedLogin = String(generatedId);
  }

  const expectedPrefix = normalizedRole === "trainer" ? "TRN" : "MEM";
  const idPattern = new RegExp(`^${expectedPrefix}-\\d{2}-\\d{3,}$`);
  if (!idPattern.test(normalizedLogin)) {
    return json({ error: "Invalid account ID format" }, 400);
  }

  const authEmail = normalizedLogin.toLowerCase() + "@gymos.local";

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
      role: normalizedRole,
      status: "active",
      phone: normalizedPhone,
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
    entity: normalizedRole,
    entity_id: profile.id,
    details: { login_id: profile.login_id }
  });

  return json({ profile });
});
