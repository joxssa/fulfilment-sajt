// Renderuje _mockup/*.html u webp snimke za sajt (1400/800/480), isti nazivi kao postojeći.
//   node _mockup/snimi-mockup.cjs narudzbine topoms-narudzbine-pregled-fulfilment 636
const path = require("path");
const { execFileSync } = require("child_process");
const puppeteer = require("C:/repos/sus-radna-soba/node_modules/puppeteer-core");

const CHROME = "C:/Users/rutif/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const FF = "G:/LazarClaude/node_modules/ffmpeg-static/ffmpeg.exe";
const REPO = "C:/repos/fulfilment-sajt";

const [izvor, ime, visinaArg] = process.argv.slice(2);
if (!izvor || !ime) {
  console.error("upotreba: node _mockup/snimi-mockup.cjs <html-bez-nastavka> <ime-slike> [visina]");
  process.exit(2);
}
const visina = Number(visinaArg || 0);

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--force-device-scale-factor=2"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1400, height: visina || 800, deviceScaleFactor: 2 });
  await p.goto("file:///" + path.join(REPO, "_mockup", izvor + ".html").split(path.sep).join("/"), { waitUntil: "networkidle0" });
  const pun = path.join(REPO, "_mockup", "_sirovo-" + ime + ".png");
  await p.screenshot({ path: pun, clip: { x: 0, y: 0, width: 1400, height: visina || (await p.evaluate(() => document.body.scrollHeight)) } });
  await b.close();

  for (const w of [1400, 800, 480]) {
    const izlaz = path.join(REPO, "images", `${ime}-${w}.webp`);
    execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", "-i", pun, "-vf", `scale=${w}:-2:flags=lanczos`, "-quality", "82", izlaz]);
    console.log("napravljeno", path.basename(izlaz));
  }
})().catch((e) => { console.error("GRESKA", e.message); process.exit(1); });
