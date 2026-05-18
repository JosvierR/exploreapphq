import type { ElementType } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { TranslationKey } from "@/locales/messages";

type TProps = {
  k: TranslationKey;
  as?: ElementType;
  className?: string;
};

export function T({ k, as: Tag = "span", className }: TProps) {
  const { t } = useI18n();
  return <Tag className={className}>{t(k)}</Tag>;
}
