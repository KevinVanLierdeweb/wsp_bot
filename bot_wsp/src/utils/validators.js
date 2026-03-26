import { isBefore, parse, isValid, format } from 'date-fns';

// Verifica si la hora dada está dentro del horario de atención configurado en .env
export const isWithinBusinessHours = (timeStr) => {
  const openTime  = process.env.RESTAURANT_OPEN_HOUR  || "19:00";
  const closeTime = process.env.RESTAURANT_CLOSE_HOUR || "23:59";
  return timeStr >= openTime && timeStr <= closeTime; // Comparación válida para formato HH:mm
};

// Valida que la fecha sea real y no sea en el pasado
export const isValidDate = (dateStr) => {
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliza a inicio del día para comparar solo fechas
  if (isBefore(parsed, today)) return false;

  return true;
};

// Valida que la hora tenga formato HH:MM en 24 horas
export const isValidTime = (timeStr) => {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(timeStr);
};
