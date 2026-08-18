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
    // Some variables might be like "showDeleteModal && selectedItem"
    // So let's match `{show...Modal && (` or `{show...Modal && ... && (`
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
        
        // Find the matching `)}` at the end
        // Let's replace the front part
        modalStr = modalStr.replace(
          regex,
          '{$1 && typeof document !== "undefined" && createPortal('
        );
        
        // Replace the ending `)}` with `, document.body)}`
        // Actually the `}` is at the very end
        const lastParenIdx = modalStr.lastIndexOf(')');
        modalStr = modalStr.substring(0, lastParenIdx) + ', document.body)' + modalStr.substring(lastParenIdx + 1);
        
        code = before + modalStr + after;
      }
    }
  });

  // Let's fix the centering issues as well
  // <div className="fixed inset-0 z-50 flex items-center justify-center p-X bg-slate-900/60 backdrop-blur-xs animate-fade-in">
  // Change to:
  // <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-fade-in">\n <div className="flex min-h-full items-center justify-center p-X">
  // We need to also close the div.
  
  // Actually, replacing with React portal already fixes the viewport issue!
  // The viewport is fixed to the `window` when it's appended to `document.body` because `body` has no transforms!
  // BUT what if the modal is larger than the screen? It'll get cut off. So the `overflow-y-auto` structure is still better.
  
  // We will do `overflow-y-auto` replacements using sed separately if needed, but portal alone fixes the "have to scroll to find the popup" issue.
  
  fs.writeFileSync(filePath, code);
}

// DatabaseMasterModule
addCreatePortal('src/components/logistics/DatabaseMasterModule.tsx', [
  'showFormModal', 'showDistributorModal', 'showUploadModal', 'showDeleteModal'
]);

// PenyiapanModule
addCreatePortal('src/components/logistics/PenyiapanModule.tsx', [
  'showFormModal', 'showExcelModal', 'showDetailModal', 'showDeleteModal'
]);

// IncomingModule
addCreatePortal('src/components/logistics/IncomingModule.tsx', [
  'showFormModal', 'showDetailModal', 'showScannerModal', 'showExcelModal', 'showDeleteModal'
]);

// PromosiModule
addCreatePortal('src/components/logistics/PromosiModule.tsx', [
  'showFormModal', 'showDeleteModal' // wait, promosi only has showFormModal right now, let's check
]);

// SuratJalanModule
addCreatePortal('src/components/logistics/SuratJalanModule.tsx', [
  'showFormModal', 'showDetailModal', 'showScannerModal', 'showDeleteModal'
]);

// QrGeneratorHoneywellModule
addCreatePortal('src/components/logistics/QrGeneratorHoneywellModule.tsx', [
  'showDetailModal', 'showDeleteModal'
]);

