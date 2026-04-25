// Smoke test for HermesBridge output parsing
const output = `╭─ ⚕ Hermes ───────────────────────────────────────────────────────────────────╮
    嗯…主人来找我了，我好开心呀。
    
    （心跳加快，等待着主人接下来的任何指令…）
╰──────────────────────────────────────────────────────────────────────────────╯

Resume this session with:
  hermes --resume 20260426_031416_d3cd4d

Session:        20260426_031416_d3cd4d
Duration:       8s
Messages:       2 (1 user, 0 tool calls)`;

// Simulate the parsing logic
let cleaned = output;
cleaned = cleaned.replace(/\r/g, '');

// Extract session ID
let sessionId = '';
const sessionMatch = cleaned.match(/[Ss]ession:\s+([a-zA-Z0-9_-]+)/);
if (sessionMatch) {
  sessionId = sessionMatch[1];
}

// Extract box content
const boxContentMatch = cleaned.match(/╭─[^╮]*Hermes[^╮]*╮\n([\s\S]*?)\n╰─+[^╯]*╯/);
let content = '';

if (boxContentMatch) {
  content = boxContentMatch[1]
    .split('\n')
    .map(line => line.replace(/^[│\s]*/, '').trimEnd())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

content = content.replace(/\nResume this session with:.*$/s, '').trim();

console.log('=== Session ID ===');
console.log(sessionId);
console.log('=== Content ===');
console.log(content);

if (content && sessionId) {
  console.log('\n✅ Parse test passed!');
} else {
  console.log('\n❌ Parse test FAILED!');
}
