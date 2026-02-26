import { z } from 'zod';

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
    sessionId?: string;
    sessionKey?: string;
    neupId: string;
    expired: boolean;
    active: boolean; // Add active flag
};

// Temporary types until schemas are created
export type RegistrationData = any;
export type ProfileData = any;
export type SecurityQuestionData = any;

// --- User & Profile ---

export type NeupId = {
    id: string;
    for: string;
    isPrimary: boolean;
}

// --- Root & Management ---

export interface UserDetails {
    accountId: string;
    neupId: string;
    profile: any;
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
    activityType?: string;
    details?: string;
    status: 'Success' | 'Failure' | 'Pending';
}

export interface Permission {
    id: string;
    name: string;
}

export interface UserPermissions {
    assignedPermissions: string[];
    restrictedPermissions: string[];
    allPermissions: string[];
}

export interface SystemError {
    id: string;
    type: string;
    context: string;
    message: string;
    timestamp: string;
    status: string;
}

export interface SystemErrorDetails extends SystemError {
    fullError: string;
    user?: {
        name: string;
        neupId: string;
    };
    ipAddress?: string;
    geolocation?: string;
    reproSteps?: string;
    solution?: string;
    solvedBy?: string;
    problemLevel?: string;
}

export interface BugReport {
    id: string;
    reportedBy: string;
    title: string;
    description: string;
    createdAt: string;
    status: string;
}

export interface BugReportDetails extends BugReport {
    reporterId?: string;
}

export interface UserAccess {
    permitId: string;
    userId: string;
    displayName: string;
    accountPhoto?: string;
    permissions: string[];
    status: 'pending' | 'approved' | 'rejected';
}

export interface AccessDetails {
    permitId: string;
    grantedTo: {
        id: string;
        name: string;
        neupId: string;
    };
    grantedBy: {
        id: string;
        name: string;
    };
    grantedOn: string;
    permissions: string[];
}

export interface Application {
    id: string;
    name: string;
    party: 'first' | 'third';
    description: string;
    icon?: "app-window" | "building" | "bar-chart" | "share-2";
    website?: string;
    developer?: string;
}

export interface KycRequest {
    id: string;
    accountId: string;
    userFullName: string;
    userNeupId: string;
    documentType: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
    documentPhotoUrl: string;
    selfiePhotoUrl: string;
}

export interface VerificationRequest {
    id: string;
    accountId: string;
    fullName: string;
    neupId: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
}