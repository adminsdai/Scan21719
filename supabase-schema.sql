-- ==============================================================================
-- SCRIPT DE INICIALIZACIÓN DE SUPABASE
-- Administrador de Privacidad Ley 21.719 - SDAI Chile
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLA DE REGISTRO INMUTABLE (APPEND-ONLY)
-- Cumplimiento de trazabilidad sin posibilidad de alteración.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    ip_anonymized VARCHAR(255) NOT NULL,
    user_agent TEXT,
    url_scanned TEXT NOT NULL,
    action VARCHAR(50) DEFAULT 'AGREED_TO_POLICIES' NOT NULL
);

-- ==============================================================================
-- 3. TABLA DE CREDENCIALES PASSKEYS (WEBAUTHN)
-- Almacena las llaves públicas biométricas del administrador.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.passkey_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,    -- Base64URL encoded credential ID
    public_key TEXT NOT NULL,              -- Base64URL encoded public key
    counter BIGINT NOT NULL DEFAULT 0,     -- Prevents cloning attacks
    transports TEXT[],                     -- e.g. ['internal', 'usb']
    user_id TEXT NOT NULL DEFAULT 'admin'  -- Single admin user for now
);

-- ==============================================================================
-- 4. CONFIGURACIÓN DE SEGURIDAD A NIVEL DE FILA (RLS)
-- ==============================================================================

-- Activar RLS en ambas tablas
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Políticas para consent_logs (Append-Only)
-- ------------------------------------------------------------------------------

-- Permitir INSERT a cualquiera (el backend con la anon key inyectará los datos)
CREATE POLICY "Permitir inserción de logs" 
ON public.consent_logs 
FOR INSERT 
TO public
WITH CHECK (true);

-- Permitir SELECT (El backend validará el JWT del admin y luego usará la key para leer)
-- Nota: Para máxima seguridad el backend usará el service_role key para leer, pero si usamos anon:
CREATE POLICY "Permitir lectura general (protegida por backend)" 
ON public.consent_logs 
FOR SELECT 
TO public
USING (true);

-- BLOQUEO TOTAL DE UPDATES (Inmutabilidad)
CREATE POLICY "Bloquear modificaciones (Append-Only)" 
ON public.consent_logs 
FOR UPDATE 
USING (false);

-- BLOQUEO TOTAL DE DELETES (Inmutabilidad)
CREATE POLICY "Bloquear borrado (Append-Only)" 
ON public.consent_logs 
FOR DELETE 
USING (false);

-- ------------------------------------------------------------------------------
-- Políticas para passkey_credentials
-- ------------------------------------------------------------------------------

-- Permitir lectura y escritura solo a través del backend seguro
CREATE POLICY "Permitir operaciones backend sobre passkeys" 
ON public.passkey_credentials 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
