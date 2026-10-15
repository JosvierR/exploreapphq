import ExploreHome from "@/components/home/App.jsx";
import { usePageMeta } from "@/hooks/usePageMeta";
import "@/components/home/index.css";

export function UnifiedHomePage() {
  usePageMeta({
    title: "Explore — El mundo se descubre compartiendo",
    description: "Explore es una red social para descubrir lugares, grabar rutas y compartir experiencias turísticas con personas que comparten tus intereses.",
    path: "/",
  });

  return <div className="explore-home"><ExploreHome /></div>;
}

export default UnifiedHomePage;
