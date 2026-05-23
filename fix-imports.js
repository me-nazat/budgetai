const fs = require('fs');
const path = require('path');

const filesToFix = [
  "app/src/app/api/notifications/route.ts",
  "app/src/app/api/recurring/route.ts",
  "app/src/app/api/market/route.ts",
  "app/src/app/api/budgets/route.ts",
  "app/src/app/api/categories/route.ts",
  "app/src/app/api/networth/route.ts",
  "app/src/app/api/transactions/route.ts",
  "app/src/app/api/transactions/batch-sync/route.ts",
  "app/src/app/api/files/[fileToken]/route.ts",
  "app/src/app/api/goals/route.ts",
  "app/src/app/api/dashboard/route.ts",
  "app/src/app/api/transactions/[transactionId]/attachments/route.ts",
  "app/src/app/api/chat/route.ts",
  "app/src/app/api/chat/save/route.ts",
  "app/src/app/api/chat/history/route.ts",
  "app/src/app/api/chat/confirm/route.ts",
  "app/src/app/api/settings/route.ts",
  "app/src/app/api/chat/messages/route.ts"
];

for (const file of filesToFix) {
  const fullPath = path.join(process.cwd(), file);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(/import \{ getSession \} from '@\/lib\/auth';/g, "import { getSession } from '@/lib/security/session-manager';");
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed', file);
}
