import { NextRequest, NextResponse } from 'next/server';
import { deleteScanRecord } from '@/src/db/scans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = req.headers.get('authorization');

    let userId = req.nextUrl.searchParams.get('userId') || 'guest';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token) {
        userId = token;
      }
    }

    const success = await deleteScanRecord(id, userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Scan not found or unauthorized to delete this record' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Scan record deleted permanently',
    });
  } catch (error: any) {
    console.error('Error deleting scan:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

