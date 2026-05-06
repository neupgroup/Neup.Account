import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { resolveWhoAmI } from '@/services/auth/whoami';

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
 * gRPC handler for AuthService.Verify
 *
 * Validates a session triplet and returns the user identity if valid.
 *
 * Request:  { sessionId, sessionKey, accountId }
 * Response: { valid, error, user: { accountId, neupId, displayName, displayImage, accountType, verified } }
 */
async function verify(call: any, callback: any) {
    const { sessionId, sessionKey, accountId } = call.request;

    try {
        const result = await resolveWhoAmI({ sessionId, sessionKey, accountId });

        if (result.status === 200 && result.body.success) {
            callback(null, {
                valid: true,
                error: '',
                user: {
                    accountId: result.body.accountId,
                    neupId: result.body.neupId ?? '',
                    displayName: result.body.displayName ?? '',
                    displayImage: result.body.displayImage ?? '',
                    accountType: result.body.accountType ?? '',
                    verified: result.body.verified,
                },
            });
        } else {
            const errBody = result.body as { error: string; error_description?: string };
            callback(null, {
                valid: false,
                error: errBody.error_description || errBody.error,
                user: null,
            });
        }
    } catch (error) {
        console.error('gRPC verify error:', error);
        callback(null, {
            valid: false,
            error: 'internal_server_error',
            user: null,
        });
    }
}

export function startGrpcServer() {
    const server = new grpc.Server();
    server.addService(authProto.AuthService.service, { Verify: verify });

    const port = process.env.GRPC_PORT || '50051';
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) {
            console.error(`gRPC Server failed to bind: ${err.message}`);
            return;
        }
        console.log(`gRPC Server running at 0.0.0.0:${boundPort}`);
    });
}
