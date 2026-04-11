import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VersionManager {
  constructor() {
    this.versionFile = path.join(__dirname, '../VERSION');
    this.packageJsonFile = path.join(__dirname, '../package.json');
    this.packageLockFile = path.join(__dirname, '../package-lock.json');
    this.publicVersionFile = path.join(__dirname, '../public/version.json');
    this.indexHtmlFile = path.join(__dirname, '../index.html');
  }

  readVersion() {
    return fs.readFileSync(this.versionFile, 'utf8').trim();
  }

  incrementVersion(currentVersion, type = 'build') {
    const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d{4})$/);

    if (!match) {
      throw new Error(`Invalid version format: ${currentVersion}. Expected x.x.xxxx`);
    }

    let [, major, minor, build] = match;
    let majorNum = Number(major);
    let minorNum = Number(minor);
    let buildNum = Number(build);

    switch (type) {
      case 'major':
        majorNum += 1;
        minorNum = 0;
        buildNum = 1;
        break;
      case 'minor':
        minorNum += 1;
        buildNum = 1;
        break;
      case 'patch':
      case 'build':
      default:
        buildNum += 1;
        break;
    }

    return `${majorNum}.${minorNum}.${String(buildNum).padStart(4, '0')}`;
  }

  writeVersionArtifacts(version, timestamp = new Date().toISOString()) {
    fs.writeFileSync(this.versionFile, version);

    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonFile, 'utf8'));
    packageJson.version = version;
    fs.writeFileSync(this.packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`);

    if (fs.existsSync(this.packageLockFile)) {
      const packageLock = JSON.parse(fs.readFileSync(this.packageLockFile, 'utf8'));
      packageLock.version = version;
      if (packageLock.packages?.['']) {
        packageLock.packages[''].version = version;
      }
      fs.writeFileSync(this.packageLockFile, `${JSON.stringify(packageLock, null, 2)}\n`);
    }

    const versionPayload = {
      version,
      timestamp,
    };
    fs.writeFileSync(this.publicVersionFile, `${JSON.stringify(versionPayload, null, 2)}\n`);

    let htmlContent = fs.readFileSync(this.indexHtmlFile, 'utf8');
    htmlContent = htmlContent.replace(
      /(<title>Task Workflow - Clawd v)[^<]+(<\/title>)/,
      `$1${version}$2`
    );
    fs.writeFileSync(this.indexHtmlFile, htmlContent);
  }

  updateVersion(type = 'build') {
    const currentVersion = this.readVersion();
    const newVersion = this.incrementVersion(currentVersion, type);
    const timestamp = new Date().toISOString();

    this.writeVersionArtifacts(newVersion, timestamp);

    return {
      oldVersion: currentVersion,
      newVersion,
      timestamp,
    };
  }

  syncVersion() {
    const version = this.readVersion();
    const existingTimestamp = fs.existsSync(this.publicVersionFile)
      ? JSON.parse(fs.readFileSync(this.publicVersionFile, 'utf8')).timestamp
      : new Date().toISOString();

    this.writeVersionArtifacts(version, existingTimestamp || new Date().toISOString());

    return { version, timestamp: existingTimestamp };
  }
}

if (process.argv[1] === __filename) {
  const manager = new VersionManager();
  const command = process.argv[2] || 'build';

  try {
    if (command === 'sync') {
      const result = manager.syncVersion();
      console.log(result.version);
    } else {
      const result = manager.updateVersion(command);
      console.log(result.newVersion);
    }
  } catch (error) {
    console.error('Error managing version:', error.message);
    process.exit(1);
  }
}

export default VersionManager;
