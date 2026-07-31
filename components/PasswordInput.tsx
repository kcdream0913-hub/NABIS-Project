"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

// A password <input> with a show/hide toggle. Renders the SAME input with its
// `type` flipped between "password" and "text" (not a separate masked overlay),
// so native autofill, password managers, and browser validation keep working
// exactly as they did before this existed. Used on login + update-password;
// share this instead of duplicating the toggle 3x so the behavior and hit
// target stay identical everywhere a password is typed.
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordInput({ className, style, ...rest }: PasswordInputProps) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={className}
        // Inline style wins over the utility classes in `className` regardless
        // of class order, so the reveal button never overlaps typed text.
        style={{ ...style, paddingRight: "2.5rem" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft hover:text-ink"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
