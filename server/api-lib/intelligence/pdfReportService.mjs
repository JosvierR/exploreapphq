import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { reportProductTitle } from "./reportRequest.mjs";

export const REPORT_DESIGN_SYSTEM_VERSION = "explore-report-design-v1";

const COLORS = Object.freeze({
  ink: [0.055, 0.075, 0.11],
  muted: [0.35, 0.39, 0.46],
  soft: [0.68, 0.71, 0.76],
  faint: [0.955, 0.962, 0.972],
  blueTint: [0.92, 0.96, 1],
  line: [0.84, 0.86, 0.89],
  white: [1, 1, 1],
  blue: [0.075, 0.33, 0.91],
  cyan: [0.09, 0.67, 0.82],
  green: [0.08, 0.62, 0.43],
  amber: [0.92, 0.58, 0.12],
  amberTint: [1, 0.97, 0.9],
  red: [0.82, 0.23, 0.28],
});

const PAGE_SIZES = Object.freeze({ a4: [595.28, 841.89], letter: [612, 792], presentation: [960, 540] });

const COPY = {
  en: {
    locale: "en-US", intelligence: "EXPLORE INTELLIGENCE 3.3", confidential: "CONFIDENTIAL · INVESTOR-SAFE AGGREGATES",
    subtitle: "Executive Analytics Report", preparedFor: "Prepared for", organization: "Organization", generated: "Generated",
    period: "Reporting period", dataAsOf: "Data through", timezone: "Timezone", unavailable: "Unavailable",
    traction: "Executive traction", activity: "User activity & growth", product: "Product engagement", markets: "Markets & destination signals",
    commercial: "Commercial evidence", revenue: "Monetization", quality: "Methodology & reporting confidence", conclusions: "Conclusions & qualifications",
    glossary: "Metric glossary", technical: "Technical lineage", analystData: "Supporting analytical data",
    activeUsers: "Active users", sessions: "Sessions", placeViews: "Place views", routeStarts: "Route starts", actions: "Commercial actions",
    previous: "Previous", absolute: "Absolute change", percent: "Change", average: "Daily average", high: "Highest observed", low: "Lowest observed",
    currentPeriod: "Current period", previousPeriod: "Previous period", observedEvents: "observed events", noData: "No eligible aggregate is available for this selection.",
    confidence: "Reporting confidence", limitation: "Limitation", evidence: "Evidence", implication: "Business implication", nextStep: "Recommended investigation",
    finding: "Finding", question: "Question", source: "Source", unit: "Unit", definition: "Plain-language definition", formula: "Technical definition",
    interpretation: "Business interpretation", knownLimits: "Known limitations", readiness: "Monetization readiness", verifiedRevenue: "Verified financial performance",
    commercialActivity: "Observed commercial activity", unavailableRevenue: "No authorized reconciled financial figure is available. This is unavailable, not zero.",
    privacy: "Privacy", fingerprint: "Snapshot", fixture: "NONPRODUCTION FIXTURE · VALIDATION ONLY", page: "Page",
    demandIndex: "Explore Demand Index", demandScale: "0–100 relative activity index; 50 is stable. It is not a percentage, market size, or financial value.",
    tableValues: "Exact supporting values", routes: "Routes", places: "Places", name: "Name", category: "Category", views: "Views", starts: "Starts",
    completions: "Completions", completionsShort: "Done", actionsShort: "Actions", status: "Status", count: "Count", date: "Date", users: "Users",
    pipeline: "Pipeline operations", completeness: "Data completeness", correctness: "Metric correctness", reporting: "Reporting confidence", history: "Historical coverage",
    companyPerformance: "Company performance", executiveDescription: "Current values, exact comparison baselines, and material confidence qualifications.", evidenceLed: "Evidence-led observations",
    observedUsage: "Observed usage", activityDescription: "Distinct observed identities and sessions across the selected UTC reporting window.", sessionsPerUser: "Sessions / active user",
    productBehavior: "Product behavior", productDescription: "Views, starts, and downstream actions are distinct observed behaviors-not completed trips or physical visits.",
    destinationIntelligence: "Destination intelligence", marketsDescription: "Rankings use privacy-safe observed event aggregates for the selected period; they do not represent complete tourism-market size.", leadingMarkets: "Leading eligible markets", categoryActivity: "Category activity", indexOmitted: "The index is omitted because eligible inputs, coverage, or minimum comparison baselines are incomplete.",
    decisionSupport: "Decision support", commercialDescription: "Deterministic observations connect business questions to values, bounded interpretations, and next investigations.", whatChanged: "What changed?", commercialBoundary: "Commercial actions are observed intent signals. They are not transactions, commissions, or realized revenue.",
    businessModel: "Business model", revenueDescription: "Financial performance, commercial activity, and integration readiness remain separate analytical concepts.", verifiedDescription: "Authorized financial performance is shown separately from estimates and commercial signals.", actionDescription: "Directions, calls, website clicks, and map opens observed in the selected period. These actions are not sales or revenue.", notVerified: "Financial reporting is not yet verified.",
    trustGovernance: "Trust & governance", qualityDescription: "Operational readiness, completeness, correctness, confidence, and historical coverage are assessed separately.", materialQualification: "Material qualification", disclosure: "Disclosure",
    evidenceReview: "Evidence review", conclusionsDescription: "What the selected snapshot supports-and what it does not support.", supportedFindings: "Supported findings", qualifications: "Qualifications", identityQualification: "An observed identity is not necessarily a registered account or unique person.", behaviorQualification: "Place views are not physical visits; route starts are not completions; commercial actions are not sales.", financialQualification: "Financial values remain subject to the stated source and recognition policy.",
    reference: "Reference", glossaryDescription: "Definitions connect each metric to its unit, source, limitations, and business meaning.", reproducibleAnalysis: "Reproducible analysis", analystDescription: "Exact aggregate values supporting the report narrative. Small cohorts and sensitive identifiers remain suppressed.", auditAppendix: "Audit appendix", technicalDescription: "Machine-facing identifiers are retained here rather than repeated throughout the investor narrative.", financialPolicy: "Financial policy", field: "Field", value: "Value", type: "Type", continued: "continued",
  },
  es: {
    locale: "es-ES", intelligence: "EXPLORE INTELLIGENCE 3.3", confidential: "CONFIDENCIAL · AGREGADOS APTOS PARA INVERSIONISTAS",
    subtitle: "Informe ejecutivo de analítica", preparedFor: "Preparado para", organization: "Organización", generated: "Generado",
    period: "Período del informe", dataAsOf: "Datos hasta", timezone: "Zona horaria", unavailable: "No disponible",
    traction: "Tracción ejecutiva", activity: "Actividad y crecimiento", product: "Participación de producto", markets: "Mercados y señales de destino",
    commercial: "Evidencia comercial", revenue: "Monetización", quality: "Metodología y confianza", conclusions: "Conclusiones y salvedades",
    glossary: "Glosario de métricas", technical: "Linaje técnico", analystData: "Datos analíticos de respaldo",
    activeUsers: "Usuarios activos", sessions: "Sesiones", placeViews: "Vistas de lugares", routeStarts: "Rutas iniciadas", actions: "Acciones comerciales",
    previous: "Anterior", absolute: "Cambio absoluto", percent: "Cambio", average: "Promedio diario", high: "Máximo observado", low: "Mínimo observado",
    currentPeriod: "Período actual", previousPeriod: "Período anterior", observedEvents: "eventos observados", noData: "No hay un agregado elegible para esta selección.",
    confidence: "Confianza del informe", limitation: "Limitación", evidence: "Evidencia", implication: "Implicación empresarial", nextStep: "Investigación recomendada",
    finding: "Hallazgo", question: "Pregunta", source: "Fuente", unit: "Unidad", definition: "Definición sencilla", formula: "Definición técnica",
    interpretation: "Interpretación empresarial", knownLimits: "Limitaciones conocidas", readiness: "Preparación de monetización", verifiedRevenue: "Rendimiento financiero verificado",
    commercialActivity: "Actividad comercial observada", unavailableRevenue: "No hay una cifra financiera autorizada y conciliada. No está disponible; no es cero.",
    privacy: "Privacidad", fingerprint: "Instantánea", fixture: "MUESTRA NO PRODUCTIVA · SOLO VALIDACIÓN", page: "Página",
    demandIndex: "Índice de Demanda Explore", demandScale: "Índice relativo de 0–100; 50 indica estabilidad. No es porcentaje, tamaño de mercado ni valor financiero.",
    tableValues: "Valores exactos de respaldo", routes: "Rutas", places: "Lugares", name: "Nombre", category: "Categoría", views: "Vistas", starts: "Inicios",
    completions: "Finalizaciones", completionsShort: "Fin.", actionsShort: "Acciones", status: "Estado", count: "Conteo", date: "Fecha", users: "Usuarios",
    pipeline: "Operación del flujo", completeness: "Integridad de datos", correctness: "Corrección de métricas", reporting: "Confianza del informe", history: "Cobertura histórica",
    companyPerformance: "Rendimiento de la empresa", executiveDescription: "Valores actuales, bases exactas de comparación y salvedades importantes de confianza.", evidenceLed: "Observaciones basadas en evidencia",
    observedUsage: "Uso observado", activityDescription: "Identidades y sesiones distintas observadas durante el período UTC seleccionado.", sessionsPerUser: "Sesiones / usuario activo",
    productBehavior: "Comportamiento del producto", productDescription: "Las vistas, los inicios y las acciones posteriores son comportamientos observados distintos; no son viajes completados ni visitas físicas.",
    destinationIntelligence: "Inteligencia de destinos", marketsDescription: "Las clasificaciones usan agregados de eventos observados que protegen la privacidad; no representan todo el mercado turístico.", leadingMarkets: "Principales mercados elegibles", categoryActivity: "Actividad por categoría", indexOmitted: "El índice se omite porque faltan entradas elegibles, cobertura o bases mínimas de comparación.",
    decisionSupport: "Apoyo a decisiones", commercialDescription: "Las observaciones deterministas vinculan preguntas de negocio con valores, interpretaciones acotadas y próximas investigaciones.", whatChanged: "¿Qué cambió?", commercialBoundary: "Las acciones comerciales son señales de intención observadas. No son transacciones, comisiones ni ingresos realizados.",
    businessModel: "Modelo de negocio", revenueDescription: "El rendimiento financiero, la actividad comercial y la preparación de integraciones son conceptos analíticos separados.", verifiedDescription: "El rendimiento financiero autorizado se muestra separado de estimaciones y señales comerciales.", actionDescription: "Direcciones, llamadas, clics web y aperturas de mapas observados. Estas acciones no son ventas ni ingresos.", notVerified: "Los informes financieros aún no están verificados.",
    trustGovernance: "Confianza y gobernanza", qualityDescription: "La preparación operativa, integridad, corrección, confianza y cobertura histórica se evalúan por separado.", materialQualification: "Salvedad importante", disclosure: "Divulgación",
    evidenceReview: "Revisión de evidencia", conclusionsDescription: "Lo que respalda la instantánea seleccionada y lo que no respalda.", supportedFindings: "Hallazgos respaldados", qualifications: "Salvedades", identityQualification: "Una identidad observada no es necesariamente una cuenta registrada ni una persona única.", behaviorQualification: "Las vistas de lugares no son visitas físicas; los inicios de ruta no son finalizaciones; las acciones comerciales no son ventas.", financialQualification: "Los valores financieros siguen sujetos a la fuente y a la política de reconocimiento indicadas.",
    reference: "Referencia", glossaryDescription: "Las definiciones conectan cada métrica con su unidad, fuente, limitaciones y significado empresarial.", reproducibleAnalysis: "Análisis reproducible", analystDescription: "Valores agregados exactos que respaldan el informe. Se mantienen suprimidas las cohortes pequeñas y los identificadores sensibles.", auditAppendix: "Apéndice de auditoría", technicalDescription: "Los identificadores técnicos se conservan aquí en vez de repetirse en la narrativa para inversionistas.", financialPolicy: "Política financiera", field: "Campo", value: "Valor", type: "Tipo", continued: "continuación",
  },
};

function cleanPdfText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\u0020-\u00ff]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdf(value) { return cleanPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function rgb(color) { return `${color[0]} ${color[1]} ${color[2]}`; }
function formatNumber(value, locale = "en-US") {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, notation: Math.abs(Number(value)) >= 100000 ? "compact" : "standard" }).format(Number(value));
}
function formatDate(value, locale = "en-US") {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return cleanPdfText(value) || "-";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}
function wrap(value, width, fontSize) {
  const words = cleanPdfText(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  const max = Math.max(8, Math.floor(width / (fontSize * 0.52)));
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeBrandPng() {
  try {
    const bytes = readFileSync(new URL("../../../public/icon-192.png", import.meta.url));
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const bitDepth = bytes[24];
    const colorType = bytes[25];
    const interlace = bytes[28];
    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) return null;
    const idat = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += 12 + length;
      if (type === "IEND") break;
    }
    const inflated = inflateSync(Buffer.concat(idat));
    const stride = width * 4;
    const decoded = Buffer.alloc(stride * height);
    let source = 0;
    for (let y = 0; y < height; y += 1) {
      const filter = inflated[source++];
      for (let x = 0; x < stride; x += 1) {
        const raw = inflated[source++];
        const left = x >= 4 ? decoded[y * stride + x - 4] : 0;
        const up = y > 0 ? decoded[(y - 1) * stride + x] : 0;
        const upperLeft = y > 0 && x >= 4 ? decoded[(y - 1) * stride + x - 4] : 0;
        const value = filter === 0 ? raw
          : filter === 1 ? raw + left
            : filter === 2 ? raw + up
              : filter === 3 ? raw + Math.floor((left + up) / 2)
                : filter === 4 ? raw + paeth(left, up, upperLeft)
                  : raw;
        decoded[y * stride + x] = value & 255;
      }
    }
    const color = Buffer.alloc(width * height * 3);
    const alpha = Buffer.alloc(width * height);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      color[pixel * 3] = decoded[pixel * 4];
      color[pixel * 3 + 1] = decoded[pixel * 4 + 1];
      color[pixel * 3 + 2] = decoded[pixel * 4 + 2];
      alpha[pixel] = decoded[pixel * 4 + 3];
    }
    return { width, height, color: deflateSync(color), alpha: deflateSync(alpha) };
  } catch {
    return null;
  }
}

const BRAND_LOGO = decodeBrandPng();

class Canvas {
  constructor(width, height, pageNumber, totalPages, copy, snapshot, section) {
    this.width = width; this.height = height; this.ops = []; this.copy = copy; this.snapshot = snapshot;
    this.pageNumber = pageNumber; this.totalPages = totalPages; this.section = section;
  }
  fill(color) { this.ops.push(`${rgb(color)} rg`); }
  stroke(color) { this.ops.push(`${rgb(color)} RG`); }
  rect(x, y, width, height, color, strokeColor = null) {
    this.fill(color); if (strokeColor) this.stroke(strokeColor);
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${strokeColor ? "B" : "f"}`);
  }
  line(x1, y1, x2, y2, color = COLORS.line, width = 1, dash = null) {
    this.stroke(color); this.ops.push(`${dash ? `[${dash}] 0 d` : "[] 0 d"} ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  text(value, x, y, size = 10, options = {}) {
    const font = options.bold ? "F2" : "F1";
    this.fill(options.color || COLORS.ink);
    this.ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`);
  }
  textRight(value, right, y, size = 10, options = {}) {
    const estimate = cleanPdfText(value).length * size * 0.5;
    this.text(value, Math.max(0, right - estimate), y, size, options);
  }
  paragraph(value, x, top, width, size = 10, options = {}) {
    const lineHeight = options.lineHeight || size * 1.4;
    const lines = wrap(value, width, size).slice(0, options.maxLines || 99);
    lines.forEach((line, index) => this.text(line, x, top - index * lineHeight, size, options));
    return top - lines.length * lineHeight;
  }
  logo(x, y, size) {
    if (BRAND_LOGO) this.ops.push(`q ${size} 0 0 ${size} ${x} ${y} cm /Logo Do Q`);
    else { this.rect(x, y, size, size, COLORS.blue); this.text("E", x + size * 0.26, y + size * 0.28, size * 0.48, { bold: true, color: COLORS.white }); }
  }
  header(kicker, title, subtitle) {
    this.logo(42, this.height - 58, 21);
    this.text("EXPLORE", 70, this.height - 49, 9, { bold: true, color: COLORS.blue });
    this.text(kicker.toUpperCase(), 42, this.height - 82, 7.5, { bold: true, color: COLORS.muted });
    this.text(title, 42, this.height - 111, this.width > 700 ? 24 : 20, { bold: true });
    if (subtitle) this.paragraph(subtitle, 42, this.height - 133, this.width - 84, 9, { color: COLORS.muted, maxLines: 2 });
    this.line(42, this.height - 154, this.width - 42, this.height - 154, COLORS.line, 0.7);
  }
  footer() {
    this.line(42, 34, this.width - 42, 34, COLORS.line, 0.6);
    this.text(`${this.section} · ${this.copy.period}: ${this.snapshot.range?.start || "-"} – ${this.snapshot.range?.end || "-"}`, 42, 19, 6.8, { color: COLORS.muted });
    this.textRight(`${this.copy.page} ${this.pageNumber} / ${this.totalPages}`, this.width - 42, 19, 7, { color: COLORS.muted });
  }
  badge(value, x, y, color = COLORS.blue) {
    const width = Math.max(42, cleanPdfText(value).length * 4.5 + 14);
    this.rect(x, y, width, 18, COLORS.faint);
    this.text(value, x + 7, y + 6, 6.8, { bold: true, color });
    return width;
  }
  valueCard(x, y, width, label, value, delta = null, tone = COLORS.blue) {
    this.rect(x, y, width, 86, COLORS.faint);
    this.rect(x, y + 82, width, 4, tone);
    this.text(label.toUpperCase(), x + 12, y + 64, 6.8, { bold: true, color: COLORS.muted });
    this.text(value ?? this.copy.unavailable, x + 12, y + 38, value != null ? 19 : 11, { bold: true, color: value != null ? COLORS.ink : COLORS.muted });
    if (delta) {
      const absolute = delta.absolute == null ? "-" : `${delta.absolute >= 0 ? "+" : ""}${formatNumber(delta.absolute, this.copy.locale)}`;
      const percent = delta.percent == null ? "baseline unavailable" : `${delta.percent >= 0 ? "+" : ""}${delta.percent}%`;
      this.text(`${this.copy.previous}: ${formatNumber(delta.previous, this.copy.locale) ?? "-"} · ${absolute}`, x + 12, y + 20, 6.5, { color: COLORS.muted });
      this.textRight(percent, x + width - 12, y + 20, 6.8, { bold: true, color: delta.percent == null ? COLORS.muted : delta.percent >= 0 ? COLORS.green : COLORS.red });
    }
  }
  bars(rows, x, y, width, height, valueKey = "count") {
    if (!rows.length) { this.paragraph(this.copy.noData, x, y + height / 2, width, 9, { color: COLORS.muted }); return; }
    const values = rows.map((row) => Number(row[valueKey]) || 0);
    const max = Math.max(1, ...values);
    const gap = 7;
    const barH = Math.min(19, (height - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length));
    rows.forEach((row, index) => {
      const rowY = y + height - (index + 1) * barH - index * gap;
      const labelW = Math.min(125, width * 0.38);
      const barWidth = (Number(row[valueKey]) || 0) / max * Math.max(24, width - labelW - 55);
      this.text(cleanPdfText(row.label).slice(0, 24), x, rowY + 5, 7.4, { color: COLORS.muted });
      this.rect(x + labelW, rowY, Math.max(2, barWidth), barH, index === 0 ? COLORS.blue : COLORS.cyan);
      this.text(formatNumber(row[valueKey], this.copy.locale) || "-", x + labelW + barWidth + 6, rowY + 5, 7.2, { bold: true });
    });
  }
  trend(points, x, y, width, height, key = "users", previousKey = "previous_users", unit = "users") {
    const current = points.map((point) => Number(point[key]) || 0);
    const previous = points.map((point) => Number(point[previousKey]) || 0);
    const hasPrevious = previous.some((value) => value > 0);
    if (current.length < 2 || Math.max(...current, ...previous) === 0) { this.paragraph(this.copy.noData, x, y + height / 2, width, 9, { color: COLORS.muted }); return; }
    const max = Math.max(1, ...current, ...previous);
    const chartLeft = x + 36;
    const chartBottom = y + 24;
    const chartWidth = width - 44;
    const chartHeight = height - 38;
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = max * tick / 4;
      const py = chartBottom + chartHeight * tick / 4;
      this.line(chartLeft, py, chartLeft + chartWidth, py, COLORS.line, 0.45);
      this.textRight(formatNumber(value, this.copy.locale) || "0", chartLeft - 6, py - 2, 6.5, { color: COLORS.muted });
    }
    const draw = (values, color, dash = null) => {
      this.stroke(color);
      const commands = values.map((value, index) => {
        const px = chartLeft + index / (values.length - 1) * chartWidth;
        const py = chartBottom + value / max * chartHeight;
        return `${px.toFixed(2)} ${py.toFixed(2)} ${index ? "l" : "m"}`;
      });
      this.ops.push(`${dash ? `[${dash}] 0 d` : "[] 0 d"} 2 w ${commands.join(" ")} S`);
    };
    if (hasPrevious) draw(previous, COLORS.soft, "5 4");
    draw(current, COLORS.blue);
    const indexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    indexes.forEach((index) => this.text(formatDate(points[index]?.date, this.copy.locale), chartLeft + index / (points.length - 1) * chartWidth - 20, y + 8, 6.2, { color: COLORS.muted }));
    this.text(unit, x, y + height - 4, 6.5, { bold: true, color: COLORS.muted });
    this.line(chartLeft + chartWidth - 135, y + height - 5, chartLeft + chartWidth - 118, y + height - 5, COLORS.blue, 2);
    this.text(this.copy.currentPeriod, chartLeft + chartWidth - 112, y + height - 8, 6.4, { color: COLORS.muted });
    if (hasPrevious) {
      this.line(chartLeft + chartWidth - 135, y + height - 17, chartLeft + chartWidth - 118, y + height - 17, COLORS.soft, 1.5, "5 4");
      this.text(this.copy.previousPeriod, chartLeft + chartWidth - 112, y + height - 20, 6.4, { color: COLORS.muted });
    }
  }
  table({ x = 42, top, width = this.width - 84, columns, rows, rowHeight = 24, fontSize = 7.2 }) {
    const headerHeight = 23;
    this.rect(x, top - headerHeight, width, headerHeight, COLORS.ink);
    let offset = x;
    columns.forEach((column) => {
      const columnWidth = width * column.width;
      if (column.align === "right") this.textRight(column.label, offset + columnWidth - 8, top - 15, fontSize, { bold: true, color: COLORS.white });
      else this.text(column.label, offset + 8, top - 15, fontSize, { bold: true, color: COLORS.white });
      offset += columnWidth;
    });
    rows.forEach((row, rowIndex) => {
      const rowTop = top - headerHeight - rowIndex * rowHeight;
      if (rowIndex % 2 === 0) this.rect(x, rowTop - rowHeight, width, rowHeight, COLORS.faint);
      let columnX = x;
      columns.forEach((column) => {
        const columnWidth = width * column.width;
        const value = cleanPdfText(row[column.key] ?? "-");
        if (column.align === "right") this.textRight(value, columnX + columnWidth - 8, rowTop - 15, fontSize, { color: column.muted ? COLORS.muted : COLORS.ink });
        else this.text(value.slice(0, column.max || 42), columnX + 8, rowTop - 15, fontSize, { color: column.muted ? COLORS.muted : COLORS.ink });
        columnX += columnWidth;
      });
    });
    return top - headerHeight - rows.length * rowHeight;
  }
  toString() { return this.ops.join("\n"); }
}

function delta(snapshot, key) { return snapshot.comparison?.deltas?.[key] || null; }
function readiness(snapshot, key) { return snapshot.data_readiness?.metrics?.[key] || null; }
function humanStatus(value) { return cleanPdfText(value || "unavailable").replaceAll("_", " "); }

function coverPage(canvas, options) {
  canvas.rect(0, 0, canvas.width, canvas.height, COLORS.ink);
  canvas.rect(0, 0, canvas.width * 0.018, canvas.height, COLORS.blue);
  const logoSize = canvas.width > 700 ? 54 : 46;
  canvas.logo(58, canvas.height - 80, logoSize);
  canvas.text("EXPLORE", 58 + logoSize + 15, canvas.height - 51, 15, { bold: true, color: COLORS.white });
  canvas.text(canvas.copy.intelligence, 58 + logoSize + 15, canvas.height - 70, 7.5, { bold: true, color: COLORS.cyan });
  const title = options.title || reportProductTitle(options.reportType, options.language);
  const titleSize = cleanPdfText(title).length > 70 ? (canvas.width > 700 ? 27 : 25) : (canvas.width > 700 ? 34 : 31);
  canvas.paragraph(title, 58, canvas.height * 0.66, canvas.width - 116, titleSize, { bold: true, color: COLORS.white, lineHeight: titleSize + 6, maxLines: 4 });
  const subtitle = options.subtitle || canvas.copy.subtitle;
  canvas.paragraph(subtitle, 58, canvas.height * 0.48, canvas.width - 116, 12, { color: [0.78, 0.81, 0.86], maxLines: 2 });
  if (options.recipient) {
    canvas.text(`${canvas.copy.preparedFor}: ${options.recipient}`, 58, canvas.height * 0.39, 9.5, { bold: true, color: COLORS.white });
    if (options.organization) canvas.text(`${canvas.copy.organization}: ${options.organization}`, 58, canvas.height * 0.39 - 18, 8.5, { color: [0.78, 0.81, 0.86] });
  }
  if (options.note) canvas.paragraph(options.note, 58, canvas.height * 0.31, canvas.width - 116, 9.5, { color: [0.78, 0.81, 0.86], maxLines: 3 });
  canvas.text(canvas.copy.confidential, 58, 106, 7.5, { bold: true, color: COLORS.cyan });
  canvas.text(`${canvas.copy.period}: ${canvas.snapshot.range?.start || "-"} – ${canvas.snapshot.range?.end || "-"}`, 58, 84, 8.5, { color: COLORS.white });
  canvas.text(`${canvas.copy.dataAsOf}: ${formatDate(canvas.snapshot.data_as_of, canvas.copy.locale)}`, 58, 68, 8.5, { color: COLORS.white });
  canvas.text(`${canvas.copy.generated}: ${formatDate(canvas.snapshot.generated_at, canvas.copy.locale)} · UTC`, 58, 52, 7.8, { color: [0.78, 0.81, 0.86] });
  if (options.fixture) canvas.text(canvas.copy.fixture, 58, 36, 7.5, { bold: true, color: COLORS.amber });
}

function executivePage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.companyPerformance, canvas.copy.traction, canvas.copy.executiveDescription);
  const cards = [
    ["active_users", canvas.copy.activeUsers, COLORS.blue], ["sessions", canvas.copy.sessions, COLORS.cyan],
    ["route_starts", canvas.copy.routeStarts, COLORS.green], ["commercial_actions", canvas.copy.actions, COLORS.amber],
  ];
  const gap = 9;
  const cardW = (canvas.width - 84 - gap * 3) / 4;
  cards.forEach(([key, label, tone], index) => canvas.valueCard(42 + index * (cardW + gap), canvas.height - 260, cardW, label, formatNumber(s.headline[key], canvas.copy.locale), delta(s, key), tone));
  canvas.text(canvas.copy.evidenceLed.toUpperCase(), 42, canvas.height - 293, 7.5, { bold: true, color: COLORS.muted });
  let cursor = canvas.height - 318;
  const rows = s.report_narrative?.executive_insights?.length ? s.report_narrative.executive_insights : s.insights;
  (rows.length ? rows : [{ finding: s.narrative.summary || canvas.copy.noData, evidence: "", limitation: "" }]).slice(0, 3).forEach((item, index) => {
    canvas.rect(42, cursor - 8, 20, 20, index === 0 ? COLORS.blue : COLORS.faint);
    canvas.text(String(index + 1), 49, cursor - 1, 7.5, { bold: true, color: index === 0 ? COLORS.white : COLORS.muted });
    canvas.text(item.finding || item.title, 74, cursor + 2, 9.5, { bold: true });
    cursor = canvas.paragraph(item.evidence, 74, cursor - 15, canvas.width - 120, 8, { color: COLORS.muted, maxLines: 2 }) - 15;
  });
  const overall = s.metric_confidence?.overall || "unavailable";
  canvas.rect(42, 58, canvas.width - 84, 58, overall === "verified" ? [0.91, 0.98, 0.95] : COLORS.blueTint);
  canvas.text(`${canvas.copy.confidence}: ${humanStatus(overall)}`, 56, 92, 8.5, { bold: true, color: overall === "verified" ? COLORS.green : COLORS.blue });
  canvas.paragraph(s.data_readiness?.quality_dimensions?.reporting_confidence?.explanation || canvas.copy.noData, 56, 76, canvas.width - 112, 7.7, { maxLines: 2, color: COLORS.muted });
}

function activityPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.observedUsage, canvas.copy.activity, canvas.copy.activityDescription);
  canvas.trend(s.trends, 42, canvas.height - 430, canvas.width - 84, 235, "users", "previous_users", canvas.copy.users);
  const stats = [
    [canvas.copy.average, formatNumber(s.trend_summary?.average_users, canvas.copy.locale)],
    [canvas.copy.high, s.trend_summary?.highest ? `${formatNumber(s.trend_summary.highest.value, canvas.copy.locale)} · ${formatDate(s.trend_summary.highest.date, canvas.copy.locale)}` : null],
    [canvas.copy.low, s.trend_summary?.lowest ? `${formatNumber(s.trend_summary.lowest.value, canvas.copy.locale)} · ${formatDate(s.trend_summary.lowest.date, canvas.copy.locale)}` : null],
    [canvas.copy.sessionsPerUser, formatNumber(s.headline.sessions_per_active_user, canvas.copy.locale)],
  ];
  const width = (canvas.width - 105) / 2;
  stats.forEach(([label, value], index) => {
    const x = 42 + (index % 2) * (width + 21);
    const y = 118 - Math.floor(index / 2) * 48;
    canvas.text(label.toUpperCase(), x, y + 18, 6.5, { bold: true, color: COLORS.muted });
    canvas.text(value || canvas.copy.unavailable, x, y, 10, { bold: true });
  });
}

function productPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.productBehavior, canvas.copy.product, canvas.copy.productDescription);
  const gap = 10;
  const cardW = (canvas.width - 84 - gap * 2) / 3;
  [["place_views", canvas.copy.placeViews, COLORS.cyan], ["route_starts", canvas.copy.routeStarts, COLORS.blue], ["route_completions", canvas.copy.completions, COLORS.green]].forEach(([key, label, tone], index) => {
    canvas.valueCard(42 + index * (cardW + gap), canvas.height - 260, cardW, label, formatNumber(s.headline[key], canvas.copy.locale), delta(s, key), tone);
  });
  const routeRows = s.routes.slice(0, 5).map((row) => ({ name: row.name, views: formatNumber(row.views, canvas.copy.locale), starts: formatNumber(row.starts, canvas.copy.locale), completions: formatNumber(row.completions, canvas.copy.locale) }));
  const placeRows = s.places.slice(0, 5).map((row) => ({ name: row.name, views: formatNumber(row.views, canvas.copy.locale), actions: formatNumber(row.commercial_actions, canvas.copy.locale), category: row.category }));
  const split = (canvas.width - 105) / 2;
  canvas.text(canvas.copy.routes.toUpperCase(), 42, canvas.height - 300, 7.5, { bold: true, color: COLORS.muted });
  canvas.table({ x: 42, top: canvas.height - 315, width: split, columns: [
    { key: "name", label: canvas.copy.name, width: 0.46, max: 22 }, { key: "views", label: canvas.copy.views, width: 0.18, align: "right" },
    { key: "starts", label: canvas.copy.starts, width: 0.18, align: "right" }, { key: "completions", label: canvas.copy.completionsShort, width: 0.18, align: "right" },
  ], rows: routeRows.length ? routeRows : [{ name: canvas.copy.noData, views: "-", starts: "-", completions: "-" }], rowHeight: 25, fontSize: 6.4 });
  canvas.text(canvas.copy.places.toUpperCase(), 63 + split, canvas.height - 300, 7.5, { bold: true, color: COLORS.muted });
  canvas.table({ x: 63 + split, top: canvas.height - 315, width: split, columns: [
    { key: "name", label: canvas.copy.name, width: 0.40, max: 19 }, { key: "category", label: canvas.copy.category, width: 0.28, max: 14 },
    { key: "views", label: canvas.copy.views, width: 0.16, align: "right" }, { key: "actions", label: canvas.copy.actionsShort, width: 0.16, align: "right" },
  ], rows: placeRows.length ? placeRows : [{ name: canvas.copy.noData, category: "-", views: "-", actions: "-" }], rowHeight: 25, fontSize: 6.4 });
}

function marketsPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.destinationIntelligence, canvas.copy.markets, canvas.copy.marketsDescription);
  const split = (canvas.width - 105) / 2;
  canvas.text(canvas.copy.leadingMarkets.toUpperCase(), 42, canvas.height - 181, 7.5, { bold: true, color: COLORS.muted });
  canvas.bars(s.markets.slice(0, 6), 42, canvas.height - 430, split, 210, "count");
  canvas.text(canvas.copy.categoryActivity.toUpperCase(), 63 + split, canvas.height - 181, 7.5, { bold: true, color: COLORS.muted });
  canvas.bars(s.categories.slice(0, 6), 63 + split, canvas.height - 430, split, 210, "count");
  const demandReady = s.report_narrative?.sections?.markets?.demand_index_eligible;
  if (demandReady) {
    canvas.valueCard(42, 67, 155, canvas.copy.demandIndex, formatNumber(s.headline.demand_index, canvas.copy.locale), null, COLORS.amber);
    canvas.paragraph(canvas.copy.demandScale, 216, 125, canvas.width - 258, 8.2, { color: COLORS.muted, maxLines: 4 });
  } else {
    canvas.rect(42, 67, canvas.width - 84, 56, COLORS.faint);
    canvas.text(`${canvas.copy.demandIndex}: ${canvas.copy.unavailable}`, 56, 99, 8.5, { bold: true, color: COLORS.muted });
    canvas.paragraph(canvas.copy.indexOmitted, 56, 83, canvas.width - 112, 7.5, { color: COLORS.muted, maxLines: 2 });
  }
}

function commercialPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.decisionSupport, canvas.copy.commercial, canvas.copy.commercialDescription);
  const rows = [...(s.report_narrative?.executive_insights || []), ...(s.report_narrative?.executive_opportunities || [])].slice(0, 3);
  let cursor = canvas.height - 188;
  (rows.length ? rows : [{ question: canvas.copy.noData, finding: "", evidence: "", limitation: "" }]).forEach((item, index) => {
    const boxHeight = canvas.width > 700 ? 92 : 112;
    canvas.rect(42, cursor - boxHeight + 12, canvas.width - 84, boxHeight, index === 0 ? COLORS.blueTint : COLORS.faint);
    canvas.text(String(index + 1).padStart(2, "0"), 56, cursor - 8, 8, { bold: true, color: COLORS.blue });
    canvas.text(item.question || canvas.copy.whatChanged, 86, cursor - 8, 8.5, { bold: true });
    canvas.text(canvas.copy.finding.toUpperCase(), 86, cursor - 29, 6.2, { bold: true, color: COLORS.muted });
    canvas.paragraph(item.finding || item.title, 166, cursor - 29, canvas.width - 224, 7.8, { maxLines: 2 });
    canvas.text(canvas.copy.evidence.toUpperCase(), 86, cursor - 49, 6.2, { bold: true, color: COLORS.muted });
    canvas.paragraph(item.evidence, 166, cursor - 49, canvas.width - 224, 7.5, { maxLines: 2 });
    canvas.text(canvas.copy.nextStep.toUpperCase(), 86, cursor - 69, 6.2, { bold: true, color: COLORS.muted });
    canvas.paragraph(item.next_step || item.recommended_investigation || item.consideration, 222, cursor - 69, canvas.width - 280, 7.5, { maxLines: 2 });
    canvas.text(`${canvas.copy.confidence}: ${humanStatus(item.confidence)} · ${canvas.copy.limitation}: ${cleanPdfText(item.limitation).slice(0, 120)}`, 86, cursor - 90, 6.5, { color: COLORS.muted });
    cursor -= boxHeight + 12;
  });
  canvas.rect(42, 54, canvas.width - 84, 42, COLORS.amberTint);
  canvas.paragraph(canvas.copy.commercialBoundary, 54, 79, canvas.width - 108, 8, { bold: true, color: [0.5, 0.31, 0.04], maxLines: 2 });
}

function revenuePage(canvas) {
  const s = canvas.snapshot;
  const revenue = s.revenue;
  canvas.header(canvas.copy.businessModel, canvas.copy.revenue, canvas.copy.revenueDescription);
  canvas.text(canvas.copy.verifiedRevenue.toUpperCase(), 42, canvas.height - 186, 7.5, { bold: true, color: COLORS.muted });
  const verified = revenue.total_verified_revenue == null ? null : `${revenue.currency || ""} ${formatNumber(revenue.total_verified_revenue, canvas.copy.locale)}`.trim();
  canvas.valueCard(42, canvas.height - 292, Math.min(240, canvas.width - 84), canvas.copy.verifiedRevenue, verified, null, verified ? COLORS.green : COLORS.amber);
  canvas.paragraph(verified ? canvas.copy.verifiedDescription : canvas.copy.unavailableRevenue, 302, canvas.height - 226, canvas.width - 344, 9, { color: COLORS.muted, maxLines: 5 });
  canvas.text(canvas.copy.commercialActivity.toUpperCase(), 42, canvas.height - 328, 7.5, { bold: true, color: COLORS.muted });
  canvas.rect(42, canvas.height - 417, canvas.width - 84, 68, COLORS.blueTint);
  canvas.text(formatNumber(s.headline.commercial_actions, canvas.copy.locale) ?? canvas.copy.unavailable, 58, canvas.height - 386, 20, { bold: true, color: COLORS.blue });
  canvas.paragraph(canvas.copy.actionDescription, 150, canvas.height - 374, canvas.width - 208, 8.3, { color: COLORS.muted, maxLines: 3 });
  canvas.text(canvas.copy.readiness.toUpperCase(), 42, canvas.height - 452, 7.5, { bold: true, color: COLORS.muted });
  const streams = revenue.streams.slice(0, 5);
  if (canvas.width > 700) {
    const gap = 8;
    const width = (canvas.width - 84 - gap * Math.max(0, streams.length - 1)) / Math.max(1, streams.length);
    streams.forEach((stream, index) => {
      const tone = stream.maturity === "active_measured" ? COLORS.green : stream.maturity === "active_incomplete" ? COLORS.amber : COLORS.soft;
      const x = 42 + index * (width + gap);
      canvas.rect(x, 43, width, 38, COLORS.faint);
      canvas.rect(x, 43, 5, 38, tone);
      canvas.text(stream.label, x + 12, 65, 7, { bold: true });
      canvas.text(humanStatus(stream.maturity), x + 12, 51, 6.3, { color: COLORS.muted });
    });
  } else {
    let y = canvas.height - 482;
    streams.forEach((stream) => {
      const tone = stream.maturity === "active_measured" ? COLORS.green : stream.maturity === "active_incomplete" ? COLORS.amber : COLORS.soft;
      canvas.rect(42, y - 7, 7, 26, tone);
      canvas.text(stream.label, 62, y + 5, 8.5, { bold: true });
      canvas.text(humanStatus(stream.maturity), 190, y + 5, 7.5, { color: COLORS.muted });
      canvas.paragraph(cleanPdfText(stream.status_message || "").replace(/Connect .*/i, canvas.copy.notVerified), 300, y + 5, canvas.width - 342, 7.3, { color: COLORS.muted, maxLines: 2 });
      y -= 38;
    });
  }
}

function qualityPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.trustGovernance, canvas.copy.quality, canvas.copy.qualityDescription);
  const dimensions = s.data_readiness?.quality_dimensions || {};
  const rows = [
    [canvas.copy.pipeline, dimensions.pipeline_operational_readiness], [canvas.copy.completeness, dimensions.data_completeness],
    [canvas.copy.correctness, dimensions.metric_correctness], [canvas.copy.reporting, dimensions.reporting_confidence],
    [canvas.copy.history, dimensions.historical_coverage],
  ];
  if (canvas.width > 700) {
    const cards = [...rows, [canvas.copy.materialQualification, { status: "partial", label: canvas.copy.disclosure, explanation: s.data_quality.rejection_coverage_note || canvas.copy.noData }]];
    const gap = 12;
    const width = (canvas.width - 84 - gap * 2) / 3;
    cards.forEach(([label, item], index) => {
      const tone = item?.status === "verified" ? COLORS.green : item?.status === "under_investigation" || label === canvas.copy.materialQualification ? COLORS.amber : COLORS.blue;
      const x = 42 + (index % 3) * (width + gap);
      const bottom = canvas.height - 295 - Math.floor(index / 3) * 140;
      canvas.rect(x, bottom, width, 120, COLORS.faint);
      canvas.rect(x, bottom, 6, 120, tone);
      canvas.text(label, x + 18, bottom + 94, 8.2, { bold: true });
      canvas.badge(item?.label || canvas.copy.unavailable, x + 18, bottom + 62, tone);
      canvas.paragraph(item?.explanation || canvas.copy.noData, x + 18, bottom + 43, width - 36, 7, { color: COLORS.muted, maxLines: 3 });
    });
  } else {
    let y = canvas.height - 190;
    rows.forEach(([label, item]) => {
      const tone = item?.status === "verified" ? COLORS.green : item?.status === "under_investigation" ? COLORS.amber : COLORS.blue;
      canvas.rect(42, y - 48, canvas.width - 84, 58, COLORS.faint);
      canvas.rect(42, y - 48, 6, 58, tone);
      canvas.text(label, 62, y - 8, 9, { bold: true });
      canvas.badge(item?.label || canvas.copy.unavailable, 225, y - 15, tone);
      canvas.paragraph(item?.explanation || canvas.copy.noData, 62, y - 29, canvas.width - 122, 7.6, { color: COLORS.muted, maxLines: 2 });
      y -= 70;
    });
    canvas.text(canvas.copy.materialQualification.toUpperCase(), 42, 86, 7, { bold: true, color: COLORS.muted });
    canvas.paragraph(s.data_quality.rejection_coverage_note || canvas.copy.noData, 42, 69, canvas.width - 84, 7.5, { color: COLORS.muted, maxLines: 3 });
  }
}

function conclusionsPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.evidenceReview, canvas.copy.conclusions, canvas.copy.conclusionsDescription);
  const insights = (s.report_narrative?.executive_insights || []).slice(0, 3);
  let y = canvas.height - 190;
  canvas.text(canvas.copy.supportedFindings.toUpperCase(), 42, y, 7.5, { bold: true, color: COLORS.muted });
  y -= 27;
  (insights.length ? insights : [{ finding: canvas.copy.noData, evidence: "" }]).forEach((item, index) => {
    canvas.text(`${index + 1}. ${item.finding || item.title}`, 42, y, 9, { bold: true });
    y = canvas.paragraph(item.evidence, 58, y - 17, canvas.width - 100, 7.8, { color: COLORS.muted, maxLines: 2 }) - 15;
  });
  canvas.text(canvas.copy.qualifications.toUpperCase(), 42, y - 5, 7.5, { bold: true, color: COLORS.muted });
  y -= 32;
  const qualifications = [
    s.data_readiness?.quality_dimensions?.data_completeness?.explanation,
    canvas.copy.identityQualification,
    canvas.copy.behaviorQualification,
    s.revenue.total_verified_revenue == null ? canvas.copy.unavailableRevenue : canvas.copy.financialQualification,
  ].filter(Boolean);
  qualifications.forEach((value) => {
    canvas.rect(42, y - 3, 5, 5, COLORS.amber);
    y = canvas.paragraph(value, 58, y + 2, canvas.width - 100, 8.2, { maxLines: 3 }) - 13;
  });
  canvas.rect(42, 56, canvas.width - 84, 50, COLORS.blueTint);
  canvas.paragraph(s.methodology.privacy, 56, 86, canvas.width - 112, 7.8, { color: COLORS.blue, maxLines: 3 });
}

function glossaryPage(canvas, metrics) {
  canvas.header(canvas.copy.reference, canvas.copy.glossary, canvas.copy.glossaryDescription);
  let y = canvas.height - 182;
  metrics.forEach(([id, metric]) => {
    canvas.text(metric.label, 42, y, 10, { bold: true, color: COLORS.blue });
    canvas.textRight(id, canvas.width - 42, y, 6.5, { color: COLORS.muted });
    y = canvas.paragraph(`${canvas.copy.definition}: ${metric.definition}`, 42, y - 17, canvas.width - 84, 7.5, { maxLines: 2 }) - 2;
    y = canvas.paragraph(`${canvas.copy.formula}: ${metric.formula}`, 42, y, canvas.width - 84, 7.2, { color: COLORS.muted, maxLines: 2 }) - 2;
    y = canvas.paragraph(`${canvas.copy.unit}: ${metric.unit} · ${canvas.copy.source}: ${metric.source}`, 42, y, canvas.width - 84, 7.2, { color: COLORS.muted, maxLines: 2 }) - 2;
    y = canvas.paragraph(`${canvas.copy.knownLimits}: ${metric.known_coverage_gaps}`, 42, y, canvas.width - 84, 7.2, { color: COLORS.muted, maxLines: 2 }) - 2;
    y = canvas.paragraph(`${canvas.copy.interpretation}: ${metric.interpretation}`, 42, y, canvas.width - 84, 7.2, { maxLines: 2 }) - 15;
  });
}

function analystTablePage(canvas, rows, title, type) {
  canvas.header(canvas.copy.reproducibleAnalysis, title, canvas.copy.analystDescription);
  if (type === "trends") {
    canvas.table({ top: canvas.height - 182, columns: [
      { key: "date", label: canvas.copy.date, width: 0.24 }, { key: "users", label: canvas.copy.users, width: 0.15, align: "right" },
      { key: "sessions", label: canvas.copy.sessions, width: 0.16, align: "right" }, { key: "place_views", label: canvas.copy.placeViews, width: 0.15, align: "right" },
      { key: "route_starts", label: canvas.copy.routeStarts, width: 0.15, align: "right" }, { key: "actions", label: canvas.copy.actions, width: 0.15, align: "right" },
    ], rows: rows.map((row) => ({ date: row.date, users: formatNumber(row.users, canvas.copy.locale), sessions: formatNumber(row.sessions, canvas.copy.locale), place_views: formatNumber(row.place_views, canvas.copy.locale), route_starts: formatNumber(row.route_starts, canvas.copy.locale), actions: formatNumber(row.commercial_actions, canvas.copy.locale) })), rowHeight: 23 });
  } else {
    canvas.table({ top: canvas.height - 182, columns: [
      { key: "type", label: canvas.copy.type, width: 0.10 }, { key: "name", label: canvas.copy.name, width: 0.29, max: 30 },
      { key: "category", label: canvas.copy.category, width: 0.20, max: 20 }, { key: "views", label: canvas.copy.views, width: 0.12, align: "right" },
      { key: "starts", label: canvas.copy.starts, width: 0.12, align: "right" }, { key: "actions", label: canvas.copy.actions, width: 0.17, align: "right" },
    ], rows: rows.map((row) => ({ type: row.type, name: row.name, category: row.category, views: formatNumber(row.views, canvas.copy.locale), starts: formatNumber(row.starts, canvas.copy.locale), actions: formatNumber(row.commercial_actions, canvas.copy.locale) })), rowHeight: 25 });
  }
}

function technicalPage(canvas) {
  const s = canvas.snapshot;
  canvas.header(canvas.copy.auditAppendix, canvas.copy.technical, canvas.copy.technicalDescription);
  const rows = [
    ["Canonical core", s.core_version], ["Report contract", s.contract_version], ["Metric catalog", s.metric_catalog_version],
    ["Narrative engine", s.report_narrative?.version], ["Classification", s.classification], ["Data cutoff", s.data_cutoff],
    ["Timezone", s.timezone], ["Snapshot fingerprint", s.fingerprint], ["Generated by", `${s.generated_by?.role || "admin"} / ${s.generated_by?.actor_ref || "not-recorded"}`],
  ].map(([label, value]) => ({ label, value: value || canvas.copy.unavailable }));
  canvas.table({ top: canvas.height - 182, columns: [{ key: "label", label: canvas.copy.field, width: 0.34 }, { key: "value", label: canvas.copy.value, width: 0.66 }], rows, rowHeight: 32, fontSize: 8 });
  canvas.text(canvas.copy.privacy.toUpperCase(), 42, 180, 7.5, { bold: true, color: COLORS.muted });
  canvas.paragraph(s.methodology.privacy, 42, 160, canvas.width - 84, 8.2, { maxLines: 4 });
  canvas.text(canvas.copy.financialPolicy.toUpperCase(), 42, 108, 7.5, { bold: true, color: COLORS.muted });
  canvas.paragraph(s.methodology.revenue, 42, 88, canvas.width - 84, 8.2, { maxLines: 4 });
}

function requestedKinds(options) {
  const mapping = {
    traction: ["executive"], activity: ["activity"], product: ["product"], markets: ["markets"], commercial: ["commercial"],
    revenue: ["revenue"], quality: ["quality"], analyst_tables: ["analyst_trends", "analyst_entities"], conclusions: ["conclusions"],
    glossary: ["glossary"], technical: ["technical"],
  };
  return options.sections?.length ? options.sections.flatMap((section) => mapping[section] || []) : null;
}

function baseKinds(options) {
  if (options.reportType === "current_dashboard") return [{ overview: "executive", product: "product", growth: "activity", tourism: "markets", markets: "markets", revenue: "revenue", operations: "quality" }[options.dashboard] || "executive"];
  if (options.reportType === "investor_snapshot") return ["executive", "activity", "product", "markets", "commercial", "revenue", "conclusions"];
  if (options.reportType === "investor_presentation") return ["executive", "activity", "product", "markets", "commercial", "revenue", "conclusions", "quality"];
  if (options.reportType === "analyst_report") return ["executive", "activity", "product", "markets", "commercial", "revenue", "quality", "analyst_trends", "analyst_entities", "glossary", "technical"];
  return ["executive", "activity", "product", "markets", "commercial", "revenue", "quality", "conclusions", "glossary"];
}

function eligible(kind, snapshot, options) {
  const sections = snapshot.report_narrative?.sections || {};
  if (kind === "executive") return sections.executive?.eligible !== false;
  if (kind === "activity") return sections.engagement?.eligible !== false;
  if (kind === "product") return sections.product?.eligible !== false;
  if (kind === "markets") return sections.markets?.eligible !== false;
  if (kind === "commercial") return options.includeOpportunities !== false && sections.commercial?.eligible !== false;
  if (kind === "revenue") return snapshot.revenue?.total_verified_revenue != null || (options.reportType !== "investor_snapshot" && sections.revenue?.eligible);
  if (kind === "quality") return options.includeDataQuality !== false;
  if (kind === "glossary") return options.includeDefinitions || ["executive_report", "analyst_report"].includes(options.reportType);
  if (kind === "technical") return sections.technical_appendix?.eligible !== false;
  if (kind === "analyst_trends" || kind === "analyst_entities") return options.reportType === "analyst_report" && sections.analyst_tables?.eligible !== false;
  return true;
}

function pageDescriptors(snapshot, options) {
  const requested = requestedKinds(options);
  const kinds = (requested || baseKinds(options)).filter((kind) => eligible(kind, snapshot, options));
  if (options.includeDataQuality !== false && options.reportType !== "investor_snapshot" && !kinds.includes("quality")) kinds.push("quality");
  const descriptors = [{ kind: "cover" }];
  for (const kind of kinds) {
    if (kind === "analyst_trends") {
      for (let index = 0; index < snapshot.trends.length; index += 22) descriptors.push({ kind, rows: snapshot.trends.slice(index, index + 22), continuation: index > 0 });
    } else if (kind === "analyst_entities") {
      const rows = [...snapshot.routes, ...snapshot.places];
      for (let index = 0; index < rows.length; index += 18) descriptors.push({ kind, rows: rows.slice(index, index + 18), continuation: index > 0 });
    } else if (kind === "glossary") {
      const metrics = Object.entries(snapshot.methodology.metric_catalog.metrics);
      const pageCount = Math.max(1, Math.ceil(metrics.length / 4));
      const pageSize = Math.ceil(metrics.length / pageCount);
      for (let index = 0; index < metrics.length; index += pageSize) descriptors.push({ kind, metrics: metrics.slice(index, index + pageSize), continuation: index > 0 });
    } else descriptors.push({ kind });
  }
  return descriptors;
}

function makePages(snapshot, options) {
  const sizeKey = options.format === "16:9" ? "presentation" : options.format;
  const [width, height] = PAGE_SIZES[sizeKey] || PAGE_SIZES.a4;
  const copy = COPY[options.language] || COPY.en;
  const descriptors = pageDescriptors(snapshot, options);
  return descriptors.map((descriptor, index) => {
    const section = ({ cover: "Cover", executive: copy.traction, activity: copy.activity, product: copy.product, markets: copy.markets, commercial: copy.commercial, revenue: copy.revenue, quality: copy.quality, conclusions: copy.conclusions, glossary: copy.glossary, technical: copy.technical, analyst_trends: copy.analystData, analyst_entities: copy.analystData }[descriptor.kind] || "Explore Intelligence");
    const canvas = new Canvas(width, height, index + 1, descriptors.length, copy, snapshot, section);
    if (descriptor.kind === "cover") coverPage(canvas, options);
    if (descriptor.kind === "executive") executivePage(canvas);
    if (descriptor.kind === "activity") activityPage(canvas);
    if (descriptor.kind === "product") productPage(canvas);
    if (descriptor.kind === "markets") marketsPage(canvas);
    if (descriptor.kind === "commercial") commercialPage(canvas);
    if (descriptor.kind === "revenue") revenuePage(canvas);
    if (descriptor.kind === "quality") qualityPage(canvas);
    if (descriptor.kind === "conclusions") conclusionsPage(canvas);
    if (descriptor.kind === "glossary") glossaryPage(canvas, descriptor.metrics || []);
    if (descriptor.kind === "technical") technicalPage(canvas);
    if (descriptor.kind === "analyst_trends") analystTablePage(canvas, descriptor.rows || [], `${copy.analystData}${descriptor.continuation ? ` · ${copy.continued}` : ""}`, "trends");
    if (descriptor.kind === "analyst_entities") analystTablePage(canvas, descriptor.rows || [], `${copy.routes} & ${copy.places}${descriptor.continuation ? ` · ${copy.continued}` : ""}`, "entities");
    if (descriptor.kind !== "cover") canvas.footer();
    return { width, height, content: canvas.toString() };
  });
}

function latin1Buffer(value) { return Buffer.from(value, "latin1"); }
function streamObject(dictionary, data) {
  return Buffer.concat([latin1Buffer(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, latin1Buffer("\nendstream")]);
}

function buildPdf(pages, metadata) {
  const objects = [];
  const add = (body) => { objects.push(Buffer.isBuffer(body) ? body : latin1Buffer(body)); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const regularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let logoId = null;
  if (BRAND_LOGO) {
    const maskId = add(streamObject(`/Type /XObject /Subtype /Image /Width ${BRAND_LOGO.width} /Height ${BRAND_LOGO.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, BRAND_LOGO.alpha));
    logoId = add(streamObject(`/Type /XObject /Subtype /Image /Width ${BRAND_LOGO.width} /Height ${BRAND_LOGO.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${maskId} 0 R`, BRAND_LOGO.color));
  }
  const pageIds = [];
  for (const page of pages) {
    const stream = latin1Buffer(page.content);
    const contentId = add(streamObject("", stream));
    const xObject = logoId ? `/XObject << /Logo ${logoId} 0 R >>` : "";
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> ${xObject} >> /Contents ${contentId} 0 R >>`));
  }
  const infoId = add(`<< /Title (${escapePdf(metadata.title)}) /Author (Explore) /Subject (${escapePdf(metadata.subject)}) /Creator (Explore Intelligence 3.3) /CreationDate (D:${metadata.pdfDate}) /Keywords (Explore Intelligence, analytics, investor reporting) >>`);
  objects[catalogId - 1] = latin1Buffer(`<< /Type /Catalog /Pages ${pagesId} 0 R /Lang (${escapePdf(metadata.language)}) >>`);
  objects[pagesId - 1] = latin1Buffer(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  const chunks = [latin1Buffer("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets[index + 1] = length;
    const chunk = Buffer.concat([latin1Buffer(`${index + 1} 0 obj\n`), body, latin1Buffer("\nendobj\n")]);
    chunks.push(chunk); length += chunk.length;
  });
  const xrefOffset = length;
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (let index = 1; index <= objects.length; index += 1) xref.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  chunks.push(latin1Buffer(xref.join("")));
  return Buffer.concat(chunks);
}

export function renderIntelligencePdf(snapshot, options) {
  const pages = makePages(snapshot, options);
  const timestamp = new Date(snapshot.generated_at);
  const pdfDate = Number.isNaN(timestamp.getTime()) ? "19700101000000Z" : timestamp.toISOString().replace(/[-:T]/g, "").replace(/\.\d{3}Z$/, "Z");
  const title = options.title || reportProductTitle(options.reportType, options.language);
  return {
    bytes: buildPdf(pages, {
      title,
      subject: `${snapshot.contract_version} | ${snapshot.classification} | ${snapshot.range?.start || ""} to ${snapshot.range?.end || ""} | ${snapshot.metric_confidence?.overall || "unknown"}`,
      language: options.language === "es" ? "es-ES" : "en-US",
      pdfDate,
    }),
    pageCount: pages.length,
    outline: pageDescriptors(snapshot, options).map((page) => page.kind),
  };
}
