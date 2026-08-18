const fs = require('fs');

function addCreatePortal(filePath, variables) {
  let code = fs.readFileSync(filePath, 'utf8');

  if (!code.includes('createPortal')) {
    code = code.replace(
      /import React([^;]+);/,
      "import React$1;\nimport { createPortal } from 'react-dom';"
    );
  }

  variables.forEach(variableName => {
    const regex = new RegExp('{(' + variableName + '(?:\\s*&&\\s*[a-zA-Z0-9_]+)*)\\s*&&\\s*\\(');
    let match;
    let limit = 0;
    while ((match = regex.exec(code)) && limit < 10) {
      limit++;
      const startIdx = match.index;
      
      let braceCount = 0;
      let endIdx = -1;
      for (let i = startIdx; i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        if (code[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }
      
      if (endIdx !== -1) {
        const before = code.substring(0, startIdx);
        const after = code.substring(endIdx + 1);
        let modalStr = code.substring(startIdx, endIdx + 1);
        
        modalStr = modalStr.replace(
          regex,
          '{$1 && typeof document !== "undefined" && createPortal('
        );
        
        const lastParenIdx = modalStr.lastIndexOf(')');
        modalStr = modalStr.substring(0, lastParenIdx) + ', document.body)' + modalStr.substring(lastParenIdx + 1);
        
        code = before + modalStr + after;
      }
    }
  });

  fs.writeFileSync(filePath, code);
}

const lines = fs.readFileSync('modals.txt', 'utf8').split('\n');
const fileToModals = {};
for (const line of lines) {
  if (!line.trim()) continue;
  const parts = line.split(':');
  if (parts.length >= 2) {
    const filePath = parts[0];
    const rest = parts.slice(1).join(':');
    const match = rest.match(/\[([A-Za-z0-9_]+),\s*set/);
    if (match) {
      const modalVar = match[1];
      if (!fileToModals[filePath]) fileToModals[filePath] = [];
      fileToModals[filePath].push(modalVar);
    }
  }
}

for (const [filePath, vars] of Object.entries(fileToModals)) {
  if (fs.existsSync(filePath)) {
    console.log(`Processing ${filePath} for variables: ${vars.join(', ')}`);
    addCreatePortal(filePath, vars);
  }
}

