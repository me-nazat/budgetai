const fs = require('fs');
let code = fs.readFileSync('src/lib/types/dto.ts', 'utf8');
code = code.replace(/export const ([A-Za-z0-9_]+DTO) = z\.object\(\s*{([\s\S]*?)}\s*\);/g, 'export const $1 = z.object({$2}).strict();');
fs.writeFileSync('src/lib/types/dto.ts', code);
console.log('Strict added.');
