const fs = require('fs');

const files = [
  'src/components/common/SupabaseConnectionModal.tsx',
  'src/components/broadcast/FloatingRobotBroadcast.tsx',
  'src/components/broadcast/BroadcastModal.tsx',
  'src/components/auth/InactivityWarningModal.tsx',
  'src/components/profile/AvatarPickerModal.tsx'
];

files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');

  if (!code.includes('createPortal')) {
    code = "import { createPortal } from 'react-dom';\n" + code;
  }

  // Find the first `return (` which is followed by `<div` with `fixed inset-0` inside it
  const match = code.match(/return\s*\(\s*<div\s+className="[^"]*fixed inset-0/s);
  if (match) {
    code = code.replace(
      match[0], 
      match[0].replace(/return\s*\(\s*/, 'return typeof document !== "undefined" ? createPortal(\n    ')
    );

    const lastParenIdx = code.lastIndexOf(');');
    if (lastParenIdx !== -1) {
      code = code.substring(0, lastParenIdx) + ', document.body) : null;' + code.substring(lastParenIdx + 2);
    }
    
    fs.writeFileSync(f, code);
    console.log(`Processed ${f}`);
  } else {
    console.log(`No match in ${f}`);
  }
});
