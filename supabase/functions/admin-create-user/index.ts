import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  const token = auth.replace(/^Bearer\s+/, "");
  const { data: { user: actor }, error: ae } = await admin.auth.getUser(token);
  if (ae || !actor) return new Response("Unauthorized", { status: 401 });

  const { data: actorProfile } = await admin
    .from("profiles")
    .select("gym_id,role")
    .eq("id", actor.id)
    .single();

  if (!actorProfile || actorProfile.role !== "admin")
    return Response.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const { login_id, full_name, role = "member", phone, email, password } = body;

  if (!login_id || !full_name || !password || !["member", "trainer"].includes(role))
    return Response.json(
      { error: "login_id, full_name, password and valid role are required" },
      { status: 400 }
    );

  if (String(password).length < 8)
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const normalizedLogin = String(login_id).trim();
  const email = normalizedLogin.toLowerCase() + "@gymos.local";

  const { data: newUser, error: ue } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (ue) return Response.json({ error: ue.message }, { status: 400 });

  const { data: profile, error: pe } = await admin.from("profiles").insert({
    id: newUser.user.id,
    gym_id: actorProfile.gym_id,
    login_id: normalizedLogin,
    full_name,
    role,
    status: "active",
    phone: phone || null,
    email: String(email || "").trim().toLowerCase() || null,
    password_change_required: true,
    password_reset_at: new Date().toISOString()
  }).select().single();

  if (pe) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return Response.json({ error: pe.message }, { status: 400 });
  }

  await admin.from("audit_logs").insert({
    gym_id: actorProfile.gym_id,
    actor_id: actor.id,
    action: "create_account",
    entity: role,
    entity_id: profile.id,
    details: { login_id: profile.login_id }
  });

  return Response.json({ profile });
});