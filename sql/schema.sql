-- =============================================
-- SUPABASE SCHEMA — Stock Postventa Centro 63
-- =============================================
-- Ejecutar en Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================

-- 1. TABLA: stock
-- Almacena los datos del CSV de stock.
-- 'raw_data' guarda la fila entera como JSONB (flexible ante cambios de columnas).
-- Las columnas extraídas son las más usadas en queries/filtros.
CREATE TABLE IF NOT EXISTS stock (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    centro_id       TEXT NOT NULL DEFAULT '63',
    cod_articulo    TEXT,
    articulo        TEXT,
    proveedor       TEXT,
    almacen         TEXT,
    familia_n1      TEXT,
    familia_n2      TEXT,
    stock_uds       NUMERIC DEFAULT 0,
    precio_inv      NUMERIC DEFAULT 0,
    valor_stock     NUMERIC DEFAULT 0,
    fecha_compra    TIMESTAMPTZ,
    fecha_venta     TIMESTAMPTZ,
    raw_data        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_stock_centro ON stock(centro_id);
CREATE INDEX IF NOT EXISTS idx_stock_proveedor ON stock(centro_id, proveedor);
CREATE INDEX IF NOT EXISTS idx_stock_cod ON stock(centro_id, cod_articulo);

-- 2. TABLA: proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    centro_id       TEXT NOT NULL DEFAULT '63',
    codigo          TEXT,
    nombre          TEXT,
    nombre_comercial TEXT,
    email           TEXT,
    telefono        TEXT,
    direccion       TEXT,
    cp              TEXT,
    poblacion       TEXT,
    provincia       TEXT,
    raw_data        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prov_centro ON proveedores(centro_id);
CREATE INDEX IF NOT EXISTS idx_prov_nombre ON proveedores(centro_id, nombre);

-- 3. TABLA: incidencias
CREATE TABLE IF NOT EXISTS incidencias (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    centro_id       TEXT NOT NULL DEFAULT '63',
    numero          TEXT,
    articulo        TEXT,
    solucion        TEXT,
    raw_data        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incid_centro ON incidencias(centro_id);
CREATE INDEX IF NOT EXISTS idx_incid_articulo ON incidencias(centro_id, articulo);

-- 4. TABLA: reclamaciones
CREATE TABLE IF NOT EXISTS reclamaciones (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    centro_id       TEXT NOT NULL DEFAULT '63',
    claim_id        TEXT NOT NULL,           -- CLM-0001, CLM-0002, ...
    user_id         UUID REFERENCES auth.users(id),
    proveedor       TEXT NOT NULL,
    articulos       JSONB NOT NULL DEFAULT '[]',
    estado          TEXT DEFAULT 'Pendiente', -- Pendiente, Enviada, Resuelta
    valor_total     NUMERIC DEFAULT 0,
    email_enviado   BOOLEAN DEFAULT FALSE,
    fecha           TIMESTAMPTZ DEFAULT NOW(),
    notas           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reclam_centro ON reclamaciones(centro_id);
CREATE INDEX IF NOT EXISTS idx_reclam_estado ON reclamaciones(centro_id, estado);
ALTER TABLE reclamaciones ADD CONSTRAINT uq_reclam_claim_centro UNIQUE (claim_id, centro_id);

-- 5. TABLA: user_profiles (información extra del usuario)
CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    centro_id       TEXT NOT NULL DEFAULT '63',
    nombre          TEXT,
    rol             TEXT DEFAULT 'user',  -- 'admin' | 'user'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo ve datos de su centro
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener centro_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_centro()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT centro_id FROM user_profiles WHERE id = auth.uid()),
    '63'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas: cada tabla filtra por centro_id
-- STOCK
CREATE POLICY "stock_select" ON stock FOR SELECT USING (centro_id = get_user_centro());
CREATE POLICY "stock_insert" ON stock FOR INSERT WITH CHECK (centro_id = get_user_centro());
CREATE POLICY "stock_update" ON stock FOR UPDATE USING (centro_id = get_user_centro());
CREATE POLICY "stock_delete" ON stock FOR DELETE USING (centro_id = get_user_centro());

-- PROVEEDORES
CREATE POLICY "prov_select" ON proveedores FOR SELECT USING (centro_id = get_user_centro());
CREATE POLICY "prov_insert" ON proveedores FOR INSERT WITH CHECK (centro_id = get_user_centro());
CREATE POLICY "prov_update" ON proveedores FOR UPDATE USING (centro_id = get_user_centro());
CREATE POLICY "prov_delete" ON proveedores FOR DELETE USING (centro_id = get_user_centro());

-- INCIDENCIAS
CREATE POLICY "incid_select" ON incidencias FOR SELECT USING (centro_id = get_user_centro());
CREATE POLICY "incid_insert" ON incidencias FOR INSERT WITH CHECK (centro_id = get_user_centro());
CREATE POLICY "incid_update" ON incidencias FOR UPDATE USING (centro_id = get_user_centro());
CREATE POLICY "incid_delete" ON incidencias FOR DELETE USING (centro_id = get_user_centro());

-- RECLAMACIONES
CREATE POLICY "reclam_select" ON reclamaciones FOR SELECT USING (centro_id = get_user_centro());
CREATE POLICY "reclam_insert" ON reclamaciones FOR INSERT WITH CHECK (centro_id = get_user_centro());
CREATE POLICY "reclam_update" ON reclamaciones FOR UPDATE USING (centro_id = get_user_centro());
CREATE POLICY "reclam_delete" ON reclamaciones FOR DELETE USING (centro_id = get_user_centro());

-- USER_PROFILES: un usuario solo ve su propio perfil
CREATE POLICY "profile_select" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profile_update" ON user_profiles FOR UPDATE USING (id = auth.uid());
-- Solo insert via trigger (ver abajo)
CREATE POLICY "profile_insert" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, centro_id, nombre)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'centro_id', '63'),
        COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe y recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- FUNCIÓN RPC: limpiar y recargar stock (bulk upsert)
-- =============================================
-- =============================================
-- FUNCIÓN RPC: limpiar y recargar stock (bulk upsert)
-- ROBUST UPDATE: Handles both JSONB Array and JSONB String input
-- =============================================
CREATE OR REPLACE FUNCTION bulk_replace_stock(p_centro_id TEXT, p_rows JSONB)
RETURNS INTEGER AS $$
DECLARE
    row_count INTEGER;
    actual_rows JSONB;
BEGIN
    -- Handle case where client sends stringified JSON (scalar string)
    IF jsonb_typeof(p_rows) = 'string' THEN
        actual_rows := (p_rows #>> '{}')::jsonb;
    ELSE
        actual_rows := p_rows;
    END IF;

    -- Borrar stock existente del centro
    DELETE FROM stock WHERE centro_id = p_centro_id;
    
    -- Insertar nuevas filas
    INSERT INTO stock (centro_id, cod_articulo, articulo, proveedor, almacen, 
                       familia_n1, familia_n2, stock_uds, precio_inv, valor_stock,
                       fecha_compra, fecha_venta, raw_data)
    SELECT 
        p_centro_id,
        (elem->>'cod_articulo'),
        (elem->>'articulo'),
        (elem->>'proveedor'),
        (elem->>'almacen'),
        (elem->>'familia_n1'),
        (elem->>'familia_n2'),
        COALESCE((elem->>'stock_uds')::NUMERIC, 0),
        COALESCE((elem->>'precio_inv')::NUMERIC, 0),
        COALESCE((elem->>'valor_stock')::NUMERIC, 0),
        CASE WHEN elem->>'fecha_compra' IS NOT NULL AND elem->>'fecha_compra' != '' 
             THEN (elem->>'fecha_compra')::TIMESTAMPTZ ELSE NULL END,
        CASE WHEN elem->>'fecha_venta' IS NOT NULL AND elem->>'fecha_venta' != ''
             THEN (elem->>'fecha_venta')::TIMESTAMPTZ ELSE NULL END,
        COALESCE(elem->'raw_data', '{}'::JSONB)
    FROM jsonb_array_elements(actual_rows) AS elem;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Similar para proveedores
CREATE OR REPLACE FUNCTION bulk_replace_proveedores(p_centro_id TEXT, p_rows JSONB)
RETURNS INTEGER AS $$
DECLARE
    row_count INTEGER;
    actual_rows JSONB;
BEGIN
    IF jsonb_typeof(p_rows) = 'string' THEN
        actual_rows := (p_rows #>> '{}')::jsonb;
    ELSE
        actual_rows := p_rows;
    END IF;

    DELETE FROM proveedores WHERE centro_id = p_centro_id;
    
    INSERT INTO proveedores (centro_id, codigo, nombre, nombre_comercial, email, 
                              telefono, direccion, cp, poblacion, provincia, raw_data)
    SELECT 
        p_centro_id,
        (elem->>'codigo'),
        (elem->>'nombre'),
        (elem->>'nombre_comercial'),
        (elem->>'email'),
        (elem->>'telefono'),
        (elem->>'direccion'),
        (elem->>'cp'),
        (elem->>'poblacion'),
        (elem->>'provincia'),
        COALESCE(elem->'raw_data', '{}'::JSONB)
    FROM jsonb_array_elements(actual_rows) AS elem;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Similar para incidencias
CREATE OR REPLACE FUNCTION bulk_replace_incidencias(p_centro_id TEXT, p_rows JSONB)
RETURNS INTEGER AS $$
DECLARE
    row_count INTEGER;
    actual_rows JSONB;
BEGIN
    IF jsonb_typeof(p_rows) = 'string' THEN
        actual_rows := (p_rows #>> '{}')::jsonb;
    ELSE
        actual_rows := p_rows;
    END IF;

    DELETE FROM incidencias WHERE centro_id = p_centro_id;
    
    INSERT INTO incidencias (centro_id, numero, articulo, solucion, raw_data)
    SELECT 
        p_centro_id,
        (elem->>'numero'),
        (elem->>'articulo'),
        (elem->>'solucion'),
        COALESCE(elem->'raw_data', '{}'::JSONB)
    FROM jsonb_array_elements(actual_rows) AS elem;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
