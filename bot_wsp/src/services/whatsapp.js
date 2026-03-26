import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './flow.js';

export const startWhatsAppBot = async () => {
    // Obtiene la versión más reciente de WhatsApp Web para evitar rechazos de API
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📡 Usando versión de WhatsApp Web: v${version.join('.')}, ultima versión disponible: ${isLatest}`);

    // Carga o crea las credenciales de sesión en la carpeta auth_info_baileys
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Crea el socket de conexión con WhatsApp
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }) // Suprime logs internos de Baileys
    });

    sock.ev.on('creds.update', saveCreds); // Guarda las credenciales cuando se actualizan

    // Maneja los cambios de estado de la conexión (QR, conectado, desconectado)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Muestra el código QR en la terminal para vincular la cuenta
            console.log("📲 Escanea el código QR con tu WhatsApp para iniciar sesión.");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const errorStatus = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = errorStatus !== DisconnectReason.loggedOut;
            console.log(`❌ Conexión cerrada (Status: ${errorStatus}). Reconectando...`, shouldReconnect);
            console.error("🔍 DETALLE DEL ERROR DE WHATSAPP:", lastDisconnect?.error);
            if (shouldReconnect) startWhatsAppBot(); // Reconecta si no fue cierre manual
        } else if (connection === 'open') {
            console.log('✅ Bot de WhatsApp conectado y listo para recibir mensajes!');
        }
    });

    // Escucha mensajes entrantes y los procesa
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return; // Ignora mensajes propios o vacíos
            const from = msg.key.remoteJid;
            if (from.includes('@g.us')) return; // Ignora mensajes de grupos

            // Extrae el texto del mensaje (texto normal o respuesta)
            let textMessage = '';
            if (msg.message.conversation) {
                textMessage = msg.message.conversation;
            } else if (msg.message.extendedTextMessage?.text) {
                textMessage = msg.message.extendedTextMessage.text;
            } else {
                return; // Ignora fotos, audios, etc.
            }

            console.log(`💬 Mensaje recibido de ${from}: ${textMessage}`);
            await handleMessage(sock, msg, from, textMessage); // Pasa el mensaje al flujo conversacional
        } catch (error) {
            console.error('Error procesando mensaje entrante:', error);
        }
    });

    return sock;
};
