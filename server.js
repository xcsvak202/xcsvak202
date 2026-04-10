const express = require("express");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// parser
function parseRemixArray(data) {
  function resolve(val) {
    if (typeof val === "object" && val !== null) {
      const result = {};
      for (const key in val) {
        const realKey = data[val[key]];
        const realVal = resolve(data[val[key] + 1]);
        result[realKey] = realVal;
      }
      return result;
    }
    return val;
  }
  return resolve(data[2]);
}

async function initBrowser() {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  });

  page = await context.newPage();

  console.log("Warmup...");
  await page.goto("https://nawala.dev");
  await sleep(3000);

  console.log("READY 🚀");
}

app.get("/api/cek", async (req, res) => {
  try {
    let domains = req.query.domain;

    if (!domains) {
      return res.json({ error: "domain kosong" });
    }

    domains = domains
      .split(/[\n, ]+/)
      .map(d => d.trim())
      .filter(Boolean)
      .slice(0, 100)
      .join(",");

    // refresh + delay
    await page.goto("https://nawala.dev");
    await sleep(2000);

    let data;

    for (let i = 0; i < 3; i++) {
      data = await page.evaluate(async (domains) => {
        const res = await fetch("/_root.data?index", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          },
          body: `domains=${domains}`
        });
        return await res.text();
      }, domains);

      if (!data.startsWith("<")) break;

      // retry delay
      await sleep(2000);
    }

    if (data.startsWith("<")) {
      return res.json({ error: "Cloudflare masih block (retry lagi)" });
    }

    const raw = JSON.parse(data);
    const parsed = parseRemixArray(raw);

    res.json({
      results: parsed.results,
      summary: parsed.summary
    });

  } catch (err) {
    console.error(err);
    res.json({ error: "fail fetch" });
  }
});

app.get("/", (req, res) => {
  res.send("FREE VERSION READY 🔥");
});

app.listen(PORT, async () => {
  console.log("Server jalan " + PORT);
  await initBrowser();
});
