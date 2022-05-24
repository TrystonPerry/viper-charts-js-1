import "./style.css";
import ViperCharts from "./viper";

let Viper;

const apiURL =
  process.env.NODE_ENV === "production"
    ? "https://api.staging.vipercharts.com"
    : "http://localhost:3001";

(async () => {
  const res = await fetch(`${apiURL}/api/markets/get`);
  if (!res.ok) {
    alert("An error occurred when fetching available markets.");
    return;
  }

  const sources = await res.json();

  // Actual chart stuff
  Viper = new ViperCharts({
    element: document.getElementById("chart"),
    sources: sources.data,
    settings: JSON.parse(localStorage.getItem("settings")),
    onRequestHistoricalData,
    onSaveViperSettings,
    onRequestTemplates,
  });

  async function onRequestHistoricalData({ requests, callback }) {
    const { timeframe, start, end } = requests[0];
    const timeseries = [];

    for (let { source, name, dataModels } of requests) {
      for (const dataModel of dataModels) {
        timeseries.push({ source, ticker: name, dataModel });
      }
    }

    for (let i = 0; i < timeseries.length; i += 25) {
      (async () => {
        const sources = timeseries.slice(i, i + 25);

        const res = await fetch(`${apiURL}/api/timeseries/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeframe,
            start,
            end,
            sources,
          }),
        });

        const { data } = await res.json();

        for (const { source, ticker, dataModel } of sources) {
          const setId = `${source}:${ticker}:${timeframe}`;
          const resId = `${source}:${ticker}:${dataModel}`;

          let d = {};
          if (data[resId]) {
            d = data[resId].data;
          }

          callback(setId, d, dataModel);
        }
      })();
    }
  }

  function onSaveViperSettings(settings) {
    localStorage.setItem("settings", JSON.stringify(settings));
  }

  async function onRequestTemplates() {
    const res = await fetch(`${apiURL}/api/templates/get`);
    return (await res.json()).data;
  }
})();
