const fs = require('fs');

// 1. page.tsx
let pageFile = 'src/app/(app)/tours/[id]/spendings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf-8');
pageCode = pageCode.replace(/interface TourTransaction \{\n  paidByParticipantId\?: number;\n/g, 'interface TourTransaction {\n');
pageCode = pageCode.replace(/getParticipantName\(transaction\.paidBy\)/g, 'getParticipantName(transaction.paidBy ?? 0)');
fs.writeFileSync(pageFile, pageCode);

// 2. route.ts & attachments/route.ts
let attachFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts';
let attachCode = fs.readFileSync(attachFile, 'utf-8');
attachCode = attachCode.replace(/import .*? from '@\/lib\/types';\n/g, '');
fs.writeFileSync(attachFile, attachCode);

let routeFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/route.ts';
let routeCode = fs.readFileSync(routeFile, 'utf-8');
routeCode = routeCode.replace(/from '\.\.\/\.\.\/\.\.\/\.\.\/tour-controller'/g, "from '../../../tour-controller'");
routeCode = routeCode.replace(/import .*? from '@\/lib\/types';\n/g, '');
fs.writeFileSync(routeFile, routeCode);

// 3. TransactionAttachmentsSection.tsx
let attachSecFile = 'src/components/TransactionAttachmentsSection.tsx';
let attachSecCode = fs.readFileSync(attachSecFile, 'utf-8');
attachSecCode = attachSecCode.replace(/transactionId\}\/attachments/g, "transactionId || 0}/attachments");
fs.writeFileSync(attachSecFile, attachSecCode);
console.log('Fixed');
