const fs = require('fs');
const path = require('path');

class MiniAppVersionManager {
  constructor() {
    this.packageJsonPath = path.join(__dirname, '../package.json');
    this.appTsPath = path.join(__dirname, '../src/App.tsx');
    this.indexHtmlPath = path.join(__dirname, '../index.html');
  }

  getCurrentVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      return packageJson.version || '1.0.0000';
    } catch (error) {
      console.error('Error reading package.json:', error);
      return '1.0.0000';
    }
  }

  updateVersion() {
    const currentVersion = this.getCurrentVersion();
    
    // Parse version in format x.x.xxxx (e.g., 1.1.0001)
    const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d{4})$/);
    let major, minor, patchStr;
    
    if (match) {
      [, major, minor, patchStr] = match;
      major = parseInt(major);
      minor = parseInt(minor);
      let patch = parseInt(patchStr);
      patch++; // increment patch
      patchStr = String(patch).padStart(4, '0');
    } else {
      // If format doesn't match, start with 1.0.0001
      major = 1;
      minor = 0;
      patchStr = '0001';
    }
    
    const newVersion = `${major}.${minor}.${patchStr}`;
    
    // Update package.json
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    // Update version in App.tsx
    let appContent = fs.readFileSync(this.appTsPath, 'utf8');
    // Replace the version in the JSX structure we created
    appContent = appContent.replace(
      /(<span style={{\s*fontSize:\s*'10px',\s*color:\s*'var\(--tg-theme-hint-color\)',\s*marginTop:\s*'2px'\s*}}>\s*v)[^<]+(<\/span>)/,
      `$1${newVersion}$2`
    );
    fs.writeFileSync(this.appTsPath, appContent);
    
    // Update version in index.html
    let htmlContent = fs.readFileSync(this.indexHtmlPath, 'utf8');
    htmlContent = htmlContent.replace(
      /(<title>Task Workflow - Clawd v)[^<]+(<\/title>)/,
      `$1${newVersion}$2`
    );
    fs.writeFileSync(this.indexHtmlPath, htmlContent);
    
    console.log(`✅ MiniApp version updated: ${currentVersion} -> ${newVersion}`);
    
    return {
      oldVersion: currentVersion,
      newVersion: newVersion
    };
  }
}

// Command line interface
if (require.main === module) {
  const vm = new MiniAppVersionManager();
  
  try {
    const result = vm.updateVersion();
    console.log(result.newVersion);
  } catch (error) {
    console.error('Error updating version:', error.message);
    process.exit(1);
  }
}

module.exports = MiniAppVersionManager;