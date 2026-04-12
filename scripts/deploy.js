import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFile = path.join(__dirname, '../VERSION');

try {
  // Bump version
  const oldVersion = fs.readFileSync(versionFile, 'utf8').trim();
  const newVersion = execSync('node scripts/version-manager.js build', { encoding: 'utf8' }).trim();

  // Build
  console.log(`\n📦 Building v${newVersion}...`);
  execSync('npm run build', { stdio: 'inherit' });

  // Deploy to GitHub Pages
  console.log('\n🚀 Publishing to GitHub Pages...');
  execSync('npx gh-pages -d dist', { stdio: 'inherit' });

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Miniapp deployed successfully!`);
  console.log(`📦 Version: ${newVersion}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
} catch (error) {
  console.error('❌ Deploy failed:', error.message);
  process.exit(1);
}
