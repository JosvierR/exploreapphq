import { LandingSections } from "@/components/sections/LandingSections";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";

export function HomePage() {
  const { t } = useI18n();
  usePageMeta({
    title: t("meta.title"),
    description: t("meta.description"),
    path: "/explorar",
  });

  return (
    <main>
      <LandingSections />
    </main>
  );
}

export default HomePage;
