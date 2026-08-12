import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

async function main() {
  const supabase = createBusinessServiceClient();
  const { data: schema, error: schemaError } = await supabase.rpc("verify_business_intelligence_schema");
  if (schemaError) throw schemaError;

  const { data: quality, error: qualityError } = await supabase.rpc("business_intelligence_quality_report");
  const report = {
    ok: Boolean(schema?.ok),
    schema,
    quality: qualityError ? { available: false, code: qualityError.code || "quality_report_unavailable" } : quality,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});

