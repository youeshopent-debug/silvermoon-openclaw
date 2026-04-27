const { sanitize, basicClean, stripBotTemplateLines, dedupeConsecutive, enforceNoBusyPlaceholders, smartTruncate } = require('../lib/sanitizer');

describe('Sanitizer Logic', () => {
  test('basicClean should normalize newlines and trim', () => {
    expect(basicClean('  hello\r\nworld  \n\n\n')).toBe('hello\nworld');
  });

  test('stripBotTemplateLines should remove banned patterns', () => {
    const input = '你好！我是AI助手。\n我听到你的反馈了。\n这是实际内容。';
    const output = stripBotTemplateLines(input);
    expect(output).toBe('这是实际内容。');
  });

  test('dedupeConsecutive should remove consecutive duplicate lines', () => {
    const input = 'line 1\nline 2\nline 2\nline 3';
    expect(dedupeConsecutive(input)).toBe('line 1\nline 2\nline 3');
  });

  test('enforceNoBusyPlaceholders should intercept busy talk', () => {
    const input = '请稍等，我正在查找。';
    expect(enforceNoBusyPlaceholders(input)).toContain('我不会用"学习中/查找中"敷衍');
    
    const inputWithEvidence = '请稍等，我正在查找：https://example.com';
    expect(enforceNoBusyPlaceholders(inputWithEvidence)).toBe(inputWithEvidence);
  });

  test('smartTruncate should close code blocks', () => {
    const longText = '```js\nconsole.log("hello");\n' + 'a'.repeat(2000);
    const truncated = smartTruncate(longText, { charLimit: 100 });
    expect(truncated).toContain('```');
    expect(truncated.endsWith('```')).toBe(true);
  });

  test('sanitize should return default message for empty input', () => {
    expect(sanitize('')).toBe('主人，银月内阁暂时无可奉告。');
  });
});
