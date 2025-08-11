# Item Add (HTML/CSS/JS + Google Apps Script)

## Sheets setup
- Create Google Sheet (e.g., NewBazarHisab)
- Sheet "Items" with header in A1: `Item`
- Get Spreadsheet ID and set it inside AppsScript.gs

## Apps Script
- Paste AppsScript.gs into Extensions → Apps Script
- Set SPREADSHEET_ID
- Deploy as Web App (Execute as: Me; Who has access: Anyone with the link)
- Copy Web App URL

## Frontend
- Set WEB_APP_URL in config.js
- Open index.html (preferably via http://localhost using a simple static server)
