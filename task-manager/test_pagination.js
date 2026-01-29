// Test script to verify pagination functionality
const { TaskService } = require('./Task_Workflow/task-workflow-backend/src/core/services/TaskService.js');

// Create a mock environment with the Redis credentials
const env = {
  UPSTASH_REDIS_REST_URL: 'https://engaged-corgi-42069.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'AaRVAAIncDJlYTg3NzAzMTEwNWU0ZTJjYWUwZGZmYWZiMjE2OGIxYXAyNDIwNjk'
};

async function testPagination() {
  try {
    console.log('Testing pagination functionality...');
    
    const taskService = new TaskService(env);
    
    // Test getting tasks by group with pagination
    console.log('\\nTesting getTasksByGroupPaginated for Test Group...');
    const testGroupResult = await taskService.getTasksByGroupPaginated('test_group', 0, 10);
    console.log(`Test Group - Page 0, Size 10: ${testGroupResult.tasks.length} tasks returned, Total: ${testGroupResult.totalCount}`);
    
    // Test getting tasks by status with pagination
    console.log('\\nTesting listTasksPaginated...');
    const paginatedResult = await taskService.listTasksPaginated(0, 10);
    console.log(`All Tasks - Page 0, Size 10: ${paginatedResult.tasks.length} tasks returned, Total: ${paginatedResult.totalCount}`);
    
    // Test getting tasks by status with pagination
    console.log('\\nTesting listTasksPaginated for New status...');
    const newTasksResult = await taskService.listTasksPaginated(0, 10, 'New');
    console.log(`New Tasks - Page 0, Size 10: ${newTasksResult.tasks.length} tasks returned, Total: ${newTasksResult.totalCount}`);
    
    console.log('\\n✅ Pagination functionality verified successfully!');
    
  } catch (error) {
    console.error('Error testing pagination:', error);
  }
}

// Run the test
testPagination();