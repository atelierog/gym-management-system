import { supabase } from "./supabase";

export async function signIn(loginId,password){
 if(!supabase) throw new Error("Supabase is not configured.");
 const email=loginId.trim().toLowerCase()+"@gymos.local";
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error)throw error;return data;
}
export async function signOut(){if(supabase)await supabase.auth.signOut();}
export async function currentProfile(){
 if(!supabase)return null;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
 if(error)throw error;return data;
}
