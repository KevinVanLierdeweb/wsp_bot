import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Detecta si el usuario dejó los valores de ejemplo sin cambiar
const isPlaceholder = supabaseUrl && supabaseUrl.includes("tu-proyecto.supabase.co");

if (!supabaseUrl || !supabaseKey || isPlaceholder) {
  console.warn("⚠️ Supabase no configurado. El bot correrá sin base de datos.");
}

// Cliente de Supabase (null si no está configurado)
export const supabase = supabaseUrl && supabaseKey && !isPlaceholder
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Retorna las reservas activas de un número de teléfono específico
export const getActiveReservations = async (phone) => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reservations').select('*')
    .eq('phone', phone).eq('status', 'active')
    .order('date', { ascending: true }).order('time', { ascending: true });
  if (error) throw error;
  return data;
};

// Retorna todas las reservas activas del sistema (uso exclusivo del administrador)
export const getAllActiveReservations = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reservations').select('*')
    .eq('status', 'active')
    .order('date', { ascending: true }).order('time', { ascending: true });
  if (error) throw error;
  return data;
};

// Inserta una nueva reserva en la base de datos y retorna el registro creado
export const createReservation = async (reservationData) => {
  if (!supabase) throw new Error("Supabase no configurado");
  const { phone, name, date, time, guests, table_number } = reservationData;
  const { data, error } = await supabase
    .from('reservations')
    .insert([{ phone, name, date, time, guests, table_number, status: 'active' }])
    .select();
  if (error) throw error;
  return data[0];
};

// Cambia el estado de una reserva a 'cancelled' (soft delete)
export const cancelReservation = async (reservationId) => {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data, error } = await supabase
    .from('reservations').update({ status: 'cancelled' })
    .eq('id', reservationId).select();
  if (error) throw error;
  return data[0];
};

// Busca la primera mesa libre para una fecha dada. Retorna el número de mesa o null si no hay.
export const checkAvailability = async (date, time) => {
  if (!supabase) return 1;
  const { data, error } = await supabase
    .from('reservations').select('table_number')
    .eq('date', date).eq('status', 'active');
  if (error) throw error;

  const occupiedTables = data.map(r => r.table_number);
  const maxTables = parseInt(process.env.MAX_TABLES || '10', 10);

  for (let i = 1; i <= maxTables; i++) {
    if (!occupiedTables.includes(i)) return i; // Primera mesa libre disponible
  }
  return null; // Sin mesas disponibles
};

// Verifica si el usuario ya hizo una reserva en las últimas 4 horas (prevención de spam)
export const checkRecentReservation = async (phone) => {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('reservations').select('created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false }).limit(1);
    if (error) { console.error("Error en checkRecentReservation:", error); return false; }
    if (data && data.length > 0) {
      const hoursDiff = (Date.now() - new Date(data[0].created_at).getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 4) return true; // Reserva reciente encontrada
    }
    return false;
  } catch (err) {
    console.error("Fallo de red en Supabase:", err);
    return false;
  }
};
