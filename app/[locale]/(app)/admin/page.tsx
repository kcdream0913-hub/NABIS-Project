import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "./dashboard";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale });

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold">{t("adminsOnlyTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {t("adminsOnlyBody")}
        </p>
      </div>
    );
  }

  return <AdminDashboard />;
}
