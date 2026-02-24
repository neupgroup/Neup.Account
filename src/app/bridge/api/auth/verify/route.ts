import { NextResponse, type NextRequest } from 'next/server';
import { logError } from '@/lib/logger';
import { validateExternalRequest } from '@/actions/auth/validate';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = await validateExternalRequest(body);
        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status ?? 400 });
        }
        return NextResponse.json(result);

    } catch (error) {
        await logError('database', error, 'verify-key');
        return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
    }
}
