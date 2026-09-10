# EXPLORE-306 — Regenerar `database.types.ts`

Misma generación que Explore-V2 (schema local 297–305). No se reescribe el ranking JS de Pioneros (Fase 4).

## Flujo

`supabase gen types --local` (UTF-8) en Explore-V2 → copiar a `src/lib/database.types.ts` → `createClient<Database>` en `src/lib/supabaseClient.ts`.

## Verificar

```bash
npm run lint
```

Epic: EXPLORE-293
