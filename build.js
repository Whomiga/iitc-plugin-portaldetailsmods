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
        const fileDir = path.dirname(SOURCE_PATH);
        const fileName = path.basename(SOURCE_PATH);
        
        // Define /Minified folder relative to the file location
        const OUTPUT_DIR = path.join(fileDir, 'Minified');
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

        const metaHeader = metaParts[0] + metaDelimiter + '\n\n';
        let remainingCode = metaParts.slice(1).join(metaDelimiter);

        // Extract the API Notes block safely by locating its opening signature
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
            
            // Reconstruct the raw un-minified API comment block completely untouched
            apiBlock = targetSignature + apiSubParts[0] + apiEndDelimiter + '\n\n';
            
            // Re-assemble the remaining program logic parts to be passed to Terser
            remainingCode = apiParts[0] + apiSubParts.slice(1).join(apiEndDelimiter);
        }

        // Minify your code payload utilizing modern ES2024 compliance engines
        const output = await minify(remainingCode, { 
            ecma: 2024, 
            compress: true, 
            mangle: true 
        });
        
        // Reconstruct your original un-minified header block and API notes with the optimized code
        const finalOutput = metaHeader + apiBlock + output.code;
        fs.writeFileSync(OUTPUT_PATH, finalOutput, 'utf8');
        console.log(`Successfully compiled to: ${OUTPUT_PATH}`);
    } catch (err) {
        console.error(`Build crash error: ${err.message}`);
    }
}
run();