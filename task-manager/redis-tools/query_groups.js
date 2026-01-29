// Simple script to query groups from Redis
const { GroupRepository } = require('./Task_Workflow/task-workflow-backend/src/core/repositories/GroupRepository.js');

// Create a mock environment with the Redis credentials
const env = {
  UPSTASH_REDIS_REST_URL: 'https://engaged-corgi-42069.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'AaRVAAIncDJlYTg3NzAzMTEwNWU0ZTJjYWUwZ...'
};

async function queryGroups() {
  try {
    const groupRepo = new GroupRepository(env);
    
    console.log('Fetching all groups...');
    const groups = await groupRepo.list();
    
    console.log(`Found ${groups.length} groups:`);
    for (const group of groups) {
      console.log('');
      console.log(`ID: ${group.id}`);
      console.log(`Name: ${group.name}`);
      console.log(`Created By: ${group.createdBy}`);
      console.log(`Created At: ${group.createdAt}`);
      console.log(`Is Default: ${group.isDefault}`);
      console.log(`Lead User IDs: [${group.leadUserIds.join(', ')}]`);
      console.log(`Members Count: ${group.members.length}`);
      console.log(`Telegram Chat ID: ${group.telegramChatId || 'None'}`);
      
      if (group.members.length > 0) {
        console.log('Members:');
        for (const member of group.members) {
          console.log(`  - User ID: ${member.userId}, Role: ${member.role}, Joined: ${member.joinedAt}`);
        }
      }
      console.log('---');
    }
    
  } catch (error) {
    console.error('Error querying groups:', error);
  }
}

// Run the query
queryGroups();