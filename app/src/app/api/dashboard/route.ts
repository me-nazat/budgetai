export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from "@/lib/middleware/api-handler";
import { withAuth } from "@/lib/middleware/with-auth";
import { getRedisClient } from '@/lib/redis';
import { DashboardService } from '@/services/dashboard.service';

export const GET = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const searchParams = request.nextUrl.searchParams;
        const monthQuery = searchParams.get('month'); // format: YYYY-MM
        const weekQuery = searchParams.get('week'); // format: 'all', '1', '2', '3', '4'

        const redis = getRedisClient();
        let version = "0";
        let cacheKey = "";

        if (redis) {
            try {
                const fetchedVersion = await redis.get<string | number>(`dashboard-version:${userId}`);
                if (fetchedVersion !== null && fetchedVersion !== undefined) {
                    version = String(fetchedVersion);
                } else {
                    await redis.set(`dashboard-version:${userId}`, "0");
                }
                const monthStr = monthQuery || 'default';
                const weekStr = weekQuery || 'all';
                cacheKey = `dashboard:${userId}:${version}:${monthStr}:${weekStr}`;

                const cachedData = await redis.get<any>(cacheKey);
                if (cachedData) {
                    return NextResponse.json(cachedData);
                }
            } catch (error) {
                console.error('[dashboard-api] Redis cache error:', error);
            }
        }

        const responseData = await DashboardService.getDashboard(
            userId,
            monthQuery || undefined,
            weekQuery || undefined
        );

        if (redis && cacheKey) {
            try {
                await redis.set(cacheKey, responseData, { ex: 300 });
            } catch (error) {
                console.error('[dashboard-api] Redis cache write error:', error);
            }
        }

        return NextResponse.json(responseData);
    })
);
