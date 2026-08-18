const fs = require('fs');

function addCreatePortalToReturn(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  if (!code.includes('createPortal')) {
    code = code.replace(
      /import React([^;]*);/,
      "import React$1;\nimport { createPortal } from 'react-dom';"
    );
  }

  // Look for `return (` where the next substantive tag is `<div className="fixed inset-0` or similar overlay.
  // Actually, we can just replace the very first `return (` that is after the component declaration.
  // But wait, there might be early returns.
  // We can just use a regex for `return (\n    <div className="fixed inset-0`
  const regex = /return \(\s*<div className="fixed inset-0/g;
  
  code = code.replace(regex, 'return typeof document !== "undefined" ? createPortal(\n    <div className="fixed inset-0');
  
  if (code.includes('createPortal(\n    <div className="fixed inset-0')) {
    // We need to replace the last `);` of the component with `, document.body) : null;`
    // The safest way is to find the LAST `);` that matches the component's main return.
    const lastParenIdx = code.lastIndexOf(');');
    if (lastParenIdx !== -1) {
      code = code.substring(0, lastParenIdx) + ', document.body) : null;' + code.substring(lastParenIdx + 2);
    }
    fs.writeFileSync(filePath, code);
    console.log(`Processed ${filePath}`);
  } else {
    console.log(`Failed to process ${filePath} - maybe different format`);
  }
}

const files = [
  'src/components/logistics/LogisticsModal.tsx',
  'src/components/QrGeneratorModal.tsx',
  'src/components/LoginModal.tsx',
  'src/components/common/SupabaseConnectionModal.tsx',
  'src/components/broadcast/FloatingRobotBroadcast.tsx',
  'src/components/broadcast/BroadcastModal.tsx',
  'src/components/auth/InactivityWarningModal.tsx',
  'src/components/profile/AvatarPickerModal.tsx',
  'src/components/LinkModal.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) addCreatePortalToReturn(f);
});

