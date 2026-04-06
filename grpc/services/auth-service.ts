import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import prisma from '@/lib/prisma';
import { getUserProfile } from '@/lib/user';

const PROTO_PATH = path.resolve(process.cwd(), 'grpc/proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const authProto = (grpc.loadPackageDefinition(packageDefinition) as any).auth;

/**
 * Validates an internal session.
 * This logic is extracted from validateExternalRequest but simplified for gRPC/internal use.
 */
async function validateInternalSession(data: {
    appId: string;
    auth_account_id: string;
    auth_session_id: string;
    auth_session_key: string;
}) {
    const { appId, auth_account_id, auth_session_id, auth_session_key } = data;

    // 1. App Validation
    const app = await prisma.application.findUnique({
        where: { id: appId }
    });

    if (!app) {
        return { success: false, error: 'Invalid application ID.' };
    }

    // 2. Session Validation
    const session = await prisma.session.findUnique({
        where: { id: auth_session_id },
    });

    if (
        !session ||
        session.accountId !== auth_account_id ||
        session.authSessionKey !== auth_session_key ||
        session.isExpired ||
        !session.expiresOn ||
        session.expiresOn < new Date()
    ) {
        return { success: false, error: 'Invalid or expired session.' };
    }

    // 3. Get User Profile
    const profile = await getUserProfile(auth_account_id);
    if (!profile) {
        return { success: false, error: 'User profile not found.' };
    }

    return {
        success: true,
        user: {
            accountId: auth_account_id,
            displayName: profile.nameDisplay || `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim(),
            neupId: profile.neupIdPrimary || '',
        }
    };
}

async function verifySession(call: any, callback: any) {
    const { appId, auth_account_id, auth_session_id, auth_session_key } = call.request;

    try {
        const result = await validateInternalSession({
            appId,
            auth_account_id,
            auth_session_id,
            auth_session_key,
        });

        if (result.success) {
            callback(null, {
                success: true,
                user: result.user,
            });
        } else {
            callback(null, {
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('gRPC verifySession error:', error);
        callback(null, {
            success: false,
            error: 'Internal gRPC error',
        });
    }
}

export function startGrpcServer() {
    const server = new grpc.Server();
    server.addService(authProto.AuthService.service, { verifySession });
    
    const port = process.env.GRPC_PORT || '50051';
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error(`gRPC Server failed to bind: ${err.message}`);
            return;
        }
        console.log(`gRPC Server running at http://0.0.0.0:${port}`);
    });
}
