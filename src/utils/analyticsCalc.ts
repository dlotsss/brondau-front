import { Booking, LayoutElement } from '../types';

export interface AnalyticsMetrics {
  totalBookings: number;
  totalSeatedGuests: number;
  occupancyRate: number; // Average overall occupancy during peak hours
  noShowRate: number;
  cancellationRate: number;
  // Guest CRM
  uniqueGuestsCount: number;          // Unique phones in the period
  newGuestsCount: number;             // First-time ever (no history before period start)
  returningGuestsCount: number;       // Have history before the period
  repeatWithinPeriod: number;         // Booked 2+ times within the chosen period
  newGuestPercentage: number;
  retentionRate: number;
  anonymousBookingsCount: number;
  // Operations
  tableTurnoverRate: number;
  peakHour: string;
  hourlyOccupancy: { hour: number; rate: number }[];
  hourlyBookingCounts: { hour: number; count: number }[];
  
  // New metrics requested
  avgLeadTimeHours: number;
  leadTimeDistribution: { label: string; percentage: number; count: number }[];
  companySizeDistribution: { label: string; percentage: number; count: number }[];
  topGuests: { name: string; phone: string; count: number }[];
  cancellationReasons: { reason: string; count: number; percentage: number }[];
  adminWorkload: { name: string; count: number; percentage: number }[];
  avgPlanDuration: number;
  avgActualDuration: number;
}

/** Normalize a phone to digits only for consistent comparison */
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;
  // Normalize KZ/RU: leading 8 → strip, leading 7 → keep last 10 digits
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return digits.slice(1); // last 10 digits
  }
  return digits;
}

export function calculateMetrics(
  bookings: Booking[], // Bookings in the selected period
  historicalBookings: Booking[], // Bookings before the selected period (e.g. 90 days before)
  layout: LayoutElement[],
  daysCount: number
): AnalyticsMetrics {
  const totalBookings = bookings.length;

  // Seated bookings (confirmed/occupied/completed)
  const seatedBookings = bookings.filter(b =>
    b.status === 'CONFIRMED' || b.status === 'OCCUPIED' || b.status === 'COMPLETED'
  );
  const totalSeatedGuests = seatedBookings.reduce((sum, b) => sum + b.guestCount, 0);

  // Total tables and seats from layout
  const tables = layout.filter(el => el.type === 'table');
  const totalTables = tables.length || 1;
  const totalSeats = tables.reduce((sum, t) => sum + ((t as any).seats || 2), 0) || 1;

  // No-Show: DECLINED bookings with no-show keywords
  const noShowBookings = bookings.filter(b =>
    b.status === 'DECLINED' &&
    (
      b.declineReason?.toLowerCase().includes('не пришел') ||
      b.declineReason?.toLowerCase().includes('не явился') ||
      b.declineReason?.toLowerCase().includes('no-show') ||
      b.declineReason?.toLowerCase().includes('no show') ||
      b.declineReason?.toLowerCase().includes('неявка') ||
      b.declineReason?.toLowerCase().includes('нет')
    )
  );
  const noShowRate = totalBookings > 0 ? (noShowBookings.length / totalBookings) * 100 : 0;

  // Cancellation Rate: CANCELLED or DECLINED (excluding no-shows)
  const noShowSet = new Set(noShowBookings.map(b => b.id));
  const cancelledBookings = bookings.filter(b =>
    b.status === 'CANCELLED' ||
    (b.status === 'DECLINED' && !noShowSet.has(b.id))
  );
  const cancellationRate = totalBookings > 0 ? (cancelledBookings.length / totalBookings) * 100 : 0;

  // ─── Guest CRM ───────────────────────────────────────────────────────────
  // Normalize phones to prevent format-mismatch false negatives
  const normalizedCurrentPhones = bookings
    .map(b => normalizePhone(b.guestPhone))
    .filter((p): p is string => p !== null);

  const normalizedHistoricalPhones = new Set(
    historicalBookings
      .map(b => normalizePhone(b.guestPhone))
      .filter((p): p is string => p !== null)
  );

  // Unique phones in the current period
  const uniqueCurrentPhones = Array.from(new Set(normalizedCurrentPhones));
  const uniqueGuestsCount = uniqueCurrentPhones.length;

  // Within-period repeat visitors: phones that appear more than once in the current period
  const phoneBookingCount = new Map<string, number>();
  normalizedCurrentPhones.forEach(p => {
    phoneBookingCount.set(p, (phoneBookingCount.get(p) || 0) + 1);
  });
  const repeatWithinPeriod = Array.from(phoneBookingCount.values()).filter(c => c > 1).length;

  // Returning vs New guests vs historical baseline
  let newGuestsCount = 0;
  let returningGuestsCount = 0;

  uniqueCurrentPhones.forEach(phone => {
    if (normalizedHistoricalPhones.has(phone)) {
      returningGuestsCount++;
    } else {
      newGuestsCount++;
    }
  });

  const totalUniqueGuests = uniqueGuestsCount || 1;
  const newGuestPercentage = (newGuestsCount / totalUniqueGuests) * 100;
  const retentionRate = (returningGuestsCount / totalUniqueGuests) * 100;

  const anonymousBookingsCount = bookings.filter(b => !normalizePhone(b.guestPhone)).length;

  // ─── Operational Efficiency ───────────────────────────────────────────────
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'OCCUPIED');
  const activeDays = daysCount > 0 ? daysCount : 1;
  const tableTurnoverRate = completedBookings.length / (totalTables * activeDays);

  // ─── Hourly stats (10:00 to 23:00) ───────────────────────────────────────
  const hourlyOccupancy: { hour: number; rate: number }[] = [];
  const hourlyBookingCounts: { hour: number; count: number }[] = [];

  for (let hour = 10; hour <= 23; hour++) {
    // Bookings starting at this hour
    const hourBookings = bookings.filter(b => {
      const date = new Date(b.dateTime);
      return date.getHours() === hour;
    });
    hourlyBookingCounts.push({ hour, count: hourBookings.length });

    // Occupancy: sum of guests across all seated bookings active at this hour, divided by seats × days
    let activeGuestsAtHour = 0;
    seatedBookings.forEach(b => {
      const bDate = new Date(b.dateTime);
      const startHour = bDate.getHours();
      const durationHours = (b.duration || 120) / 60;
      const endHour = startHour + durationHours;
      if (hour >= startHour && hour < endHour) {
        activeGuestsAtHour += b.guestCount;
      }
    });

    const rate = totalSeats > 0
      ? Math.min(100, (activeGuestsAtHour / (totalSeats * activeDays)) * 100)
      : 0;
    hourlyOccupancy.push({ hour, rate });
  }

  // Peak Hour (highest booking count)
  let maxCount = -1;
  let peakHourNum = 18;
  hourlyBookingCounts.forEach(item => {
    if (item.count > maxCount) {
      maxCount = item.count;
      peakHourNum = item.hour;
    }
  });
  const peakHour = `${peakHourNum}:00 – ${peakHourNum + 1}:00`;

  // Average occupancy across active hours (12:00–22:00)
  const activeHours = hourlyOccupancy.filter(h => h.hour >= 12 && h.hour <= 22);
  const occupancyRate = activeHours.length > 0
    ? activeHours.reduce((sum, h) => sum + h.rate, 0) / activeHours.length
    : 0;

  // ─── NEW METRICS CALCULATIONS ─────────────────────────────────────────────

  // 1. Lead Time (Booking Depth)
  let totalLeadTimeHours = 0;
  let leadTimeValidCount = 0;
  const leadTimeBuckets = {
    lessThan2h: 0,
    between2hAnd12h: 0,
    between12hAnd24h: 0,
    between1dAnd3d: 0,
    moreThan3d: 0
  };

  bookings.forEach(b => {
    const diffMs = b.dateTime.getTime() - b.createdAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours >= 0) {
      totalLeadTimeHours += diffHours;
      leadTimeValidCount++;
      if (diffHours < 2) {
        leadTimeBuckets.lessThan2h++;
      } else if (diffHours < 12) {
        leadTimeBuckets.between2hAnd12h++;
      } else if (diffHours < 24) {
        leadTimeBuckets.between12hAnd24h++;
      } else if (diffHours < 72) {
        leadTimeBuckets.between1dAnd3d++;
      } else {
        leadTimeBuckets.moreThan3d++;
      }
    }
  });

  const avgLeadTimeHours = leadTimeValidCount > 0 ? totalLeadTimeHours / leadTimeValidCount : 0;
  const totalLeadTimeParsed = leadTimeValidCount || 1;
  const leadTimeDistribution = [
    { label: '< 2 ч.', count: leadTimeBuckets.lessThan2h, percentage: (leadTimeBuckets.lessThan2h / totalLeadTimeParsed) * 100 },
    { label: '2–12 ч.', count: leadTimeBuckets.between2hAnd12h, percentage: (leadTimeBuckets.between2hAnd12h / totalLeadTimeParsed) * 100 },
    { label: '12–24 ч.', count: leadTimeBuckets.between12hAnd24h, percentage: (leadTimeBuckets.between12hAnd24h / totalLeadTimeParsed) * 100 },
    { label: '1–3 дн.', count: leadTimeBuckets.between1dAnd3d, percentage: (leadTimeBuckets.between1dAnd3d / totalLeadTimeParsed) * 100 },
    { label: '3+ дн.', count: leadTimeBuckets.moreThan3d, percentage: (leadTimeBuckets.moreThan3d / totalLeadTimeParsed) * 100 }
  ];

  // 2. Company Size Distribution
  const sizeBuckets = {
    size1to2: 0,
    size3to4: 0,
    size5to6: 0,
    size7plus: 0
  };
  
  bookings.forEach(b => {
    const count = b.guestCount;
    if (count <= 2) {
      sizeBuckets.size1to2++;
    } else if (count <= 4) {
      sizeBuckets.size3to4++;
    } else if (count <= 6) {
      sizeBuckets.size5to6++;
    } else {
      sizeBuckets.size7plus++;
    }
  });
  
  const totalSizeCount = bookings.length || 1;
  const companySizeDistribution = [
    { label: '1–2 чел.', count: sizeBuckets.size1to2, percentage: (sizeBuckets.size1to2 / totalSizeCount) * 100 },
    { label: '3–4 чел.', count: sizeBuckets.size3to4, percentage: (sizeBuckets.size3to4 / totalSizeCount) * 100 },
    { label: '5–6 чел.', count: sizeBuckets.size5to6, percentage: (sizeBuckets.size5to6 / totalSizeCount) * 100 },
    { label: '7+ чел.', count: sizeBuckets.size7plus, percentage: (sizeBuckets.size7plus / totalSizeCount) * 100 }
  ];

  // 3. Top Guests (Loyalty Rating)
  const guestStats = new Map<string, { name: string; count: number }>();
  bookings.forEach(b => {
    const phone = normalizePhone(b.guestPhone);
    if (!phone) return;
    const existing = guestStats.get(phone);
    if (existing) {
      existing.count++;
      if (b.guestName && b.guestName.trim()) {
        existing.name = b.guestName;
      }
    } else {
      guestStats.set(phone, { name: b.guestName || 'Без имени', count: 1 });
    }
  });
  const topGuests = Array.from(guestStats.entries())
    .map(([phone, data]) => {
      const formattedPhone = phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '+7 ($1) $2-$3-$4');
      return {
        phone: formattedPhone,
        name: data.name,
        count: data.count
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 4. Cancellation Reasons
  const reasonCounts = new Map<string, number>();
  let totalCancelledOrDeclined = 0;
  bookings.forEach(b => {
    if (b.status === 'CANCELLED' || b.status === 'DECLINED') {
      totalCancelledOrDeclined++;
      const reason = (b.cancelReason || b.declineReason || b.cancelComment || 'Причина не указана').trim();
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  });
  const totalCancelledOrDeclinedDiv = totalCancelledOrDeclined || 1;
  const cancellationReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: (count / totalCancelledOrDeclinedDiv) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 5. Admin Workload (Workload by administrator/staff member)
  const adminCounts = new Map<string, number>();
  let assignedBookings = 0;
  bookings.forEach(b => {
    const admin = (b.assignedTo || 'Авто / Без назначения').trim();
    adminCounts.set(admin, (adminCounts.get(admin) || 0) + 1);
    assignedBookings++;
  });
  const totalAssignedDiv = assignedBookings || 1;
  const adminWorkload = Array.from(adminCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: (count / totalAssignedDiv) * 100
    }))
    .sort((a, b) => b.count - a.count);

  // 6. Plan / Fact Seating Duration
  let totalPlanDuration = 0;
  let totalActualDuration = 0;
  let completedDurationCount = 0;

  bookings.forEach(b => {
    if (b.status === 'COMPLETED' && b.updatedAt) {
      const actualMin = (b.updatedAt.getTime() - b.dateTime.getTime()) / (60 * 1000);
      // Filter out negative values or unreasonably large values (e.g. forgot to close for 12+ hours)
      if (actualMin > 5 && actualMin < 480) {
        totalPlanDuration += b.duration || 120;
        totalActualDuration += actualMin;
        completedDurationCount++;
      }
    }
  });

  const avgPlanDuration = completedDurationCount > 0 ? totalPlanDuration / completedDurationCount : 0;
  const avgActualDuration = completedDurationCount > 0 ? totalActualDuration / completedDurationCount : 0;

  return {
    totalBookings,
    totalSeatedGuests,
    occupancyRate,
    noShowRate,
    cancellationRate,
    uniqueGuestsCount,
    newGuestsCount,
    returningGuestsCount,
    repeatWithinPeriod,
    newGuestPercentage,
    retentionRate,
    anonymousBookingsCount,
    tableTurnoverRate,
    peakHour,
    hourlyOccupancy,
    hourlyBookingCounts,
    
    // New metrics returned
    avgLeadTimeHours,
    leadTimeDistribution,
    companySizeDistribution,
    topGuests,
    cancellationReasons,
    adminWorkload,
    avgPlanDuration,
    avgActualDuration
  };
}
