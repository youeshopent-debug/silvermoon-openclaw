require('dotenv').config({path:'.env'});
const D=require('better-sqlite3');
const d=new D('user_data/memory/silvermoon_memory.sqlite');
const rows=d.prepare("SELECT uid,substr(content,1,300) as c,at FROM mem WHERE uid LIKE 'seed:%' ORDER BY uid").all();
rows.forEach(r=>{
  console.log('--- '+r.uid+' ---');
  console.log('CONTENT: '+JSON.stringify(r.c));
  console.log('AT: '+r.at);
});
console.log('\n总计: '+d.prepare('SELECT COUNT(*) as n FROM mem').get().n+' 条');
d.close();
