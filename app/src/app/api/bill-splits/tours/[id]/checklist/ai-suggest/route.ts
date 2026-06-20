import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, queryAll } from '@/lib/db';
import { generateGeminiResponse } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getAuthorizedTour(tourId: number, userId: number) {
  return await queryOne<{ id: number; name: string }>(
    `SELECT DISTINCT t.id, t.name
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, userId, userId]
  );
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    // 1. Get Participants
    const participants = await queryAll<{ name: string }>(
      'SELECT name FROM tour_participants WHERE tour_id = ?',
      [tourId]
    );

    // 2. Get Itinerary Activities
    const itinerary = await queryAll<{ title: string; type: string; location: string; day: number }>(
      'SELECT title, type, location, day FROM tour_itinerary_items WHERE tour_id = ? ORDER BY day, time ASC',
      [tourId]
    );

    // 3. Build Prompt
    const prompt = `You are an expert travel assistant. Generate a highly tailored packing list of essential items for a tour named "${tour.name}".
    
Trip Details:
- Tour Name: ${tour.name}
- Number of Participants: ${participants.length} (${participants.map(p => p.name).join(', ')})
- Total Itinerary Activities: ${itinerary.length}
${itinerary.map(item => `  * Day ${item.day}: ${item.title} (${item.type}) at ${item.location}`).join('\n')}

Based on the destination, activity types (e.g., flights, hotels, outdoors, dining), and group profile, generate a list of exactly 8-12 highly relevant packing items.

Respond ONLY with a JSON array of objects. Do not include markdown code block formatting (like \`\`\`json). The response must be a valid JSON array matching this exact schema:
[
  {
    "name": "Item Name (e.g. Swimwear, Chargers, Passport)",
    "category": "Clothing" | "Documents" | "Electronics" | "Toiletries" | "Other",
    "priority": "High" | "Medium" | "Low",
    "quantity": number
  }
]`;

    const responseText = await generateGeminiResponse(prompt);
    
    // Clean response text just in case markdown wrapping is included
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```')) {
      const match = cleanText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleanText = match[1].trim();
    }

    try {
      const suggestions = JSON.parse(cleanText);
      return NextResponse.json({ success: true, suggestions });
    } catch (parseError) {
      console.error('Failed to parse AI checklist suggestions JSON:', cleanText, parseError);
      return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to generate AI packing suggestions', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
