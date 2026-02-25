
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html } = body

    // Using Resend API (free tier: 100 emails/day)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY || 'demo-key'}`
      },
      body: JSON.stringify({
        from: '[SUA EMPRESA] <pedidos@espetosgenino.com>',
        to: [to],
        subject,
        html
      })
    })

    if (!response.ok) {
      // If Resend fails, log the email instead
      console.log('📧 Email notification (Resend unavailable):')
      console.log('To:', to)
      console.log('Subject:', subject)
      console.log('Body:', html)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Email logged (configure RESEND_API_KEY for actual sending)' 
      })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending email:', error)
    
    // Log email even if sending fails
    console.log('📧 Email notification (error occurred):')
    console.log('Request body:', await request.clone().json())
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Email logged',
        error: String(error) 
      },
      { status: 200 }
    )
  }
}
