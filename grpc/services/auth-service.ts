import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { validateSession } from '@/services/auth/session';

const PROTO_PATH = path.resolve(process.cwd(), 'grpc/proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const authProto = (grpc.loadPackageDefinition(packageDefinition) as any).auth;

async function verify(call: any, callback: any) {
    const { sessionId, sessionKey, accountId, appId, privateKey } = call.request;

    try {
        const result = await validateSession({
            sessionId,
            sessionKey,
            accountId,
            appId,
            privateKey,
        });

        callback(null, {
            valid: result.valid,
        });
    } catch (error) {
        console.error('gRPC verify error:', error);
        callback(null, {
            valid: false,
        });
    }
}
}

export function startGrpcServer() {
    const server = new grpc.Server();
    server.addService(authProto.AuthService.service, { Verify: verify });
    
    const port = process.env.GRPC_PORT || '50051';
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error(`gRPC Server failed to bind: ${err.message}`);
            return;
        }
        console.log(`gRPC Server running at http://0.0.0.0:${port}`);
    });
}
