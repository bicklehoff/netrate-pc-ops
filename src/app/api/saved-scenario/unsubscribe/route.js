import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const scenario = await prisma.savedScenario.findFirst({
      where: { unsubToken: token },
    });

    if (!scenario) {
      return new NextResponse(renderPage('Not Found', 'This unsubscribe link is no longer valid.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (scenario.alertStatus === 'unsubscribed') {
      return new NextResponse(renderPage('Already Unsubscribed', 'You have already been unsubscribed from rate alerts for this scenario.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    await prisma.savedScenario.update({
      where: { id: scenario.id },
      data: { alertStatus: 'unsubscribed' },
    });

    return new NextResponse(renderPage('Unsubscribed', 'You have been unsubscribed from rate alerts for this scenario. You will no longer receive updates.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return new NextResponse(renderPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - NetRate Mortgage</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #6b7280; line-height: 1.6; }
    a { color: #0891b2; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top: 24px;"><a href="https://www.netratemortgage.com">Back to NetRate Mortgage</a></p>
  </div>
</body>
</html>`;
}
