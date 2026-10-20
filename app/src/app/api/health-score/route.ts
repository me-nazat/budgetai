export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne } from '@/lib/db';
import { DashboardService } from '@/services/dashboard.service';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const searchParams = request.nextUrl.searchParams;
    const monthQuery = searchParams.get('month') || undefined;

    const health = await DashboardService.getHealthScore(userId, monthQuery);

    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;
    if (monthQuery && monthQuery.match(/^\d{4}-\d{2}$/)) {
      [currentYear, currentMonth] = monthQuery.split('-').map(Number);
    }

    // Sparkline history (last 7 months)
    const history = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

      if (i === 0) {
        history.push({
          month: d.toLocaleString('default', { month: 'short' }),
          score: health.score,
        });
        continue;
      }

      const moExp = await queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
        [userId, monthStart, monthEnd]
      );
      const moEarn = await queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
        [userId, monthStart, monthEnd]
      );
      const eT = moEarn?.total || 0;
      const xT = moExp?.total || 0;
      const sR = eT > 0 ? (eT - xT) / eT : 0;
      let pScore = 50;
      if (sR >= 0.2) pScore += 30;
      else if (sR > 0.05) pScore += 15;
      else if (sR < 0) pScore -= 20;

      pScore = Math.max(10, Math.min(100, pScore));

      history.push({
        month: d.toLocaleString('default', { month: 'short' }),
        score: pScore,
      });
    }

    const primaryAction =
      health.pillars.savingsRate.score < 25
        ? health.pillars.savingsRate.action
        : health.pillars.budgetAdherence.score < 25
          ? health.pillars.budgetAdherence.action
          : health.pillars.emergencyRunway.score < 25
            ? health.pillars.emergencyRunway.action
            : health.pillars.debtLoad.action;

    return NextResponse.json({
      score: health.score,
      grade: health.grade,
      pillars: health.pillars,
      breakdown: {
        savingsRate: { score: health.pillars.savingsRate.score, max: 25 },
        budgetAdherence: { score: health.pillars.budgetAdherence.score, max: 25 },
        emergencyRunway: { score: health.pillars.emergencyRunway.score, max: 25 },
        debtLoad: { score: health.pillars.debtLoad.score, max: 25 },
        netWorth: { score: Math.round(health.score * 0.2), max: 20 },
        emergencyFund: { score: health.pillars.emergencyRunway.score, max: 20 },
        consistency: { score: 10, max: 10 },
      },
      history,
      insight: primaryAction,
    });
  })
);
