// Módulo central de eventos para comunicar el estado del bot al servidor web
// Funciona como un "bus de mensajes" interno entre whatsapp.js y app.js
import { EventEmitter } from 'events';

// Instancia única (Singleton) que será compartida por todos los módulos
export const botEmitter = new EventEmitter();

// Estado global del bot (lo compartimos entre módulos)
export const botState = {
  running: false,    // Si el bot está activo
  connected: false,  // Si WhatsApp está conectado
  qr: null,          // El QR actual (string) o null si ya conectó
};
