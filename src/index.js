import "./style.css";
import ViperCharts from "./viper";

let Viper;

(async () => {
  // Get all FTX markets and parse into sources object
  const res = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
  const json = await res.json();

  const sources = {
    BINANCE: [],
  };

  // Convert all Binance Futures symbols to datasets with one dataModel (price)
  for (const { symbol } of json.symbols) {
    sources.BINANCE.push({
      source: "BINANCE", // Source matches the sources['SOURCE NAME']
      name: symbol,
      // All data models
      models: [
        {
          id: "price", // dataModel unique id scoped in dataset
          label: `BINANCE ${symbol}`, // A label for plotting on y axis
          model: "ohlc", // Data model type. See /src/components/data_models.js for full list of datamodel types
          name: "Price", // Name for UI purposes
        },
      ],
    });
  }

  // Actual chart stuff
  Viper = new ViperCharts({
    element: document.getElementById("chart"),
    sources: sources,
    settings: JSON.parse(localStorage.getItem("settings")),
    onRequestHistoricalData,
    onSaveViperSettings,
  });

  // New request for data
  async function onRequestHistoricalData({ requests, callback }) {
    // Loop through all dataset requests
    for (const {
      source,
      name,
      dataModels,
      timeframe,
      start,
      end,
    } of requests) {
      // If the source is Binance, fetch from Binance API
      if (source === "BINANCE") {
        // Loop through all requested dataModels of dataset eg: Price, Volume, Open Interest
        for (const dataModel of dataModels) {
          // Fetch implementation for price
          if (dataModel === "price") {
            // Convert ms timestamp to Binance parseable interval string
            const interval = {
              1: "1m",
              5: "5m",
              15: "15m",
              60: "1h",
              240: "4h",
              1440: "1d",
            }[timeframe / 60000];

            const res = await fetch(
              `https://fapi.binance.com/fapi/v1/klines?symbol=${name}&interval=${interval}&startTime=${start}&end=${end}&limit=${300}`
            );
            const json = await res.json();
            const data = {};

            // Convert data from array to object
            for (const item of json) {
              data[new Date(item[0]).toISOString()] = {
                open: +item[1],
                high: +item[2],
                low: +item[3],
                close: +item[4],
              };
            }

            callback(`${source}:${name}:${timeframe}`, data, dataModel);
          }
        }
      }
    }
  }

  // Add persistent storage using local storage
  function onSaveViperSettings(settings) {
    localStorage.setItem("settings", JSON.stringify(settings));
  }
})();
