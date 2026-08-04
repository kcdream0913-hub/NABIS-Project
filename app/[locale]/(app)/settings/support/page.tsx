import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { SettingsSection, SettingsNote } from "@/components/settings/primitives";
import FeedbackForm from "./FeedbackForm";

// Pilot support routes to the founder's inbox. sangamline.com IS now owned, but
// no support@ mailbox exists on it yet — publishing that address before the
// mailbox is provisioned would silently drop users' support mail. Switch this to
// support@sangamline.com only once the mailbox is live and receiving (BL-FEEDBACK-02 §4).
const SUPPORT_EMAIL = "kcdream0913@gmail.com";
const SUPPORT_SUBJECT = "Sangamline support request";

export default async function SupportPage() {
  const t = await getTranslations("settings.support");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;
  return (
    <SettingsSection title={t("title")} description={t("description")}>
      {/* Primary channel: the form writes to a real table, so a submit that fails says so. */}
      <p className="text-sm text-ink">{t("body")}</p>
      <div className="mt-3">
        <FeedbackForm />
      </div>

      {/* Secondary, ALWAYS-visible fallback. The form is primary because a bare mailto fails
          silently for anyone without a configured mail client — but if the form fails, or the
          user just prefers email, this is still here. Not instead of the form; below it. */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm text-ink-soft">{t("orEmailBody")}</p>
        <p className="mt-1 text-sm">
          <span className="font-medium text-ink">{t("pilotSupportLabel")}:</span>{" "}
          <a href={mailto} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <a
          href={mailto}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2"
        >
          <Mail size={15} aria-hidden /> {t("emailUs")}
        </a>
      </div>

      <SettingsNote>{t("responseNote")}</SettingsNote>
    </SettingsSection>
  );
}
