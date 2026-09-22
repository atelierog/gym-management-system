import { supabase } from "../main";

export async function recordPayment(payment) {
  const {data,error}=await supabase.from("payments").insert(payment).select().single();
  if(error) throw error;
  return data;
}

export async function memberPayments(memberId) {
  const {data,error}=await supabase.from("payments").select("*").eq("member_id",memberId).order("paid_at",{ascending:false});
  if(error) throw error;
  return data;
}
