import { supabase } from "./supabase.js";
import type { Context } from "hono";

export async function getUserFromToken(c: Context): Promise<any | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch (err) {
    return null;
  }
}
