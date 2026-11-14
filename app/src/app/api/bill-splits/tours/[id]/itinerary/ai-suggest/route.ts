import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcastTourUpdate } from '@/lib/tour-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ActivityTemplate {
  dayOffset: number;
  time: string;
  timeEnd: string;
  title: string;
  location: string;
  type: 'flight' | 'hotel' | 'food' | 'activity' | 'transport' | 'other';
  groupTheme: string;
  notes: string;
  costRatio: number; // fraction of estimated daily budget
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await queryOne<{
    id: number;
    name: string;
    destination: string | null;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
    base_currency: string | null;
  }>(
    `SELECT DISTINCT t.id, t.name, t.destination, t.start_date, t.end_date, t.total_budget, t.base_currency
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, session.userId, session.userId]
  );

  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    // 1. Calculate number of trip days
    let numDays = 3;
    if (tour.start_date && tour.end_date) {
      const s = new Date(tour.start_date).getTime();
      const e = new Date(tour.end_date).getTime();
      const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0 && diff <= 14) {
        numDays = diff;
      } else if (diff > 14) {
        numDays = 14;
      }
    }

    const destination = tour.destination || tour.name;
    const destLower = destination.toLowerCase();
    const currency = tour.base_currency || 'BDT';
    const totalBudget = tour.total_budget ? Number(tour.total_budget) : 0;
    const dailyBudget = totalBudget > 0 ? Math.round(totalBudget / numDays) : (currency === 'USD' ? 120 : currency === 'EUR' ? 110 : 3500);

    // 2. Fetch existing itinerary titles to avoid duplicating
    const existing = await queryAll<{ title: string; day: number }>(
      'SELECT title, day FROM tour_itinerary_items WHERE tour_id = ?',
      [tourId]
    );
    const existingKeys = new Set(existing.map((e) => `${e.day}_${e.title.toLowerCase().trim()}`));

    // 3. Category detection
    const isBeach = ['beach', 'sea', 'bali', 'phuket', 'cox', 'saint martin', 'maldives', 'goa', 'hawaii', 'cancun', 'island', 'kuakata'].some((k) => destLower.includes(k));
    const isMountain = ['mountain', 'hill', 'sajek', 'pokhara', 'alps', 'banff', 'sapa', 'himalaya', 'trek', 'queenstown', 'darjeeling', 'manali', 'swat'].some((k) => destLower.includes(k));
    const isHistoric = ['paris', 'rome', 'kyoto', 'istanbul', 'cairo', 'london', 'florence', 'athens', 'agra', 'vienna', 'heritage', 'prague', 'delhi'].some((k) => destLower.includes(k));
    const isModernCity = ['tokyo', 'singapore', 'dubai', 'new york', 'bangkok', 'seoul', 'shanghai', 'kuala lumpur', 'hong kong', 'chicago'].some((k) => destLower.includes(k));

    // 4. Generate activities per day
    const generatedTemplates: ActivityTemplate[] = [];

    for (let day = 1; day <= numDays; day++) {
      const isFirstDay = day === 1;
      const isLastDay = day === numDays;

      if (isFirstDay) {
        generatedTemplates.push(
          {
            dayOffset: day,
            time: '12:00',
            timeEnd: '14:00',
            title: `Arrival & Check-in at ${destination} Stay`,
            location: `${destination} Central Hotel / Resort`,
            type: 'hotel',
            groupTheme: `Day ${day} — Arrival & Orientation`,
            notes: 'Keep booking vouchers, IDs, and reservation numbers handy.',
            costRatio: 0.25,
          },
          {
            dayOffset: day,
            time: '15:30',
            timeEnd: '18:00',
            title: isBeach
              ? 'Sunset Promenade & Coastal Walk'
              : isMountain
              ? 'Scenic Valley Overlook Walk'
              : isHistoric
              ? 'Old Town Historic Quarter Stroll'
              : 'Neighborhood Orientation Walk',
            location: `${destination} Center`,
            type: 'activity',
            groupTheme: `Day ${day} — Arrival & Orientation`,
            notes: 'Relaxed introductory exploration and photos.',
            costRatio: 0.1,
          },
          {
            dayOffset: day,
            time: '19:30',
            timeEnd: '21:30',
            title: 'Welcome Group Dinner & Local Cuisine',
            location: `Top Rated Dining in ${destination}`,
            type: 'food',
            groupTheme: `Day ${day} — Arrival & Orientation`,
            notes: 'Try the iconic local specialty dishes.',
            costRatio: 0.3,
          }
        );
      } else if (isLastDay) {
        generatedTemplates.push(
          {
            dayOffset: day,
            time: '09:00',
            timeEnd: '11:00',
            title: 'Souvenir & Artisan Market Shopping',
            location: `${destination} Local Market`,
            type: 'activity',
            groupTheme: `Day ${day} — Souvenirs & Farewell`,
            notes: 'Pick up authentic handicrafts, snacks, and gifts for family.',
            costRatio: 0.2,
          },
          {
            dayOffset: day,
            time: '12:00',
            timeEnd: '13:30',
            title: 'Farewell Lunch & Trip Retrospective',
            location: `Scenic View Cafe in ${destination}`,
            type: 'food',
            groupTheme: `Day ${day} — Souvenirs & Farewell`,
            notes: 'Settle remaining receipts and share photos.',
            costRatio: 0.25,
          },
          {
            dayOffset: day,
            time: '15:00',
            timeEnd: '17:00',
            title: 'Hotel Check-out & Departure Transfer',
            location: `${destination} Station / Airport`,
            type: 'transport',
            groupTheme: `Day ${day} — Souvenirs & Farewell`,
            notes: 'Ensure all bags packed and check-out clearances completed.',
            costRatio: 0.15,
          }
        );
      } else {
        // Full Exploration Days
        if (isBeach) {
          generatedTemplates.push(
            {
              dayOffset: day,
              time: '09:00',
              timeEnd: '13:00',
              title: day % 2 === 0 ? 'Coral Reef Snorkeling & Island Boat Tour' : 'Beach Watersports & Jet Ski Adventure',
              location: `${destination} Shorelines`,
              type: 'activity',
              groupTheme: `Day ${day} — Ocean Discovery`,
              notes: 'Wear reef-safe sunscreen and carry waterproof pouch.',
              costRatio: 0.35,
            },
            {
              dayOffset: day,
              time: '13:30',
              timeEnd: '15:00',
              title: 'Fresh Catch Seafood Lunch',
              location: `${destination} Beachside Shack`,
              type: 'food',
              groupTheme: `Day ${day} — Ocean Discovery`,
              notes: 'Grilled local fish, prawns, and chilled tropical drinks.',
              costRatio: 0.25,
            },
            {
              dayOffset: day,
              time: '16:30',
              timeEnd: '19:00',
              title: 'Golden Hour Sunset Catamaran Cruise',
              location: `${destination} Marina / Pier`,
              type: 'activity',
              groupTheme: `Day ${day} — Ocean Discovery`,
              notes: 'Best photography lighting of the day.',
              costRatio: 0.2,
            },
            {
              dayOffset: day,
              time: '19:45',
              timeEnd: '22:00',
              title: 'Beachfront Bonfire & Night Market',
              location: `${destination} Night Bazaar`,
              type: 'activity',
              groupTheme: `Day ${day} — Ocean Discovery`,
              notes: 'Live acoustic music and night vendor snacks.',
              costRatio: 0.2,
            }
          );
        } else if (isMountain) {
          generatedTemplates.push(
            {
              dayOffset: day,
              time: '06:00',
              timeEnd: '08:30',
              title: 'Early Sunrise Peak Photography & Cloud View',
              location: `${destination} Summit Viewpoint`,
              type: 'activity',
              groupTheme: `Day ${day} — Alpine Trek & Panoramas`,
              notes: 'Dress warmly in layers; bring charged camera/phone.',
              costRatio: 0.1,
            },
            {
              dayOffset: day,
              time: '09:30',
              timeEnd: '14:00',
              title: day % 2 === 0 ? 'Pine Forest & Hidden Waterfall Trek' : 'Cable Car & Hilltop Village Discovery',
              location: `${destination} Trailhead`,
              type: 'activity',
              groupTheme: `Day ${day} — Alpine Trek & Panoramas`,
              notes: 'Sturdy trekking footwear and hydration pack required.',
              costRatio: 0.3,
            },
            {
              dayOffset: day,
              time: '14:30',
              timeEnd: '16:00',
              title: 'Traditional Mountain Cuisine Lunch',
              location: `${destination} Hilltop Lodge`,
              type: 'food',
              groupTheme: `Day ${day} — Alpine Trek & Panoramas`,
              notes: 'Hearty local organic soup and freshly baked breads.',
              costRatio: 0.25,
            },
            {
              dayOffset: day,
              time: '19:30',
              timeEnd: '22:00',
              title: 'Stargazing Gathering & Outdoor Campfire',
              location: `${destination} Camping Ground`,
              type: 'activity',
              groupTheme: `Day ${day} — Alpine Trek & Panoramas`,
              notes: 'Clear night sky views and hot spiced tea.',
              costRatio: 0.15,
            }
          );
        } else if (isHistoric) {
          generatedTemplates.push(
            {
              dayOffset: day,
              time: '09:30',
              timeEnd: '12:30',
              title: day % 2 === 0 ? `Iconic Landmarks & Architectural Wonder Tour` : `National History & Art Museum`,
              location: `${destination} Landmark District`,
              type: 'activity',
              groupTheme: `Day ${day} — Culture & Heritage`,
              notes: 'Pre-booked skip-the-line QR vouchers recommended.',
              costRatio: 0.3,
            },
            {
              dayOffset: day,
              time: '13:00',
              timeEnd: '14:30',
              title: 'Historic Courtyard Brasserie Lunch',
              location: `Historic Quarter, ${destination}`,
              type: 'food',
              groupTheme: `Day ${day} — Culture & Heritage`,
              notes: 'Artisan cheeses, local wine/beverage pairings, and fresh bread.',
              costRatio: 0.25,
            },
            {
              dayOffset: day,
              time: '15:30',
              timeEnd: '18:00',
              title: 'Artisan Workshop & Hidden Alleys Walk',
              location: `${destination} Bohemian Quarter`,
              type: 'activity',
              groupTheme: `Day ${day} — Culture & Heritage`,
              notes: 'Local craftsmen, vintage bookstalls, and street art.',
              costRatio: 0.15,
            },
            {
              dayOffset: day,
              time: '19:30',
              timeEnd: '22:00',
              title: 'Evening Monument Lights & Classical Dinner',
              location: `${destination} Riverfront`,
              type: 'food',
              groupTheme: `Day ${day} — Culture & Heritage`,
              notes: 'Stunning night-illuminated architecture views.',
              costRatio: 0.3,
            }
          );
        } else {
          // Modern City / General Destination
          generatedTemplates.push(
            {
              dayOffset: day,
              time: '09:30',
              timeEnd: '12:00',
              title: day % 2 === 0 ? 'Skyline Observation Deck & Panoramic Views' : 'Interactive Science & Digital Arts Exhibition',
              location: `${destination} Central Tower`,
              type: 'activity',
              groupTheme: `Day ${day} — City Highlights`,
              notes: 'Spectacular 360-degree city views and photography.',
              costRatio: 0.3,
            },
            {
              dayOffset: day,
              time: '12:30',
              timeEnd: '14:00',
              title: 'Authentic Food Market & Street Fare Lunch',
              location: `${destination} Food Arcade`,
              type: 'food',
              groupTheme: `Day ${day} — City Highlights`,
              notes: 'Explore multiple food stalls with regional delicacies.',
              costRatio: 0.2,
            },
            {
              dayOffset: day,
              time: '15:00',
              timeEnd: '18:00',
              title: 'Cultural Park & Botanical Garden Tour',
              location: `${destination} Green Oasis`,
              type: 'activity',
              groupTheme: `Day ${day} — City Highlights`,
              notes: 'Relaxing afternoon walk amid curated floral landscapes.',
              costRatio: 0.15,
            },
            {
              dayOffset: day,
              time: '19:30',
              timeEnd: '22:00',
              title: 'Rooftop Lounge Dinner & City Skyline Night View',
              location: `${destination} Skyline Avenue`,
              type: 'food',
              groupTheme: `Day ${day} — City Highlights`,
              notes: 'Vibrant evening atmosphere with city lights.',
              costRatio: 0.35,
            }
          );
        }
      }
    }

    // Filter out duplicates
    const itemsToInsert = generatedTemplates.filter(
      (t) => !existingKeys.has(`${t.dayOffset}_${t.title.toLowerCase().trim()}`)
    );

    const insertedItems: any[] = [];

    for (const t of itemsToInsert) {
      const estimatedCost = Math.round(dailyBudget * t.costRatio);
      const costDisplay = `${estimatedCost}`;

      const res = await run(
        `INSERT INTO tour_itinerary_items (
          tour_id, day, time, time_end, title, location, cost, cost_display, type, notes, group_title, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Planned')`,
        [tourId, t.dayOffset, t.time, t.timeEnd, t.title, t.location, estimatedCost, costDisplay, t.type, t.notes, t.groupTheme]
      );

      insertedItems.push({
        id: res.lastInsertRowid,
        tourId,
        day: t.dayOffset,
        time: t.time,
        timeEnd: t.timeEnd,
        title: t.title,
        location: t.location,
        cost: estimatedCost,
        costDisplay,
        type: t.type,
        notes: t.notes,
        groupTitle: t.groupTheme,
        status: 'Planned',
      });
    }

    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE', data: { action: 'AI_SUGGEST', count: insertedItems.length } });

    return NextResponse.json({
      success: true,
      numDays,
      count: insertedItems.length,
      items: insertedItems,
      destination,
    });
  } catch (error) {
    console.error('Failed to generate AI itinerary', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return POST(request, context);
}
