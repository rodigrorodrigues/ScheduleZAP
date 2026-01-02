/**
 * Get the current date in São Paulo timezone
 * @returns Date string in YYYY-MM-DD format
 */
export function getCurrentDateSP(): string {
  const now = new Date();
  const spDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  return spDate.toISOString().split("T")[0];
}

/**
 * Get the current time in São Paulo timezone
 * @returns Time string in HH:MM format
 */
export function getCurrentTimeSP(): string {
  const now = new Date();
  const spTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  return spTime.toTimeString().slice(0, 5);
}

/**
 * Create a Date object in São Paulo timezone from date and time strings
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timeString - Time string in HH:MM format
 * @returns Date object in São Paulo timezone
 */
export function createDateInSP(dateString: string, timeString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  const dateTimeString = `${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}T${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
  return new Date(dateTimeString + "-03:00"); // UTC-3 for São Paulo
}

/**
 * Convert a Date to São Paulo timezone
 * @param date - Date object to convert
 * @returns Date object in São Paulo timezone
 */
export function convertToSP(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}

/**
 * Check if a scheduled date/time is in the future
 * @param scheduledDate - Date string in YYYY-MM-DD format
 * @param scheduledTime - Time string in HH:MM format
 * @returns Object with validation result and error message if invalid
 */
export function validateScheduledDateTime(
  scheduledDate: string,
  scheduledTime: string
): { isValid: boolean; error?: string } {
  const scheduledAt = createDateInSP(scheduledDate, scheduledTime);
  const now = new Date();
  const nowSP = convertToSP(now);
  const scheduledSP = convertToSP(scheduledAt);

  const isToday = scheduledSP.toDateString() === nowSP.toDateString();
  
  if (isToday && scheduledSP.getTime() <= nowSP.getTime()) {
    return {
      isValid: false,
      error: "Para hoje, o horário deve ser no futuro (São Paulo)",
    };
  }

  return { isValid: true };
}
