import { NextRequest, NextResponse } from 'next/server';
import { validateExternalRequest } from '@/services/auth/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await validateExternalRequest(body);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      );
    }
  } catch (error) {
    console.error('Error in /bridge/api.v1/auth/verify:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
