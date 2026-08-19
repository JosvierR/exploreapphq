export type ApiDocsSurface = "postgrest" | "edge" | "admin";

export type ApiDocsSource = {
  title: string;
  slug: ApiDocsSurface;
  content: Record<string, unknown>;
};

type OpenApiOperation = Record<string, unknown> & {
  description?: string;
  operationId?: string;
  security?: Array<Record<string, unknown>>;
};

type RequestBuilderLike = {
  method?: string;
  headers?: Headers;
};

export type TryItOutRule = {
  surface: ApiDocsSurface;
  method: string;
  origin: string;
  pathname: RegExp;
  disabled: boolean;
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DISABLED_NOTICE =
  "**Try it out disabled:** this operation is destructive, privileged, or requires a non-user secret. " +
  "The contract remains visible for reference, but the admin docs will not send it.";

const RESTRICTED_ADMIN_OPERATIONS = new Set([
  "postAdminRoster",
  "patchAdminRoster",
  "deleteAdminRoster",
  "patchAdminReportById",
  "postAdminModerationAction",
  "getCronAnalyticsAggregate",
  "postCronAnalyticsAggregate",
  "postAdminAnalyticsAggregate",
  "postBootstrapBoardAdmins",
  "getTokenMetrics",
  "postAdminWaitlistNotifyLaunch",
  "postAdminBroadcast",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function operationUsesNonUserSecret(operation: OpenApiOperation) {
  return (operation.security ?? []).some((requirement) =>
    Object.keys(requirement).some((name) => name !== "bearerAuth"),
  );
}

export function isTryItOutDisabled(
  surface: ApiDocsSurface,
  method: string,
  operation: OpenApiOperation,
) {
  const normalizedMethod = method.toUpperCase();
  if (surface === "postgrest") return !READ_METHODS.has(normalizedMethod);
  if (surface === "edge") return operation.operationId === "postCloudflareStreamWebhook";
  if (normalizedMethod === "DELETE") return true;
  if (operation.operationId && RESTRICTED_ADMIN_OPERATIONS.has(operation.operationId)) return true;
  return operationUsesNonUserSecret(operation);
}

function ensurePostgrestSecurity(spec: Record<string, unknown>) {
  const components = { ...(asRecord(spec.components) ?? {}) };
  const securitySchemes = { ...(asRecord(components.securitySchemes) ?? {}) };
  securitySchemes.bearerAuth = {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Supabase access token for the signed-in admin.",
  };
  securitySchemes.supabasePublishableKey = {
    type: "apiKey",
    in: "header",
    name: "apikey",
    description: "Public Supabase publishable key; never a secret or service-role key.",
  };
  components.securitySchemes = securitySchemes;
  spec.components = components;
}

export function prepareApiDocsSource(source: ApiDocsSource): ApiDocsSource {
  const content = structuredClone(source.content);
  const paths = asRecord(content.paths) ?? {};
  if (source.slug === "postgrest") ensurePostgrestSecurity(content);

  for (const pathItemValue of Object.values(paths)) {
    const pathItem = asRecord(pathItemValue);
    if (!pathItem) continue;
    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const operation = asRecord(operationValue) as OpenApiOperation | null;
      if (!operation) continue;

      if (source.slug === "postgrest") {
        operation.security = [{ bearerAuth: [], supabasePublishableKey: [] }];
      }

      const disabled = isTryItOutDisabled(source.slug, method, operation);
      operation["x-explore-try-it-out-disabled"] = disabled;
      if (disabled && !String(operation.description ?? "").includes(DISABLED_NOTICE)) {
        operation.description = [DISABLED_NOTICE, operation.description].filter(Boolean).join("\n\n");
      }
    }
  }

  return { ...source, content };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathTemplateRegExp(pathname: string) {
  const pattern = escapeRegExp(pathname).replace(/\\\{[^/{}]+\\\}/g, "[^/]+");
  return new RegExp(`^${pattern}/?$`);
}

function joinPath(prefix: string, path: string) {
  return `${prefix.replace(/\/$/, "")}/${path.replace(/^\//, "")}`.replace(/\/{2,}/g, "/");
}

function trustedServerForSurface(surface: ApiDocsSurface, appOrigin: URL, supabaseUrl: URL) {
  if (surface === "admin") return { origin: appOrigin.origin, prefix: "" };
  if (surface === "edge") {
    return { origin: supabaseUrl.origin, prefix: joinPath(supabaseUrl.pathname, "/functions/v1") };
  }
  return { origin: supabaseUrl.origin, prefix: joinPath(supabaseUrl.pathname, "/rest/v1") };
}

export function buildTryItOutRules(
  sources: ApiDocsSource[],
  options: { appOrigin: string; supabaseUrl: string },
) {
  const appOrigin = new URL(options.appOrigin);
  const supabaseUrl = new URL(options.supabaseUrl);
  if (!/^https?:$/.test(appOrigin.protocol) || !/^https?:$/.test(supabaseUrl.protocol)) {
    throw new Error("API docs Try it out only supports HTTP(S) servers.");
  }

  const rules: TryItOutRule[] = [];
  for (const source of sources) {
    const paths = asRecord(source.content.paths) ?? {};
    const trusted = trustedServerForSurface(source.slug, appOrigin, supabaseUrl);
    for (const [path, pathItemValue] of Object.entries(paths)) {
      const pathItem = asRecord(pathItemValue);
      if (!pathItem) continue;
      for (const [method, operationValue] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method.toLowerCase())) continue;
        const operation = asRecord(operationValue);
        if (!operation) continue;
        rules.push({
          surface: source.slug,
          method: method.toUpperCase(),
          origin: trusted.origin,
          pathname: pathTemplateRegExp(joinPath(trusted.prefix, path)),
          disabled: operation["x-explore-try-it-out-disabled"] === true,
        });
      }
    }
  }
  return rules;
}

export function authorizeApiDocsRequest(options: {
  request: Request;
  requestBuilder: unknown;
  accessToken: string;
  publishableKey: string;
  rules: TryItOutRule[];
}) {
  if (!options.accessToken) throw new Error("Try it out requires an active admin session.");
  const target = new URL(options.request.url);
  if (!/^https?:$/.test(target.protocol) || target.username || target.password) {
    throw new Error("Try it out blocked an unsafe server URL.");
  }

  const method = options.request.method.toUpperCase();
  const rule = options.rules.find(
    (candidate) =>
      candidate.method === method &&
      candidate.origin === target.origin &&
      candidate.pathname.test(target.pathname),
  );
  if (!rule) throw new Error("Try it out blocked a request outside the documented server allowlist.");
  if (rule.disabled) throw new Error("Try it out is disabled for this destructive or privileged operation.");

  const requestBuilder = options.requestBuilder as RequestBuilderLike;
  if (!requestBuilder?.headers || typeof requestBuilder.headers.set !== "function") {
    throw new Error("Try it out could not safely attach the admin session.");
  }
  requestBuilder.headers.set("Authorization", `Bearer ${options.accessToken}`);
  if (rule.surface === "postgrest" || rule.surface === "edge") {
    if (!options.publishableKey) throw new Error("Supabase publishable key is missing.");
    requestBuilder.headers.set("apikey", options.publishableKey);
  } else {
    requestBuilder.headers.delete("apikey");
  }
}

export function buildAuthorizedApiDocsRequest(options: {
  request: Request;
  accessToken: string;
  publishableKey: string;
  rules: TryItOutRule[];
}) {
  const headers = new Headers(options.request.headers);
  authorizeApiDocsRequest({
    ...options,
    requestBuilder: { headers },
  });
  return new Request(options.request, { headers });
}

export function scalarAuthentication(accessToken: string, publishableKey: string) {
  return {
    preferredSecurityScheme: "bearerAuth",
    securitySchemes: {
      bearerAuth: { token: accessToken },
      supabasePublishableKey: {
        name: "apikey",
        in: "header" as const,
        value: publishableKey,
      },
    },
  };
}

export const API_DOCS_DISABLED_NOTICE = DISABLED_NOTICE;
