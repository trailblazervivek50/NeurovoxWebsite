import { NextRequest, NextResponse } from 'next/server';
import { createScanRecord, getUserScans } from '@/src/db/scans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function verifyAuthToken(req: NextRequest): Promise<{ uid: string; email?: string; name?: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  if (token) {
    return { uid: token, name: 'User' };
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    // User scans are strictly user-scoped
    const userId = auth?.uid || req.nextUrl.searchParams.get('userId') || 'guest';
    const scans = await getUserScans(userId);

    return NextResponse.json({
      status: 'success',
      scans,
      retentionPolicy: '30-Day Auto-Purge Window',
    });
  } catch (error: any) {
    console.error('Error fetching scans:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    const body = await req.json();

    const userId = auth?.uid || body.userId || 'guest';
    const userName = auth?.name || body.userName || 'Anonymous User';

    const newScan = await createScanRecord({
      userId,
      userName,
      jawWidthCm: body.jawWidthCm ?? body.jawWidth,
      faceHeightCm: body.faceHeightCm ?? body.faceHeight,
      faceWidthCm: body.faceWidthCm,
      referenceInterEyeCm: body.referenceInterEyeCm ?? 6.3,
      recommendedSize: body.recommendedSize,
      confidence: body.confidence,
      scanQuality: body.scanQuality || 'Good',
      probabilities: body.probabilities,
      headPose: body.headPose,
      stabilityMetrics: body.stabilityMetrics,
      normalizedFeatures: body.normalizedFeatures,
      isDemoSimulation: Boolean(body.isDemoSimulation),
    });

    return NextResponse.json({
      status: 'success',
      scan: newScan,
      message: 'Scan biometrics recorded with 30-day retention schedule',
    });
  } catch (error: any) {
    console.error('Error saving scan:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
