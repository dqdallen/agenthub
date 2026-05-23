import fs from 'fs';

const filePath = './server/index.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /estimatedTime: estimatedTime \|\| null,\n/,
  ''
);

fs.writeFileSync(filePath, content);
console.log('Fixed estimatedTime in bid API');