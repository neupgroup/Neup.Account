export function isConnectionSecure(): boolean {
  if (typeof window === 'undefined') return true;
  
  // If protocol is HTTP, consider it unsecure (even for localhost)
  if (window.location.protocol === 'http:') {
    return false;
  }
  
  return window.isSecureContext;
}
