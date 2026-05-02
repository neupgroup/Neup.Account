import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { verifyPassword } from '@/services/auth/password';

describe('verifyPassword', () => {
    it('returns valid when password matches stored hash', async () => {
        const hash = await bcrypt.hash('correct-password', 10);
        const result = await verifyPassword({ password: 'correct-password', storedHash: hash });
        expect(result.status).toBe('valid');
    });

    it('returns invalid when password does not match stored hash', async () => {
        const hash = await bcrypt.hash('correct-password', 10);
        const result = await verifyPassword({ password: 'wrong-password', storedHash: hash });
        expect(result.status).toBe('invalid');
    });

    it('returns invalid when password is empty', async () => {
        const result = await verifyPassword({ password: '' });
        expect(result.status).toBe('invalid');
    });

    it('returns invalid when password is only whitespace', async () => {
        const result = await verifyPassword({ password: '   ' });
        expect(result.status).toBe('invalid');
    });

    it('returns invalid when password is shorter than minLength', async () => {
        const result = await verifyPassword({ password: 'abc', minLength: 8 });
        expect(result.status).toBe('invalid');
    });

    it('returns valid when no storedHash is provided and password is non-empty', async () => {
        const result = await verifyPassword({ password: 'any-password' });
        expect(result.status).toBe('valid');
    });

    it('returns unauthorized when requireHash is true but no storedHash provided', async () => {
        const result = await verifyPassword({ password: 'any-password', requireHash: true });
        expect(result.status).toBe('unauthorized');
    });

    it('returns expired when expiresOn is in the past', async () => {
        const past = new Date(Date.now() - 1000);
        const result = await verifyPassword({ password: 'any-password', expiresOn: past });
        expect(result.status).toBe('expired');
    });

    it('returns valid when expiresOn is in the future', async () => {
        const future = new Date(Date.now() + 60000);
        const result = await verifyPassword({ password: 'any-password', expiresOn: future });
        expect(result.status).toBe('valid');
    });

    it('accepts expiresOn as an ISO string', async () => {
        const past = new Date(Date.now() - 1000).toISOString();
        const result = await verifyPassword({ password: 'any-password', expiresOn: past });
        expect(result.status).toBe('expired');
    });
});
