const fs = require('fs');

// 1. Fix src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/route.ts
let routeFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/route.ts';
let routeCode = fs.readFileSync(routeFile, 'utf-8');
routeCode = routeCode.replace(/from '\.\.\/\.\.\/tour-controller'/g, "from '../../../../tour-controller'");
routeCode = routeCode.replace(/import \{.*?\} from '@\/lib\/types';\n?/g, '');
fs.writeFileSync(routeFile, routeCode);

// 2. Fix src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts
let attachFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts';
let attachCode = fs.readFileSync(attachFile, 'utf-8');
attachCode = attachCode.replace(/import \{.*?\} from '@\/lib\/types';\n?/g, '');
fs.writeFileSync(attachFile, attachCode);

// 3. Fix src/app/(app)/tours/[id]/spendings/page.tsx
let pageFile = 'src/app/(app)/tours/[id]/spendings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf-8');
pageCode = pageCode.replace(
  "interface TourTransaction {",
  "interface TourTransaction {\n  paidByParticipantId?: number;"
);
pageCode = pageCode.replace(
  "paidBy: number;",
  "paidBy?: number;"
);
pageCode = pageCode.replace(
  /const res = await fetch\(`\/api\/bill-splits\/tours\/\$\{tour\.id\}\/spendings\/\$\{tx\.id\}`/g,
  "const res = await fetch(`/api/bill-splits/tours/${tour?.id}/spendings/${tx.id}`"
);
fs.writeFileSync(pageFile, pageCode);

// 4. Fix src/components/TransactionAttachmentsSection.tsx
let attachSecFile = 'src/components/TransactionAttachmentsSection.tsx';
let attachSecCode = fs.readFileSync(attachSecFile, 'utf-8');
attachSecCode = attachSecCode.replace(
  /transactionId\}\/attachments`/g,
  "transactionId || 0}/attachments`"
);
fs.writeFileSync(attachSecFile, attachSecCode);
console.log('Fixed typecheck issues');
