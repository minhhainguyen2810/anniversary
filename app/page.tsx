import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import AnniversaryApp, { type AppAnniversary } from "./anniversary-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) return <AnniversaryApp mode="config" anniversaries={[]} household={null} />;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <AnniversaryApp mode="signed-out" anniversaries={[]} household={null} />;

  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();
  if (!membership) return <AnniversaryApp mode="onboarding" anniversaries={[]} household={null} />;
  const [{ data: household }, { data: anniversaries }] = await Promise.all([
    supabase.from("households").select("id, invite_code").eq("id", membership.household_id).single(),
    supabase.from("anniversaries").select("id, name, anniversary_date").eq("household_id", membership.household_id).order("anniversary_date"),
  ]);
  return <AnniversaryApp mode="ready" anniversaries={(anniversaries ?? []) as AppAnniversary[]} household={household} />;
}
