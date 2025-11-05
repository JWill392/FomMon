const https = require('https');
const fs = require('fs');
const path = require('path');
const { createGunzip } = require('zlib');
const tar = require('tar');

const GLYPH_FONT_URL = 'https://github.com/versatiles-org/versatiles-fonts/releases/download/v2.0.0/noto_sans.tar.gz';
const GLYPH_FONTS_DIR = path.join(__dirname, '../public/assets/glyphs');

const SPRITES_URL = 'https://github.com/versatiles-org/versatiles-style/releases/download/v5.7.0/sprites.tar.gz';
const SPRITES_DIR = path.join(__dirname, '../public/assets/sprites');

async function downloadAndExtract(url, targetDir, assetName) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if assets already exist
    if (fs.readdirSync(targetDir).length > 0) {
        console.log(`Asset '${assetName}' already exists.  Skipping download`);
        return;
    }


    console.log(`Downloading ${assetName}...`);

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            function extractArchive(httpResponse) {
                httpResponse
                    .pipe(createGunzip())
                    .pipe(tar.x({cwd: targetDir}))
                    .on('finish', () => {
                        console.log(`Downloaded ${assetName} successfully! extracting...`);
                        resolve();
                        console.log(`Extracted ${assetName} successfully!`);
                    })
                    .on('error', reject);
            }

            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    extractArchive(redirectResponse);
                }).on('error', reject);
            } else {
                extractArchive(response);
            }
        }).on('error', reject);
    });
}

async function downloadVersatilesStyleAssets() {
    try {
        await downloadAndExtract(GLYPH_FONT_URL, GLYPH_FONTS_DIR, 'glyph fonts');
        await downloadAndExtract(SPRITES_URL, SPRITES_DIR, 'sprites');
    } catch (error) {
        console.error('Error downloading assets:', error);
        throw error;
    }
}

downloadVersatilesStyleAssets().catch(console.error);