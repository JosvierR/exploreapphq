(function () {
  "use strict";

  const translations = {
    en: {
      "nav.product": "Product",
      "nav.how": "How it works",
      "nav.creators": "For creators",
      "nav.partners": "Partners",
      "nav.contact": "Contact",
      "cta.start": "Start exploring",
      "cta.how": "See how it works",
      "cta.explorer": "Become an explorer",
      "cta.partner": "Partner with us",
      "hero.eyebrow": "Geospatial social network",
      "hero.title1": "Where social content becomes",
      "hero.title2": "real-world exploration.",
      "hero.lead": "Explore Atlas connects videos, places, routes and real experiences — helping you discover what to do, where to go and how to get there.",
      "badge.video": "Video-first",
      "badge.map": "Map-connected",
      "badge.route": "Route-ready",
      "badge.community": "Community-powered",
      "flow.video": "Video",
      "flow.place": "Place",
      "flow.route": "Route",
      "flow.experience": "Experience",
      "problem.eyebrow": "The problem",
      "problem.title": "Discovery is broken.",
      "problem.lead": "People find places on TikTok or Instagram, then jump to Maps, reviews and planning — content inspires, but rarely converts into action.",
      "problem.1": "TikTok & Instagram show videos, but don't turn them into routes.",
      "problem.2": "Google Maps locates places, but doesn't convey how they feel.",
      "problem.3": "TripAdvisor feels generic and commercial.",
      "problem.4": "Local experiences rarely surface on big platforms.",
      "problem.5": "People want to know what to do near them now — not endless lists.",
      "problem.quote": "People don't just want recommendations. They want to feel the place before they go.",
      "solution.eyebrow": "The solution",
      "solution.title": "Explore connects the video, the place and the route.",
      "solution.lead": "Every place can have real videos, exact location, useful details, routes and content from other explorers.",
      "solution.1t": "Watch a real video",
      "solution.1d": "See the experience before you move.",
      "solution.2t": "Tap the place",
      "solution.2d": "Open context tied to a real location.",
      "solution.3t": "See the map",
      "solution.3d": "Understand where it is and what's nearby.",
      "solution.4t": "Follow or create a route",
      "solution.4d": "Turn inspiration into a path.",
      "solution.5t": "Visit",
      "solution.5d": "Go there in the real world.",
      "solution.6t": "Share your experience",
      "solution.6d": "Feed the network with new content.",
      "what.eyebrow": "What is Explore",
      "what.title": "Not a travel app. A geospatial social network.",
      "what.lead": "Built around real places, real videos and real movement. Every post connects to somewhere you can actually go.",
      "what.1t": "Social video feed",
      "what.1d": "Discover through short-form video.",
      "what.2t": "Places on maps",
      "what.2d": "Every video links to a location.",
      "what.3t": "Explorer routes",
      "what.3d": "Follow paths built by the community.",
      "what.4t": "Nearby discovery",
      "what.4d": "Find what to do around you now.",
      "what.5t": "Community layer",
      "what.5d": "See what others experienced first.",
      "what.6t": "Content → action",
      "what.6d": "Watch it, then go live it.",
      "flowsec.eyebrow": "Product flow",
      "flowsec.title": "From inspiration to movement.",
      "flowsec.lead": "Each experience feeds the next. Discover, explore, record and recommend.",
      "flowsec.1": "Video discovery",
      "flowsec.2": "Place detail",
      "flowsec.3": "Map location",
      "flowsec.4": "Route planning",
      "flowsec.5": "Real visit",
      "flowsec.6": "New content",
      "flowsec.quote": "Every explored place makes the network smarter, richer and more alive.",
      "audience.eyebrow": "Who it's for",
      "audience.title": "Built for explorers, creators and local discovery.",
      "audience.1t": "Local explorers",
      "audience.1d": "Spontaneous plans, hidden spots, food, nature and city experiences near you.",
      "audience.2t": "Travelers",
      "audience.2d": "Real content from people who were there — not generic lists.",
      "audience.3t": "Creators",
      "audience.3d": "Videos that drive visits and routes, not just views.",
      "audience.4t": "Tourism & local business",
      "audience.4d": "Authentic discovery for destinations and places.",
      "features.eyebrow": "Features",
      "features.title": "Built for real-world discovery.",
      "features.1t": "Video-first discovery",
      "features.1d": "Discover places through real short-form videos.",
      "features.2t": "Places with context",
      "features.2d": "Every video connects to an actual location.",
      "features.3t": "Smart routes",
      "features.3d": "Turn places into routes you can follow.",
      "features.4t": "Mid-route posting",
      "features.4d": "Create places and upload videos while exploring.",
      "features.5t": "Community layer",
      "features.5d": "See what explorers experienced before you go.",
      "features.6t": "Nearby experiences",
      "features.6d": "Find what to do based on location and interest.",
      "features.7t": "Creator profiles",
      "features.7d": "Build reputation by sharing real places and routes.",
      "features.8t": "Tourism intelligence",
      "features.8d": "Understand what people actually explore.",
      "compare.eyebrow": "Differentiation",
      "compare.title": "Explore is not another map. It's the social layer of the real world.",
      "compare.tiktok": "TikTok / Instagram",
      "compare.maps": "Google Maps",
      "compare.trip": "TripAdvisor",
      "compare.explore": "Explore",
      "compare.good": "Great for",
      "compare.weak": "Weak for",
      "compare.watch": "watching",
      "compare.going": "going",
      "compare.locating": "locating",
      "compare.feeling": "feeling",
      "compare.reviews": "reviews",
      "compare.authentic": "authentic discovery",
      "compare.tagline": "Watch it. Feel it. Map it. Route it. Live it.",
      "midroute.eyebrow": "Mid-route",
      "midroute.title": "Exploration doesn't wait until the route ends.",
      "midroute.lead": "Discover and create while you move. Found something on the way? Publish the place, add location, upload video — routes stay alive, not static.",
      "midroute.1": "Create places while exploring",
      "midroute.2": "Upload videos mid-route",
      "midroute.3": "Routes become living experiences",
      "tourism.eyebrow": "Local impact",
      "tourism.title": "Local experiences deserve better discovery.",
      "tourism.lead": "Small businesses, viewpoints, beaches, urban spots, culture, local food and nature — visible through authentic content.",
      "tourism.quote": "Explore helps turn hidden places into visible experiences.",
      "mockups.eyebrow": "Product",
      "mockups.title": "See Explore in action.",
      "mockups.feed": "Video feed",
      "mockups.place": "Place detail",
      "mockups.map": "Map & routes",
      "mockups.profile": "Explorer profile",
      "mockups.route": "Route view",
      "mockups.create": "Create place",
      "mockups.upload": "Upload video",
      "cta.title": "Don't just watch the world. Explore it.",
      "cta.lead": "Join a new way to discover places through videos, maps, routes and real experiences.",
      "footer.desc": "Explore Atlas is a geospatial social network for real-world discovery.",
      "footer.product": "Product",
      "footer.company": "Company",
      "footer.legal": "Legal",
      "footer.home": "Home",
      "footer.how": "How it works",
      "footer.creators": "For creators",
      "footer.partners": "For tourism partners",
      "footer.privacy": "Privacy",
      "footer.terms": "Terms",
      "meta.title": "Explore Atlas — The Geospatial Social Network for Real-World Discovery"
    },
    es: {
      "nav.product": "Producto",
      "nav.how": "Cómo funciona",
      "nav.creators": "Creadores",
      "nav.partners": "Aliados",
      "nav.contact": "Contacto",
      "cta.start": "Empezar a explorar",
      "cta.how": "Ver cómo funciona",
      "cta.explorer": "Ser explorador",
      "cta.partner": "Aliarte con Explore",
      "hero.eyebrow": "Red social geoespacial",
      "hero.title1": "Donde el contenido social se convierte en",
      "hero.title2": "exploración real.",
      "hero.lead": "Explore Atlas conecta videos, lugares, rutas y experiencias reales para ayudarte a descubrir qué hacer, dónde ir y cómo llegar.",
      "badge.video": "Video primero",
      "badge.map": "Conectado al mapa",
      "badge.route": "Listo para rutas",
      "badge.community": "Impulsado por la comunidad",
      "flow.video": "Video",
      "flow.place": "Lugar",
      "flow.route": "Ruta",
      "flow.experience": "Experiencia",
      "problem.eyebrow": "El problema",
      "problem.title": "Descubrir lugares está roto.",
      "problem.lead": "La gente descubre en TikTok o Instagram, luego salta a Maps, reseñas y planificación — el contenido inspira, pero rara vez se convierte en acción.",
      "problem.1": "TikTok e Instagram muestran videos, pero no los convierten en rutas.",
      "problem.2": "Google Maps ubica lugares, pero no transmite cómo se sienten.",
      "problem.3": "TripAdvisor se siente genérico y comercial.",
      "problem.4": "Experiencias locales casi nunca aparecen en plataformas grandes.",
      "problem.5": "La gente quiere saber qué hacer cerca ahora — no listas infinitas.",
      "problem.quote": "La gente no solo quiere recomendaciones. Quiere sentir el lugar antes de ir.",
      "solution.eyebrow": "La solución",
      "solution.title": "Explore conecta el video, el lugar y la ruta.",
      "solution.lead": "Cada lugar puede tener videos reales, ubicación exacta, detalles útiles, rutas y contenido de otros exploradores.",
      "solution.1t": "Mira un video real",
      "solution.1d": "Vive la experiencia antes de moverte.",
      "solution.2t": "Toca el lugar",
      "solution.2d": "Abre contexto ligado a una ubicación real.",
      "solution.3t": "Ve el mapa",
      "solution.3d": "Entiende dónde está y qué hay cerca.",
      "solution.4t": "Sigue o crea una ruta",
      "solution.4d": "Convierte la inspiración en un camino.",
      "solution.5t": "Visita",
      "solution.5d": "Ve en el mundo real.",
      "solution.6t": "Comparte tu experiencia",
      "solution.6d": "Alimenta la red con nuevo contenido.",
      "what.eyebrow": "Qué es Explore",
      "what.title": "No es una app de turismo. Es una red social geoespacial.",
      "what.lead": "Construido alrededor de lugares reales, videos reales y movimiento real. Cada publicación conecta con un lugar que puedes visitar.",
      "what.1t": "Feed de video social",
      "what.1d": "Descubre con video corto.",
      "what.2t": "Lugares en mapas",
      "what.2d": "Cada video enlaza a una ubicación.",
      "what.3t": "Rutas de exploradores",
      "what.3d": "Sigue caminos creados por la comunidad.",
      "what.4t": "Descubrimiento cercano",
      "what.4d": "Encuentra qué hacer cerca de ti.",
      "what.5t": "Capa comunitaria",
      "what.5d": "Ve qué vivieron otros antes de ir.",
      "what.6t": "Contenido → acción",
      "what.6d": "Míralo, luego vívelo.",
      "flowsec.eyebrow": "Flujo del producto",
      "flowsec.title": "De la inspiración al movimiento.",
      "flowsec.lead": "Cada experiencia alimenta la siguiente. Descubre, explora, graba y recomienda.",
      "flowsec.1": "Descubrimiento en video",
      "flowsec.2": "Detalle del lugar",
      "flowsec.3": "Ubicación en mapa",
      "flowsec.4": "Planificación de ruta",
      "flowsec.5": "Visita real",
      "flowsec.6": "Nuevo contenido",
      "flowsec.quote": "Cada lugar explorado hace que la red sea más inteligente, más rica y más viva.",
      "audience.eyebrow": "Para quién es",
      "audience.title": "Creado para exploradores, creadores y descubrimiento local.",
      "audience.1t": "Exploradores locales",
      "audience.1d": "Planes espontáneos, spots escondidos, comida, naturaleza y ciudad cerca de ti.",
      "audience.2t": "Viajeros",
      "audience.2d": "Contenido real de quienes ya estuvieron — no listas genéricas.",
      "audience.3t": "Creadores",
      "audience.3d": "Videos que generan visitas y rutas, no solo views.",
      "audience.4t": "Turismo y negocios locales",
      "audience.4d": "Descubrimiento auténtico para destinos y lugares.",
      "features.eyebrow": "Funciones",
      "features.title": "Hecho para descubrimiento en el mundo real.",
      "features.1t": "Descubrimiento video-first",
      "features.1d": "Descubre lugares con videos cortos reales.",
      "features.2t": "Lugares con contexto",
      "features.2d": "Cada video conecta a una ubicación real.",
      "features.3t": "Rutas inteligentes",
      "features.3d": "Convierte lugares en rutas que puedes seguir.",
      "features.4t": "Publicación en ruta",
      "features.4d": "Crea lugares y sube videos mientras exploras.",
      "features.5t": "Capa comunitaria",
      "features.5d": "Ve qué vivieron otros exploradores.",
      "features.6t": "Experiencias cercanas",
      "features.6d": "Qué hacer según ubicación e interés.",
      "features.7t": "Perfiles de creador",
      "features.7d": "Reputación compartiendo lugares y rutas reales.",
      "features.8t": "Inteligencia turística",
      "features.8d": "Entiende qué explora la gente de verdad.",
      "compare.eyebrow": "Diferenciación",
      "compare.title": "Explore no es otro mapa. Es la capa social del mundo real.",
      "compare.tiktok": "TikTok / Instagram",
      "compare.maps": "Google Maps",
      "compare.trip": "TripAdvisor",
      "compare.explore": "Explore",
      "compare.good": "Fuerte en",
      "compare.weak": "Débil en",
      "compare.watch": "ver",
      "compare.going": "ir",
      "compare.locating": "ubicar",
      "compare.feeling": "sentir",
      "compare.reviews": "reseñas",
      "compare.authentic": "descubrimiento auténtico",
      "compare.tagline": "Míralo. Siéntelo. Ubícalo. Recorrelo. Vívelo.",
      "midroute.eyebrow": "En ruta",
      "midroute.title": "La exploración no espera a que termine la ruta.",
      "midroute.lead": "Descubre y crea en movimiento. ¿Encontraste algo? Publica el lugar, agrega ubicación, sube video — las rutas son vivas, no estáticas.",
      "midroute.1": "Crear lugares mientras exploras",
      "midroute.2": "Subir videos en ruta",
      "midroute.3": "Rutas como experiencias vivas",
      "tourism.eyebrow": "Impacto local",
      "tourism.title": "Las experiencias locales merecen mejor descubrimiento.",
      "tourism.lead": "Negocios pequeños, miradores, playas, spots urbanos, cultura, comida local y naturaleza — visibles con contenido auténtico.",
      "tourism.quote": "Explore ayuda a convertir lugares escondidos en experiencias visibles.",
      "mockups.eyebrow": "Producto",
      "mockups.title": "Explore en acción.",
      "mockups.feed": "Feed de video",
      "mockups.place": "Detalle de lugar",
      "mockups.map": "Mapa y rutas",
      "mockups.profile": "Perfil explorador",
      "mockups.route": "Vista de ruta",
      "mockups.create": "Crear lugar",
      "mockups.upload": "Subir video",
      "cta.title": "No solo mires el mundo. Explóralo.",
      "cta.lead": "Únete a una nueva forma de descubrir lugares con videos, mapas, rutas y experiencias reales.",
      "footer.desc": "Explore Atlas es una red social geoespacial para descubrimiento en el mundo real.",
      "footer.product": "Producto",
      "footer.company": "Empresa",
      "footer.legal": "Legal",
      "footer.home": "Inicio",
      "footer.how": "Cómo funciona",
      "footer.creators": "Para creadores",
      "footer.partners": "Para aliados turísticos",
      "footer.privacy": "Privacidad",
      "footer.terms": "Términos",
      "meta.title": "Explore Atlas — Red social geoespacial para descubrimiento real"
    }
  };

  const STORE = {
    play: "https://play.google.com/store/apps/details?id=com.explore.miapp&hl=es",
    apple: "https://apps.apple.com/do/app/explore-tourism/id6748882805?l=en-GB"
  };

  let currentLang = localStorage.getItem("explore-lang") || "en";

  function setLanguage(lang) {
    const dict = translations[lang];
    if (!dict) return;
    currentLang = lang;
    localStorage.setItem("explore-lang", lang);
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
    });

    if (dict["meta.title"]) document.title = dict["meta.title"];
  }

  function initHeader() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const mobile = document.querySelector(".nav-mobile");

    if (!header) return;

    window.addEventListener("scroll", function () {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

    if (toggle && mobile) {
      toggle.addEventListener("click", function () {
        const open = mobile.classList.toggle("is-open");
        toggle.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.style.overflow = open ? "hidden" : "";
      });
      mobile.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          mobile.classList.remove("is-open");
          toggle.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        });
      });
    }
  }

  function initLang() {
    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLanguage(btn.getAttribute("data-lang"));
      });
    });
    setLanguage(currentLang);
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  function initStoreLinks() {
    document.querySelectorAll("[data-store]").forEach(function (el) {
      const key = el.getAttribute("data-store");
      if (STORE[key]) {
        el.href = STORE[key];
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initLang();
    initReveal();
    initStoreLinks();
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
