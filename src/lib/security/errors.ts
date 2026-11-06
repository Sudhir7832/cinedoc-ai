import { NextResponse } from 'next/server';

export class RequestSecurityError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = 'RequestSecurityError';
  }
}

export function secureErrorResponse(error: unknown, fallback = 'Request failed.') {
  if (error instanceof RequestSecurityError) {
    return NextResponse.json({ success: false, error: error.publicMessage }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : '';
  if (message.includes('Authentication required')) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (message.includes('Forbidden')) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
