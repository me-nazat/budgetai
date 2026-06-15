const fs = require('fs');

// 1. page.tsx
let pageFile = 'src/app/(app)/tours/[id]/spendings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf-8');
pageCode = pageCode.replace(/paidByName: getParticipantName\(s\.paidByParticipantId\),/g, "paidByName: getParticipantName(s.paidByParticipantId || undefined),");
fs.writeFileSync(pageFile, pageCode);

// 2. attachments route.ts
let attachFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts';
let attachCode = fs.readFileSync(attachFile, 'utf-8');
attachCode = attachCode.replace(/interface RouteContext extends any \{\n  params: \{\n    id: string;\n    spendingId: string;\n  \}\n\}/g, "interface RouteContext {\n  params: {\n    id: string;\n    spendingId: string;\n  }\n}");
attachCode = attachCode.replace(/interface RouteContext extends any \{/g, "interface RouteContext {");
fs.writeFileSync(attachFile, attachCode);

// 3. spendings route.ts
let routeFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/route.ts';
let routeCode = fs.readFileSync(routeFile, 'utf-8');
routeCode = routeCode.replace(/interface RouteContext extends any \{\n  params: \{\n    id: string;\n    spendingId: string;\n  \}\n\}/g, "interface RouteContext {\n  params: {\n    id: string;\n    spendingId: string;\n  }\n}");
routeCode = routeCode.replace(/interface RouteContext extends any \{/g, "interface RouteContext {");
fs.writeFileSync(routeFile, routeCode);

// 4. TransactionAttachmentsSection.tsx
let attachSecFile = 'src/components/TransactionAttachmentsSection.tsx';
let attachSecCode = fs.readFileSync(attachSecFile, 'utf-8');
// It might be `transactionId` used inside JSX. Let's just find and replace transactionId with (transactionId || 0) in the component body
attachSecCode = attachSecCode.replace(/<TransactionAttachmentsSectionProps> /g, '');
// Wait, I will just search for `transactionId` in TransactionAttachmentsSection and replace it safely where it expects a number.
// Or wait, in the component, transactionId is typed as `number | undefined`.
// Where is it passed to something expecting `number`?
// Let's just use sed to see line 350-360 of TransactionAttachmentsSection.tsx
