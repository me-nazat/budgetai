const fs = require('fs');

let pageFile = 'src/app/(app)/tours/[id]/spendings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf-8');
pageCode = pageCode.replace(/paidByName: getParticipantName\(s\.paidByParticipantId\)/g, "paidByName: getParticipantName(s.paidByParticipantId ?? 0)");
pageCode = pageCode.replace(/paidByName: getParticipantName\(s\.paidByParticipantId \|\| undefined\)/g, "paidByName: getParticipantName(s.paidByParticipantId ?? 0)");
fs.writeFileSync(pageFile, pageCode);

let attachFile = 'src/app/api/bill-splits/tours/[id]/spendings/[spendingId]/attachments/route.ts';
let attachCode = fs.readFileSync(attachFile, 'utf-8');
attachCode = attachCode.replace(/export interface RouteContext extends any \{/g, "export interface RouteContext {");
fs.writeFileSync(attachFile, attachCode);

console.log('Fixed');
