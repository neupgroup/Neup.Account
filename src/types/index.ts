
import { z } from 'zod';
import { registrationSchema, profileSchema, securityQuestionSchema } from '@/schemas/auth';
import { Timestamp } from 'firebase/firestore';


// --- Base Types ---
export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    details?: any; 
};

// --- Authentication & Session ---
export type Session = {
    accountId: string;
    sessionId: string;
    sessionKey: string;
};

export type StoredAccount = {
    accountId: string;
    sessionId: string;
    sessionKey: string;
    neupId: string;
    expired: boolean;
    active: boolean; // Add active flag
};

export type RegistrationData = z.infer<typeof registrationSchema>;
export type ProfileData = z.infer<typeof profileSchema>;
export type SecurityQuestionData = z.infer<typeof securityQuestionSchema>;

// --- User & Profile ---

export type NeupId = {
    id: string;
    for: string;
    isPrimary: boolean;
}

export type UserProfile = {
    neupId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dob: string; // Should be a string in YYYY-MM-DD format
    gender: string;
    nationality: string;
    contact?: {
        email?: string;
        phone?: string;
    };
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
    };
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
};


// --- Root & Management ---

export interface UserDetails {
    accountId: string;
    neupId: string;
    profile: UserProfile;
    linkedBrands: any[];
    linkedDependents: any[];
    security: {
        isMfaEnabled: boolean;
        isPasskeyEnabled: boolean;
        isSecurityQuestionsEnabled: boolean;
        serviceBlock: any | null;
    }
}

export interface UserActivityLog {
    id: string;
    timestamp: string;
    ipAddress?: string;
    activityType: string;
    details?: string;
    status: 'Success' | 'Failure' | 'Pending';
}


export interface PermissionSet {
    id: string;
    name: string;
    description: string;
    permissions: string[];
}

export interface UserPermissions {
    assignedPermissionSetIds: string[];
    restrictedPermissionSetIds: string[];
}
