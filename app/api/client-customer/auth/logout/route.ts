import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Remover cookie
  response.cookies.delete('client-customer-token');

  return response;
}
