const MARKET_API_URL = "https://finans.truncgil.com/v4/today.json";
const YAHOO_CHART_API = "https://query1.finance.yahoo.com/v8/finance/chart/";
const YAHOO_SYMBOLS = {
  usdTry: "USDTRY=X",
  goldOunce: "GC=F",
};
const TROY_OUNCE_GRAMS = 31.1034768;

const fallbackMarket = {
  Update_Date: "Yerel örnek veri",
  USD: { Buying: "40.85", Change: "0" },
  GRA: { Buying: "4320", Change: "0" },
  ONS: { Buying: "4710", Change: "0" },
};

const state = {
  gram: 0,
  ounce: 0,
  usd: 0,
  targetOunce: 0,
  targetUsd: 0,
  premiumFactor: 1,
  lastUpdate: "",
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  dataStatus: $("#dataStatus"),
  gramPrice: $("#gramPrice"),
  gramChange: $("#gramChange"),
  ouncePrice: $("#ouncePrice"),
  ounceChange: $("#ounceChange"),
  usdPrice: $("#usdPrice"),
  usdChange: $("#usdChange"),
  derivedGram: $("#derivedGram"),
  ounceMove: $("#ounceMove"),
  usdMove: $("#usdMove"),
  ounceMoveLabel: $("#ounceMoveLabel"),
  usdMoveLabel: $("#usdMoveLabel"),
  scenarioPrice: $("#scenarioPrice"),
  scenarioDelta: $("#scenarioDelta"),
  liveOunceValue: $("#liveOunceValue"),
  targetOunceInput: $("#targetOunceInput"),
  ouncePresets: $("#ouncePresets"),
  liveUsdValue: $("#liveUsdValue"),
  targetUsdInput: $("#targetUsdInput"),
  usdPresets: $("#usdPresets"),
  ounceOneImpact: $("#ounceOneImpact"),
  usdOneImpact: $("#usdOneImpact"),
  combinedOneImpact: $("#combinedOneImpact"),
  updatedAt: $("#updatedAt"),
  refreshButton: $("#refreshButton"),
};

const moneyTRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

const moneyUSD = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberTR = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 4,
});

function parseMarketNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const cleaned = String(value).trim().replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  return Number.parseFloat(normalized) || 0;
}

function pick(data, keys) {
  for (const key of keys) {
    if (data[key]) return data[key];
  }
  return null;
}

function getBuying(asset) {
  return parseMarketNumber(asset?.Buying ?? asset?.buying ?? asset?.Alış ?? asset?.alis);
}

function getChange(asset) {
  return parseMarketNumber(asset?.Change ?? asset?.change ?? asset?.Değişim ?? asset?.degisim);
}

function formatChange(change) {
  const sign = change > 0 ? "+" : "";
  return `${sign}${numberTR.format(change)}%`;
}

function setStatus(text, mode = "") {
  elements.dataStatus.classList.toggle("is-live", mode === "live");
  elements.dataStatus.classList.toggle("is-error", mode === "error");
  elements.dataStatus.querySelector("span:last-child").textContent = text;
}

function setChange(element, change) {
  element.textContent = formatChange(change);
  element.classList.toggle("positive", change > 0);
  element.classList.toggle("negative", change < 0);
}

function hydrateMarket(rawData, yahooData = null) {
  const gramAsset = pick(rawData, ["GRA", "Gram Altın", "gram-altin", "gramAltin", "ALTIN"]);
  const usdAsset = pick(rawData, ["USD", "Amerikan Doları", "dolar", "US Dollar"]);

  const gram = getBuying(gramAsset);
  const yahooUsd = parseMarketNumber(yahooData?.usdTry?.price);
  const yahooOunce = parseMarketNumber(yahooData?.goldOunce?.price);
  const usd = yahooUsd || getBuying(usdAsset);
  const ounce = yahooOunce || (gram && usd ? (gram / usd) * TROY_OUNCE_GRAMS : 0);

  if (!gram || !ounce || !usd) {
    throw new Error("Piyasa verisinde gram altın, ons veya USD/TRY bulunamadı.");
  }

  state.gram = gram;
  state.ounce = ounce;
  state.usd = usd;
  state.targetOunce = ounce;
  state.targetUsd = usd;
  state.premiumFactor = gram / ((ounce / TROY_OUNCE_GRAMS) * usd);
  state.lastUpdate =
    yahooData?.updatedAt ||
    rawData.Update_Date ||
    rawData.update_date ||
    new Date().toLocaleString("tr-TR");

  elements.gramPrice.textContent = moneyTRY.format(gram);
  elements.ouncePrice.textContent = moneyUSD.format(ounce);
  elements.usdPrice.textContent = moneyTRY.format(usd);
  elements.derivedGram.textContent = moneyTRY.format((ounce / TROY_OUNCE_GRAMS) * usd);
  elements.updatedAt.textContent = state.lastUpdate;

  setChange(elements.gramChange, getChange(gramAsset));
  setYahooChange(elements.ounceChange, yahooData?.goldOunce);
  setYahooChange(elements.usdChange, yahooData?.usdTry);

  renderPresets();
  updateScenario();
}

function setYahooChange(element, quote) {
  const change = parseMarketNumber(quote?.changePercent);
  if (!quote || Number.isNaN(change)) {
    element.textContent = "Yahoo verisi bekleniyor";
    element.classList.remove("positive", "negative");
    return;
  }

  element.textContent = `Yahoo ${formatChange(change)}`;
  element.classList.toggle("positive", change > 0);
  element.classList.toggle("negative", change < 0);
}

function updateScenario() {
  if (!state.gram) return;

  const scenarioOunce = state.targetOunce || state.ounce;
  const scenarioUsd = state.targetUsd || state.usd;
  const ounceMove = (scenarioOunce / state.ounce - 1) * 100;
  const usdMove = (scenarioUsd / state.usd - 1) * 100;
  const scenario = state.gram * (scenarioOunce / state.ounce) * (scenarioUsd / state.usd);
  const delta = scenario - state.gram;
  const deltaPercent = (scenario / state.gram - 1) * 100;

  syncRange(elements.ounceMove, ounceMove);
  syncRange(elements.usdMove, usdMove);
  elements.ounceMoveLabel.textContent = `${numberTR.format(ounceMove)}%`;
  elements.usdMoveLabel.textContent = `${numberTR.format(usdMove)}%`;
  elements.liveOunceValue.textContent = moneyUSD.format(state.ounce);
  elements.liveUsdValue.textContent = moneyTRY.format(state.usd);
  elements.targetOunceInput.value = formatInputNumber(scenarioOunce, 2);
  elements.targetUsdInput.value = formatInputNumber(scenarioUsd, 2);
  elements.scenarioPrice.textContent = moneyTRY.format(scenario);
  elements.scenarioDelta.textContent = `${delta >= 0 ? "+" : ""}${moneyTRY.format(delta)} (${formatChange(deltaPercent)})`;
  elements.scenarioDelta.classList.toggle("positive", delta > 0);
  elements.scenarioDelta.classList.toggle("negative", delta < 0);

  elements.ounceOneImpact.textContent = `+${moneyTRY.format(state.gram * 0.01)}`;
  elements.usdOneImpact.textContent = `+${moneyTRY.format(state.gram * 0.01)}`;
  elements.combinedOneImpact.textContent = `+${moneyTRY.format(state.gram * 0.0201)}`;
}

function updateRangeFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const fill = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${fill}%`);
}

function syncRange(input, value) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.value = Math.min(max, Math.max(min, value));
  updateRangeFill(input);
}

function formatInputNumber(value, fractionDigits) {
  return Number(value).toFixed(fractionDigits).replace(/\.?0+$/, "");
}

function renderPresets() {
  const usdBase = Math.round(state.usd);
  const ounceBase = Math.round(state.ounce / 50) * 50;

  renderPresetButtons(
    elements.usdPresets,
    [usdBase - 6, usdBase - 4, usdBase - 2, usdBase, usdBase + 2, usdBase + 4, usdBase + 6],
    "usd",
  );
  renderPresetButtons(
    elements.ouncePresets,
    [ounceBase - 150, ounceBase - 100, ounceBase - 50, ounceBase, ounceBase + 50, ounceBase + 100, ounceBase + 150],
    "ounce",
  );
}

function renderPresetButtons(container, values, type) {
  container.replaceChildren(
    ...values.map((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = type === "usd" ? numberTR.format(value) : `$${numberTR.format(value)}`;
      button.addEventListener("click", () => {
        if (type === "usd") {
          state.targetUsd = value;
        } else {
          state.targetOunce = value;
        }
        updateScenario();
      });
      return button;
    }),
  );
}

async function fetchMarket() {
  setStatus("Canlı veri alınıyor");

  try {
    const [marketResult, yahooResult] = await Promise.allSettled([
      fetch(MARKET_API_URL, { cache: "no-store" }),
      fetchYahooQuotes(),
    ]);

    if (marketResult.status !== "fulfilled" || !marketResult.value.ok) {
      throw new Error("Ana piyasa API yanıtı başarısız.");
    }

    const data = await marketResult.value.json();
    const yahooData = yahooResult.status === "fulfilled" ? yahooResult.value : null;

    hydrateMarket(data, yahooData);
    setStatus(yahooData ? "Yahoo verisi aktif" : "Yahoo alınamadı, yedek veri", yahooData ? "live" : "error");
  } catch (error) {
    hydrateMarket(fallbackMarket);
    setStatus("Canlı veri alınamadı, örnek veri", "error");
    console.warn(error);
  }
}

async function fetchYahooQuotes() {
  const [usdTry, goldOunce] = await Promise.all([
    fetchYahooChart(YAHOO_SYMBOLS.usdTry),
    fetchYahooChart(YAHOO_SYMBOLS.goldOunce),
  ]);

  return {
    usdTry,
    goldOunce,
    updatedAt: new Date(Math.max(usdTry.timestamp, goldOunce.timestamp) * 1000).toLocaleString("tr-TR"),
  };
}

async function fetchYahooChart(symbol) {
  const response = await fetch(`${YAHOO_CHART_API}${encodeURIComponent(symbol)}?range=1d&interval=1m`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${symbol} yanıtı başarısız: ${response.status}`);
  }

  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const timestamps = result?.timestamp || [];
  const lastIndex = closes.map(Number).findLastIndex((value) => Number.isFinite(value) && value > 0);
  const price = Number.isFinite(Number(meta?.regularMarketPrice))
    ? Number(meta.regularMarketPrice)
    : Number(closes[lastIndex]);
  const previousClose = Number(meta?.chartPreviousClose || meta?.previousClose || 0);
  const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Yahoo ${symbol} fiyatı okunamadı.`);
  }

  return {
    price,
    changePercent,
    timestamp: Number(meta?.regularMarketTime || timestamps[lastIndex] || Date.now() / 1000),
  };
}

elements.ounceMove.addEventListener("input", () => {
  state.targetOunce = state.ounce * (1 + parseMarketNumber(elements.ounceMove.value) / 100);
  updateScenario();
});
elements.usdMove.addEventListener("input", () => {
  state.targetUsd = state.usd * (1 + parseMarketNumber(elements.usdMove.value) / 100);
  updateScenario();
});
elements.targetOunceInput.addEventListener("input", () => {
  state.targetOunce = parseMarketNumber(elements.targetOunceInput.value) || state.ounce;
  updateScenario();
});
elements.targetUsdInput.addEventListener("input", () => {
  state.targetUsd = parseMarketNumber(elements.targetUsdInput.value) || state.usd;
  updateScenario();
});
elements.refreshButton.addEventListener("click", fetchMarket);

elements.ounceMove.value = 0;
elements.usdMove.value = 0;
updateRangeFill(elements.ounceMove);
updateRangeFill(elements.usdMove);
fetchMarket();
setInterval(fetchMarket, 120000);
