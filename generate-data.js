const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get git log with author info and changed files
function getGitData() {
  try {
    // Get commit history with author and files
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
        // Only process files in root (no directory separator) and skip data.json
        if (!file.includes('/') && file !== 'data.json' && fs.existsSync(file)) {
          if (!fileAuthors.has(file)) {
            fileAuthors.set(file, {
              author,
              email,
              date,
              file
            });
          }
        }
      });
    });

    return Array.from(fileAuthors.values());
  } catch (error) {
    console.error('Error getting git data:', error.message);
    return [];
  }
}

// Read file content (supports markdown and plain text)
function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

// Convert markdown to plain text preview (simple version)
function getPreview(content, maxLength = 200) {
  // Remove markdown syntax for preview
  let text = content
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  return text;
}

// Main function
function generateData() {
  const filesWithAuthors = getGitData();
  
  const data = filesWithAuthors.map(({ author, email, date, file }) => {
    const content = readFileContent(file);
    const isMarkdown = file.endsWith('.md');
    
    return {
      file,
      author,
      email,
      date,
      isMarkdown,
      preview: getPreview(content),
      fullContent: content
    };
  });

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log(`Generated data.json with ${data.length} entries`);
}

generateData();
