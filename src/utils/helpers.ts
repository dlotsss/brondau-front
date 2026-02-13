
export const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Check if a time is within work hours, handling overnight case.
export const isWithinWorkHours = (
    time: Date,
    workStarts: string,
    workEnds: string
): boolean => {
    const startMins = parseTime(workStarts);
    const endMins = parseTime(workEnds);
    const timeMins = time.getHours() * 60 + time.getMinutes();

    if (endMins < startMins) {
        // Overnight shift (e.g. 10:00 - 02:00)
        // Valid if >= starts (10:00..23:59) OR < ends (00:00..01:59)
        return timeMins >= startMins || timeMins < endMins;
    } else {
        // Standard shift (e.g. 09:00 - 21:00)
        return timeMins >= startMins && timeMins < endMins;
    }
};

// Generate available slots based on work hours
export const generateTimeSlots = (
    workStarts: string,
    workEnds: string,
    interval: number = 30
): string[] => {
    const slots: string[] = [];
    const startMins = parseTime(workStarts);
    let endMins = parseTime(workEnds);

    if (endMins <= startMins) {
        endMins += 24 * 60; // Add 24 hours for overnight
    }

    for (let current = startMins; current < endMins; current += interval) {
        const h = Math.floor(current / 60) % 24;
        const m = current % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
};
