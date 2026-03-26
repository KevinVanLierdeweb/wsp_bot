-- =========================================================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS PARA SUPABASE (POSTGRESQL)
-- =========================================================================

-- Comando para crear una tabla llamada 'reservations' dentro del esquema público ('public')
-- La condición 'IF NOT EXISTS' previene que el script falle y borre datos si la tabla ya existía de un despliegue anterior
CREATE TABLE IF NOT EXISTS public.reservations (
    -- COLUMNA id: Usaremos el tipo de dato UUID (Identificador Único Universal).
    -- Por defecto se autogenerará usando la función 'gen_random_uuid()' para evitar colisiones numéricas de IDs
    -- Es la Clave Primaria (PRIMARY KEY) de la tabla, lo que significa que será nuestro ancla principal de búsqueda
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- COLUMNA phone: Guardaremos el número de celular del cliente como texto (VARCHAR). 
    -- Longitud máxima 255 (muy generoso), y 'NOT NULL' prohíbe las filas que no tengan celular (es fundamental)
    phone VARCHAR(255) NOT NULL,
    
    -- COLUMNA name: Nombre literal que nos escribe en el chat el ser humano. Texto VARCHAR.
    name VARCHAR(255) NOT NULL,
    
    -- COLUMNA date: Especial para fechas puras del calendario. Tipo de dato nativo SQL 'DATE'.
    -- Solo guardará año, mes y día (Ej. 2024-11-04), excluyendo zonas horarias para evitar problemas de desfases globales
    date DATE NOT NULL,
    
    -- COLUMNA time: Relativo a la porción de horario puro ('20:30:00'). Sin fecha asociada.
    time TIME NOT NULL,
    
    -- COLUMNA guests: Registra el volumen de personas (int = número entero).
    guests INTEGER NOT NULL,
    
    -- COLUMNA table_number: Almacena físicamente qué mesa ocupará este cliente del 1 al Máximo
    table_number INTEGER NOT NULL,
    
    -- COLUMNA status: Un indicador literal. Inicia por defecto en 'active' si no se provee. 
    -- 'CHECK' es una regla restrictiva: Si el sistema intentara enviar algo como 'eliminadoooo', Postgres rechazará el comando.
    -- Solo se permite albergar dos estados ('active' o 'cancelled'). Esto protege la integridad lógica de la App
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    
    -- COLUMNA created_at: Una huella digital imborrable para saber matemáticamente en qué milisegundo se creó la fila.
    -- Utiliza TIMESTAMP WITH TIME ZONE para guardar la hora global exacta y, por defecto, se llama a una función para imprimir el 'ahora' ('utc')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===============================================
-- CREACIÓN DE ÍNDICES (OPTIONAL BUT CRITICAL)
-- ===============================================
-- Los índices (INDEX) funcionan como un "índice de un libro". Si tienes 2 millones de reservas y la IA necesita saber hoy 
-- las de ESTE MES, buscar sin índice tardaría minutos, buscar con índice tarda milisegundos.

-- Creamos un índice sobre el 'teléfono' (Ideal para la petición veloz de "Ver mis reservas de mipropio_numero")
CREATE INDEX IF NOT EXISTS phone_idx ON public.reservations (phone);

-- Creamos un índice vital sobre 'date'. Nuestra validación de mesas (checkAvailability) requiere súper velocidad para leer la fecha actual en la db
CREATE INDEX IF NOT EXISTS date_idx ON public.reservations (date);

-- Creamos un índice para los estados ('inactive/cancelled/active'). Usado todo el tiempo para filtrar las que ya se esfumaron
CREATE INDEX IF NOT EXISTS status_idx ON public.reservations (status);
