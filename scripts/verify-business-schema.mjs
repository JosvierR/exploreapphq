import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

async function main() {
  const supabase = createBusinessServiceClient();
  const { data: schema, error: schemaError } = await supabase.rpc("verify_business_intelligence_schema");
  if (schemaError) throw schemaError;

  const { data: geographySchema, error: geographySchemaError } = await supabase.rpc(
    "verify_business_geo_enrichment_schema",
  );
  if (geographySchemaError) throw geographySchemaError;

  const { data: geographySemantics, error: geographySemanticsError } = await supabase.rpc(
    "verify_business_geo_semantics",
  );
  if (geographySemanticsError) throw geographySemanticsError;

  const { data: quality, error: qualityError } = await supabase.rpc("business_intelligence_quality_report");
  const { data: geographyQuality, error: geographyQualityError } = await supabase.rpc(
    "business_destination_geography_quality_report",
  );
  const report = {
    ok: Boolean(schema?.ok && geographySchema?.ok && geographySemantics?.ok),
    schema,
    geography_schema: geographySchema,
    geography_semantics: geographySemantics,
    quality: qualityError ? { available: false, code: qualityError.code || "quality_report_unavailable" } : quality,
    geography_quality: geographyQualityError
      ? { available: false, code: geographyQualityError.code || "geography_quality_report_unavailable" }
      : geographyQuality,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});

