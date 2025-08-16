
"use client";

import { GeolocationProvider } from "./geolocation-context";

export function GeolocationClientProvider({ children }: { children: React.ReactNode }) {
    return <GeolocationProvider>{children}</GeolocationProvider>;
}
