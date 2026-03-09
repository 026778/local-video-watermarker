import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const targets = [
  {
    src: path.join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm'),
    dest: path.join(projectRoot, 'public', 'ffmpeg', 'core'),
  },
  {
    src: path.join(projectRoot, 'node_modules', '@ffmpeg', 'core-mt', 'dist', 'esm'),
    dest: path.join(projectRoot, 'public', 'ffmpeg', 'core-mt'),
  },
];

const copyDirRecursive = (srcDir, destDir) => {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    throw new Error(`Missing source folder: ${src}`);
  }
  copyDirRecursive(src, dest);
  console.log(`Synced: ${src} -> ${dest}`);
}
