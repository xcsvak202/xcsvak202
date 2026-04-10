const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let context;
let page;

// parser remix
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

// init browser
async function initBrowser() {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  context = await browser.newContext();
  page = await context.newPage();

  console.log("Warmup...");
  await page.goto("https://nawala.dev", { waitUntil: "domcontentloaded" });
  console.log("Ready 🚀");
}

// endpoint
app.get("/api/cek", async (req, res) => {
  try {
    let domains = req.query.domain;

    if (!domains) {
      return res.json({ error: "domain kosong" });
    }

    // normalize input
    domains = domains
      .split(/[\n, ]+/)
      .map(d => d.trim())
      .filter(Boolean)
      .slice(0, 100)
      .join(",");

    // refresh page tiap request biar aman
    await page.goto("https://nawala.dev", { waitUntil: "domcontentloaded" });

    const data = await page.evaluate(async (domains) => {
      try {
        const res = await fetch("/_root.data?index", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          },
          body: `domains=${domains}`
        });

        return await res.text();
      } catch (e) {
        return JSON.stringify({ error: "fetch failed inside browser" });
      }
    }, domains);

    const raw = JSON.parse(data);

    // kalau error dari dalam browser
    if (raw.error) {
      return res.json(raw);
    }

    const parsed = parseRemixArray(raw);

    const clean = {
      results: parsed.results || [],
      summary: parsed.summary || {},
      rateLimited: parsed.rateLimited,
      cached: parsed.cached
    };

    res.json(clean);

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("API Nawala FINAL READY 🚀");
});

app.listen(PORT, async () => {
  console.log("Server jalan di port " + PORT);
  await initBrowser();
});
