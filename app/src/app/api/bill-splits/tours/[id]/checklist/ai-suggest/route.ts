import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcastTourUpdate } from '@/lib/tour-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await queryOne<{ id: number; name: string; destination?: string | null }>(
    `SELECT DISTINCT t.id, t.name, t.destination
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, session.userId, session.userId]
  );

  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    // Fetch participants to round-robin assign items
    const participants = await queryAll<{ id: number; name: string }>(
      'SELECT id, name FROM tour_participants WHERE tour_id = ? ORDER BY id ASC',
      [tourId]
    );

    const dest = tour.destination?.toLowerCase() || tour.name.toLowerCase();

    // Context-aware essentials
    const baseSuggestions = [
      // Documents
      { name: 'Passports & National IDs', category: 'Documents', priority: 'High', quantity: 1, desc: 'Original physical documents & scanned copies' },
      { name: 'Travel Insurance Documents', category: 'Documents', priority: 'High', quantity: 1, desc: 'Emergency contact numbers & policy number' },
      { name: 'Hotel / Airbnb Booking Confirmations', category: 'Documents', priority: 'Medium', quantity: 1, desc: 'Check-in vouchers & addresses' },
      { name: 'Flight / Train Boarding Passes', category: 'Documents', priority: 'High', quantity: 1, desc: 'Digital wallet pass or printed tickets' },
      // Gear
      { name: 'High-Capacity Power Bank (20,000mAh)', category: 'Gear', priority: 'High', quantity: 1, desc: 'Keep in carry-on bag' },
      { name: 'Universal Travel Power Adapter', category: 'Gear', priority: 'Medium', quantity: 2, desc: 'Multi-plug with fast USB-C PD charging' },
      { name: 'Compact First Aid Kit', category: 'Gear', priority: 'Medium', quantity: 1, desc: 'Bandages, antiseptic wipes, burn cream' },
      { name: 'Waterproof Dry Bag / Daypack', category: 'Gear', priority: 'Medium', quantity: 1, desc: 'For day trips and water activities' },
      // Medicine
      { name: 'Pain Relief (Paracetamol / Ibuprofen)', category: 'Medicine', priority: 'High', quantity: 1, desc: 'Headaches, aches, fever' },
      { name: 'Motion Sickness Tablets', category: 'Medicine', priority: 'Medium', quantity: 1, desc: 'For winding mountain roads or boat trips' },
      { name: 'Electrolyte Hydration Sachets (ORS)', category: 'Medicine', priority: 'High', quantity: 4, desc: 'Combat heat exhaustion & dehydration' },
      { name: 'Insect Repellent Spray', category: 'Medicine', priority: 'Medium', quantity: 1, desc: 'Mosquito protection' },
      // Clothing
      { name: 'Comfortable Walking / Trail Shoes', category: 'Clothing', priority: 'High', quantity: 1, desc: 'Broken-in shoes with good grip' },
      { name: 'Lightweight Rain Jacket or Compact Umbrella', category: 'Clothing', priority: 'Medium', quantity: 1, desc: 'Sudden rain protection' },
      { name: 'Breathable Quick-Dry Outfits', category: 'Clothing', priority: 'Medium', quantity: 3, desc: 'Daily activities' },
      // Bookings & Money
      { name: 'Emergency Local Cash Reserves', category: 'Bookings', priority: 'High', quantity: 1, desc: 'Small bills for street vendors and taxis' },
      { name: 'Activity Pre-Bookings & Attraction Tickets', category: 'Bookings', priority: 'Medium', quantity: 1, desc: 'Skip-the-line QR codes' },
    ];

    // Beach or tropical extras
    if (dest.includes('beach') || dest.includes('bali') || dest.includes('phuket') || dest.includes('cox') || dest.includes('island') || dest.includes('maldives') || dest.includes('goa')) {
      baseSuggestions.push(
        { name: 'Reef-Safe Sunscreen (SPF 50+)', category: 'Medicine', priority: 'High', quantity: 1, desc: 'Water-resistant UV protection' },
        { name: 'Quick-Dry Microfiber Beach Towels', category: 'Gear', priority: 'Low', quantity: 1, desc: 'Compact and sand-free' }
      );
    }

    // Existing items check to prevent duplicates
    const existingItems = await queryAll<{ name: string }>(
      'SELECT name FROM tour_checklist_items WHERE tour_id = ?',
      [tourId]
    );
    const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));

    const itemsToInsert = baseSuggestions.filter((item) => !existingNames.has(item.name.toLowerCase()));

    let assignedIdx = 0;
    const insertedItems: any[] = [];

    for (const item of itemsToInsert) {
      const assignee = participants.length > 0 && item.category !== 'Documents'
        ? participants[assignedIdx % participants.length].name
        : 'Everyone';
      assignedIdx++;

      const res = await run(
        `INSERT INTO tour_checklist_items (
          tour_id, name, category, assigned_to, completed, description, priority, quantity, completed_by
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, '[]')`,
        [tourId, item.name, item.category, assignee, item.desc, item.priority, item.quantity]
      );

      insertedItems.push({
        id: res.lastInsertRowid,
        tourId,
        name: item.name,
        category: item.category,
        assignedTo: assignee,
        completed: false,
        description: item.desc,
        priority: item.priority,
        quantity: item.quantity,
      });
    }

    broadcastTourUpdate(tourId, { type: 'CHECKLIST_CHANGE' });

    return NextResponse.json({
      success: true,
      count: insertedItems.length,
      suggestions: insertedItems,
      items: insertedItems,
    });
  } catch (error) {
    console.error('Failed to generate AI suggestions', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return POST(request, context);
}
