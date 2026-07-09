import { LandingSectionsLegacy } from "@/components/sections/legacy/LandingSectionsLegacy";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";

export function HomePageLegacy() {
  const { t } = useI18n();
  usePageMeta({
    title: t("meta.title"),
    description: t("meta.description"),
    path: "/home-classic",
  });

  return (
    <main>
      <LandingSectionsLegacy />
    </main>
  );
}

export default HomePageLegacy;
