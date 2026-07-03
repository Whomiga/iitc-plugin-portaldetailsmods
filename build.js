const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

// Capture the exact absolute file path index argument from the execution stack array
const SOURCE_PATH = process.argv[2];

if (!SOURCE_PATH) {
    console.error("Error: No target file provided by task manager.");
    process.exit(1);
}

async function run() {
    try {
        const fileDir = path.dirname(SOURCE_PATH);
        const fileName = path.basename(SOURCE_PATH);
        
        // Define /Minified folder relative to the saved file's current directory
        const OUTPUT_DIR = path.join(fileDir, 'Minified');
        const OUTPUT_PATH = path.join(OUTPUT_DIR, fileName);

        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
        const code = fs.readFileSync(SOURCE_PATH, 'utf8');

        // Split data directly at the closing UserScript tag boundary
        const delimiter = '// ==/UserScript==';
        const parts = code.split(delimiter);
        if (parts.length < 2) return console.error("Error: Metadata block missing!");

        const header = parts[0] + delimiter + '\n\n';
        const bodyToMinify = parts.slice(1).join(delimiter);

        // Minify your code payload utilizing modern ES2024 compliance engines
        const output = await minify(bodyToMinify, { 
            ecma: 2024, 
            compress: true, 
            mangle: true 
        });
        
        // Reconstruct your original un-minified header block with the optimized code
        fs.writeFileSync(OUTPUT_PATH, header + output.code, 'utf8');
        console.log(`Successfully compiled to: ${OUTPUT_PATH}`);
    } catch (err) {
        console.error(`Build crash error: ${err.message}`);
    }
}
run();