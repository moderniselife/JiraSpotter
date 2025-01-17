const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(distDir, 'extension.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

// Listen for archive warnings
archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
    } else {
        throw err;
    }
});

// Listen for archive errors
archive.on('error', (err) => {
    throw err;
});

// Files to include in the zip
const files = [
    'manifest.json',
    'config.js',
    'background.js',
    'content.js',
    'sidepanel.js',
    'sidepanel.html',
    'styles.css',
    'content-styles.css',
    'marked.min.js',
    'html2canvas.min.js',
    'test-recorder.js', ,
    'icons/*'
];

console.log('Creating Chrome Store package...');

// Add files to the zip
files.forEach(file => {
    if (file.includes('*')) {
        archive.glob(file);
        console.log(`Added glob pattern: ${file}`);
    } else {
        if (fs.existsSync(file)) {
            archive.file(file, { name: file });
            console.log(`Added file: ${file}`);
        } else {
            console.warn(`Warning: File not found: ${file}`);
        }
    }
});

// Pipe archive data to the file
archive.pipe(output);

// Finalize the archive
archive.finalize().then(() => {
    console.log('Chrome Store package created successfully at dist/extension.zip');
}).catch(err => {
    console.error('Error creating package:', err);
    process.exit(1);
});