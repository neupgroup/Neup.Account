import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Resolves a path relative to the application's base path.
 * If NEXT_PUBLIC_BASE_PATH is set, it prepends it to the path.
 * Ensures only one leading slash.
 */
export function resolvePath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!basePath) return path;
  
  // Normalize path to start with / if it doesn't
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Normalize basePath to start with / and not end with /
  const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const cleanBase = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase;
  
  return `${cleanBase}${normalizedPath}`;
}
