import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get('collection');
  if (!collection) {
    return NextResponse.json({ success: false, error: 'Missing collection parameter' }, { status: 400 });
  }
  const coll = await getCollection(collection);
  const params: Record<string, string | number> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === 'collection') continue;
    // Ethereum hex addresses should remain strings
    if (/^0x[a-fA-F0-9]+$/.test(value)) {
      params[key] = value;
    } else {
      const num = Number(value);
      params[key] = !isNaN(num) ? num : value;
    }
  }
  const results = coll.find(params);
  return NextResponse.json({ success: true, results });
}
