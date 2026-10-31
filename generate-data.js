const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXCLUDE_PATTERNS = [
  'data.json',
  'index.html',
  'style.css',
  'generate-data.js',
  '.gitignore',
  '.nojekyll',
  'README.md',
  '*.json',
  '*.lock',
  'package.json',
  'package-lock.json',
];

// Set to true to only include files in the repo root (no subdirectories)
const ROOT_ONLY = true;

// Max characters in the preview card
const PREVIEW_LENGTH = 200;


// Convert a glob-ish pattern to a RegExp. Supports '*' only.
function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars (except *)
    .replace(/\*/g, '.*');                 // * → .*
  return new RegExp(`^${escaped}$`);
}

// Precompile patterns
const EXCLUDE_REGEXES = EXCLUDE_PATTERNS.map(patternToRegex);

function isExcluded(file) {
  const base = path.basename(file);
  // Match against both the full path and the basename
  return EXCLUDE_REGEXES.some(rx => rx.test(file) || rx.test(base));
}

function getGitData() {
  try {
    const logOutput = execSync(
      'git log --pretty=format:"%H|%an|%ae|%ad" --date=short --name-only',
      { encoding: 'utf-8' }
    );

    const commits = logOutput.split('\n\n').filter(Boolean);
    const fileAuthors = new Map();

    commits.forEach(commitBlock => {
      const lines = commitBlock.split('\n').filter(Boolean);
      if (lines.length === 0) return;

      const [hash, author, email, date] = lines[0].split('|');
      const files = lines.slice(1);

      files.forEach(file => {
        // Root-only filter
        if (ROOT_ONLY && file.includes('/')) return;

        // Exclusion filter
        if (isExcluded(file)) return;

        // Must exist on disk
        if (!fs.existsSync(file)) return;

        // Only record the FIRST author who touched the file
        if (!fileAuthors.has(file)) {
          fileAuthors.set(file, { author, email, date, file });
        }
      });
    });

    return Array.from(fileAuthors.values());
  } catch (error) {
    console.error('Error getting git data:', error.message);
    return [];
  }
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

function getPreview(content, maxLength = PREVIEW_LENGTH) {
  let text = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  return text;
}

function generateData() {
  const filesWithAuthors = getGitData();

  const data = filesWithAuthors.map(({ author, email, date, file }) => {
    const content = readFileContent(file);
    return {
      file,
      author,
      email,
      date,
      isMarkdown: file.endsWith('.md'),
      preview: getPreview(content),
      fullContent: content,
    };
  });

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log(`✔ Generated data.json with ${data.length} entries`);
  console.log(`  Excluded patterns: ${EXCLUDE_PATTERNS.join(', ')}`);
}

generateData();
