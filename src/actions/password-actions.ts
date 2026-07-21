"use server";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/actions/auth-actions";
export async function updatePassword(_: ActionState, formData:FormData): Promise<ActionState>{const password=String(formData.get("password")??"");if(password.length<8)return{error:"הסיסמה חייבת לכלול לפחות 8 תווים"};const supabase=await createClient();const{error}=await supabase.auth.updateUser({password});return error?{error:"לא ניתן לעדכן את הסיסמה. ייתכן שהקישור פג."}:{success:"הסיסמה עודכנה בהצלחה"};}
