import { ref } from 'vue';
import { type Resource, type Booking } from '../types/index'; // Use '@' alias configured by Vite

// --- Interfaces ---
interface User {
    id: string;
    role: string;
}

interface Role {
    name: string;
    maxBookingHours: number;
}

// --- Data ---
export const resources = ref<Resource[]>([
    { id: 'server-1', name: 'Maxwell', startTime: '00:00', endTime: '23:00', slotDurationMinutes: 60 },
    { id: 'server-2', name: 'CPU Compute Node Beta', startTime: '00:00', endTime: '23:00', slotDurationMinutes: 120 },
    { id: 'rig-1', name: 'Testing Rig Gamma', startTime: '00:00', endTime: '23:30', slotDurationMinutes: 60 },
]);

export let bookings = ref<Booking[]>([
    { id: 'b1', resourceId: 'server-1', userId: 'alice', date: '2023-10-27', startTime: '10:00', endTime: '11:00', activity: 'Training' },
    { id: 'b2', resourceId: 'server-1', userId: 'bob', date: getDemoDateString(0), startTime: '14:00', endTime: '16:00', activity: 'Testing' },
    { id: 'b3', resourceId: 'rig-1', userId: 'charlie', date: getDemoDateString(0), startTime: '09:30', endTime: '11:00', activity: 'Development' },
    { id: 'b4', resourceId: 'server-1', userId: 'dave', date: getDemoDateString(1), startTime: '09:00', endTime: '11:00', activity: 'Maintenance' },
]);

const roles = ref<Role[]>([
    { name: 'user', maxBookingHours: 2 },
    { name: 'admin', maxBookingHours: 12 },
]);

const users = ref<User[]>([
    { id: 'alice', role: 'admin' },
    { id: 'bob', role: 'user' },
    { id: 'charlie', role: 'user' },
    { id: 'dave', role: 'user' },
]);

export const currentUserId = ref<string>(''); // Simulate logged-in user

// --- Helper Functions ---
const simulateDelay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

export function getDemoDateString(dayOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`; // Format as YYYY-MM-DD
}

export async function setCurrentUser(userId: string) {

    await simulateDelay();
    // const user = users.value.find(u => u.id === userId);
    // if (!user) {
    //     console.error(`SimAPI: User not found: ${userId}`);
    //     throw new Error(`User with ID ${userId} not found.`);
    // }
    currentUserId.value = userId;
    const newUser = { id: userId, role: 'user' }
    users.value.push(newUser);
    console.log(`SimAPI: Current user set to ${userId}`);
}



// --- API Functions ---
export async function fetchResources(): Promise<Resource[]> {
    await simulateDelay();
    console.log("SimAPI: Fetching resources");
    return JSON.parse(JSON.stringify(resources.value));
}

export async function fetchBookingsForResource(resourceId: string, date: string): Promise<Booking[]> {
    await simulateDelay();
    if (!resourceId || !date) {
        console.error("SimAPI: Missing resourceId or date for fetching bookings");
        throw new Error("Resource ID and date are required.");
    }
    console.log(`SimAPI: Fetching bookings for ${resourceId} on ${date}`);
    const filteredBookings = bookings.value.filter(b => b.resourceId === resourceId && b.date === date);
    return JSON.parse(JSON.stringify(filteredBookings));
}

export async function getUserRole(userId: string): Promise<Role> {
    await simulateDelay();
    const user = users.value.find(u => u.id === userId);
    if (!user) {
        console.error(`SimAPI: User not found: ${userId}`);
        throw new Error(`User with ID ${userId} not found.`);
    }
    const role = roles.value.find(r => r.name === user.role);
    if (!role) {
        console.error(`SimAPI: Role not found: ${user.role}`);
        throw new Error(`Role with name ${user.role} not found.`);
    }
    return JSON.parse(JSON.stringify(role));
}

export async function createBooking(bookingData: Omit<Booking, 'id'>): Promise<Booking> {
    await simulateDelay(500);

    console.log("SimAPI: Attempting to create booking", bookingData);

    const resource = resources.value.find(r => r.id === bookingData.resourceId);
    if (!resource) {
        console.error(`SimAPI: Resource not found: ${bookingData.resourceId}`);
        throw new Error(`Resource with ID ${bookingData.resourceId} not found.`);
    }

    // Validate start and end times
    const newBookingStart = new Date(`${bookingData.date}T${bookingData.startTime}:00`);
    const newBookingEnd = new Date(`${bookingData.date}T${bookingData.endTime}:00`);

    if (isNaN(newBookingStart.getTime()) || isNaN(newBookingEnd.getTime())) {
        throw new Error('Invalid start or end time format');
    }

    if (newBookingEnd <= newBookingStart) {
        throw new Error('End time must be after start time');
    }

    // Conflict check
    const conflict = bookings.value.some(existingBooking => {
        if (bookingData.resourceId !== existingBooking.resourceId) return false;

        const existingStart = new Date(`${existingBooking.date}T${existingBooking.startTime}:00`);
        const existingEnd = new Date(`${existingBooking.date}T${existingBooking.endTime}:00`);

        return (
            newBookingStart.getTime() < existingEnd.getTime() &&
            newBookingEnd.getTime() > existingStart.getTime()
        );
    });

    if (conflict) {
        console.warn('SimAPI: Booking conflict detected');
        throw new Error('Time slot conflicts with an existing reservation.');
    }

    const newBooking: Booking = {
        ...bookingData,
        id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    bookings.value.push(newBooking);
    console.log('SimAPI: Booking added:', newBooking);
    return JSON.parse(JSON.stringify(newBooking));
}

export async function deleteBooking(bookingId: string): Promise<void> {
    await simulateDelay(500);

    console.log(`SimAPI: Attempting to delete booking with ID: ${bookingId}`);

    const initialLength = bookings.value.length;
    bookings.value = bookings.value.filter(booking => booking.id !== bookingId);

    if (bookings.value.length === initialLength) {
        console.warn(`SimAPI: Booking with ID ${bookingId} not found.`);
        throw new Error(`Booking with ID ${bookingId} not found.`);
    }

    console.log(`SimAPI: Booking with ID ${bookingId} deleted.`);
}

export function resetData() {
    bookings.value = [];
    console.log("SimAPI: Bookings Reset");
}