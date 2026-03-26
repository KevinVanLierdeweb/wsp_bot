import { format } from 'date-fns';
import {
  createReservation, getActiveReservations, cancelReservation,
  checkAvailability, checkRecentReservation, getAllActiveReservations
} from '../database/supabase.js';
import { isValidDate, isValidTime, isWithinBusinessHours } from '../utils/validators.js';

// Mapa en memoria para rastrear el estado de la conversación de cada usuario
const sessions = new Map();

// Textos estáticos del bot
const MENU_TEXT = `📋 *Nuestro Menú* 📋\n\n*Entradas*\n- Empanadas $500\n- Rabas $1200\n\n*Platos Principales*\n- Asado con papas $3000\n- Milanesa Napolitana $2500\n- Pasta Casera $2000\n\n*Bebidas*\n- Gaseosa $500\n- Cerveza $800\n- Vino $1500`;
const MAIN_MENU = `Hola! Soy el asistente virtual del restaurante. ¿En qué te puedo ayudar hoy?\n\nResponde con el número de la opción:\n1️⃣ Hacer una reserva\n2️⃣ Ver el menú\n3️⃣ Mis reservas\n4️⃣ Cancelar una reserva`;
const ADMIN_MENU = `👑 *Panel de Administrador* 👑\n\nResponde con el número de la opción:\n6️⃣ Ver TODAS las reservas activas\n(O usa comandos normales como cliente)`;

// Envía un mensaje simulando que el bot está escribiendo (espera 3 segundos antes de responder)
const sendReply = async (sock, to, text) => {
  try {
    await sock.sendPresenceUpdate('composing', to); // Muestra "escribiendo..."
    await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa de 3 segundos
    await sock.sendPresenceUpdate('paused', to);
    return await sock.sendMessage(to, { text });
  } catch (err) {
    console.error("Error al enviar mensaje:", err);
  }
};

// Función principal: recibe cada mensaje y decide qué responder según el estado de la sesión
export const handleMessage = async (sock, msg, from, messageText) => {
  const text = messageText.trim();
  const phone = from.split('@')[0]; // ID del usuario (puede ser número o LID interno de WhatsApp)

  // Soporta múltiples admins separados por coma en .env (también acepta LIDs internos de WhatsApp)
  const ownerPhones = (process.env.OWNER_PHONE || '').split(',').map(n => n.replace(/\D/g, ''));
  const isAdmin = ownerPhones.some(adminPhone => adminPhone.length > 5 && phone.endsWith(adminPhone));

  // Muestra en consola el ID interno para facilitar la configuración del admin
  if (!isAdmin) {
    console.log(`[DEBUG ADMIN] ID del usuario: '${phone}'. Si sos el dueño, agregá este ID a OWNER_PHONE en .env`);
  }

  // Inicializa sesión nueva si el usuario no tiene una activa
  if (!sessions.has(phone)) {
    sessions.set(phone, { step: 'IDLE', data: {} });
  }
  const session = sessions.get(phone);

  try {
    // Comando global "salir": resetea la conversación al menú principal
    if (text.toLowerCase() === 'salir' || text.toLowerCase() === 'menu principal') {
      session.step = 'IDLE';
      session.data = {};
      let response = MAIN_MENU;
      if (isAdmin) response += `\n\n${ADMIN_MENU}`;
      return await sendReply(sock, from, response);
    }

    switch (session.step) {

      // Menú principal: espera que el usuario elija una opción (1-4 o 6 para admin)
      case 'IDLE':
        if (text === '1') {
          // Límite de reservas cada 4h — DESACTIVADO TEMPORALMENTE
          /*
          const hasRecent = await checkRecentReservation(phone);
          if (hasRecent) return await sendReply(sock, from, `⚠️ Ya hiciste una reserva reciente. Espera 4 horas o contacta al administrador.`);
          */
          session.step = 'AWAIT_NAME';
          return await sendReply(sock, from, `¡Perfecto! Vamos a hacer tu reserva. 📝\n\nPrimero, por favor dime tu *nombre completo*.\n(Escribe 'salir' en cualquier momento para cancelar)`);
        }
        else if (text === '2') {
          return await sendReply(sock, from, MENU_TEXT);
        }
        else if (text === '3') {
          // Muestra las reservas activas del usuario
          const res = await getActiveReservations(phone);
          if (res.length === 0) return await sendReply(sock, from, `No tienes reservas activas en este momento.`);
          let reply = `Tus reservas activas:\n\n`;
          res.forEach((r, i) => {
            reply += `*Reserva #${i+1}*\n📅 Fecha: ${r.date}\n⏰ Hora: ${r.time}\n👥 Personas: ${r.guests}\n🍽️ Mesa asignada: ${r.table_number}\n\n`;
          });
          return await sendReply(sock, from, reply);
        }
        else if (text === '4') {
          // Muestra las reservas del usuario para que elija cuál cancelar
          const res = await getActiveReservations(phone);
          if (res.length === 0) return await sendReply(sock, from, `No tienes reservas activas para cancelar.`);
          let reply = `¿Qué reserva deseas cancelar?\nResponde con el número correspondiente:\n\n`;
          res.forEach((r, i) => { reply += `${i+1}️⃣ Fecha: ${r.date} a las ${r.time} para ${r.guests} personas.\n`; });
          session.step = 'AWAIT_CANCEL';
          session.data.reservations = res; // Guarda la lista en sesión para no re-consultar la DB
          return await sendReply(sock, from, reply);
        }
        else if (isAdmin && text === '6') {
          // Admin: muestra todas las reservas activas del sistema
          const allRes = await getAllActiveReservations();
          if (allRes.length === 0) return await sendReply(sock, from, `No hay reservas activas en el sistema.`);
          let reply = `📊 *Todas las reservas activas:*\n\n`;
          allRes.forEach(r => {
            reply += `👤 Cliente: ${r.name} (${r.phone})\n📅 Fecha: ${r.date} | ⏰ ${r.time}\n👥 Personas: ${r.guests} | 🍽️ Mesa: ${r.table_number}\n--------------------------\n`;
          });
          return await sendReply(sock, from, reply);
        }
        else {
          let response = MAIN_MENU;
          if (isAdmin) response += `\n\n${ADMIN_MENU}`;
          return await sendReply(sock, from, response);
        }

      // Paso 1: Solicita el nombre del cliente
      case 'AWAIT_NAME':
        session.data.name = text;
        // Si WhatsApp oculta el número del usuario (@lid), se solicita manualmente
        if (from.includes('@lid')) {
          session.step = 'AWAIT_PHONE';
          return await sendReply(sock, from, `Gracias ${text}. ¿A qué número de celular podemos contactarte en caso de algún cambio en tu reserva?`);
        } else {
          session.step = 'AWAIT_GUESTS';
          return await sendReply(sock, from, `Gracias ${text}. ¿Para *cuántas personas* es la reserva? (Solo ingresa el número, ej: 4)`);
        }

      // Paso 1b: Solicita el número de contacto si el usuario tiene privacidad activada en WhatsApp
      case 'AWAIT_PHONE':
        const contactPhone = text.replace(/\D/g, '');
        if (contactPhone.length < 8) return await sendReply(sock, from, `Por favor ingresa un número de teléfono válido.`);
        session.data.name = `${session.data.name} (Telf: ${contactPhone})`; // Guarda el teléfono junto al nombre
        session.step = 'AWAIT_GUESTS';
        return await sendReply(sock, from, `Excelente. ¿Para *cuántas personas* es la reserva? (Solo ingresa el número, ej: 4)`);

      // Paso 2: Valida y guarda la cantidad de personas
      case 'AWAIT_GUESTS':
        const guests = parseInt(text);
        if (isNaN(guests) || guests <= 0 || guests > 20) {
          return await sendReply(sock, from, `Por favor, ingresa un número de personas válido (entre 1 y 20).`);
        }
        session.data.guests = guests;
        session.step = 'AWAIT_DATE';
        return await sendReply(sock, from, `¿Qué *fecha* te gustaría reservar?\nPor favor usa el formato AAAA-MM-DD (ejemplo: ${format(new Date(), 'yyyy-MM-dd')}).`);

      // Paso 3: Valida que la fecha sea real y futura
      case 'AWAIT_DATE':
        if (!isValidDate(text)) {
          return await sendReply(sock, from, `La fecha es inválida o es una fecha en el pasado. Ingresa la fecha en formato AAAA-MM-DD (ejemplo: 2024-12-31).`);
        }
        session.data.date = text;
        session.step = 'AWAIT_TIME';
        return await sendReply(sock, from, `Perfecto. ¿A qué *hora*?\nNuestro horario es de ${process.env.RESTAURANT_OPEN_HOUR || '19:00'} a ${process.env.RESTAURANT_CLOSE_HOUR || '23:59'}.\nPor favor usa el formato HH:MM (ejemplo: 20:30).`);

      // Paso 4: Valida la hora, verifica disponibilidad e inserta la reserva en la DB
      case 'AWAIT_TIME':
        if (!isValidTime(text)) return await sendReply(sock, from, `Formato de hora inválido. Usa HH:MM (ejemplo: 20:30).`);
        if (!isWithinBusinessHours(text)) {
          return await sendReply(sock, from, `Lo siento, esa hora está fuera de nuestro horario de atención.\nAbrimos a las ${process.env.RESTAURANT_OPEN_HOUR || '19:00'} y cerramos a las ${process.env.RESTAURANT_CLOSE_HOUR || '23:59'}.`);
        }

        session.data.time = text;
        session.step = 'PROCESSING'; // Bloquea la sesión para evitar reservas duplicadas si el usuario escribe varias veces

        const tableNumber = await checkAvailability(session.data.date, session.data.time);
        if (tableNumber === null) {
          session.step = 'IDLE';
          return await sendReply(sock, from, `Lo siento, no tenemos mesas disponibles para esa fecha y hora. 😔\nIntenta con otro horario escribiendo "1".`);
        }
        session.data.table_number = tableNumber;

        try {
          const res = await createReservation({
            phone, name: session.data.name, date: session.data.date,
            time: session.data.time, guests: session.data.guests, table_number: session.data.table_number
          });

          // Notifica al dueño en segundo plano (fire-and-forget, no bloquea la respuesta al cliente)
          for (const num of ownerPhones) {
            if (num && num !== phone && num.length > 5) {
              const adminMsg = `🚨 *¡NUEVA RESERVA RECIBIDA!* 🚨\n\n👤 Nombre: ${res.name}\n📱 Teléfono: ${res.phone}\n📅 Fecha: ${res.date}\n⏰ Hora: ${res.time}\n👥 Personas: ${res.guests}\n🍽️ Mesa asignada: ${res.table_number}`;
              sock.sendMessage(`${num}@s.whatsapp.net`, { text: adminMsg }).catch(() => {});
              sock.sendMessage(`${num}@lid`, { text: adminMsg }).catch(() => {});
            }
          }

          const confirmationMsg = `✅ *¡Tu reserva está confirmada!* ✅\n\n👤 *Nombre:* ${res.name}\n📅 *Fecha:* ${res.date}\n⏰ *Hora:* ${res.time}\n👥 *Personas:* ${res.guests}\n🍽️ *Mesa asignada:* ${res.table_number}\n\n¡Te esperamos!`;
          session.step = 'IDLE';
          session.data = {};
          return await sendReply(sock, from, confirmationMsg);

        } catch (dbError) {
          session.step = 'IDLE'; // Libera la sesión para que el usuario pueda reintentar
          console.error(dbError);
          return await sendReply(sock, from, `Ocurrió un error al guardar tu reserva. Por favor intenta más tarde.`);
        }

      // Paso de cancelación: el usuario elige qué reserva eliminar por número de índice
      case 'AWAIT_CANCEL':
        const index = parseInt(text) - 1; // Convierte de base-1 (usuario) a base-0 (array JS)
        const userReservations = session.data.reservations;
        if (isNaN(index) || index < 0 || index >= userReservations.length) {
          return await sendReply(sock, from, `Número inválido. Por favor escribe el número de la reserva que deseas cancelar o 'salir'.`);
        }
        const resToCancel = userReservations[index];
        try {
          await cancelReservation(resToCancel.id); // Soft delete: cambia status a 'cancelled'
          session.step = 'IDLE';
          session.data = {};

          // Notifica al dueño de la cancelación en segundo plano
          for (const num of ownerPhones) {
            if (num && num !== phone && num.length > 5) {
              const adminCancelMsg = `❌ *RESERVA CANCELADA* ❌\n\nEl cliente ${resToCancel.name} (${resToCancel.phone}) canceló su reserva para el ${resToCancel.date} a las ${resToCancel.time}.`;
              sock.sendMessage(`${num}@s.whatsapp.net`, { text: adminCancelMsg }).catch(() => {});
              sock.sendMessage(`${num}@lid`, { text: adminCancelMsg }).catch(() => {});
            }
          }
          return await sendReply(sock, from, `✅ Tu reserva ha sido cancelada exitosamente.`);
        } catch (err) {
          console.error(err);
          return await sendReply(sock, from, `Error al cancelar la reserva. Intenta de nuevo más tarde.`);
        }

      // Estado de seguridad: si la sesión llega a un estado desconocido, la resetea
      default:
        session.step = 'IDLE';
        return await sendReply(sock, from, MAIN_MENU);
    }

  } catch (error) {
    console.error("Error procesando mensaje:", error);
    await sock.sendMessage(from, { text: "Ups, ocurrió un error interno. Por favor intenta de nuevo." });
  }
};
