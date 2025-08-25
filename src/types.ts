
export type UserSession = {
    id: string;
    ipAddress: string;
    userAgent: string;
    lastLoggedIn: string;
    loginType: string;
    geolocation?: string;
    rawLastLoggedIn: Date;
};
