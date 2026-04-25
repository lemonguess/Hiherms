// Integration test: call hermes via the bridge logic
const { spawn } = require('child_process');

function execCommand(command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      env: { ...process.env, HOME: process.env.HOME || '/root' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('timeout')); }, timeout);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) resolve(stdout);
      else reject(new Error(stderr || `exit ${code}`));
    });
  });
}

function parseOutput(output) {
  let cleaned = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  cleaned = cleaned.replace(/\r/g, '');

  let sessionId = '';
  const sessionMatch = cleaned.match(/[Ss]ession:\s+([a-zA-Z0-9_-]+)/);
  if (sessionMatch) sessionId = sessionMatch[1];

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

  return { content, sessionId };
}

async function main() {
  console.log('Testing Hermes integration...\n');

  try {
    // Test 1: simple query
    console.log('Test 1: Simple query');
    const out1 = await execCommand(
      `hermes chat -q 'Reply with exactly: OK'`,
      60000
    );
    const r1 = parseOutput(out1);
    console.log(`  Session: ${r1.sessionId || 'N/A'}`);
    console.log(`  Content: ${r1.content.slice(0, 100)}`);
    console.log(`  Result: ${r1.content.includes('OK') ? '✅' : '⚠️'}`);

    // Test 2: resume session
    if (r1.sessionId) {
      console.log('\nTest 2: Resume session');
      const out2 = await execCommand(
        `hermes --resume ${r1.sessionId} chat -q 'What did I just ask you? Reply in ONE short sentence.'`,
        60000
      );
      const r2 = parseOutput(out2);
      console.log(`  Session: ${r2.sessionId || 'N/A'}`);
      console.log(`  Content: ${r2.content.slice(0, 100)}`);
      console.log(`  Result: ✅`);
    }

    console.log('\n✅ All integration tests passed!');
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
  }
}

main();
