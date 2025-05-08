import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { name: nameInput, base64 } = await request.json();
    if (!nameInput || !base64) {
      return NextResponse.json({ success: false, error: 'Missing name or base64' }, { status: 400 });
    }

    // Ensure name is a string and add .png extension
    const name = String(nameInput) + '.png';

    const folder = path.join(process.cwd(), 'data', 'image');
    await fs.mkdir(folder, { recursive: true });
    // Strip data URI prefix if present
    const matches = base64.match(/^data:(image\/\w+);base64,(.*)$/);
    const data = matches ? matches[2] : base64;
    const buffer = Buffer.from(data, 'base64');
    const filePath = path.join(folder, name);
    await fs.writeFile(filePath, buffer);
    // Return the path with the .png extension
    return NextResponse.json({ success: true, path: `/data/image/${name}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
