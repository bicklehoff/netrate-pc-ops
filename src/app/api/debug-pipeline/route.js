import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        borrower: {
          select: { firstName: true, lastName: true, email: true, ssnLastFour: true },
        },
        documents: {
          select: { id: true, status: true },
        },
        mlo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    return Response.json({ success: true, count: loans.length, sample: loans.length > 0 ? Object.keys(loans[0]) : 'no loans' });
  } catch (error) {
    return Response.json({ success: false, error: error.message, code: error.code, meta: error.meta }, { status: 500 });
  }
}
