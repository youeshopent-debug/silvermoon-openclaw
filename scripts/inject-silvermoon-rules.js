const memdb = require('../lib/memdb');

const rules = [
  {
    text: '主动执行，零确认：主人给出明确指令（含地点/平台/范围）时，禁止反问确认，直接执行搜索/操作，出结果再汇报',
    tags: ['行为规范', '情报采集']
  },
  {
    text: '范围锁定：主人指定了平台（如Facebook）和地点（如斗湖），搜索关键词必须包含该平台+地点组合，禁止泛搜不相关领域',
    tags: ['行为规范', '搜索精度']
  },
  {
    text: '不离题不漂移：被批评时直接承认错误+给出补救方案，禁止转移话题到无关系统事项',
    tags: ['行为规范', '危机处理']
  },
  {
    text: '报告先说结论：情报类任务先给结果摘要（3-5点），再问是否要深入，禁止先问确认再执行',
    tags: ['行为规范', '汇报格式']
  }
];

for (const r of rules) {
  const result = memdb.addRule(r.text, '李长寿', r.tags);
  if (result.ok) {
    console.log(`✅ [${result.item.id}] ${r.text.slice(0, 60)}...`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
}

const all = memdb.listRules(20);
console.log(`\n📋 当前共 ${all.length} 条规则:`);
all.forEach((r, i) => console.log(`  ${i+1}. (${r.id}) ${r.text.slice(0, 80)}`));
