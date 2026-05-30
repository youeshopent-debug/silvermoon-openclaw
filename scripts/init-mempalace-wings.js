const mempalace = require('../lib/mempalace-bridge');

const AGENTS = [
  { id: 'yinyue', name: '银月' },
  { id: 'lichangshou', name: '李长寿' },
  { id: 'hanli', name: '韩立' },
  { id: 'yaolao', name: '药老' },
  { id: 'medusa', name: '美杜莎' },
  { id: 'moying', name: '墨影' },
  { id: 'xiaoyan', name: '萧炎' },
  { id: 'yafei', name: '雅妃' },
  { id: 'xiaoyixian', name: '小医仙' },
  { id: 'ziling', name: '紫灵' },
  { id: 'ziyan', name: '紫研' },
];

async function main() {
  console.log('========================================');
  console.log('  银月钱庄 - MemPalace Wings 初始化');
  console.log('========================================');

  if (!mempalace.isAvailable()) {
    console.log('\n⚠️  MemPalace 未安装，使用文件系统桥接模式');
  }

  for (const agent of AGENTS) {
    const result = await mempalace.initAgentWing(agent.id, agent.name);
    if (result.ok) {
      console.log(`  ✅ ${agent.name} (${agent.id}) - Wing 初始化完成`);
    } else {
      console.log(`  ❌ ${agent.name} (${agent.id}) - ${result.reason}`);
    }
  }

  console.log('\n========================================');
  console.log('  初始化完成！');
  console.log('========================================');
}

main().catch(console.error);
