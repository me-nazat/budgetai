const fs = require('fs');
let file = 'src/components/TransactionAttachmentsSection.tsx';
let code = fs.readFileSync(file, 'utf-8');
code = code.replace(/buildAttachmentViewerHref\(transactionDescription, transactionId, file\.id\)/g, "buildAttachmentViewerHref(transactionDescription, transactionId || 0, file.id)");
fs.writeFileSync(file, code);
console.log('Fixed TransactionAttachmentsSection');
