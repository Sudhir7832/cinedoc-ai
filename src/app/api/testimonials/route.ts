import { NextResponse } from 'next/server';
import { TestimonialManager } from '@/lib/testimonials';
import { connection } from 'next/server';

export async function GET() {
  await connection();
  return NextResponse.json({ success: true, testimonials: await TestimonialManager.list(false) });
}
