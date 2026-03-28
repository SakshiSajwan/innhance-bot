const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // Make sure path is correct

router.get('/', async (req, res) => {
  try {
    // 1. Fetch valid bookings from the database (Ignore cancelled ones for analytics)
    const bookings = await Booking.find({ status: { $ne: 'cancelled' } });

    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // ── 2. Calculate Revenue Data (Last 6 Months) ──
    const revenueData = [];
    
    // Initialize last 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      revenueData.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0,
        bookings: 0,
        occupancy: 0
      });
    }

    // ── 3. Calculate Room Distribution ──
    const roomMap = {
      standard: { name: 'Standard', value: 0, color: '#60a5fa', bookings: 0, revenue: 0 },
      deluxe:   { name: 'Deluxe',   value: 0, color: '#e8b86d', bookings: 0, revenue: 0 },
      suite:    { name: 'Suite',    value: 0, color: '#22c55e', bookings: 0, revenue: 0 }
    };
    let totalRoomBookings = 0;

    // ── 4. Calculate Weekly Data (This Week: Mon-Sun) ──
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayIndex = now.getDay(); // 0 is Sunday, 1 is Monday...

    // Find start of this week (Monday)
    const startOfWeek = new Date(now);
    const distanceToMonday = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyMap = {
      'Mon': { day: 'Mon', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 1 },
      'Tue': { day: 'Tue', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 2 },
      'Wed': { day: 'Wed', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 3 },
      'Thu': { day: 'Thu', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 4 },
      'Fri': { day: 'Fri', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 5 },
      'Sat': { day: 'Sat', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 6 },
      'Sun': { day: 'Sun', checkins: 0, checkouts: 0, revenue: 0, isToday: currentDayIndex === 0 }
    };

    // ── 5. Calculate Top Guests ──
    const guestMap = {};

    // ── PROCESS ALL BOOKINGS ──
    bookings.forEach(b => {
      const checkInDate = new Date(b.checkIn);
      const checkOutDate = new Date(b.checkOut);
      const amount = b.totalAmount || 0;

      // Revenue Logic
      const revMonth = revenueData.find(r => r.monthIdx === checkInDate.getMonth() && r.year === checkInDate.getFullYear());
      if (revMonth) {
        revMonth.revenue += amount;
        revMonth.bookings += 1;
        // Basic occupancy logic: assuming every booking adds approx 10% to monthly occupancy
        revMonth.occupancy = Math.min(100, revMonth.bookings * 10); 
      }

      // Room Logic
      const rType = b.roomType ? b.roomType.toLowerCase() : 'standard';
      if (roomMap[rType]) {
        roomMap[rType].bookings += 1;
        roomMap[rType].revenue += amount;
        totalRoomBookings += 1;
      }

      // Weekly Logic
      if (checkInDate >= startOfWeek && checkInDate <= endOfWeek) {
        weeklyMap[days[checkInDate.getDay()]].checkins += 1;
        weeklyMap[days[checkInDate.getDay()]].revenue += amount;
      }
      if (checkOutDate >= startOfWeek && checkOutDate <= endOfWeek) {
        weeklyMap[days[checkOutDate.getDay()]].checkouts += 1;
      }

      // Guest Logic
      const gName = b.guestName || 'Guest';
      if (!guestMap[gName]) {
        guestMap[gName] = { name: gName, visits: 0, spentNum: 0, room: b.roomType || 'Standard' };
      }
      guestMap[gName].visits += 1;
      guestMap[gName].spentNum += amount;
      guestMap[gName].room = b.roomType || guestMap[gName].room; // Store latest room type
    });

    // ── FINALIZE DATA FORMATS ──

    // Format Room Data (Calculate Percentages)
    Object.values(roomMap).forEach(r => {
      r.value = totalRoomBookings > 0 ? Math.round((r.bookings / totalRoomBookings) * 100) : 0;
    });
    const finalRoomData = Object.values(roomMap);

    // Format Weekly Data Array (Order Mon -> Sun)
    const finalWeeklyData = [
      weeklyMap['Mon'], weeklyMap['Tue'], weeklyMap['Wed'], 
      weeklyMap['Thu'], weeklyMap['Fri'], weeklyMap['Sat'], weeklyMap['Sun']
    ];

    // Format Top Guests (Sort by spent amount and get top 4)
    const finalTopGuests = Object.values(guestMap)
      .sort((a, b) => b.spentNum - a.spentNum)
      .slice(0, 4)
      .map(g => ({
        ...g,
        spent: `₹${g.spentNum.toLocaleString()}`
      }));

    // Clean up internal fields from revenue data before sending
    const finalRevenueData = revenueData.map(({ monthIdx, year, ...rest }) => rest);

    // Send Real Data
    res.status(200).json({
      revenueData: finalRevenueData,
      roomData: finalRoomData,
      weeklyData: finalWeeklyData,
      topGuests: finalTopGuests
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Server error fetching analytics data" });
  }
});

module.exports = router;