"use client";

import {useContext} from 'react';
import {GeolocationContext} from '@/core/providers/geolocation-context';
import {logActivity} from '@/lib/log-actions';


// Client-side hook to wrap logActivity and inject geolocation
export function useLogActivity() {
    const geo = useContext(GeolocationContext);

    return (
        targetAccountId: string,
        action: string,
        status: "Success" | "Failed" | "Pending" | "Alert",
        ipAddress?: string,
        actorAccountId?: string
    ) => {
        const locationString = geo?.latitude && geo?.longitude
            ? `${geo.latitude},${geo.longitude}`
            : undefined;

        return logActivity(targetAccountId, action, status, ipAddress, actorAccountId, locationString);
    };
}
