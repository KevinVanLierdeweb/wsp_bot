import dotenv from 'dotenv';
import { startWhatsAppBot } from './services/whatsapp.js';
import { startServer } from './app.js';

dotenv.config(); // Carga variables de entorno desde .env

const iniciar = async () => {
    console.log("Iniciando Bot de Restaurante...");
    startServer();              // Levanta el servidor Express
    await startWhatsAppBot();  // Conecta el bot a WhatsApp
};

iniciar().catch(console.error); // Inicia la aplicación y captura errores críticos
