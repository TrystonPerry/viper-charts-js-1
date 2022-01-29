import EventEmitter from "../../events/event_emitter";

import Utils from "../../utils";

class Dataset extends EventEmitter {
  constructor($global, source, name, timeframe, data) {
    super();
    this.$global = $global;
    this.source = source;
    this.name = name;
    this.timeframe = timeframe;
    this.data = data;
    this.subscribers = {};
  }

  getId() {
    return `${this.source}:${this.name}:${this.timeframe}`;
  }

  getTimeframeAgnosticId() {
    return `${this.source}:${this.name}`;
  }

  /**
   * Update the data and call all subscribers that updates were applied
   * @param {object} dataset
   * @param {object} updates
   */
  updateDataset(updates) {
    // Apply updates
    Object.assign(this.data, updates);

    const timestamps = Object.keys(updates).sort((a, b) => a - b);

    // Update all listeners to re-render this particular element
    for (const chartId in this.subscribers) {
      const chart = this.$global.charts[chartId];

      // Load the visible data for this chart range
      chart.setVisibleRange();

      // Calculate all indicator data for new time additions
      const indicatorIdArray = this.subscribers[chartId];
      for (const renderingQueueId of indicatorIdArray) {
        chart.computedState.calculateOneSet({
          renderingQueueId,
          timestamps,
          dataset: {
            source: this.source,
            name: this.name,
            timeframe: this.timeframe,
            data: this.data,
          },
        });
      }
    }
  }

  addSubscriber(chartId, renderingQueueId) {
    let subscribers = this.subscribers[chartId];
    if (!subscribers) {
      subscribers = [renderingQueueId];
    } else {
      subscribers.push(renderingQueueId);
    }

    this.subscribers[chartId] = subscribers;
  }

  removeSubscriber(chartId, renderingQueueId) {
    const subscribers = this.subscribers[chartId];

    if (!subscribers || !subscribers.length) {
      console.error("No subscribers from chart or subscribers active.");
      return;
    }

    const i = subscribers.indexOf(renderingQueueId);
    subscribers.splice(i, 1);

    // If no more subscribers to this chart, remove this chart
    if (subscribers.length === 0) {
      delete this.subscribers[chartId];
    }

    // If no more subscribers at all, remove from dataset array
    if (!Object.keys(this.subscribers).length) {
      delete this.$global.data.datasets[this.getId()];
    }

    return this.subscribers[chartId] || [];
  }
}

export default class DataState extends EventEmitter {
  constructor({ $global }) {
    super();

    this.$global = $global;
    this.datasets = {};
    this.sources = {};

    this.allRequestedPoints = {};
    this.requestInterval = setInterval(this.fireRequest.bind(this), 250);
  }

  init() {}

  setAllDataSources(sources) {
    this.sources = sources;
    this.fireEvent("set-all-data-sources", this.sources);
  }

  addOrGetDataset({ source, name, timeframe, data = {} }) {
    let dataset;
    const datasetId = `${source}:${name}:${timeframe}`;

    // If dataset does not exist, fetch and create
    if (!this.datasets[datasetId]) {
      dataset = new Dataset(this.$global, source, name, timeframe, data);
      this.datasets[datasetId] = dataset;
    } else {
      dataset = this.datasets[datasetId];
    }

    this.fireEvent("add-dataset", dataset);
    return dataset;
  }

  requestDataPoints({ dataset, start, end }) {
    const { timeframe } = dataset;
    const id = dataset.getId();
    const now = Date.now();

    const requestedPoint = [Infinity, -Infinity];

    // Loop through each requested timestamp and check if any are not found
    for (const timestamp of Utils.getAllTimestampsIn(start, end, timeframe)) {
      // Check if greater than now
      if (timestamp > now) break;

      // Check if in data state
      if (dataset.data[timestamp] !== undefined) continue;

      // Add to state
      if (timestamp < requestedPoint[0]) {
        requestedPoint[0] = timestamp;
      }
      if (timestamp > requestedPoint[1]) {
        requestedPoint[1] = timestamp;
      }
    }

    // Get array of timestamps that are already in data store and check if

    if (requestedPoint[0] === Infinity || requestedPoint[1] === -Infinity) {
      return;
    }

    this.allRequestedPoints[id] = requestedPoint;
  }

  fireRequest() {
    const allRequestedPoints = JSON.parse(
      JSON.stringify(this.allRequestedPoints)
    );
    this.allRequestedPoints = {};
    const datasetIds = Object.keys(allRequestedPoints);

    // Check if any requested times for any datasets
    if (!datasetIds.length) return;

    // Loop through all requested timestamps and mark their dataset data points as fetched
    for (const id of datasetIds) {
      const [start, end] = allRequestedPoints[id];
      const dataset = this.datasets[id];
      const { timeframe } = dataset;

      // This is so data does not get requested again
      for (const timestamp of Utils.getAllTimestampsIn(start, end, timeframe)) {
        dataset.data[timestamp] = null;
      }
    }

    // Build array with requested sources, names, timeframes, and start & end times
    let requests = [];
    for (const id of datasetIds) {
      let [start, end] = allRequestedPoints[id];
      const dataset = this.datasets[id];
      const { source, name, timeframe } = dataset;

      // Loop from end to start timeframe on timeframe * 300 interval to batch requests to max of 300 data points per
      for (let i = (end - start) / (timeframe * 300); i > 0; i--) {
        const leftBound = i <= 1 ? start : end - timeframe * 300;

        requests.push({
          id,
          source,
          name,
          timeframe,
          start: leftBound,
          end,
        });

        end -= timeframe * 100;
      }
    }

    // Sort by latest timestamps
    requests = requests.sort((a, b) => b.end - a.end);

    const callback = (id, updates = {}) => {
      const dataset = this.datasets[id];

      // If dataset was deleted since request was fired
      if (!dataset) return;

      // Update data
      dataset.updateDataset.bind(dataset)(updates);
    };

    this.$global.api.onRequestHistoricalData({
      requests,
      callback: callback.bind(this),
    });
  }
}
