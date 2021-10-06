import Canvas from "../canvas.js";
import Background from "./background.js";
import PriceSelected from "./price_selected.js";

export default class TimeScale {
  constructor({ $state }) {
    this.$state = $state;

    this.canvas = null;
  }

  init() {
    this.canvas = new Canvas({
      $state: this.$state,
      id: `canvas-pricescale`,
      canvas:
        this.$state.global.ui.charts[this.$state.chart.id].subcharts.yScale
          .current,
      height: this.$state.dimensions.height - 20,
      width: 50,
      cursor: "n-resize",
      position: "right",
    });

    new Background({
      $state: this.$state,
      canvas: this.canvas,
      color: "#080019",
    });
    new PriceSelected({ $state: this.$state, canvas: this.canvas });

    this.$state.global.layout.addEventListener(
      `resize-${this.$state.chart.id}`,
      ({ yScale }) => {
        this.canvas.setHeight(yScale.height);
      }
    );
  }
}
