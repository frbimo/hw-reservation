// src/components/HardwareScheduler.vue
<template>
    <div class="scheduler-container-vertical" v-if="viewStartDateTime_24h && viewEndDateTime_24h">
        <div class="scheduler-grid-vertical" :style="gridStyle">
            <div class="grid-time-labels">
                <div class="time-label-header-spacer"></div>
                <!-- REMOVED ':style' binding from here -->
                <div v-for="(slot, index) in timeSlots_24h" :key="index" class="time-slot-label">
                    {{ formatTime(slot.start) }}
                </div>
            </div>
            <div class="grid-resource-header">
                {{ resource.name || 'Timeline' }}
            </div>
            <div class="grid-timeline-area-vertical" ref="timelineAreaRef" @mousedown.prevent="handleMouseDown">
                <!-- :style="{ height: 'calc(100% - var(--resource-header-height, 40px))' }"> -->
                <!-- Elements inside are positioned relative to this container's top -->

                <!-- Shaded Area 'Before' -->
                <div v-if="operatingHoursStyle.beforeHeight > 0" class="operating-hours-shade-vertical"
                    :style="{ top: '0%', height: operatingHoursStyle.beforeHeight + '%' }"
                    title="Outside operating hours"></div>

                <!-- Shaded Area 'After' -->
                <div v-if="operatingHoursStyle.afterTop < 100" class="operating-hours-shade-vertical"
                    :style="{ top: operatingHoursStyle.afterTop + '%', height: (100 - operatingHoursStyle.afterTop) + '%' }"
                    title="Outside operating hours"></div>

                <!-- Existing Bookings -->
                <div v-for="res in positionedBookings_24h_vertical" :key="res.id"
                    :class="['booking-block-vertical', res.isCurrentUser ? 'my-booking' : 'other-booking']"
                    :style="{ top: res.top + '%', height: res.height + '%' }"
                    :title="`Booked by: ${res.userId} (${formatTime(res.start)} - ${formatTime(res.end)})`"
                    @mousedown.stop>
                    <span class="booking-text-vertical">
                        <span class="booking-text-vertical">
                            <strong>Time:</strong> {{ formatTime(res.start) }} - {{ formatTime(res.end) }} <br>
                            <strong>Booked by:</strong> {{ res.userId }} <br>
                            <strong>Activity:</strong> {{ res.activity || 'N/A' }}
                        </span>
                    </span>
                </div>

                <!-- Selection Indicator -->
                <div v-if="showSelectionIndicator" class="selection-indicator-vertical"
                    :style="finalSelectionIndicatorStyle_vertical"
                    :class="{ 'pending': !!pendingSelectionStyle_vertical }">
                </div>

                <!-- Horizontal Grid Lines -->
                <div v-for="n in totalSlots_24h" :key="`h-line-${n}`" class="horizontal-grid-line-vertical"
                    :style="{ top: (n / totalSlots_24h) * 100 + '%' }">
                </div>
            </div>
        </div>
    </div>
    <div v-else class="placeholder-message">
        <p>Error calculating base timeline. (Check viewDate prop)</p>
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';

// --- Props remain the same ---
const props = defineProps({
    resource: { type: Object, required: true },
    bookings: { type: Array, required: true },
    viewDate: { type: Date, required: true },
    currentUserId: { type: [Number, String], required: true }
});

const emit = defineEmits(['request-booking']);

// --- Refs and State (Interaction needs Y coordinates) ---
const timelineAreaRef = ref(null);
const selectionStartIndex = ref(null);
const startY = ref(0); // Changed from startX
const currentY = ref(0); // Changed from currentX
const isSelecting = ref(false);
const pendingSelectionStyle_vertical = ref(null); // Renamed

// --- Constants and Time Helpers (Unchanged) ---
const FORCED_SLOT_DURATION_MINUTES = 60; // Keep as 1 hour

function parseTimeString(timeStr, date) {
    if (!timeStr || !date) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0); // Set time in the local timezone
    // console.log('hours & :', { hours, minutes });
    console.log('Parsing time string:', { timeStr, date, newDate });

    return newDate;
}

// function parseTimeString(timeStr, date) {
//     if (!timeStr || !date) return null;
//     const [hours, minutes] = timeStr.split(':').map(Number);
//     if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
//     const newDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
//     newDate.setHours(hours, minutes, 0, 0);
//     return newDate;
// }

// --- Base Time Computeds (Unchanged) ---
const viewStartDateTime_24h = computed(() => {
    if (!props.viewDate || !(props.viewDate instanceof Date)) return null;
    // const date = new Date(props.viewDate.getUTCFullYear(), props.viewDate.getUTCMonth(), props.viewDate.getUTCDate());
    const date = new Date(props.viewDate);
    date.setHours(0, 0, 0, 0);
    console.log
    return date;
});
const viewEndDateTime_24h = computed(() => {
    if (!viewStartDateTime_24h.value) return null;
    const nextDay = new Date(viewStartDateTime_24h.value);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
});
const slotDurationMs_24h = computed(() => FORCED_SLOT_DURATION_MINUTES * 60 * 1000);
const viewTotalDurationMs_24h = computed(() => {
    if (!viewStartDateTime_24h.value || !viewEndDateTime_24h.value) return 0;
    return viewEndDateTime_24h.value.getTime() - viewStartDateTime_24h.value.getTime();
});
const timeSlots_24h = computed(() => {
    // Calculation logic remains the same
    const slots = [];
    if (!viewStartDateTime_24h.value || viewTotalDurationMs_24h.value <= 0 || slotDurationMs_24h.value <= 0) return slots;
    let currentSlotTime = new Date(viewStartDateTime_24h.value);
    const endLimit = new Date(viewEndDateTime_24h.value);
    let safetyCounter = 0;
    while (currentSlotTime < endLimit && safetyCounter < 30) {
        let slotEnd = new Date(currentSlotTime.getTime() + slotDurationMs_24h.value);
        slots.push({ start: new Date(currentSlotTime), end: new Date(slotEnd > endLimit ? endLimit : slotEnd) });
        currentSlotTime = slotEnd;
        safetyCounter++;
    }
    return slots;
});
const totalSlots_24h = computed(() => timeSlots_24h.value.length); // Should be 24

// --- NEW: Vertical Percentage Calculation ---
const timeSlotHeightPercent_24h = computed(() => {
    return totalSlots_24h.value > 0 ? (100 / totalSlots_24h.value) : 0; // ~4.167%
});

// --- Operating Hours (Calculate top/height) ---
const resourceOperatingStart = computed(() => parseTimeString(props.resource.startTime, props.viewDate));
const resourceOperatingEnd = computed(() => parseTimeString(props.resource.endTime, props.viewDate));

// const operatingHoursStyle = computed(() => {
//     if (!resourceOperatingStart.value || !resourceOperatingEnd.value || !viewStartDateTime_24h.value || viewTotalDurationMs_24h.value <= 0) {
//         return { beforeHeight: 0, afterTop: 100 }; // Use height/top
//     }
//     const startOffsetMs = Math.max(0, resourceOperatingStart.value.getTime() - viewStartDateTime_24h.value.getTime());
//     const endOffsetMs = Math.max(0, resourceOperatingEnd.value.getTime() - viewStartDateTime_24h.value.getTime());

//     const beforeHeight = (startOffsetMs / viewTotalDurationMs_24h.value) * 100; // Use height
//     const afterTop = (endOffsetMs / viewTotalDurationMs_24h.value) * 100;       // Use top

//     return {
//         beforeHeight: Math.max(0, Math.min(100, beforeHeight)),
//         afterTop: Math.max(0, Math.min(100, afterTop))
//     };
// });

const operatingHoursStyle = computed(() => {
    if (!resourceOperatingStart.value || !resourceOperatingEnd.value || !viewStartDateTime_24h.value || viewTotalDurationMs_24h.value <= 0) {
        return { beforeHeight: 0, afterTop: 100 };
    }

    const startOffsetMs = Math.max(0, resourceOperatingStart.value.getTime() - viewStartDateTime_24h.value.getTime());
    const endOffsetMs = Math.max(0, resourceOperatingEnd.value.getTime() - viewStartDateTime_24h.value.getTime());

    const beforeHeight = Math.min((startOffsetMs / viewTotalDurationMs_24h.value) * 100, 100);
    const afterTop = Math.min((endOffsetMs / viewTotalDurationMs_24h.value) * 100, 100);

    console.log('Operating Hours Debug:', {
        startTime: props.resource.startTime,
        endTime: props.resource.endTime,
        resourceOperatingStart: resourceOperatingStart.value,
        resourceOperatingEnd: resourceOperatingEnd.value,
        beforeHeight,
        afterTop
    });

    return {
        beforeHeight: Math.max(0, beforeHeight),
        afterTop: Math.max(0, afterTop)
    };
});

// --- Positioned Bookings (Calculate top/height) ---
const positionedBookings_24h_vertical = computed(() => { // Renamed
    if (!viewStartDateTime_24h.value || viewTotalDurationMs_24h.value <= 0) return [];
    console.log('Bookings passed to HardwareScheduler:', props.bookings);
    return props.bookings
        .map((book) => {

            const start = parseTimeString(book.startTime, props.viewDate);
            const end = parseTimeString(book.endTime, props.viewDate);

            console.log('Booking startTime:', start);
            console.log('Booking endTime:', end);

            if (!start || !end || end <= start) return null;
            const startOffsetMs = start.getTime() - viewStartDateTime_24h.value.getTime();
            const durationMs = end.getTime() - start.getTime();
            if (startOffsetMs < 0 || startOffsetMs >= viewTotalDurationMs_24h.value || durationMs <= 0) return null;

            // --- Calculate top and height percentages ---
            const topPercent = (startOffsetMs / viewTotalDurationMs_24h.value) * 100;
            const heightPercent = (durationMs / viewTotalDurationMs_24h.value) * 100;

            console.log('Booking Debug:', {
                booking: book,
                start,
                viewStartDateTime_24h: viewStartDateTime_24h.value,
                startOffsetMs,
                durationMs,
                topPercent,
                heightPercent
            });

            return {
                ...book,
                start,
                end,
                top: Math.max(0, topPercent), // Clamp top edge
                height: Math.min(heightPercent, 100 - topPercent), // Clamp height
                isCurrentUser: book.userId === props.currentUserId,
            };
        })
        .filter((b) => b !== null && b.height > 0.01); // Filter out zero-height
});

// --- Selection Indicator Computeds (Calculate top/height) ---
const showSelectionIndicator = computed(() => {
    return isSelecting.value || pendingSelectionStyle_vertical.value !== null;
});

const draggingSelectionStyle_vertical = computed(() => { // Renamed
    if (!isSelecting.value || !timelineAreaRef.value || totalSlots_24h.value === 0) return { top: '0%', height: '0%' };
    const timelineHeight = timelineAreaRef.value.offsetHeight; if (timelineHeight === 0) return { top: '0%', height: '0%' };

    // --- Use Y coordinates ---
    const rawStartPercent = (startY.value / timelineHeight) * 100;
    const rawCurrentPercent = (currentY.value / timelineHeight) * 100;

    const slotHeightPercent = 100 / totalSlots_24h.value; // Use height percent
    const startIndex = Math.floor(rawStartPercent / slotHeightPercent);
    const currentIndex = Math.floor((rawCurrentPercent + 0.001) / slotHeightPercent); // Use Y

    let startSlotIndex = Math.min(startIndex, currentIndex);
    let endSlotIndex = Math.max(startIndex, currentIndex);

    // Selection logic for single slot etc. remains conceptually similar
    if (startSlotIndex === endSlotIndex) {
        if (rawCurrentPercent >= rawStartPercent) { endSlotIndex = startSlotIndex + 1; }
        else { startSlotIndex = Math.max(0, startSlotIndex - 1); endSlotIndex = startSlotIndex + 1; }
    } else { endSlotIndex = Math.max(startIndex, currentIndex) + 1; }

    let top = startSlotIndex * slotHeightPercent; // Use top
    let height = (endSlotIndex - startSlotIndex) * slotHeightPercent; // Use height

    top = Math.max(0, top);
    height = Math.max(slotHeightPercent, height); // Min height is one slot
    if (top + height > 100) { height = 100 - top; } // Clamp height

    return { top: `${top}%`, height: `${height}%` };
});

const finalSelectionIndicatorStyle_vertical = computed(() => { // Renamed
    if (pendingSelectionStyle_vertical.value) {
        return pendingSelectionStyle_vertical.value;
    }
    if (isSelecting.value) {
        return draggingSelectionStyle_vertical.value;
    }
    return { top: '0%', height: '0%' };
});

// --- Interaction Handlers (Use Y coordinates) ---
function handleMouseDown(event) {
    if (event.target !== timelineAreaRef.value || !viewStartDateTime_24h.value || totalSlots_24h.value === 0) { return; }

    pendingSelectionStyle_vertical.value = null; // Clear pending

    const timelineRect = timelineAreaRef.value.getBoundingClientRect();
    const timelineHeight = timelineRect.height; // Use height
    const slotHeightPixels = timelineHeight / totalSlots_24h.value; // Use height

    // --- Use Y coordinates ---
    const initialY = Math.max(0, Math.min(event.clientY - timelineRect.top, timelineHeight));
    selectionStartIndex.value = Math.floor(initialY / slotHeightPixels);

    startY.value = initialY; // Store Y
    currentY.value = initialY; // Store Y
    isSelecting.value = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event) {
    if (!isSelecting.value || !timelineAreaRef.value) return;
    const rect = timelineAreaRef.value.getBoundingClientRect();
    // --- Use Y coordinates ---
    currentY.value = Math.max(0, Math.min(event.clientY - rect.top, timelineAreaRef.value.offsetHeight));
}

// function handleMouseUp(event) {
//     if (!isSelecting.value) return;

//     let shouldEmit = false;
//     let finalStartTime = null;
//     let finalEndTime = null;
//     let finalStyleForPending = null;

//     if (timelineAreaRef.value && viewStartDateTime_24h.value && viewTotalDurationMs_24h.value > 0 && totalSlots_24h.value > 0 && selectionStartIndex.value !== null) {
//         const timelineRect = timelineAreaRef.value.getBoundingClientRect();
//         const timelineHeight = timelineRect.height; // Use height
//         const slotHeightPixels = timelineHeight / totalSlots_24h.value; // Use height

//         // --- Use Y coordinates ---
//         const finalY = Math.max(0, Math.min(event.clientY - timelineRect.top, timelineHeight));
//         const finalSlotIndexRaw = Math.floor(finalY / slotHeightPixels);

//         const minSlotIndex = Math.min(selectionStartIndex.value, finalSlotIndexRaw);
//         const maxSlotIndex = Math.max(selectionStartIndex.value, finalSlotIndexRaw);
//         const finalStartSlotIndex = minSlotIndex; const finalEndSlotIndex = maxSlotIndex + 1;
//         const clampedStartSlotIndex = Math.max(0, finalStartSlotIndex);
//         const clampedEndSlotIndex = Math.min(totalSlots_24h.value, finalEndSlotIndex);

//         if (clampedStartSlotIndex < clampedEndSlotIndex) {
//             // Time calculation logic is unchanged, uses the derived slot indices
//             finalStartTime = new Date(viewStartDateTime_24h.value.getTime() + clampedStartSlotIndex * slotDurationMs_24h.value);
//             finalEndTime = new Date(viewStartDateTime_24h.value.getTime() + clampedEndSlotIndex * slotDurationMs_24h.value);

//             if (finalEndTime > finalStartTime) {
//                 // --- Calculate final top/height style ---
//                 const slotHeightPercent = 100 / totalSlots_24h.value;
//                 const finalTopPercent = clampedStartSlotIndex * slotHeightPercent;
//                 const finalHeightPercent = (clampedEndSlotIndex - clampedStartSlotIndex) * slotHeightPercent;
//                 finalStyleForPending = {
//                     top: `${finalTopPercent}%`,
//                     height: `${finalHeightPercent}%`
//                 };

//                 // Collision/Operating hours checks remain the same
//                 const withinOperatingHours = resourceOperatingStart.value && resourceOperatingEnd.value && finalStartTime >= resourceOperatingStart.value && finalEndTime <= resourceOperatingEnd.value;
//                 const collision = positionedBookings_24h_vertical.value.some(res => finalStartTime < res.end && finalEndTime > res.start);

//                 if (withinOperatingHours && !collision) {
//                     shouldEmit = true;
//                 } else if (!withinOperatingHours) {
//                     alert(`Booking outside operating hours (${formatTime(resourceOperatingStart.value)} - ${formatTime(resourceOperatingEnd.value)}).`);
//                 } else if (collision) {
//                     alert("Cannot book: Time slot conflicts with an existing reservation.");
//                 }
//             }
//         }
//     }

//     isSelecting.value = false;
//     window.removeEventListener('mousemove', handleMouseMove);
//     window.removeEventListener('mouseup', handleMouseUp);
//     selectionStartIndex.value = null;

//     if (shouldEmit && finalStyleForPending) {
//         pendingSelectionStyle_vertical.value = finalStyleForPending; // Store vertical style
//         emit('request-booking', { resource: props.resource, start: finalStartTime, end: finalEndTime });
//     } else {
//         pendingSelectionStyle_vertical.value = null; // Clear vertical style
//     }
// }

function handleMouseUp(event) {
    if (!isSelecting.value) return;

    let shouldEmit = false;
    let finalStartTime = null;
    let finalEndTime = null;

    if (timelineAreaRef.value && viewStartDateTime_24h.value && viewTotalDurationMs_24h.value > 0 && totalSlots_24h.value > 0 && selectionStartIndex.value !== null) {
        const timelineRect = timelineAreaRef.value.getBoundingClientRect();
        const timelineHeight = timelineRect.height;
        const slotHeightPixels = timelineHeight / totalSlots_24h.value;

        const finalY = Math.max(0, Math.min(event.clientY - timelineRect.top, timelineHeight));
        const finalSlotIndexRaw = Math.floor(finalY / slotHeightPixels);

        const minSlotIndex = Math.min(selectionStartIndex.value, finalSlotIndexRaw);
        const maxSlotIndex = Math.max(selectionStartIndex.value, finalSlotIndexRaw);
        const finalStartSlotIndex = minSlotIndex;
        const finalEndSlotIndex = maxSlotIndex + 1;

        const clampedStartSlotIndex = Math.max(0, finalStartSlotIndex);
        const clampedEndSlotIndex = Math.min(totalSlots_24h.value, finalEndSlotIndex);

        if (clampedStartSlotIndex < clampedEndSlotIndex) {
            finalStartTime = new Date(viewStartDateTime_24h.value.getTime() + clampedStartSlotIndex * slotDurationMs_24h.value);
            finalEndTime = new Date(viewStartDateTime_24h.value.getTime() + clampedEndSlotIndex * slotDurationMs_24h.value);

            // console.log('Booking Debug:', {
            //     finalStartTime,
            //     finalEndTime,
            //     resourceOperatingStart: resourceOperatingStart.value,
            //     resourceOperatingEnd: resourceOperatingEnd.value
            // });

            if (finalEndTime > finalStartTime) {
                const withinOperatingHours = resourceOperatingStart.value && resourceOperatingEnd.value &&
                    finalStartTime >= resourceOperatingStart.value && finalEndTime <= resourceOperatingEnd.value;

                if (withinOperatingHours) {
                    console.log('Booking within operating hours:', {
                        start: formatTime(finalStartTime),
                        end: formatTime(finalEndTime)
                    });
                    shouldEmit = true;
                } else {
                    alert(`Booking outside operating hours (${formatTime(resourceOperatingStart.value)} - ${formatTime(resourceOperatingEnd.value)}).`);
                }
            }
        }
    }

    isSelecting.value = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    selectionStartIndex.value = null;

    if (shouldEmit) {
        emit('request-booking', { resource: props.resource, start: finalStartTime, end: finalEndTime });
    }
}

// --- Expose clear method (Renamed internal state) ---
function clearPendingSelection() {
    console.log("HardwareScheduler (Vertical): Clearing pending selection highlight.");
    pendingSelectionStyle_vertical.value = null;
}
defineExpose({ clearPendingSelection });

// --- Utility (Unchanged) ---
function formatTime(date) {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// --- Cleanup (Unchanged) ---
onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp);
});

// --- CSS Variables for Layout ---
const gridStyle = computed(() => ({
    '--time-label-width': '60px', // Width of the time column
    '--resource-header-height': '60px', // Height of the top header
    '--slot-base-height': '60px' // Min height for one hour slot (adjust as needed)
}));

</script>
<style scoped>
/* --- NEW Vertical Layout Styles --- */

.scheduler-container-vertical {
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    border: 1px solid var(--calendar-grid-border-color);
    background-color: var(--calendar-bg-color);
    position: relative;
    /* Keep for potential absolute children */
    box-sizing: border-box;
}

.scheduler-grid-vertical {
    display: grid;
    grid-template-columns: var(--time-label-width, 60px) 1fr;
    /* --- MODIFICATION: Use calculated fixed height for the content row --- */
    grid-template-rows: var(--resource-header-height, 40px) calc(24 * var(--slot-base-height, 50px));
    /* Fixed height */
    position: relative;
}

/* --- Column 1: Time Labels --- */
.grid-time-labels {
    grid-column: 1 / 2;
    grid-row: 1 / 3;
    /* Span both rows */
    display: flex;
    flex-direction: column;
    background-color: #f8f8f8;
    border-right: 1px solid var(--calendar-grid-border-color);
    position: sticky;
    left: 0;
    top: 0;
    z-index: 15;
    box-sizing: border-box;
}

.time-label-header-spacer {
    height: var(--resource-header-height, 40px);
    flex-shrink: 0;
    border-bottom: 1px solid var(--calendar-grid-border-color);
    box-sizing: border-box;
}


.time-slot-label {
    flex-shrink: 0;
    display: flex;
    align-items: top;
    justify-content: center;
    font-size: 11px;
    color: var(--calendar-time-text-color);
    /* border-bottom: 1px solid var(--calendar-grid-border-color); */
    box-sizing: border-box;
    /* --- MODIFICATION: Use fixed height, remove min-height --- */
    height: var(--slot-base-height, 50px);
    /* Use fixed height */
    text-align: center;
    padding: 0 5px;
    /* Removed reference to inline style height */
}

.time-slot-label:last-child {
    border-bottom: none;
}


/* --- Column 2, Row 1: Resource Header --- */
.grid-resource-header {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
    height: var(--resource-header-height, 40px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    background-color: #f0f0f0;
    border-bottom: 1px solid var(--calendar-grid-border-color);
    position: sticky;
    top: 0;
    z-index: 12;
    box-sizing: border-box;
}

/* --- Column 2, Row 2: Timeline Area --- */
.grid-timeline-area-vertical {
    grid-column: 2 / 3;
    grid-row: 2 / 3;
    position: relative;
    cursor: ns-resize;
    user-select: none;
    box-sizing: border-box;
    /* --- MODIFICATION: Use fixed height, remove min-height --- */
    height: calc(24 * var(--slot-base-height, 50px));
    /* Set fixed total height */
    /* Ensure overflow happens in the main container */
    overflow: hidden;
    /* Clip content exceeding this fixed height (shouldn't happen) */
}

/* --- Vertical Operating Hours --- */
.operating-hours-shade-vertical {
    position: absolute;
    left: 0;
    right: 0;
    background-color: rgba(200, 200, 200, 0.2);
    z-index: 2;
    pointer-events: none;
}

/* --- Vertical Booking Block --- */
.booking-block-vertical {
    position: absolute;
    left: 5px;
    right: 5px;
    border-radius: 4px;
    overflow: hidden;
    padding: 5px 8px;
    z-index: 5;
    cursor: pointer;
    transition: background-color 0.2s ease;
    box-sizing: border-box;
    /* border: 1px solid rgba(0, 0, 0, 0.1); */
}

.booking-block-vertical.my-booking {
    background-color: var(--calendar-current-user-booking-bg);
    color: var(--calendar-current-user-booking-text);
}

.booking-block-vertical.other-booking {
    background-color: var(--calendar-other-user-booking-bg);
    color: var(--calendar-other-user-booking-text);
}

.booking-block-vertical:hover {
    opacity: 0.9;
}

.booking-text-vertical {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    display: block;
    word-wrap: break-word;
}

.booking-text-vertical strong {
    font-weight: bold;
    color: #333;
}

/* --- Vertical Selection Indicator --- */
.selection-indicator-vertical {
    position: absolute;
    left: 2px;
    right: 2px;
    background-color: var(--calendar-selection-bg);
    border: 1px dashed var(--calendar-selection-border);
    z-index: 4;
    pointer-events: none;
    border-radius: 3px;
    box-sizing: border-box;
}

/* --- Horizontal Grid Lines --- */
.horizontal-grid-line-vertical {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--calendar-grid-border-color);
    /* Ensure this is visible */
    z-index: 1;
    /* Keep below bookings/selection */
    pointer-events: none;
    /* Top position calculation remains the same (top: N%) */
    /* This line should now align perfectly with the booking block top */
}

.horizontal-grid-line-vertical:first-of-type {
    /* Maybe hide the top line as it overlaps with header border */
    /* display: none; */
}

/* --- Placeholder --- */
.placeholder-message {
    padding: 20px;
    text-align: center;
    color: #666;
    border: 1px dashed #ccc;
    border-radius: 4px;
    margin: 20px;
}
</style>