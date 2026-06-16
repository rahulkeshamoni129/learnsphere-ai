import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, 'node_modules/unplugin/dist');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Check if we contain import.meta.dirname
  if (content.includes('import.meta.dirname')) {
    console.log(`Patching import.meta.dirname in ${filePath}...`);
    
    // Inject the url import at the top of the file if it's not there
    if (!content.includes('node:url') && !content.includes('__fileURLToPath')) {
      // Find the first import statement or start of file
      const importIndex = content.indexOf('import ');
      if (importIndex !== -1) {
        content = 
          content.slice(0, importIndex) + 
          'import { fileURLToPath as __fileURLToPath } from "node:url";\n' + 
          content.slice(importIndex);
      } else {
        content = 'import { fileURLToPath as __fileURLToPath } from "node:url";\n' + content;
      }
    } else if (content.includes('node:url') && !content.includes('__fileURLToPath')) {
      // If node:url is imported but not as __fileURLToPath, we can just alias or use what is there.
      // But to be safe, let's inject our own helper.
      content = 'import { fileURLToPath as __fileURLToPath } from "node:url";\n' + content;
    }

    // Replace import.meta.dirname with fallback
    // We check if "path" is imported as "path" or if we can use a direct call.
    // In index.mjs, "path" is imported. But just to be robust, we can use "path.dirname"
    // which relies on "path" being imported, or we can use a fallback.
    // Since "path" is standard and imported in index.mjs, using "path.dirname" is safe.
    // Let's replace import.meta.dirname with (import.meta.dirname || path.dirname(__fileURLToPath(import.meta.url)))
    content = content.replace(/import\.meta\.dirname/g, '(import.meta.dirname || path.dirname(__fileURLToPath(import.meta.url)))');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully patched ${filePath}`);
  } else {
    console.log(`No patches needed for ${filePath}`);
  }
}

// Check all files in the target directory
if (fs.existsSync(targetDir)) {
  const files = fs.readdirSync(targetDir);
  for (const file of files) {
    if (file.endsWith('.mjs') || file.endsWith('.js')) {
      patchFile(path.join(targetDir, file));
    }
  }
} else {
  console.error(`Target directory not found: ${targetDir}`);
}
