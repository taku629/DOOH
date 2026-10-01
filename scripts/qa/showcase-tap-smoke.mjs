import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8765/showcase-tap.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];

page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForFunction(
    () => Boolean(document.getElementById("doohFrame")?.contentWindow?.__inkDemo?.showThanks),
    null,
    { timeout: 90_000 },
);
await page.waitForTimeout(1_000);

const before = await page.evaluate(() => ({
    count: document.getElementById("countDisplay")?.textContent,
    phoneClasses: document.getElementById("phoneShell")?.className,
    phoneFilter: getComputedStyle(document.getElementById("phoneShell")).filter,
}));

await page.locator("#tapSurface").click({ position: { x: 500, y: 340 } });
await page.waitForFunction(() => document.getElementById("countDisplay")?.textContent === "15人", null, {
    timeout: 15_000,
});
await page.waitForTimeout(1_700);

const after = await page.evaluate(() => {
    const doohDocument = document.getElementById("doohFrame")?.contentDocument;
    return {
        count: document.getElementById("countDisplay")?.textContent,
        nextName: document.getElementById("nameInput")?.value,
        phoneClasses: document.getElementById("phoneShell")?.className,
        doohContainsName: doohDocument?.body?.innerText?.includes("あおい") === true,
        doohTextSample: doohDocument?.body?.innerText?.slice(-500) || "",
    };
});

await page.screenshot({
    path: "/home/takumu/DOOH/artifacts/screenshots/showcase-tap-after.png",
    fullPage: true,
});

console.log(JSON.stringify({ before, after, errors }, null, 2));
await browser.close();

if (before.count !== "14人") process.exitCode = 1;
if (!before.phoneFilter.includes("grayscale(1)")) process.exitCode = 1;
if (after.count !== "15人") process.exitCode = 1;
if (!after.phoneClasses.includes("is-color")) process.exitCode = 1;
if (!after.doohContainsName) process.exitCode = 1;
if (errors.length) process.exitCode = 1;
