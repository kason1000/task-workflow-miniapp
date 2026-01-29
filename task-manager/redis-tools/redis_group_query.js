// Load environment variables
require('dotenv').config();

// Import the RedisClient
const { RedisClient } = require('./Task_Workflow/task-workflow-backend/src/core/repositories/RedisClient.js');

// Use the environment variables from wrangler configuration
const env = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || 'https://engaged-corgi-42069.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || 'AaRVAAIncDJlYTg3NzAzMTEwNWU0ZTJjYWUwZ...'
};

async function queryAllGroups() {
  try {
    const redis = new RedisClient(env);
    
    // Get all keys that might contain group information
    console.log('Fetching all keys from Redis...');
    const allKeysResult = await redis.list({ prefix: '*' });
    
    console.log('\nAll Redis keys:');
    for (const keyObj of allKeysResult.keys) {
      console.log(`- ${keyObj.name}`);
    }
    
    // Filter for group-related keys
    const groupKeys = allKeysResult.keys.filter(key => 
      key.name.toLowerCase().includes('group') || 
      key.name.toLowerCase().includes('grp') ||
      key.name.startsWith('g_') ||
      key.name.startsWith('group_')
    );
    
    console.log('\nGroup-related keys found:', groupKeys.length);
    for (const keyObj of groupKeys) {
      try {
        const value = await redis.get(keyObj.name);
        console.log(`\n--- Key: ${keyObj.name} ---`);
        console.log('Value:', JSON.stringify(value, null, 2));
      } catch (err) {
        console.log(`Error reading key ${keyObj.name}:`, err.message);
      }
    }
    
    // If no group keys found, look for other patterns
    if (groupKeys.length === 0) {
      console.log('\nNo specific group keys found. Looking for other patterns...');
      
      // Try to find any keys with 'group' in them regardless of position
      for (const keyObj of allKeysResult.keys) {
        try {
          if (keyObj.name.toLowerCase().includes('group')) {
            const value = await redis.get(keyObj.name);
            console.log(`\n--- Potential group key: ${keyObj.name} ---`);
            console.log('Value:', JSON.stringify(value, null, 2));
          }
        } catch (err) {
          console.log(`Error reading potential group key ${keyObj.name}:`, err.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error querying Redis:', error);
  }
}

// Run the query
queryAllGroups();