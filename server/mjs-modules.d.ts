declare module "*.mjs" {
  type EmailLinks = {
    siteUrl: string;
    appleUrl: string;
    playUrl: string;
    logoUrl: string;
  };
  type EmailTemplate = {
    subject: string;
    html: string;
    text: string;
  };

  const defaultExport: unknown;
  export default defaultExport;

  export const buildAppLaunchEmail: (email: string, links: EmailLinks) => EmailTemplate;
  export const buildWaitlistWelcomeEmail: (email: string, links: EmailLinks) => EmailTemplate;
  export const handleAdminAnalyticsOverview: (request: Request) => Promise<Response>;
  export const dispatchAdminAnalyticsApi: (request: Request, route: string) => Promise<Response>;
  export const handleAdminMe: (request: Request) => Promise<Response>;
  export const handleAdminModerationAction: (request: Request) => Promise<Response>;
  export const handleAdminModerationSummary: (request: Request) => Promise<Response>;
  export const handleAdminOpsSummary: (request: Request) => Promise<Response>;
  export const handleAdminReportById: (request: Request, id?: string) => Promise<Response>;
  export const handleAdminReports: (request: Request) => Promise<Response>;
  export const handleAdminSystemHealth: (request: Request) => Promise<Response>;
  export const handleAdminSystemMetrics: (request: Request) => Promise<Response>;
  export const handleBootstrapBoardAdmins: (request: Request) => Promise<Response>;
  export const handleAdminUsers: (request: Request) => Promise<Response>;
  export const handleHealth: (request: Request) => Promise<Response>;
  export const handleTokenMetrics: (request: Request) => Promise<Response>;
  export const ensureRequestId: (request: Request) => { request: Request; requestId: string };
  export const handleEvents: (request: Request) => Promise<Response>;
  export const handleReports: (request: Request) => Promise<Response>;
  export const handleUserHiddenContent: (request: Request) => Promise<Response>;
  export const handleUserHiddenContentUnhide: (request: Request) => Promise<Response>;
}
