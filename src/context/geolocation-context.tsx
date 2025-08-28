
"use client";

import { createContext, useState, useEffect, type ReactNode } from 'react';

type GeolocationState = {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
};

export const GeolocationContext = createContext<GeolocationState | undefined>(undefined);

export const GeolocationProvider = ({ children }: { children: ReactNode }) => {
  const [location, setLocation] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(l => ({ ...l, error: 'Geolocation is not supported by your browser.' }));
      return;
    }

    const successHandler = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
      });
    };

    const errorHandler = (error: GeolocationPositionError) => {
      setLocation(l => ({ ...l, error: error.message }));
    };

    const options = {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 3600000 // 1 hour
    };

    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, options);
  }, []);

  return (
    <GeolocationContext.Provider value={location}>
      {children}
    </GeolocationContext.Provider>
  );
};
