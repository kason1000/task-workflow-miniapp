import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update the version.json file with the current version
const versionFile = path.join(__dirname, '../VERSION');
const versionJsonFile = path.join(__dirname, '../public/version.json');

try {
  // Read current version
  const currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
  
  // Create version.json content
  const versionJson = {
    version: currentVersion,
    timestamp: new Date().toISOString()
  };
  
  // Write version.json
  fs.writeFileSync(versionJsonFile, JSON.stringify(versionJson, null, 2));
  
  console.log(`Version updated to ${currentVersion}`);
} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}