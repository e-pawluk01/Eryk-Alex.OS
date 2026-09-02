import { NextResponse } from 'next/server';
import { generateSku } from '@/lib/sku';

export async function POST(request: Request) {
  try {
    const { category } = await request.json();
    if (!category) {
      return NextResponse.json({ error: 'Missing category' }, { status: 400 });
    }

    const result = await generateSku(category);
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SKU generate error:', error);
    return NextResponse.json({ error: error.message || 'SKU generation failed' }, { status: 500 });
  }
}
