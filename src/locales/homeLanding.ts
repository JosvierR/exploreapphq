import type { Locale } from "@/features/i18n/locales";

export type HomeLandingCopy = {
  skip: string;
  brandAria: string;
  navDiscover: string;
  navRoutes: string;
  menuOpen: string;
  menuClose: string;
  headerCta: string;
  heroAria: string;
  heroWord1: string;
  heroWord2: string;
  ctaStart: string;
  ctaApp: string;
  introAria: string;
  introLine1: string[];
  introLine2: string[];
  overviewTitle: string;
  overviewLead: string;
  demos: { id: "discover" | "record" | "community"; title: string; caption: string }[];
  previewEyebrow: string;
  previewTitle: string;
  previewClose: string;
  previewTabs: string;
  previewNote: string;
  routesEyebrow: string;
  routesTitle: string;
  routesLead: string;
  routesBullets: string[];
  routesDemoTitle: string;
  routesDemoSub: string;
  routesFloatTitle: string;
  routesFloatSub: string;
  destinationsEyebrow: string;
  destinationsTitle: string;
  destinationsLead: string;
  destinations: {
    image: "mountains" | "coast" | "forest";
    tag: string;
    title: string;
    text: string;
    alt: string;
  }[];
  closingTitle: string;
  closingLead: string;
  closingCta: string;
  worldwide: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    lead: string;
    mapLabel: string;
    mapSub: string;
    carouselLabel: string;
    footer: string;
    discover: string;
    community: string;
    prevCountry: string;
    nextCountry: string;
    pause: string;
    resume: string;
    viewCountry: (country: string) => string;
    destinations: {
      code: string;
      country: string;
      interest: string;
      title: string;
      text: string;
    }[];
  };
  metaTitle: string;
  metaDescription: string;
};

const en: HomeLandingCopy = {
  skip: "Skip to content",
  brandAria: "Explore, home",
  navDiscover: "Discover",
  navRoutes: "Routes",
  menuOpen: "Open menu",
  menuClose: "Close menu",
  headerCta: "See Explore",
  heroAria: "Meet Explore",
  heroWord1: "Meet",
  heroWord2: "Explore",
  ctaStart: "Start discovering",
  ctaApp: "See the app",
  introAria: "Thousands of routes. One app.",
  introLine1: ["Thousands", "of", "routes."],
  introLine2: ["One", "single", "app."],
  overviewTitle: "Discover. Record. Connect.",
  overviewLead: "Discover, record and share. Everything that moves you, in one place.",
  demos: [
    { id: "discover", title: "Discover", caption: "Find your next favorite place." },
    { id: "record", title: "Record", caption: "Turn the journey into a story." },
    { id: "community", title: "Connect", caption: "Adventure is also people." },
  ],
  previewEyebrow: "Meet Explore",
  previewTitle: "Your next story.",
  previewClose: "Close preview",
  previewTabs: "Explore views",
  previewNote: "Conceptual Explore preview · Illustrative content",
  routesEyebrow: "Record your path",
  routesTitle: "Every route deserves\nto be remembered.",
  routesLead:
    "The trip starts long before you arrive. Record your route, keep what you lived and share those small discoveries that made the journey special.",
  routesBullets: [
    "Your route, step by step",
    "Places and experiences in one story",
    "A new path to inspire others",
  ],
  routesDemoTitle: "Your first route starts here",
  routesDemoSub: "Try the route view",
  routesFloatTitle: "One path. Your story.",
  routesFloatSub: "Remember what got you there.",
  destinationsEyebrow: "Change your perspective",
  destinationsTitle: "Leave the familiar.",
  destinationsLead: "Sometimes the best plan is discovering a place you didn’t even know existed.",
  destinations: [
    {
      image: "mountains",
      tag: "Nature",
      title: "Where the trail begins.",
      text: "A new path. Another way of looking.",
      alt: "Valley between mountains",
    },
    {
      image: "coast",
      tag: "Getaways",
      title: "A corner by the sea.",
      text: "Unplug from the usual.",
      alt: "Turquoise beach at sunset",
    },
    {
      image: "forest",
      tag: "Adventure",
      title: "A world that surprises you.",
      text: "Leave room for the unexpected.",
      alt: "Forest with wildlife and mountains",
    },
  ],
  closingTitle: "Your next story\nis out there.",
  closingLead: "A place to discover. A route to live.\nPeople you haven’t met yet.",
  closingCta: "Meet Explore",
  worldwide: {
    eyebrow: "Discover the unexpected",
    title: "Connect.",
    titleAccent: "Without borders.",
    lead: "Places off the usual map.\nPeople with the same curiosity.",
    mapLabel: "Connect",
    mapSub: "With the world",
    carouselLabel: "Connections around the world",
    footer: "Different places. Shared interests.",
    discover: "Discover a new place",
    community: "Meet the community",
    prevCountry: "Previous country",
    nextCountry: "Next country",
    pause: "Pause map tour",
    resume: "Resume map tour",
    viewCountry: (country) => `View ${country}`,
    destinations: [
      {
        code: "uk",
        country: "United Kingdom",
        interest: "Places off the beaten path",
        title: "The best spots aren’t always in the guides.",
        text: "A hidden trail. A beach almost nobody knows. That place someone found by chance and decided to share.",
      },
      {
        code: "swe",
        country: "Sweden",
        interest: "Inspiration for your next getaway",
        title: "The same curiosity. Another horizon.",
        text: "Find inspiration from people who love getting lost among forests, lakes and new trails.",
      },
      {
        code: "nl",
        country: "Netherlands",
        interest: "Shared experiences",
        title: "A place is discovered through its people.",
        text: "Explore experiences that bring you closer to a world you still have left to know.",
      },
      {
        code: "aus",
        country: "Australia",
        interest: "By the sea",
        title: "The urge to explore has no borders.",
        text: "From a seaside escape to an unexpected route, an adventure can bring you closer to someone.",
      },
      {
        code: "ca",
        country: "Canada",
        interest: "Routes shared by the community",
        title: "New paths. New connections.",
        text: "Connect with people who share your love for nature and discover the world through their routes.",
      },
      {
        code: "vnm",
        country: "Vietnam",
        interest: "Local experiences",
        title: "The next story can start far away.",
        text: "Share what you lived and meet another perspective. A shared interest can be the start of a connection.",
      },
    ],
  },
  metaTitle: "Explore — The world is discovered by sharing",
  metaDescription:
    "Explore is a social network to discover places, record routes and share travel experiences with people who share your interests.",
};

const es: HomeLandingCopy = {
  skip: "Saltar al contenido",
  brandAria: "Explore, inicio",
  navDiscover: "Descubre",
  navRoutes: "Rutas",
  menuOpen: "Abrir menú",
  menuClose: "Cerrar menú",
  headerCta: "Ver Explore",
  heroAria: "Conoce Explore",
  heroWord1: "Conoce",
  heroWord2: "Explore",
  ctaStart: "Empieza a descubrir",
  ctaApp: "Conoce la app",
  introAria: "Miles de rutas. Una sola app.",
  introLine1: ["Miles", "de", "rutas."],
  introLine2: ["Una", "sola", "app."],
  overviewTitle: "Descubre. Graba. Conecta.",
  overviewLead: "Descubre, graba y comparte. Todo lo que te mueve, en un mismo lugar.",
  demos: [
    { id: "discover", title: "Descubre", caption: "Encuentra tu próximo lugar favorito." },
    { id: "record", title: "Graba", caption: "Convierte el camino en una historia." },
    { id: "community", title: "Conecta", caption: "La aventura también son las personas." },
  ],
  previewEyebrow: "Conoce Explore",
  previewTitle: "Tu próxima historia.",
  previewClose: "Cerrar vista previa",
  previewTabs: "Vistas de Explore",
  previewNote: "Vista conceptual de Explore · Contenido ilustrativo",
  routesEyebrow: "Graba tu camino",
  routesTitle: "Cada ruta merece\nser recordada.",
  routesLead:
    "El viaje empieza mucho antes de llegar. Graba tu recorrido, guarda lo que viviste y comparte esos pequeños descubrimientos que hicieron especial el camino.",
  routesBullets: [
    "Tu recorrido, paso a paso",
    "Lugares y experiencias en una historia",
    "Una nueva ruta para inspirar a otros",
  ],
  routesDemoTitle: "Tu primera ruta empieza aquí",
  routesDemoSub: "Prueba la vista de recorrido",
  routesFloatTitle: "Un camino. Tu historia.",
  routesFloatSub: "Recuerda lo que te hizo llegar.",
  destinationsEyebrow: "Cambia de perspectiva",
  destinationsTitle: "Sal de lo conocido.",
  destinationsLead: "A veces, el mejor plan es descubrir un lugar que ni siquiera sabías que existía.",
  destinations: [
    {
      image: "mountains",
      tag: "Naturaleza",
      title: "Donde empieza el sendero.",
      text: "Un nuevo camino. Otra forma de mirar.",
      alt: "Valle entre montañas",
    },
    {
      image: "coast",
      tag: "Escapadas",
      title: "Un rincón junto al mar.",
      text: "Desconecta de lo de siempre.",
      alt: "Playa de agua turquesa al atardecer",
    },
    {
      image: "forest",
      tag: "Aventura",
      title: "Un mundo que te sorprende.",
      text: "Deja espacio para lo inesperado.",
      alt: "Bosque con fauna y montañas",
    },
  ],
  closingTitle: "Tu próxima historia\nestá ahí fuera.",
  closingLead: "Un lugar por descubrir. Una ruta por vivir.\nPersonas que todavía no conoces.",
  closingCta: "Conoce Explore",
  worldwide: {
    eyebrow: "Descubre lo inesperado",
    title: "Conecta.",
    titleAccent: "Sin fronteras.",
    lead: "Lugares fuera de lo habitual.\nPersonas con tu misma curiosidad.",
    mapLabel: "Conecta",
    mapSub: "Con el mundo",
    carouselLabel: "Conexiones alrededor del mundo",
    footer: "Lugares distintos. Intereses en común.",
    discover: "Descubre un nuevo lugar",
    community: "Conoce la comunidad",
    prevCountry: "País anterior",
    nextCountry: "Siguiente país",
    pause: "Pausar recorrido del mapa",
    resume: "Reanudar recorrido del mapa",
    viewCountry: (country) => `Ver ${country}`,
    destinations: [
      {
        code: "uk",
        country: "Reino Unido",
        interest: "Lugares fuera de lo habitual",
        title: "Lo mejor no siempre sale en las guías.",
        text: "Un sendero escondido. Una playa que casi nadie conoce. Ese lugar que alguien encontró por casualidad y decidió compartir.",
      },
      {
        code: "swe",
        country: "Suecia",
        interest: "Inspiración para tu próxima escapada",
        title: "La misma curiosidad. Otro horizonte.",
        text: "Encuentra inspiración en quienes disfrutan perderse entre bosques, lagos y nuevos senderos.",
      },
      {
        code: "nl",
        country: "Países Bajos",
        interest: "Experiencias compartidas",
        title: "Un lugar se descubre a través de su gente.",
        text: "Explora experiencias que te acercan a un mundo que todavía te falta por conocer.",
      },
      {
        code: "aus",
        country: "Australia",
        interest: "Junto al mar",
        title: "Las ganas de explorar no tienen fronteras.",
        text: "Desde una escapada junto al mar hasta un recorrido inesperado, una aventura puede acercarte a alguien.",
      },
      {
        code: "ca",
        country: "Canadá",
        interest: "Rutas compartidas por la comunidad",
        title: "Nuevos caminos. Nuevas conexiones.",
        text: "Conecta con personas que comparten tu pasión por la naturaleza y descubre el mundo a través de sus recorridos.",
      },
      {
        code: "vnm",
        country: "Vietnam",
        interest: "Experiencias locales",
        title: "La próxima historia puede empezar lejos.",
        text: "Comparte lo que viviste y conoce otra perspectiva. Un interés en común puede ser el comienzo de una conexión.",
      },
    ],
  },
  metaTitle: "Explore — El mundo se descubre compartiendo",
  metaDescription:
    "Explore es una red social para descubrir lugares, grabar rutas y compartir experiencias turísticas con personas que comparten tus intereses.",
};

const pt: HomeLandingCopy = {
  ...en,
  skip: "Saltar para o conteúdo",
  brandAria: "Explore, início",
  navDiscover: "Descobrir",
  navRoutes: "Rotas",
  menuOpen: "Abrir menu",
  menuClose: "Fechar menu",
  headerCta: "Ver Explore",
  heroAria: "Conheça Explore",
  heroWord1: "Conheça",
  heroWord2: "Explore",
  ctaStart: "Comece a descobrir",
  ctaApp: "Conheça a app",
  introAria: "Milhares de rotas. Uma só app.",
  introLine1: ["Milhares", "de", "rotas."],
  introLine2: ["Uma", "só", "app."],
  overviewTitle: "Descubra. Grave. Conecte.",
  overviewLead: "Descubra, grave e partilhe. Tudo o que o move, num só lugar.",
  demos: [
    { id: "discover", title: "Descubra", caption: "Encontre o seu próximo lugar favorito." },
    { id: "record", title: "Grave", caption: "Transforme o caminho numa história." },
    { id: "community", title: "Conecte", caption: "A aventura também são as pessoas." },
  ],
  previewEyebrow: "Conheça Explore",
  previewTitle: "A sua próxima história.",
  previewClose: "Fechar pré-visualização",
  previewTabs: "Vistas Explore",
  previewNote: "Pré-visualização conceptual Explore · Conteúdo ilustrativo",
  routesEyebrow: "Grave o seu caminho",
  routesTitle: "Cada rota merece\nser lembrada.",
  routesLead:
    "A viagem começa muito antes de chegar. Grave o percurso, guarde o que viveu e partilhe essas pequenas descobertas que tornaram o caminho especial.",
  routesBullets: [
    "O seu percurso, passo a passo",
    "Lugares e experiências numa história",
    "Uma nova rota para inspirar outros",
  ],
  routesDemoTitle: "A sua primeira rota começa aqui",
  routesDemoSub: "Experimente a vista de percurso",
  routesFloatTitle: "Um caminho. A sua história.",
  routesFloatSub: "Lembre-se do que o trouxe até aqui.",
  destinationsEyebrow: "Mude de perspetiva",
  destinationsTitle: "Saia do conhecido.",
  destinationsLead: "Por vezes, o melhor plano é descobrir um lugar que nem sabia que existia.",
  destinations: [
    {
      image: "mountains",
      tag: "Natureza",
      title: "Onde o trilho começa.",
      text: "Um novo caminho. Outra forma de olhar.",
      alt: "Vale entre montanhas",
    },
    {
      image: "coast",
      tag: "Escapadelas",
      title: "Um canto junto ao mar.",
      text: "Desligue da rotina.",
      alt: "Praia de água turquesa ao pôr do sol",
    },
    {
      image: "forest",
      tag: "Aventura",
      title: "Um mundo que o surpreende.",
      text: "Deixe espaço para o inesperado.",
      alt: "Floresta com fauna e montanhas",
    },
  ],
  closingTitle: "A sua próxima história\nestá lá fora.",
  closingLead: "Um lugar por descobrir. Uma rota por viver.\nPessoas que ainda não conhece.",
  closingCta: "Conheça Explore",
  worldwide: {
    ...en.worldwide,
    eyebrow: "Descubra o inesperado",
    title: "Conecte.",
    titleAccent: "Sem fronteiras.",
    lead: "Lugares fora do habitual.\nPessoas com a mesma curiosidade.",
    mapLabel: "Conecte",
    mapSub: "Com o mundo",
    carouselLabel: "Ligações em todo o mundo",
    footer: "Lugares diferentes. Interesses em comum.",
    discover: "Descubra um novo lugar",
    community: "Conheça a comunidade",
    prevCountry: "País anterior",
    nextCountry: "País seguinte",
    pause: "Pausar percurso do mapa",
    resume: "Retomar percurso do mapa",
    viewCountry: (country) => `Ver ${country}`,
    destinations: [
      {
        code: "uk",
        country: "Reino Unido",
        interest: "Lugares fora do habitual",
        title: "O melhor nem sempre está nos guias.",
        text: "Um trilho escondido. Uma praia que quase ninguém conhece. Aquele lugar que alguém encontrou por acaso e decidiu partilhar.",
      },
      {
        code: "swe",
        country: "Suécia",
        interest: "Inspiração para a próxima escapadela",
        title: "A mesma curiosidade. Outro horizonte.",
        text: "Encontre inspiração em quem gosta de se perder entre florestas, lagos e novos trilhos.",
      },
      {
        code: "nl",
        country: "Países Baixos",
        interest: "Experiências partilhadas",
        title: "Um lugar descobre-se através das pessoas.",
        text: "Explore experiências que o aproximam de um mundo que ainda falta conhecer.",
      },
      {
        code: "aus",
        country: "Austrália",
        interest: "Junto ao mar",
        title: "A vontade de explorar não tem fronteiras.",
        text: "De uma escapadela junto ao mar a um percurso inesperado, uma aventura pode aproximá-lo de alguém.",
      },
      {
        code: "ca",
        country: "Canadá",
        interest: "Rotas partilhadas pela comunidade",
        title: "Novos caminhos. Novas ligações.",
        text: "Ligue-se a pessoas que partilham a paixão pela natureza e descubra o mundo através das suas rotas.",
      },
      {
        code: "vnm",
        country: "Vietname",
        interest: "Experiências locais",
        title: "A próxima história pode começar longe.",
        text: "Partilhe o que viveu e conheça outra perspetiva. Um interesse em comum pode ser o início de uma ligação.",
      },
    ],
  },
  metaTitle: "Explore — O mundo descobre-se a partilhar",
  metaDescription:
    "Explore é uma rede social para descobrir lugares, gravar rotas e partilhar experiências de viagem com pessoas que partilham os seus interesses.",
};

const fr: HomeLandingCopy = {
  ...en,
  skip: "Aller au contenu",
  brandAria: "Explore, accueil",
  navDiscover: "Découvrir",
  navRoutes: "Itinéraires",
  menuOpen: "Ouvrir le menu",
  menuClose: "Fermer le menu",
  headerCta: "Voir Explore",
  heroAria: "Découvrez Explore",
  heroWord1: "Découvrez",
  heroWord2: "Explore",
  ctaStart: "Commencer à découvrir",
  ctaApp: "Voir l’app",
  introAria: "Des milliers d’itinéraires. Une seule app.",
  introLine1: ["Des", "milliers", "d’itinéraires."],
  introLine2: ["Une", "seule", "app."],
  overviewTitle: "Découvrez. Enregistrez. Connectez.",
  overviewLead: "Découvrez, enregistrez et partagez. Tout ce qui vous inspire, au même endroit.",
  demos: [
    { id: "discover", title: "Découvrir", caption: "Trouvez votre prochain lieu préféré." },
    { id: "record", title: "Enregistrer", caption: "Transformez le chemin en histoire." },
    { id: "community", title: "Connecter", caption: "L’aventure, ce sont aussi les gens." },
  ],
  previewEyebrow: "Découvrez Explore",
  previewTitle: "Votre prochaine histoire.",
  previewClose: "Fermer l’aperçu",
  previewTabs: "Vues Explore",
  previewNote: "Aperçu conceptuel Explore · Contenu illustratif",
  routesEyebrow: "Enregistrez votre chemin",
  routesTitle: "Chaque itinéraire mérite\nd’être gardé.",
  routesLead:
    "Le voyage commence bien avant l’arrivée. Enregistrez votre parcours, gardez ce que vous avez vécu et partagez ces petites découvertes qui ont rendu le chemin spécial.",
  routesBullets: [
    "Votre parcours, étape par étape",
    "Lieux et expériences dans une histoire",
    "Un nouvel itinéraire pour inspirer les autres",
  ],
  routesDemoTitle: "Votre premier itinéraire commence ici",
  routesDemoSub: "Essayez la vue parcours",
  routesFloatTitle: "Un chemin. Votre histoire.",
  routesFloatSub: "Souvenez-vous de ce qui vous a mené là.",
  destinationsEyebrow: "Changez de perspective",
  destinationsTitle: "Sortez du familier.",
  destinationsLead: "Parfois, le meilleur plan est de découvrir un lieu dont vous ignoriez même l’existence.",
  destinations: [
    {
      image: "mountains",
      tag: "Nature",
      title: "Là où le sentier commence.",
      text: "Un nouveau chemin. Une autre façon de voir.",
      alt: "Vallée entre les montagnes",
    },
    {
      image: "coast",
      tag: "Escapades",
      title: "Un coin au bord de la mer.",
      text: "Déconnectez de l’habitude.",
      alt: "Plage turquoise au coucher du soleil",
    },
    {
      image: "forest",
      tag: "Aventure",
      title: "Un monde qui vous surprend.",
      text: "Laissez de la place à l’inattendu.",
      alt: "Forêt avec faune et montagnes",
    },
  ],
  closingTitle: "Votre prochaine histoire\nest dehors.",
  closingLead: "Un lieu à découvrir. Un itinéraire à vivre.\nDes personnes que vous ne connaissez pas encore.",
  closingCta: "Découvrir Explore",
  worldwide: {
    ...en.worldwide,
    eyebrow: "Découvrez l’inattendu",
    title: "Connectez.",
    titleAccent: "Sans frontières.",
    lead: "Des lieux hors des sentiers battus.\nDes personnes avec la même curiosité.",
    mapLabel: "Connectez",
    mapSub: "Avec le monde",
    carouselLabel: "Connexions autour du monde",
    footer: "Des lieux différents. Des intérêts communs.",
    discover: "Découvrir un nouveau lieu",
    community: "Découvrir la communauté",
    prevCountry: "Pays précédent",
    nextCountry: "Pays suivant",
    pause: "Mettre en pause le parcours",
    resume: "Reprendre le parcours",
    viewCountry: (country) => `Voir ${country}`,
    destinations: [
      {
        code: "uk",
        country: "Royaume-Uni",
        interest: "Lieux hors des sentiers battus",
        title: "Le meilleur n’est pas toujours dans les guides.",
        text: "Un sentier caché. Une plage que presque personne ne connaît. Ce lieu trouvé par hasard et partagé.",
      },
      {
        code: "swe",
        country: "Suède",
        interest: "Inspiration pour votre prochaine escapade",
        title: "La même curiosité. Un autre horizon.",
        text: "Trouvez l’inspiration auprès de ceux qui aiment se perdre entre forêts, lacs et nouveaux sentiers.",
      },
      {
        code: "nl",
        country: "Pays-Bas",
        interest: "Expériences partagées",
        title: "Un lieu se découvre à travers ses gens.",
        text: "Explorez des expériences qui vous rapprochent d’un monde qu’il vous reste à connaître.",
      },
      {
        code: "aus",
        country: "Australie",
        interest: "Au bord de la mer",
        title: "L’envie d’explorer n’a pas de frontières.",
        text: "D’une escapade en bord de mer à un parcours inattendu, une aventure peut vous rapprocher de quelqu’un.",
      },
      {
        code: "ca",
        country: "Canada",
        interest: "Itinéraires partagés par la communauté",
        title: "Nouveaux chemins. Nouvelles connexions.",
        text: "Connectez avec des personnes qui partagent votre passion pour la nature et découvrez le monde à travers leurs parcours.",
      },
      {
        code: "vnm",
        country: "Vietnam",
        interest: "Expériences locales",
        title: "La prochaine histoire peut commencer loin.",
        text: "Partagez ce que vous avez vécu et découvrez une autre perspective. Un intérêt commun peut être le début d’une connexion.",
      },
    ],
  },
  metaTitle: "Explore — Le monde se découvre en partageant",
  metaDescription:
    "Explore est un réseau social pour découvrir des lieux, enregistrer des itinéraires et partager des expériences de voyage avec des personnes qui partagent vos intérêts.",
};

const de: HomeLandingCopy = {
  ...en,
  skip: "Zum Inhalt springen",
  brandAria: "Explore, Startseite",
  navDiscover: "Entdecken",
  navRoutes: "Routen",
  menuOpen: "Menü öffnen",
  menuClose: "Menü schließen",
  headerCta: "Explore ansehen",
  heroAria: "Lerne Explore kennen",
  heroWord1: "Lerne",
  heroWord2: "Explore",
  ctaStart: "Jetzt entdecken",
  ctaApp: "App ansehen",
  introAria: "Tausende Routen. Eine App.",
  introLine1: ["Tausende", "von", "Routen."],
  introLine2: ["Eine", "einzige", "App."],
  overviewTitle: "Entdecken. Aufnehmen. Verbinden.",
  overviewLead: "Entdecke, nimm auf und teile. Alles, was dich bewegt, an einem Ort.",
  demos: [
    { id: "discover", title: "Entdecken", caption: "Finde deinen nächsten Lieblingsort." },
    { id: "record", title: "Aufnehmen", caption: "Mach aus dem Weg eine Geschichte." },
    { id: "community", title: "Verbinden", caption: "Abenteuer sind auch Menschen." },
  ],
  previewEyebrow: "Lerne Explore kennen",
  previewTitle: "Deine nächste Geschichte.",
  previewClose: "Vorschau schließen",
  previewTabs: "Explore-Ansichten",
  previewNote: "Konzeptvorschau von Explore · Illustrativer Inhalt",
  routesEyebrow: "Nimm deinen Weg auf",
  routesTitle: "Jede Route verdient,\nerinnert zu werden.",
  routesLead:
    "Die Reise beginnt lange vor der Ankunft. Nimm deine Route auf, bewahre, was du erlebt hast, und teile die kleinen Entdeckungen, die den Weg besonders machten.",
  routesBullets: [
    "Deine Route, Schritt für Schritt",
    "Orte und Erlebnisse in einer Geschichte",
    "Eine neue Route, um andere zu inspirieren",
  ],
  routesDemoTitle: "Deine erste Route beginnt hier",
  routesDemoSub: "Teste die Routenansicht",
  routesFloatTitle: "Ein Weg. Deine Geschichte.",
  routesFloatSub: "Erinnere dich, was dich dorthin brachte.",
  destinationsEyebrow: "Wechsle die Perspektive",
  destinationsTitle: "Verlasse das Bekannte.",
  destinationsLead: "Manchmal ist der beste Plan, einen Ort zu entdecken, von dem du nicht einmal wusstest, dass er existiert.",
  destinations: [
    {
      image: "mountains",
      tag: "Natur",
      title: "Wo der Pfad beginnt.",
      text: "Ein neuer Weg. Eine andere Art zu sehen.",
      alt: "Tal zwischen Bergen",
    },
    {
      image: "coast",
      tag: "Ausflüge",
      title: "Ein Ort am Meer.",
      text: "Trenne dich vom Gewohnten.",
      alt: "Türkisener Strand bei Sonnenuntergang",
    },
    {
      image: "forest",
      tag: "Abenteuer",
      title: "Eine Welt, die überrascht.",
      text: "Lass Raum für Unerwartetes.",
      alt: "Wald mit Wildtieren und Bergen",
    },
  ],
  closingTitle: "Deine nächste Geschichte\nwartet draußen.",
  closingLead: "Ein Ort zum Entdecken. Eine Route zum Erleben.\nMenschen, die du noch nicht kennst.",
  closingCta: "Explore kennenlernen",
  worldwide: {
    ...en.worldwide,
    eyebrow: "Entdecke das Unerwartete",
    title: "Verbinde.",
    titleAccent: "Ohne Grenzen.",
    lead: "Orte abseits des Üblichen.\nMenschen mit derselben Neugier.",
    mapLabel: "Verbinde",
    mapSub: "Mit der Welt",
    carouselLabel: "Verbindungen rund um die Welt",
    footer: "Verschiedene Orte. Gemeinsame Interessen.",
    discover: "Einen neuen Ort entdecken",
    community: "Die Community kennenlernen",
    prevCountry: "Vorheriges Land",
    nextCountry: "Nächstes Land",
    pause: "Kartentour pausieren",
    resume: "Kartentour fortsetzen",
    viewCountry: (country) => `${country} ansehen`,
    destinations: [
      {
        code: "uk",
        country: "Vereinigtes Königreich",
        interest: "Orte abseits der üblichen Wege",
        title: "Das Beste steht nicht immer im Reiseführer.",
        text: "Ein versteckter Pfad. Ein Strand, den fast niemand kennt. Der Ort, den jemand zufällig fand und teilen wollte.",
      },
      {
        code: "swe",
        country: "Schweden",
        interest: "Inspiration für den nächsten Ausflug",
        title: "Dieselbe Neugier. Ein anderer Horizont.",
        text: "Finde Inspiration bei Menschen, die sich gern in Wäldern, an Seen und auf neuen Wegen verlieren.",
      },
      {
        code: "nl",
        country: "Niederlande",
        interest: "Geteilte Erlebnisse",
        title: "Ein Ort wird durch seine Menschen entdeckt.",
        text: "Erkunde Erlebnisse, die dich einer Welt näherbringen, die du noch kennenlernen willst.",
      },
      {
        code: "aus",
        country: "Australien",
        interest: "Am Meer",
        title: "Der Drang zu entdecken kennt keine Grenzen.",
        text: "Vom Strandausflug bis zur unerwarteten Route — ein Abenteuer kann dich jemandem näherbringen.",
      },
      {
        code: "ca",
        country: "Kanada",
        interest: "Von der Community geteilte Routen",
        title: "Neue Wege. Neue Verbindungen.",
        text: "Verbinde dich mit Menschen, die deine Liebe zur Natur teilen, und entdecke die Welt durch ihre Routen.",
      },
      {
        code: "vnm",
        country: "Vietnam",
        interest: "Lokale Erlebnisse",
        title: "Die nächste Geschichte kann weit weg beginnen.",
        text: "Teile, was du erlebt hast, und lerne eine andere Perspektive kennen. Ein gemeinsames Interesse kann der Anfang einer Verbindung sein.",
      },
    ],
  },
  metaTitle: "Explore — Die Welt entdeckt man gemeinsam",
  metaDescription:
    "Explore ist ein soziales Netzwerk, um Orte zu entdecken, Routen aufzunehmen und Reiseerlebnisse mit Menschen zu teilen, die deine Interessen teilen.",
};

export const homeLanding: Record<Locale, HomeLandingCopy> = {
  en,
  es,
  pt,
  fr,
  de,
};

export function getHomeLanding(locale: Locale): HomeLandingCopy {
  return homeLanding[locale] ?? homeLanding.en;
}
