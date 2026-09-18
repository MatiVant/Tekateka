import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code')
    if (!code) return new NextResponse('Código requerido', { status: 400 })
    const png = await QRCode.toBuffer(code, { errorCorrectionLevel: 'M', type: 'png', width: 400, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
    return new NextResponse(png as BodyInit, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' } })
  } catch (error) {
    console.error('[v0] Error al generar QR de imagen:', error)
    return new NextResponse('Error al generar QR', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
    }

    const qrDataUrl = await QRCode.toDataURL(code, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    return NextResponse.json({ qrDataUrl })
  } catch (error: any) {
    console.error('[v0] Error al generar QR:', error)
    return NextResponse.json(
      { error: 'Error al generar código QR', details: error.message },
      { status: 500 }
    )
  }
}
