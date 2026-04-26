const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');

async function test() {
  console.log('--- Start msedge-tts test ---');
  
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'test-tts-'));
  const tmpFile = path.join(tmpDir, 'audio.mp3');
  const text = '测试一段语音看看能不能生成。';
  
  console.log('Temp file path:', tmpFile);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('zh-CN-XiaoyiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    
    // docs say toFile takes (dirPath, input)
    // it will write to audio.mp3 in that dir
    const result = await tts.toFile(tmpDir, text);
    console.log('Result:', result);
    
    console.log('Synthesis complete.');
    console.log('File exists?', fs.existsSync(tmpFile));
    
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    console.log('Cleaning up...');
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
}

test();
