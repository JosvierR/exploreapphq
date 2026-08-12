-- ============================================================================
-- 00001_enable_postgis.sql
-- PostGIS extension + shared helper functions
-- ============================================================================

-- Habilitar PostGIS para queries geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;

-- Función reutilizable: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';
