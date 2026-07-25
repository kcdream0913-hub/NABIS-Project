"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

// City input seeded with Nepali cities via a native <datalist> (accessible, free
// text still allowed). autocorrect/spellcheck off so a city name isn't "fixed".
const NEPAL_CITIES = [
  "Kathmandu", "Pokhara", "Lalitpur", "Bhaktapur", "Biratnagar", "Birgunj",
  "Butwal", "Dharan", "Bharatpur", "Janakpur", "Hetauda", "Nepalgunj",
  "Dhangadhi", "Itahari", "Damak", "Ghorahi", "Tulsipur", "Birtamod",
];

export default function CityCombobox({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  const id = useId();
  const listId = `${id}-cities`;
  const t = useTranslations("guided");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{t("cityLabel")}</label>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={t("cityPlaceholder")}
        autoCapitalize="words"
        spellCheck={false}
        autoCorrect="off"
        inputMode="text"
        className="mt-1 w-full rounded-lg border border-border-input px-3.5 py-3 text-base focus:border-primary"
      />
      <datalist id={listId}>
        {NEPAL_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
