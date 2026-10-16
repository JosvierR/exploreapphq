import ExploreHome from "@/components/home/App.jsx";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getHomeLanding } from "@/locales/homeLanding";
import "@/components/home/index.css";

export function UnifiedHomePage() {
  const { locale } = useI18n();
  const copy = getHomeLanding(locale);

  usePageMeta({
    title: copy.metaTitle,
    description: copy.metaDescription,
    path: "/",
  });

  return (
    <div className="explore-home">
      <ExploreHome />
    </div>
  );
}

export default UnifiedHomePage;
