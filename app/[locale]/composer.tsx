"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function Composer({
  isVerified,
  onPosted,
}: {
  isVerified: boolean;
  onPosted: () => void;
}) {
  const t = useTranslations("composer");
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function publish() {
    if (!body.trim()) return;
    setPosting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }
    await supabase.from("posts").insert({
      author_id: user.id,
      posted_as: "user",
      body: body.trim(),
    });
    setBody("");
    setPosting(false);
    onPosted();
  }

  if (!isVerified) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-mist p-3 text-sm text-ink-soft">
        {t("verifyToPost")}{" "}
        <a href="/profile/verify" className="font-medium text-pine hover:text-pine-ink">
          {t("verifyNow")}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={t("placeholder")}
        className="w-full resize-none border-none p-0 text-sm outline-none placeholder:text-ink-soft"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={publish}
          disabled={!body.trim() || posting}
          className="rounded-md bg-pine px-3.5 py-1.5 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-40"
        >
          {posting ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}
