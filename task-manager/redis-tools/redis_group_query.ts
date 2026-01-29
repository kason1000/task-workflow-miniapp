import { RedisClient } from './Task_Workflow\task-workflow-backend\src\core\repositories\RedisClient';

// Load environment variables
const env = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
};

async function queryAllGroups() {
  try {
    const redis = new RedisClient(env as any);
    
    // Get all keys that might contain group information
    // Look for patterns that might indicate group data
    const allKeys = await redis.list({ prefix: '*' });
    
    console.log('All Redis keys:');
    for (const keyObj of allKeys.keys) {
      console.log(`- ${keyObj.name}`);
    }
    
    // Look specifically for group-related keys
    const groupKeys = allKeys.keys.filter(key => 
      key.name.includes('group') || 
      key.name.includes('grp') ||
      key.name.startsWith('g_') ||
      key.name.startsWith('group_')
    );
    
    console.log('\nGroup-related keys:');
    for (const keyObj of groupKeys) {
      try {
        const value = await redis.get(keyObj.name);
        console.log(`\nKey: ${keyObj.name}`);
        console.log(`Value:`, value);
      } catch (err) {
        console.log(`Error reading key ${keyObj.name}:`, err.message);
      }
    }
    
    // If we don't find specific group patterns, try to get all values
    if (groupKeys.length === 0) {
      console.log('\nTrying to get common group storage patterns...');
      
      // Common patterns for group data
      const patterns = [
        'groups:*',
        'group:*',
        'groups_list',
        'all_groups',
        'team:*',
        'teams:*'
      ];
      
      for (const pattern of patterns) {
        try {
          const keys = await redis.list({ prefix: pattern });
          for (const keyObj of keys.keys) {
            const value = await redis.get(keyObj.name);
            console.log(`\nKey: ${keyObj.name}`);
            console.log(`Value:`, value);
          }
        } catch (err) {
          console.log(`Pattern ${pattern} not found or error:`, err.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error querying Redis:', error);
  }
}

// Run the query
queryAllGroups();