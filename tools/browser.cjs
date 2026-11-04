/* Browser checks work on either laptop or Linux; explicit overrides take priority. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
exports.executablePath=()=>{
  if(process.env.CHROMIUM_PATH)return process.env.CHROMIUM_PATH;
  const base=process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ms-playwright'):path.join(os.homedir(),'.cache','ms-playwright');
  const names=fs.existsSync(base)?fs.readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1])):[];
  for(const name of names)for(const suffix of ['chrome-win64/chrome.exe','chrome-win/chrome.exe','chrome-linux64/chrome','chrome-linux/chrome']){const file=path.join(base,name,suffix);if(fs.existsSync(file))return file;}
  throw new Error('Install a Playwright Chromium browser or set CHROMIUM_PATH to its executable.');
};
