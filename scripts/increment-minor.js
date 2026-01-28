import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFile = path.join(__dirname, '../VERSION');

function incrementVersion(currentVersion, type) {
  const parts = currentVersion.split('.');
  let major = parseInt(parts[0]);
  let minor = parseInt(parts[1]);
  let build = parseInt(parts[2]);

  switch (type) {
    case 'major':
      major++;
      minor = 0;
      build = 1;
      break;
    case 'minor':
      minor++;
      build = 1;
      break;
    case 'patch': // treat same as build for our x.x.xxxx format
    case 'build':
    default:
      build = build + 1;
      break;
  }

  // Format build number to 4 digits
  const formattedBuild = String(build).padStart(4, '0');
  return `${major}.${minor}.${formattedBuild}`;
}

try {
  // Read current version
  let currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
  
  // Increment version
  const newVersion = incrementVersion(currentVersion, 'minor');
  
  // Write new version back to file
  fs.writeFileSync(versionFile, newVersion);
  
  console.log(newVersion);
  
  // Also update package.json with the new version
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  
} catch (error) {
  console.error('Error managing version:', error);
  process.exit(1);
}