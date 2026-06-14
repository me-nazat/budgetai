export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { FALLBACK_RATES } from '@/lib/currency';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
            next: { revalidate: 3600 }
        });
        
        if (!res.ok) throw new Error('Failed to fetch rates');
        
        const data = await res.json();
        if (data && data.rates) {
            return NextResponse.json({ rates: data.rates });
        }
        
        throw new Error('Invalid rate data');
    } catch (e) {
        console.error('Exchange rate fetch error:', e);
        // Return fallbacks if the API is down
        return NextResponse.json({ rates: FALLBACK_RATES });
    }
}
