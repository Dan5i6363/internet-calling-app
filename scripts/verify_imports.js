const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function resolveImport(sourceFile, importSpecifier) {
  let basePath;
  if (importSpecifier.startsWith('@/')) {
    basePath = path.join(SRC, importSpecifier.substring(2));
  } else if (importSpecifier.startsWith('.')) {
    basePath = path.join(path.dirname(sourceFile), importSpecifier);
  } else {
    // External package (e.g., 'react', 'next/server', 'lucide-react')
    return { ok: true, external: true };
  }

  for (const ext of EXTENSIONS) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      // Check exact casing on disk
      const dir = path.dirname(candidate);
      const base = path.basename(candidate);
      const actualEntries = fs.readdirSync(dir);
      if (actualEntries.includes(base)) {
        return { ok: true, resolvedPath: candidate };
      } else {
        return { ok: false, error: `Casing mismatch for ${base} in ${dir}` };
      }
    }
  }

  return { ok: false, error: `Cannot resolve import "${importSpecifier}" from ${path.relative(ROOT, sourceFile)}` };
}

console.log('=== Verifying all local imports across src/ ===');
const allSourceFiles = getFiles(SRC);
let totalImportsChecked = 0;
let errorsFound = [];

const IMPORT_REGEX = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

for (const filePath of allSourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const importSpecifier = match[1] || match[2];
    if (importSpecifier.startsWith('.') || importSpecifier.startsWith('@/')) {
      totalImportsChecked++;
      const result = resolveImport(filePath, importSpecifier);
      if (!result.ok) {
        errorsFound.push({
          file: path.relative(ROOT, filePath),
          specifier: importSpecifier,
          error: result.error,
        });
      }
    }
  }
}

console.log(`Total local imports checked: ${totalImportsChecked}`);
if (errorsFound.length > 0) {
  console.error(`FAILED: ${errorsFound.length} import resolution error(s) found:`);
  for (const err of errorsFound) {
    console.error(`  - In ${err.file}: ${err.specifier} -> ${err.error}`);
  }
  process.exit(1);
} else {
  console.log(`PASSED: All ${totalImportsChecked} local imports resolve cleanly to actual files on disk.`);
  process.exit(0);
}
