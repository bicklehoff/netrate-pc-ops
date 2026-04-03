// API: MLO Scenario Alert Queue
// GET  /api/portal/mlo/scenario-alerts — list queue items with filters
// PATCH /api/portal/mlo/scenario-alerts — approve/decline queue items

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/resend';
import { scenarioAlertTemplate } from '@/lib/email-templates/borrower';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const q = searchParams.get('q');
    const view = searchParams.get('view'); // 'scenarios' for management view

    // Management view: list all saved scenarios
    if (view === 'scenarios') {
      const where = {};
      if (q) {
        where.lead = {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        };
      }

      const scenarios = await prisma.savedScenario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: { select: { name: true, email: true, phone: true } },
          _count: { select: { alertQueue: true } },
        },
      });

      return NextResponse.json({ scenarios });
    }

    // Default view: alert queue items
    const where = {};
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;

    const queueItems = await prisma.scenarioAlertQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: {
          include: {
            lead: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    // Filter by search query on borrower name/email
    let filtered = queueItems;
    if (q) {
      const lq = q.toLowerCase();
      filtered = queueItems.filter(item => {
        const lead = item.scenario?.lead;
        return (lead?.name?.toLowerCase().includes(lq)) ||
               (lead?.email?.toLowerCase().includes(lq));
      });
    }

    return NextResponse.json({ items: filtered });
  } catch (err) {
    console.error('Scenario alerts GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action, mloNotes } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    if (!['approve', 'decline', 'pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Handle pause/resume — these act on SavedScenario, not queue items
    if (action === 'pause' || action === 'resume') {
      await prisma.savedScenario.updateMany({
        where: { id: { in: ids } },
        data: { alertStatus: action === 'pause' ? 'paused' : 'active' },
      });
      return NextResponse.json({ success: true, action, count: ids.length });
    }

    const results = { sent: 0, declined: 0, errors: [] };

    for (const id of ids) {
      try {
        const item = await prisma.scenarioAlertQueue.findUnique({
          where: { id },
          include: {
            scenario: {
              include: {
                lead: { select: { name: true, email: true } },
              },
            },
          },
        });

        if (!item || item.status !== 'pending') continue;

        if (action === 'decline') {
          await prisma.scenarioAlertQueue.update({
            where: { id },
            data: {
              status: 'declined',
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
              mloNotes: mloNotes || null,
            },
          });
          results.declined++;
          continue;
        }

        // Approve: send email then update records
        const lead = item.scenario?.lead;
        const sd = item.scenario?.scenarioData;
        if (!lead?.email) {
          results.errors.push(`${id}: no borrower email`);
          continue;
        }

        const firstName = lead.name?.split(' ')[0] || 'there';
        const viewLink = `${SITE_URL}/rates`;
        const unsubscribeLink = `${SITE_URL}/api/saved-scenario/unsubscribe?token=${item.scenario.unsubToken}`;

        const emailData = scenarioAlertTemplate({
          firstName,
          scenarioSummary: {
            purpose: sd?.purpose,
            loanAmount: sd?.loanAmount,
            fico: sd?.fico,
            ltv: sd?.ltv,
            state: sd?.state,
          },
          currentRates: item.pricingData || [],
          previousRates: item.previousData || [],
          viewLink,
          unsubscribeLink,
          mloNotes: mloNotes || null,
        });

        await sendEmail({
          to: lead.email,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        });

        // Update queue item
        await prisma.scenarioAlertQueue.update({
          where: { id },
          data: {
            status: 'sent',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            sentAt: new Date(),
            mloNotes: mloNotes || null,
          },
        });

        // Update saved scenario with latest pricing
        await prisma.savedScenario.update({
          where: { id: item.scenarioId },
          data: {
            lastSentAt: new Date(),
            lastPricingData: item.pricingData,
            sendCount: { increment: 1 },
          },
        });

        results.sent++;
      } catch (err) {
        results.errors.push(`${id}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error('Scenario alerts PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
