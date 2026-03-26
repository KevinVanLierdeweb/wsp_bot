import express from 'express';
import dotenv from 'dotenv';
import { supabase } from './database/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // Permite leer JSON en las peticiones entrantes

// Ruta raíz: confirma que el servidor está activo
app.get('/', (req, res) => {
    res.json({ message: 'Restaurant WhatsApp Bot API is running' });
});

// Health check: verifica conexión con la base de datos
app.get('/health', async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'DB no conectada' });
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', detail: error.message });
    }
});

// Inicia el servidor HTTP en el puerto configurado
export const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Servidor Express escuchando en el puerto ${PORT}`);
    });
};

export default app;
