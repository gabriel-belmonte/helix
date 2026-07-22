import { chromium } from "playwright-core";

const URL = "http://localhost:8099/helix/index.html";
// Use the system Chromium (snap) instead of downloading a browser.
const EXE = process.env.CHROMIUM_EXE || "/snap/bin/chromium";

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL, { waitUntil: "networkidle" });
// Give web fonts a moment to load.
await page.waitForTimeout(800);
await page.screenshot({ path: "landing-full.png", fullPage: true });
console.log("saved landing-full.png");
await browser.close();
