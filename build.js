const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

// Grab the input file path passed by VS Code (Index 2)
let SOURCE_PATH = process.argv[2];

if (!SOURCE_PATH) {
    console.error("Error: No target file provided by task manager.");
    process.exit(1);
}

// FIX FOR SUBST DRIVES & SPACES: Resolve absolute paths cleanly
if (!fs.existsSync(SOURCE_PATH)) {
    const fileName = path.basename(SOURCE_PATH);
    const localAttempt = path.join(__dirname, fileName);
    
    if (fs.existsSync(localAttempt)) {
        SOURCE_PATH = localAttempt;
    } else {
        console.error(`Error: Could not resolve file location: ${SOURCE_PATH}`);
        process.exit(1);
    }
}

async function run() {
    try {
        const fileDir = "P:\\Ingress Stuff\\";
        const fileName = path.basename(SOURCE_PATH);
        
        // Define /Minified folder relative to the file location
        const OUTPUT_DIR = path.join(fileDir, 'My Plugins - Releases');
        const OUTPUT_PATH = path.join(OUTPUT_DIR, fileName);

        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

        // CASE 1: Straight copy for meta files (No minification)
        if (fileName.endsWith('.meta.js')) {
            fs.copyFileSync(SOURCE_PATH, OUTPUT_PATH);
            console.log(`Successfully copied metadata file to: ${OUTPUT_PATH}`);
            return;
        }

        // CASE 2: Processing loop for functional user script files
        let code = fs.readFileSync(SOURCE_PATH, 'utf8');

        // Extract the UserScript metadata block safely
        const metaDelimiter = '// ==/UserScript==';
        const metaParts = code.split(metaDelimiter);
        if (metaParts.length < 2) return console.error("Error: UserScript metadata block missing!");

        const rawMetaHeader = metaParts[0] + metaDelimiter;
        let remainingCode = metaParts.slice(1).join(metaDelimiter).trim();

        // REGEX ENGINE: Matches '//', any spaces/tabs, '@minify', any spaces/tabs, then 'skip'
        const minifySkipRegex = /\/\/\s*@minify\s+skip/;
        const shouldSkipMinify = minifySkipRegex.test(rawMetaHeader);

        // Split raw header into lines for cleaning
        const metaLines = rawMetaHeader.split(/\r?\n/);

        // --- Generate clean header versions (strip matching regex lines from both targets) ---
        // 1. Header for the .user.js file (keeps icon, strips @minify)
        const cleanUserHeader = metaLines
            .filter(line => !minifySkipRegex.test(line))
            .join('\n')
            .trim();

        // 2. Header for the standalone .meta.js file (strips both icon AND @minify)
        const cleanMetaHeader = metaLines
            .filter(line => !line.includes('@icon64') && !minifySkipRegex.test(line))
            .join('\n')
            .trim();

        // Save out standalone meta file asset
        const metaFileName = fileName.replace('.user.js', '.meta.js');
        const META_OUTPUT_PATH = path.join(OUTPUT_DIR, metaFileName);
        fs.writeFileSync(META_OUTPUT_PATH, cleanMetaHeader + '\n', 'utf8');
        console.log(`Successfully created standalone meta file: ${META_OUTPUT_PATH}`);

        // --- HANDLING IF SKIP FLAG IS PRESENT ---
        if (shouldSkipMinify) {
            // Write clean un-minified code block with exactly one newline separating sections
            fs.writeFileSync(OUTPUT_PATH, cleanUserHeader + '\n\n' + remainingCode, 'utf8');
            console.log(`Skipped minification due to tag match. Clean file copied to: ${OUTPUT_PATH}`);
            return;
        }

        // --- NORMAL PIPELINE: RUN CODES THROUGH TERSER ENGINE ---
        const apiStartSignatureCRLF = '/*\r\nAPI Notes';
        const apiStartSignatureLF = '/*\nAPI Notes';
        const apiEndDelimiter = '*/';
        let apiBlock = '';

        let targetSignature = null;
        if (remainingCode.includes(apiStartSignatureCRLF)) {
            targetSignature = apiStartSignatureCRLF;
        } else if (remainingCode.includes(apiStartSignatureLF)) {
            targetSignature = apiStartSignatureLF;
        }

        if (targetSignature) {
            const apiParts = remainingCode.split(targetSignature);
            const apiSubParts = apiParts[1].split(apiEndDelimiter);
            
            // Extract the raw un-minified API comment block cleanly
            apiBlock = targetSignature + apiSubParts[0] + apiEndDelimiter + '\n\n';
            
            // Re-assemble remaining script code to send to Terser engine
            remainingCode = (apiParts[0] + apiSubParts.slice(1).join(apiEndDelimiter)).trim();
        }

        const output = await minify(remainingCode, { 
            ecma: 2024, 
            compress: true, 
            mangle: true 
        });
        
        // Output clean tight block structure with exactly one empty line spacing buffer
        const finalOutput = cleanUserHeader + '\n\n' + apiBlock + output.code;
        fs.writeFileSync(OUTPUT_PATH, finalOutput, 'utf8');
        console.log(`Successfully compiled to: ${OUTPUT_PATH}`);
    } catch (err) {
        console.error(`Build crash error: ${err.message}`);
    }
}
run();