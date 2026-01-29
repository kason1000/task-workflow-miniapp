// Simple script to connect directly to Redis and query group information
const { Redis } = require('@upstash/redis');

// Create Redis client with the credentials
const redis = new Redis({
  url: 'https://engaged-corgi-42069.upstash.io',
  token: 'AaRVAAIncDJlYTg3NzAzMTEwNWU0ZTJjYWUwZGZmYWZiMjE2OGIxYXAyNDIwNjk'
});

async function queryGroups() {
  try {
    console.log('Connecting to Redis and fetching group information...');
    
    // Get the group index to see what groups exist
    console.log('\\n1. Fetching group index...');
    const groupIndex = await redis.get('index:groups');
    console.log('Group index:', groupIndex);
    
    if (groupIndex && Array.isArray(groupIndex) && groupIndex.length > 0) {
      console.log(`\\n2. Found ${groupIndex.length} groups in index. Fetching details...`);
      
      for (const groupId of groupIndex) {
        console.log(`\\nFetching details for group: ${groupId}`);
        const groupData = await redis.get(`group:${groupId}`);
        console.log('Group data:', JSON.stringify(groupData, null, 2));
      }
    } else {
      console.log('\\n2. No groups found in index. Looking for individual group keys...');
      
      // Look for any keys that might contain group information
      const keys = await redis.keys('group:*');
      console.log(`Found ${keys.length} group-related keys:`, keys);
      
      for (const key of keys) {
        const groupData = await redis.get(key);
        console.log(`\\n${key}:`, JSON.stringify(groupData, null, 2));
      }
    }
    
    // Also look for any other group-related keys
    console.log('\\n3. Looking for other group-related keys...');
    const allKeys = await redis.keys('*');
    const groupLikeKeys = allKeys.filter(key => 
      key.toLowerCase().includes('group') || 
      key.toLowerCase().includes('grp') ||
      key.startsWith('g_')
    );
    
    console.log(`Found ${groupLikeKeys.length} potentially group-related keys:`, groupLikeKeys);
    
    for (const key of groupLikeKeys) {
      if (!key.startsWith('group:') && !key.includes('index:groups')) {
        const data = await redis.get(key);
        console.log(`\\n${key}:`, JSON.stringify(data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error querying Redis:', error);
    console.error('Error details:', error.message, error.stack);
  } finally {
    console.log('\\nDone.');
  }
}

// Run the query
queryGroups();