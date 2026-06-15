const fs = require('fs');

// 1. page.tsx
let pageFile = 'src/app/(app)/tours/[id]/spendings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf-8');
pageCode = pageCode.replace(/getParticipantName = useCallback\(\(id: number\) =>/g, "getParticipantName = useCallback((id?: number) =>");
fs.writeFileSync(pageFile, pageCode);

// 2. attachments route.ts
let attachFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts';
let attachCode = fs.readFileSync(attachFile, 'utf-8');
attachCode = attachCode.replace(/RouteContextWithId/g, "any");
fs.writeFileSync(attachFile, attachCode);

// 3. spendings route.ts
let routeFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/route.ts';
let routeCode = fs.readFileSync(routeFile, 'utf-8');
routeCode = routeCode.replace(/RouteContextWithId/g, "any");
fs.writeFileSync(routeFile, routeCode);

// 4. TransactionAttachmentsSection.tsx
let attachSecFile = 'src/components/TransactionAttachmentsSection.tsx';
let attachSecCode = fs.readFileSync(attachSecFile, 'utf-8');
attachSecCode = attachSecCode.replace(/transactionId: transactionId,/g, "transactionId: transactionId || 0,");
fs.writeFileSync(attachSecFile, attachSecCode);
console.log('Fixed');
