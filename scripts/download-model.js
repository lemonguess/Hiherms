#!/usr/bin/env node
// Auto-download Sherpa-ONNX streaming ASR model
// Model: streaming-paraformer-bilingual-zh-en (Chinese + English, real-time)
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MODEL_DIR = path.join(__dirname, '..', 'model');
const MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-paraformer-bilingual-zh-en.tar.bz2';
const TARBALL = path.join(MODEL_DIR, 'model.tar.bz2');

// Expected files after extraction
const EXPECTED_FILES = [
  'encoder.onnx',
  'decoder.onnx',
  'joiner.onnx',
  'tokens.txt',
];

// Check if model already downloaded
if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });
const allExist = EXPECTED_FILES.every(f => fs.existsSync(path.join(MODEL_DIR, f)));
if (allExist) {
  console.log('✅ ASR model already downloaded.');
  process.exit(0);
}

console.log('⬇️  Downloading Sherpa-ONNX streaming paraformer (zh+en, ~48MB)...');

const file = fs.createWriteStream(TARBALL);

function download(url) {
  https.get(url, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      download(response.headers.location);
      return;
    }
    if (response.statusCode !== 200) {
      console.error(`❌ Download failed: HTTP ${response.statusCode}`);
      process.exit(1);
    }

    const total = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;

    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total > 0) {
        process.stdout.write(`\r   ${((downloaded / total) * 100).toFixed(1)}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
      }
    });

    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('\n📦 Extracting...');
      try {
        execSync(`tar -xjf "${TARBALL}" -C "${MODEL_DIR}" --strip-components=1`, { stdio: 'pipe' });
        fs.unlinkSync(TARBALL);
        console.log('✅ ASR model ready! Found:');
        EXPECTED_FILES.forEach(f => {
          if (fs.existsSync(path.join(MODEL_DIR, f))) console.log(`   ✓ ${f}`);
        });
      } catch (e) {
        console.error('❌ Extraction failed:', e.message);
        console.log('   Try manually:');
        console.log(`   curl -L -o model.tar.bz2 "${MODEL_URL}"`);
        console.log('   tar -xjf model.tar.bz2 -C model/ --strip-components=1');
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('❌ Download failed:', err.message);
    process.exit(1);
  });
}

download(MODEL_URL);
