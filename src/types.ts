
export type Session = {
  accountId: string;
  sessionId: string;
  sessionKey: string;
};

export type StoredAccount = {
  accountId: string;
  sessionId: string;
  sessionKey: string;
  neupId?: string;
  expired: boolean;
  active: boolean;
  isBrand?: boolean;
};

export type Application = {
  id: string;
  name: string;
  description: string;
  appSecret?: string; // Optional for client-side usage
  party?: 'first' | 'third';
  slug?: string;
  dataAccessed?: string[];
  icon?: 'app-window' | 'building' | 'bar-chart' | 'share-2';
};

export type Permission = {
  id: string;
  name: string; // e.g. property_ReadWrite
  app_id: string; // e.g. neup_console
  access: string[]; // e.g. ["property.read", "property.write"]
  description: string;
  intended_for: 'individual' | 'brand' | 'dependent' | 'branch' | 'root';
};

export type NotificationCreate = {
    recipient_id: string;
    action: string; // e.g., 'request.family_invitation', 'warning.sticky', 'informative.login'
    message: string;
    requestId?: string;
    sender_id?: string;
    persistence?: 'dismissable' | 'untildays' | 'permanent';
    noticeType?: 'general' | 'success' | 'warning' | 'error';
    reason?: string;
    expiresOn?: Date | null;
}

export type Notification = {
  id: string; // notification doc id
  requestId?: string; // Only for request-based notifications
  action: string;
  senderId?: string;
  senderName?: string;
  senderNeupId?: string;
  isRead: boolean;
  createdAt: string;
  message?: string;
  persistence?: 'dismissable' | 'untildays' | 'permanent';
  noticeType?: 'general' | 'success' | 'warning' | 'error';
  deletableOn?: string | null;
};

export type AllNotifications = {
  sticky: Notification[];
  requests: Notification[];
  other: Notification[];
};

export type Invitation = {
    notificationId: string;
    requestId: string;
    action: string;
    senderId: string;
    senderName: string;
    senderNeupId: string;
    createdAt: string;
};

export type KycRequest = {
    id: string; // The document id in the kyc collection
    accountId: string;
    userFullName: string;
    userNeupId: string;
    documentType: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    documentPhotoUrl: string;
    selfiePhotoUrl: string;
};

export type VerificationRequest = {
    id: string;
    accountId: string;
    fullName: string;
    neupId: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
};


export type PendingNeupIdRequest = {
    id: string;
    userFullName: string;
    requestedNeupId: string;
    requestDate: string;
    status: string;
    currentNeupIds: string[];
    accountId: string;
};

export type SocialLink = {
    id: string;
    type: 'instagram' | 'linkedin' | 'twitter' | 'facebook' | 'whatsapp' | 'other';
    url: string;
    isVisible: boolean;
};

export type SystemError = {
    id: string;
    type: 'ai' | 'database' | 'validation' | 'auth' | 'unknown';
    context: string;
    message: string;
    timestamp: string;
    status: 'new' | 'in_progress' | 'solved';
};

export type SystemErrorDetails = SystemError & {
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
    problemLevel?: 'hot' | 'warm' | 'cold';
};

export type BugReport = {
    id: string;
    title: string;
    reportedBy: string;
    createdAt: string;
    status: 'new' | 'in_progress' | 'solved';
};

export type BugReportDetails = BugReport & {
    description: string;
    reporterId: string;
}


export type ActivityLog = {
    id: string;
    user: string;
    neupId: string;
    action: string;
    status: string;
    timestamp: string;
};

export type UserActivityLog = {
    id: string;
    action: string;
    status: string;
    ip: string;
    timestamp: string;
    geolocation?: string;
    rawTimestamp: Date;
};

export type UserPermissions = {
    assignedPermissionSetIds: string[];
    restrictedPermissionSetIds: string[];
    allPermissions: string[];
};

export type FamilyMember = {
  accountId: string;
  neupId: string;
  displayName: string;
  displayPhoto?: string;
  status: 'pending' | 'approved';
  hidden: boolean;
  addedBy: string;
};

export type FamilyGroup = {
  id: string; // family doc id
  createdBy: string;
  members: FamilyMember[];
};

export type UserAccess = {
  permitId: string; // The document ID from 'permit' collection
  userId: string; // The user ID who has access
  displayName: string;
  displayPhoto?: string;
  permissions: string[];
  status: 'pending' | 'approved' | 'rejected';
};

export type AccessDetails = {
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
};

export type SearchResult = {
    id: string;
    type: 'user' | 'permission';
    title: string;
    description: string;
    url: string;
};

export type UserDashboardStats = {
    lastIpAddress: string;
    lastLocation: string;
    lastActive: string;
};

export type UserStats = {
  totalUsers: number;
  activeUsers: number;
  signedUpToday: number;
};

export type UserDetails = {
    accountId: string;
    neupId: string;
    profile: import('@/lib/user').UserProfile;
    accountType?: string;
};

export type AccountDetails = {
    block: {
        status: boolean;
        reason?: string;
        message?: string;
        is_permanent?: boolean;
        until?: string | null;
    } | null;
};

export type BrandAccount = {
    id: string;
    name: string;
    logoUrl?: string;
    plan: string;
};

export type DeletionRequest = {
  accountId: string;
  userFullName: string;
  userNeupId: string;
  requestedAt: string;
};
