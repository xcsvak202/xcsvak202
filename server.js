const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

// parser remix (decode response aneh)
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

// init browser (sekali doang)
async function initBrowser() {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext();
  page = await context.newPage();

  console.log("Warmup nawala...");
  await page.goto("https://nawala.dev");
  console.log("Browser ready 🚀");
}

// endpoint GET (multi domain)
app.get("/api/cek", async (req, res) => {
  try {
    let domains = req.query.domain;

    if (!domains) {
      return res.json({ error: "domain kosong" });
    }

    // support banyak format
    domains = domains
      .split(/[\n, ]+/)
      .map(d => d.trim())
      .filter(Boolean)
      .slice(0, 100)
      .join(",");

    const data = await page.evaluate(async (domains) => {
      const res = await fetch("/_root.data?index", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `domains=${domains}`
      });
      return await res.text();
    }, domains);

    const raw = JSON.parse(data);
    const parsed = parseRemixArray(raw);

    // clean response
    const clean = {
      results: parsed.results,
      summary: parsed.summary,
      rateLimited: parsed.rateLimited,
      cached: parsed.cached
    };

    res.json(clean);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error fetch" });
  }
});

app.get("/", (req, res) => {
  res.send("API Nawala READY 🚀");
});

app.listen(PORT, async () => {
  console.log("Server jalan di port " + PORT);
  await initBrowser();
});
