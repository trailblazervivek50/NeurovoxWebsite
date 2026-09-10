import { NextRequest, NextResponse } from 'next/server';
import { createOrderRecord, getUserOrders } from '@/src/db/orders';
import { runPythonEngine } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'guest';
    const orders = await getUserOrders(userId);
    return NextResponse.json({ status: 'success', orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Run order processing through Python engine
    let processed;
    try {
      processed = await runPythonEngine('orders.py', [body]);
    } catch (bridgeErr) {
      console.warn('Python order engine fallback:', bridgeErr);
      const subtotal = (body.items || []).reduce((acc: number, item: any) => acc + (item.priceInr || 1499) * (item.quantity || 1), 0);
      const tax = Math.round(subtotal * 0.18);
      const total = subtotal + tax;
      processed = {
        orderId: `NVX-IND-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        status: 'confirmed',
        currency: 'INR',
        currencySymbol: '₹',
        subtotalInr: subtotal,
        taxInr: tax,
        shippingInr: 0,
        totalInr: total,
        formattedTotal: `₹${total.toLocaleString('en-IN')}`,
        createdAt: new Date().toISOString(),
      };
    }

    const newOrder = await createOrderRecord({
      id: processed.orderId,
      userId: body.userId || 'guest',
      scanId: body.scanId || null,
      customerName: body.customerName || 'Customer',
      customerEmail: body.customerEmail || 'customer@example.com',
      shippingAddress: body.shippingAddress || {},
      items: body.items || [],
      currency: 'INR',
      totalInr: processed.totalInr || 1499,
      status: 'confirmed',
    });

    return NextResponse.json({
      status: 'success',
      order: newOrder || processed,
      processedDetails: processed,
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
