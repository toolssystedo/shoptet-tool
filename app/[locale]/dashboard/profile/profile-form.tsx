"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/routing";
import { updateProfile } from "./actions";
import { User } from "@prisma/client";
import { useTranslations } from "next-intl";

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const t = useTranslations("profile");
  const [name, setName] = useState(user.name || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const result = await updateProfile({ name });
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          router.refresh();
          setTimeout(() => setSuccess(false), 3000);
        }
      } catch {
        setError(t("updateError"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-600">{t("updateSuccess")}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("updating") : t("updateProfile")}
      </Button>
    </form>
  );
}
