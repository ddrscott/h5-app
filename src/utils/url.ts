/**
 * URL utility functions for generating links
 */

/**
 * Get the base web URL from environment or default
 */
export function getWebUrl(): string {
  return process.env.WEB_URL || `http://localhost:${process.env.PORT || 2567}`;
}

/**
 * Generate a room join URL
 */
export function getRoomJoinUrl(roomId: string): string {
  const baseUrl = getWebUrl();
  return `${baseUrl}/?room=${roomId}`;
}

/**
 * Generate a shareable game invite link
 */
export function getInviteUrl(roomId: string, roomName?: string): string {
  const baseUrl = getWebUrl();
  const url = new URL(baseUrl);
  url.pathname = '/';
  url.searchParams.set('room', roomId);
  if (roomName) {
    url.searchParams.set('name', roomName);
  }
  return url.toString();
}

/**
 * Generate API endpoint URLs
 */
export function getApiUrl(path: string): string {
  const baseUrl = getWebUrl();
  return `${baseUrl}${path}`;
}