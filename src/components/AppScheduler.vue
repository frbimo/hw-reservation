<template>
    <div id="app-container">
        <h1>OSC Asia Pacific Lab - Resource Reservation</h1>

        <!-- Resource Selection -->
        <div class="controls-row">
            <label for="resource-select">Select Resource:</label>
            <select id="resource-select" v-model="selectedResourceId">
                <option :value="null" disabled>-- Please select --</option>
                <option v-for="res in resources" :key="res.id" :value="res.id">
                    {{ res.name }}
                </option>
            </select>
        </div>

        <!-- Date Selection (Calendar Input) -->
        <!-- <div class="controls-row">
        <label for="date-select">Select Date:</label>
        <input type="date" id="date-select" v-model="dateString" />
        <span class="current-date-display" v-if="currentDate">Viewing: {{ formatDate(currentDate) }}</span>
      </div> -->
        <div class="controls-row">
            <label for="date-select">Select Date:</label>
            <input type="date" id="date-select" v-model="dateString" />
            <button @click="goToPreviousDay">Previous Day</button>
            <button @click="goToNextDay">Next Day</button>
            <span class="current-date-display" v-if="currentDate">Viewing: {{ formatDate(currentDate) }}</span>
        </div>

        <!-- Render Scheduler only if a resource AND date are selected -->
        <HardwareScheduler v-if="selectedResource && currentDate" ref="schedulerRef"
            :key="selectedResourceId + '-' + dateString" :resource="selectedResource" :bookings="filteredBookings"
            :viewDate="currentDate" :currentUserId="currentUserId" @request-booking="handleBookingRequest" />
        <div v-else class="placeholder-message">
            <p v-if="!selectedResource">Please select a resource.</p>
            <p v-if="!currentDate">Please select a valid date.</p>
        </div>

        <!-- Booking Confirmation Modal -->
        <div v-if="showBookingModal" class="booking-modal">
            <h2>Confirm New Booking</h2>
            <p><strong>Resource:</strong> {{ newBookingInfo.resourceName }}</p>
            <p><strong>Date:</strong> {{ formatDate(newBookingInfo.start) }}</p>
            <p>
                <strong>Time:</strong> {{ formatTimeOnly(newBookingInfo.start) }} -
                {{ formatTimeOnly(newBookingInfo.end) }}
            </p>
            <p><i>{{ currentUserId }} will book this time slot.</i></p>
            <div class="modal-actions">
                <button @click="confirmBooking">Confirm Booking</button>
                <button @click="cancelBooking">Cancel</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import HardwareScheduler from './HardwareScheduler.vue';
import {
    resources,
    bookings,
    createBooking,
    deleteBooking,
    fetchResources,
    currentUserId,
    getUserRole,
    getDemoDateString
} from '../services/apiSimulator';

// --- State ---
const selectedResourceId = ref(null);
const dateString = ref(getDemoDateString(0));
const currentDate = ref(parseDateString(dateString.value));
const schedulerRef = ref(null);
const showBookingModal = ref(false);
const newBookingInfo = ref(null);
const userRole = ref(null);

// --- Computed Properties ---
const selectedResource = computed(() => {
    return resources.value.find((r) => r.id === selectedResourceId.value) || null;
});

const filteredBookings = computed(() => {
    console.log('Debugging filteredBookings:');
    console.log('selectedResourceId:', selectedResourceId.value);
    console.log('dateString:', dateString.value);
    console.log('bookings:', bookings.value);
    console.log('selectedResource:', selectedResource.value);

    if (!selectedResource.value || !dateString.value) {
        console.log('No selected resource or dateString is empty.');
        return [];
    }

    const filtered = bookings.value.filter(
        (b) => {
            console.log('Checking booking:', b);
            console.log('Condition 1 (resourceId):', b.resourceId === selectedResourceId.value, b.resourceId, selectedResourceId.value);
            console.log('Condition 2 (date):', b.date === dateString.value, b.date, dateString.value);
            return b.resourceId === selectedResourceId.value && b.date === dateString.value
        }
    );

    console.log('Filtered bookings:', filtered);
    return filtered;
});

// --- Watchers ---
watch(dateString, (newDateStr) => {
    currentDate.value = parseDateString(newDateStr);
});

watch(currentUserId, async (newUserId) => {
    try {
        userRole.value = await getUserRole(newUserId);
    } catch (error) {
        console.error('Error fetching user role:', error);
        alert(`Failed to fetch user role: ${error.message}`);
        userRole.value = { name: 'user', maxBookingHours: 2 }; // Default role
    }
});

// // --- Date Helper Functions ---
// function getDemoDateString(dayOffset = 0) {
//   const date = new Date();
//   date.setDate(date.getDate() + dayOffset);
//   const year = date.getFullYear();
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const day = date.getDate().toString().padStart(2, '0');
//   return `${year}-${month}-${day}`;
// }

function parseDateString(dateStr) {
    if (!dateStr) return null;
    try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        const d = new Date(Date.UTC(year, month, day));
        if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
            return d;
        }
        console.warn('Parsed date parts do not match input string:', dateStr);
        return null;
    } catch (e) {
        console.error('Error parsing date string:', dateStr, e);
        return null;
    }
}

// --- Booking Modal Logic ---
async function handleBookingRequest(payload) {
    const { resource, start, end } = payload;

    console.log('Booking request start:', start);
    console.log('Booking request end:', end);
    // Get the maximum booking hours allowed for the user's role
    const maxBookingHours = userRole.value ? userRole.value.maxBookingHours : 2; // Default to 2 hours

    // Calculate the duration of the booking request in hours
    const durationHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);

    // Check if the duration exceeds the maximum allowed booking hours
    if (durationHours > maxBookingHours) {
        alert(`Maximum booking duration for your role is ${maxBookingHours} hours.`);
        return; // Prevent the modal from showing
    }

    newBookingInfo.value = {
        resourceId: resource.id,
        resourceName: resource.name,
        start,
        end,
    };
    showBookingModal.value = true;
}

async function confirmBooking() {
    if (!newBookingInfo.value) return;

    const start = newBookingInfo.value.start;
    const end = newBookingInfo.value.end;
    const resource = selectedResource.value;

    console.log('Confirming booking start:', start);
    console.log('Confirming booking end:', end);
    if (!resource) {
        console.error('No resource selected.');
        alert('No resource selected.');
        return;
    }

    const newBookingData = {
        resourceId: resource.id,
        userId: currentUserId.value,
        date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`, // Local date
        startTime: formatTimeOnly(start),
        endTime: formatTimeOnly(end),
        activity: prompt('Enter activity for this booking:', 'General Activity') || 'N/A', // Prompt user for activity
    };

    try {
        const createdBooking = await createBooking(newBookingData);
        console.log('Booking added:', createdBooking);
        bookings.value.push(createdBooking);

        showBookingModal.value = false;
        newBookingInfo.value = null;

        schedulerRef.value?.clearPendingSelection();

        alert('Booking added!');
    } catch (error) {
        console.error('Error creating booking:', error);
        alert(`Failed to create booking: ${error.message}`);
    }
}

// async function confirmBooking() {
//   if (!newBookingInfo.value) return;

//   const start = newBookingInfo.value.start;
//   const end = newBookingInfo.value.end;
//   const resource = selectedResource.value;

//   console.log('Confirming booking start:', start);
//   console.log('Confirming booking end:', end);
//   if (!resource) {
//     console.error('No resource selected.');
//     alert('No resource selected.');
//     return;
//   }

//   const newBookingData = {
//     resourceId: resource.id,
//     userId: currentUserId.value,
//     date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`, // Local date
//     startTime: formatTimeOnly(start),
//     endTime: formatTimeOnly(end),
//   };

//   try {
//     const createdBooking = await createBooking(newBookingData);
//     console.log('Booking added:', createdBooking);
//     bookings.value.push(createdBooking);

//     showBookingModal.value = false;
//     newBookingInfo.value = null;

//     schedulerRef.value?.clearPendingSelection();

//     alert('Booking added!');
//   } catch (error) {
//     console.error('Error creating booking:', error);
//     alert(`Failed to create booking: ${error.message}`);
//   }
// }

async function cancelBooking() {
    showBookingModal.value = false;

    if (newBookingInfo.value) {
        try {
            console.log('Canceling booking for:', newBookingInfo.value);

            const bookingToDelete = bookings.value.find((booking) => {
                const start = newBookingInfo.value.start;
                console.log('Checking booking:', booking);
                return (
                    booking.resourceId === newBookingInfo.value.resourceId &&
                    booking.date === start.toISOString().split('T')[0] &&
                    booking.startTime === formatTimeOnly(start)
                );
            });

            console.log('Booking to delete:', bookingToDelete);

            if (bookingToDelete) {
                await deleteBooking(bookingToDelete.id);
                bookings.value = bookings.value.filter((booking) => booking.id !== bookingToDelete.id);
                alert('Booking cancelled successfully!');
            } else {
                alert('No booking found to cancel.');
            }
        } catch (error) {
            console.error('Error canceling booking:', error);
            alert(`Failed to cancel booking: ${error.message}`);
        }
    }

    newBookingInfo.value = null;
    schedulerRef.value?.clearPendingSelection();
}

// async function cancelBooking() {
//   showBookingModal.value = false;

//   if (newBookingInfo.value) {
//     try {
//       const bookingToDelete = bookings.value.find((booking) => {
//         const start = newBookingInfo.value.start;
//         return (
//           booking.resourceId === newBookingInfo.value.resourceId &&
//           booking.date === start.toISOString().split('T')[0] &&
//           booking.startTime === formatTimeOnly(start)
//         );
//       });

//       if (bookingToDelete) {
//         await deleteBooking(bookingToDelete.id);
//         bookings.value = bookings.value.filter((booking) => booking.id !== bookingToDelete.id);
//         alert('Booking cancelled successfully!');
//       }
//       // else {
//       //   alert('No booking found to cancel.');
//       // }
//     } catch (error) {
//       console.error('Error canceling booking:', error);
//       alert(`Failed to cancel booking: ${error.message}`);
//     }
//   }

//   newBookingInfo.value = null;
//   schedulerRef.value?.clearPendingSelection();
// }

// --- Formatting Helpers ---
function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short',
    });
};

function goToPreviousDay() {
    const current = new Date(dateString.value);
    current.setDate(current.getDate() - 1); // Move to the previous day
    dateString.value = current.toISOString().split('T')[0]; // Update in YYYY-MM-DD format
}

function goToNextDay() {
    const current = new Date(dateString.value);
    current.setDate(current.getDate() + 1); // Move to the next day
    dateString.value = current.toISOString().split('T')[0]; // Update in YYYY-MM-DD format
}

function formatTimeOnly(date) {
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// function formatTimeOnly(date) {
//   // if (!date) return '';
//   // return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
// formatTimeOnly
// }
</script>

<style scoped>
/* Styles from previous response remain the same - Add them here */
#app-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.controls-row {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.controls-row label {
    font-weight: 500;
    min-width: 110px;
}

.controls-row select,
.controls-row input[type="date"] {
    padding: 5px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
}

.current-date-display {
    font-weight: bold;
    margin-left: 15px;
}

.placeholder-message {
    padding: 20px;
    text-align: center;
    color: #666;
    border: 1px dashed #ccc;
    border-radius: 4px;
    margin-top: 20px;
}

.booking-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 25px 35px;
    border-radius: 8px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.25);
    z-index: 1000;
    border: 1px solid #ccc;
    min-width: 350px;
}

.booking-modal h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
}

.booking-modal p {
    margin: 8px 0;
    line-height: 1.4;
}

.booking-modal p strong {
    display: inline-block;
    width: 80px;
    font-weight: 600;
}

.booking-modal p i {
    color: #555;
    font-size: 0.9em;
}

.modal-actions {
    margin-top: 25px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.modal-actions button {
    padding: 8px 15px;
    cursor: pointer;
    border-radius: 4px;
    border: 1px solid transparent;
}

.modal-actions button:first-child {
    background-color: var(--calendar-current-user-booking-bg);
    color: white;
    border-color: var(--calendar-current-user-booking-bg);
}

.modal-actions button:last-child {
    background-color: #eee;
    color: #333;
    border-color: #ccc;
}
</style>