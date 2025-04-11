// src/types/index.ts
export interface Resource {
    id: string;
    name: string;
    description?: string;
    startTime: string; // e.g., "09:00"
    endTime: string;   // e.g., "17:00" (Exclusive)
    slotDurationMinutes: number; // e.g., 60
}

export interface Booking {
    id: string;
    resourceId: string;
    userId: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    activity: string;
}

export interface TimeSlot {
    time: string; // HH:MM (Start time)
    isAvailable: boolean;
}