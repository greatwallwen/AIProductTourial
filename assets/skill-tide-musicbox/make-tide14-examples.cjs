const fs = require('node:fs');
const path = require('node:path');
const studio = require('./tide14-model.js');

const root = __dirname;
const context = studio.prepare(JSON.parse(fs.readFileSync(path.join(root,'recovered-14day-from-pdf.json'))).data);
let baseline = studio.validate(context, {...studio.initial(context), mapping: 'height'});
let newBaseline = studio.initial(context);
for (const [slot, day, offset] of [[0,0,60],[1,6,120],[2,13,180]]) {
  baseline = studio.select(context,baseline,day,offset,30);
  baseline = studio.place(context,baseline,slot);
  newBaseline = studio.select(context,newBaseline,day,offset,30);
  newBaseline = studio.place(context,newBaseline,slot);
}
let arrangement = studio.initial(context);
for (const [slot, day, offset, changes] of [[0,0,60,[[2,4,.8],[6,-3,.65]]],[1,6,120,[[3,5,.75],[8,-2,.9]]],[2,13,180,[[4,7,.9],[11,-5,.6]]]]) {
  arrangement = studio.select(context,arrangement,day,offset,30);
  for (const [index,shift,volume] of changes) arrangement = studio.edit(context,arrangement,index,{shift,volume});
  arrangement = studio.place(context,arrangement,slot);
}
const original = studio.wav(context,baseline);
const newOriginal = studio.wav(context,newBaseline);
const adapted = studio.wav(context,arrangement);
if (Buffer.compare(Buffer.from(original),Buffer.from(newOriginal))===0 || Buffer.compare(Buffer.from(newOriginal),Buffer.from(adapted))===0) throw new Error('A/B/C audio must all differ');
for (const [name,bytes] of [['十四日-演示原始映射.wav',original],['十四日-演示新规则未改编.wav',newOriginal],['十四日-演示人工改编.wav',adapted]]) fs.writeFileSync(path.join(root,name),Buffer.from(bytes));
fs.writeFileSync(path.join(root,'十四日-演示人工改编-配方.json'),JSON.stringify(studio.toRecipe(arrangement),null,2)+'\n');
console.log(`Created 3 A/B/C WAVs from identical 48 note positions: old height, contour baseline, contour + 6 edited notes`);
