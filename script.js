const MARKET_API_URL = "https://finans.truncgil.com/v4/today.json";
const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
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

function hydrateMarket(rawData, ounceData = null) {
  const gramAsset = pick(rawData, ["GRA", "Gram Altın", "gram-altin", "gramAltin", "ALTIN"]);
  const ounceAsset = pick(rawData, ["ONS", "Ons Altın", "ons", "ons-altin", "XAU"]);
  const usdAsset = pick(rawData, ["USD", "Amerikan Doları", "dolar", "US Dollar"]);

  const gram = getBuying(gramAsset);
  const usd = getBuying(usdAsset);
  const apiOunce = parseMarketNumber(ounceData?.price);
  const marketOunce = getBuying(ounceAsset);
  const ounce = apiOunce || marketOunce || (gram && usd ? (gram / usd) * TROY_OUNCE_GRAMS : 0);

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
    ounceData?.updatedAtReadable ||
    rawData.Update_Date ||
    rawData.update_date ||
    new Date().toLocaleString("tr-TR");

  elements.gramPrice.textContent = moneyTRY.format(gram);
  elements.ouncePrice.textContent = moneyUSD.format(ounce);
  elements.usdPrice.textContent = moneyTRY.format(usd);
  elements.derivedGram.textContent = moneyTRY.format((ounce / TROY_OUNCE_GRAMS) * usd);
  elements.updatedAt.textContent = state.lastUpdate;

  setChange(elements.gramChange, getChange(gramAsset));
  if (apiOunce) {
    elements.ounceChange.textContent = "Canlı XAU/USD";
    elements.ounceChange.classList.remove("positive", "negative");
  } else {
    setChange(elements.ounceChange, getChange(ounceAsset));
  }
  setChange(elements.usdChange, getChange(usdAsset));

  renderPresets();
  updateScenario();
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

  renderPresetButtons(elements.usdPresets, [usdBase - 4, usdBase - 2, usdBase, usdBase + 2, usdBase + 4], "usd");
  renderPresetButtons(
    elements.ouncePresets,
    [ounceBase - 100, ounceBase - 50, ounceBase, ounceBase + 50, ounceBase + 100],
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
    const [marketResult, ounceResult] = await Promise.allSettled([
      fetch(MARKET_API_URL, { cache: "no-store" }),
      fetch(GOLD_API_URL, { cache: "no-store" }),
    ]);

    if (marketResult.status !== "fulfilled" || !marketResult.value.ok) {
      throw new Error("Ana piyasa API yanıtı başarısız.");
    }

    const data = await marketResult.value.json();
    const ounceData =
      ounceResult.status === "fulfilled" && ounceResult.value.ok
        ? await ounceResult.value.json()
        : null;

    hydrateMarket(data, ounceData);
    setStatus("Canlı veri aktif", "live");
  } catch (error) {
    hydrateMarket(fallbackMarket);
    setStatus("Canlı veri alınamadı, örnek veri", "error");
    console.warn(error);
  }
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
