# Quick Setup Guide

## Installation (5 minutes)

### Step 1: Install Node.js
If you don't have Node.js:
1. Visit https://nodejs.org/
2. Download the LTS version
3. Run the installer

### Step 2: Install Dependencies
```bash
saiacs-style-validator
npm install
```

### Step 3: Start the App
```bash
npm start
```

### Step 4: Open Browser
Go to: http://localhost:3000

## Quick Test

1. Open the web interface
2. Select "Assignment"
3. Upload "NT - Final Assignment - final.docx" (in the project folder)
4. Click "Validate Document"
5. See the results!

## What You'll See

The validator will show:
- **Summary**: Total issues by severity (Critical, High, Medium, Low)
- **Issues List**: Each issue with:
  - What rule was violated
  - What was expected vs what was found
  - Where in the document
  - How to fix it

## Common First-Time Issues

### "npm not found"
- Install Node.js first (includes npm)

### Port 3000 already in use
```bash
# Edit server.js, change line 5:
const PORT = 3001;
```

### Dependencies fail to install
```bash
# Try with verbose output:
npm install --verbose
```

## Next Steps

1. Test with your own DOCX files
2. Review [rules_categories.md](rules_categories.md) for all validation rules
3. See [README.md](README.md) for complete documentation

## Need Help?

1. Check README.md for full documentation
2. Check Troubleshooting section
3. Verify Node.js version: `node --version` (need 14+)
4. Check server logs in terminal for errors

## Development Mode

For development with auto-reload:
```bash
npm run dev
```

This uses nodemon to restart the server when you make changes.

---

**Ready in 5 minutes!**
