/**
 * Lightweight Swagger 2 → OpenAPI 3.1 conversion for PostgREST-shaped docs.
 * Used when swagger2openapi is unavailable or fails in serverless.
 */

/**
 * @param {Record<string, unknown>} swagger
 * @returns {Record<string, unknown>}
 */
export function convertSwagger2LiteToOpenApi31(swagger) {
  const info =
    swagger.info && typeof swagger.info === "object"
      ? /** @type {Record<string, unknown>} */ ({ .../** @type {object} */ (swagger.info) })
      : { title: "Explore PostgREST API", version: "0.0.0" };
  if (!info.title) info.title = "Explore PostgREST API";
  if (!info.version) info.version = "0.0.0";

  /** @type {Record<string, unknown>} */
  const openapi = {
    openapi: "3.1.0",
    info,
    paths: {},
  };

  const servers = buildServers(swagger);
  if (servers.length) openapi.servers = servers;

  if (swagger.externalDocs) openapi.externalDocs = swagger.externalDocs;
  if (swagger.tags) openapi.tags = swagger.tags;
  if (swagger.security) openapi.security = swagger.security;

  /** @type {Record<string, unknown>} */
  const components = {};
  if (swagger.definitions && typeof swagger.definitions === "object") {
    components.schemas = rewriteRefsDeep(swagger.definitions);
  }
  if (swagger.parameters && typeof swagger.parameters === "object") {
    components.parameters = Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (swagger.parameters)).map(([name, param]) => [
        name,
        convertParameter(/** @type {Record<string, unknown>} */ (param)),
      ]),
    );
  }
  if (swagger.responses && typeof swagger.responses === "object") {
    components.responses = Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (swagger.responses)).map(([name, resp]) => [
        name,
        convertResponse(/** @type {Record<string, unknown>} */ (resp)),
      ]),
    );
  }
  if (swagger.securityDefinitions && typeof swagger.securityDefinitions === "object") {
    components.securitySchemes = convertSecuritySchemes(
      /** @type {Record<string, unknown>} */ (swagger.securityDefinitions),
    );
  }
  if (Object.keys(components).length) openapi.components = components;

  const pathsIn = swagger.paths && typeof swagger.paths === "object" ? swagger.paths : {};
  /** @type {Record<string, unknown>} */
  const pathsOut = {};
  for (const [pathKey, pathItem] of Object.entries(/** @type {Record<string, unknown>} */ (pathsIn))) {
    if (!pathItem || typeof pathItem !== "object") continue;
    pathsOut[pathKey] = convertPathItem(/** @type {Record<string, unknown>} */ (pathItem));
  }
  openapi.paths = pathsOut;
  return openapi;
}

/**
 * @param {Record<string, unknown>} swagger
 */
function buildServers(swagger) {
  const host = typeof swagger.host === "string" ? swagger.host : "";
  const basePath = typeof swagger.basePath === "string" ? swagger.basePath : "";
  const schemes = Array.isArray(swagger.schemes) && swagger.schemes.length ? swagger.schemes : ["https"];
  if (!host) {
    if (basePath) return [{ url: basePath }];
    return [];
  }
  return schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath || ""}`,
  }));
}

/**
 * @param {Record<string, unknown>} pathItem
 */
function convertPathItem(pathItem) {
  /** @type {Record<string, unknown>} */
  const out = {};
  if (Array.isArray(pathItem.parameters)) {
    out.parameters = pathItem.parameters.map((param) =>
      convertParameter(/** @type {Record<string, unknown>} */ (param)),
    );
  }
  for (const method of ["get", "put", "post", "delete", "options", "head", "patch", "trace"]) {
    const op = pathItem[method];
    if (!op || typeof op !== "object") continue;
    out[method] = convertOperation(/** @type {Record<string, unknown>} */ (op));
  }
  return out;
}

/**
 * @param {Record<string, unknown>} op
 */
function convertOperation(op) {
  /** @type {Record<string, unknown>} */
  const out = { ...op };
  delete out.consumes;
  delete out.produces;
  delete out.schemes;

  const params = Array.isArray(op.parameters) ? op.parameters : [];
  /** @type {unknown[]} */
  const keptParams = [];
  /** @type {Record<string, unknown> | null} */
  let requestBody = null;

  for (const raw of params) {
    if (!raw || typeof raw !== "object") continue;
    const param = /** @type {Record<string, unknown>} */ (raw);
    if (param.in === "body") {
      requestBody = {
        description: param.description,
        required: Boolean(param.required),
        content: {
          "application/json": {
            schema: rewriteRefsDeep(param.schema || {}),
          },
        },
      };
      continue;
    }
    if (param.in === "formData") {
      if (!requestBody) {
        requestBody = {
          required: false,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: {}, required: [] },
            },
          },
        };
      }
      const content = /** @type {Record<string, any>} */ (requestBody.content)["multipart/form-data"];
      const schema = content.schema;
      const name = String(param.name || "field");
      schema.properties[name] = rewriteRefsDeep({
        type: param.type,
        format: param.format,
        description: param.description,
        items: param.items,
      });
      if (param.required) schema.required.push(name);
      continue;
    }
    keptParams.push(convertParameter(param));
  }

  if (keptParams.length) out.parameters = keptParams;
  else delete out.parameters;
  if (requestBody) out.requestBody = requestBody;

  if (op.responses && typeof op.responses === "object") {
    out.responses = Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (op.responses)).map(([code, resp]) => [
        code,
        convertResponse(/** @type {Record<string, unknown>} */ (resp)),
      ]),
    );
  }

  return out;
}

/**
 * @param {Record<string, unknown>} param
 */
function convertParameter(param) {
  if (param.$ref) return rewriteRefsDeep(param);
  /** @type {Record<string, unknown>} */
  const out = {
    name: param.name,
    in: param.in === "formData" ? "query" : param.in,
    required: Boolean(param.required),
  };
  if (param.description) out.description = param.description;
  if (param.schema) {
    out.schema = rewriteRefsDeep(param.schema);
  } else {
    /** @type {Record<string, unknown>} */
    const schema = {};
    if (param.type) schema.type = param.type;
    if (param.format) schema.format = param.format;
    if (param.items) schema.items = rewriteRefsDeep(param.items);
    if (param.enum) schema.enum = param.enum;
    if (param.default !== undefined) schema.default = param.default;
    out.schema = schema;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} resp
 */
function convertResponse(resp) {
  if (!resp || typeof resp !== "object") return { description: "Response" };
  if (resp.$ref) return rewriteRefsDeep(resp);
  /** @type {Record<string, unknown>} */
  const out = {
    description: typeof resp.description === "string" ? resp.description : "Response",
  };
  if (resp.headers) out.headers = resp.headers;
  if (resp.schema) {
    out.content = {
      "application/json": {
        schema: rewriteRefsDeep(resp.schema),
      },
    };
  }
  return out;
}

/**
 * @param {Record<string, unknown>} securityDefinitions
 */
function convertSecuritySchemes(securityDefinitions) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [name, raw] of Object.entries(securityDefinitions)) {
    if (!raw || typeof raw !== "object") continue;
    const def = /** @type {Record<string, unknown>} */ (raw);
    if (def.type === "basic") {
      out[name] = { type: "http", scheme: "basic" };
    } else if (def.type === "apiKey") {
      out[name] = { type: "apiKey", name: def.name, in: def.in };
    } else if (def.type === "oauth2") {
      out[name] = {
        type: "oauth2",
        flows: {
          implicit: {
            authorizationUrl: def.authorizationUrl,
            scopes: def.scopes || {},
          },
        },
      };
    } else {
      out[name] = def;
    }
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function rewriteRefsDeep(value) {
  if (Array.isArray(value)) return value.map((item) => rewriteRefsDeep(item));
  if (!value || typeof value !== "object") return value;
  /** @type {Record<string, unknown>} */
  const obj = { .../** @type {object} */ (value) };
  if (typeof obj.$ref === "string") {
    obj.$ref = obj.$ref
      .replace(/^#\/definitions\//, "#/components/schemas/")
      .replace(/^#\/parameters\//, "#/components/parameters/")
      .replace(/^#\/responses\//, "#/components/responses/");
  }
  for (const [key, child] of Object.entries(obj)) {
    if (key === "$ref") continue;
    obj[key] = rewriteRefsDeep(child);
  }
  return obj;
}
