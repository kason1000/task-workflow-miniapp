const versionUrl = `${import.meta.env.BASE_URL}version.json`;

export const getAppVersion = async (): Promise<string> => {
  try {
    const response = await fetch(versionUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load version: ${response.status}`);
    }

    const versionData = await response.json();
    return versionData.version || 'unknown';
  } catch {
    return 'unknown';
  }
};

export const getAppVersionSync = (): string => 'unknown';
