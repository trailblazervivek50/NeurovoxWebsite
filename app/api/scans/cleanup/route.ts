import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredScans } from '@/src/db/scans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const deletedCount = await cleanupExpiredScans();
    return NextResponse.json({
      status: 'success',
      deletedCount,
      timestamp: new Date().toISOString(),
      message: `Successfully purged ${deletedCount} biometric records past 30-day retention window`,
    });
  } catch (error: any) {
    console.error('Error executing retention cleanup:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
