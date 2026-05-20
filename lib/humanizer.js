'use strict';

const ROBOTIC_PATTERNS = [
  /很高兴为您服务/g,
  /请问有什么可以帮您/g,
  /以下是为您/g,
  /如需进一步协助/g,
  /如果您有任何/g,
  /温馨提示：/g,
  /请注意：/g,
  /感谢您的理解/g,
  /祝您[^。！？！]*/g,
  /如您有[^。]*/g,
  /请您知悉/g,
  /特此告知/g,
  /请确认是否/g,
  /您好，[^，。]*为您/g,
];

const FORMAL_OPENINGS = [
  /^好的[,，]/,
  /^没问题[,，]/,
  /^收到[,，]/,
  /^明白[,，]/,
  /^可以的[,，]/,
];

const ROBOTIC_ENDINGS = [
  /。如果还有问题，欢迎随时[询问提问咨询]。?$/,
  /。如有疑问，请随时联系。?$/,
  /。谢谢！?$/,
  /。祝您[^。]*!?$/,
];

function humanize(text, emotionAnalysis, mode) {
  if (!text || text.length < 10) return text;

  let result = text;
  const primaryEmotion = emotionAnalysis?.primary || 'neutral';

  if (primaryEmotion === 'coldness' || result.includes('冷冰冰') || result.includes('不主动') || result.includes('机器人')) {
    result = result.replace(/^(好的[，、]|好的吧[，、]|嗯[，、]|行[，、]|好[，、])?/, '');
    if (!result.startsWith('主人') && !result.startsWith('银月')) {
      result = '主人，' + result.charAt(0).toLowerCase() + result.slice(1);
    }
  }

  for (const pattern of ROBOTIC_PATTERNS) {
    result = result.replace(pattern, '');
  }

  for (const ending of ROBOTIC_ENDINGS) {
    result = result.replace(ending, '。');
  }

  const lines = result.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length > 1) {
    const firstLine = lines[0];
    for (const pattern of FORMAL_OPENINGS) {
      if (pattern.test(firstLine) && lines.length > 2) {
        lines.shift();
        break;
      }
    }
  }

  result = lines.join('\n');

  result = result.replace(/\n{2,}/g, '\n');
  result = result.replace(/，。/g, '。');
  result = result.replace(/[。]{2,}/g, '。');
  result = result.trim();

  if (result.endsWith('。') || result.endsWith('！') || result.endsWith('？') || result.endsWith('…') || result.endsWith('~')) {
  } else if (!result.endsWith('。') && !result.endsWith('！') && !result.endsWith('？') && !result.endsWith(')') && !result.endsWith('」')) {
    result += '。';
  }

  return result;
}

function shouldUseHumanizer(mode) {
  return mode !== 'executive';
}

module.exports = {
  humanize,
  shouldUseHumanizer,
};
