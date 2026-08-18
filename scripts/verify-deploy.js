import fs from 'fs';
import path from 'path';

const indexPath = path.resolve('dist', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('Error: dist/index.html not found after build.');
  process.exit(1);
}

const stats = fs.statSync(indexPath);
if (stats.size === 0) {
  console.error('Error: dist/index.html is empty.');
  process.exit(1);
}

console.log('Verification successful: dist/index.html exists and is valid.');
process.exit(0);
