// Client-side security check utilities.
// Used by auth pages to block authentication on insecure connections.

// Returns true if the current browser context is considered secure.
// HTTPS pages and secure contexts (e.g. localhost over HTTPS) return true.
// Plain HTTP — including localhost over HTTP — returns false.
export function isConnectionSecure(): boolean {
  if (typeof window === 'undefined') return true;
  
  // Treat any HTTP connection as insecure, even on localhost
  if (window.location.protocol === 'http:') {
    return false;
  }
  
  return window.isSecureContext;
}
