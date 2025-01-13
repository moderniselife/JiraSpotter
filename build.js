const fs = require('fs');
const sass = require('sass');
require('dotenv').config();

// Compile SCSS to CSS
try {
    const result = sass.compile('styles.scss');
    fs.writeFileSync('styles.css', result.css);
    console.log('SCSS compiled successfully!');
} catch (error) {
    console.error('Error compiling SCSS:', error);
}

// Read the template file
const template = fs.readFileSync('config.template.js', 'utf8');

// Replace placeholders with environment variables
const config = template
    .replace('YOUR_CLIENT_ID', process.env.JIRA_CLIENT_ID || '')
    .replace('YOUR_CLIENT_SECRET', process.env.JIRA_CLIENT_SECRET || '');

// Write the config file
fs.writeFileSync('config.js', config);

console.log('Config file generated successfully!');