// Utility to get the application version
// Tries multiple methods to retrieve the current version

export const getAppVersion = async (): Promise<string> => {
  try {
    // Try to get version from the public version.json file
    const response = await fetch('./version.json');
    const versionData = await response.json();
    return versionData.version || '1.1.0001';
  } catch (error) {
    // Fallback to a default version if version.json is not available
    return '1.1.0001';
  }
};

// Synchronous version for immediate use (will return default if async not ready)
export const getAppVersionSync = (): string => {
  // This will be the default; actual version should be retrieved asynchronously
  return '1.1.0001';
};