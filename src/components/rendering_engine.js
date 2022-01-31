import instructions from "../models/instructions.js";
import Utils from "../utils.js";
import Canvas from "./canvas.js";

/**
 * Handles render queue and layers including order
 */
export default class RenderingEngine {
  /**
   * @param {Canvas} canvas
   * @param {object} settings
   */
  constructor({ canvas, $state, type, settings }) {
    this.$state = $state;

    this.canvas = canvas;
    this.type = type;

    this.overlayQueue = new Map();
    /**
     * Rendering order of queue Map IDs (first rendered in back, last rendered in front)
     * @type {Array<string>} id
     */
    this.renderingOrder = [];
    this.lastFrameTime = -1;

    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetH = 1;
    this.offsetW = 1;

    this.initDraw();
  }

  initDraw() {
    requestAnimationFrame(this.recursiveDraw.bind(this));
  }

  recursiveDraw() {
    const t0 = this.lastFrameTime;
    const t1 = performance.now();
    const fps = Math.floor(t0 < 0 ? 0 : 1000 / (t1 - t0));
    this.lastFrameTime = t1;
    this.draw();
    requestAnimationFrame(this.recursiveDraw.bind(this));
  }

  /**
   * Run draw canvas regardless of requesting animation frame or anything.
   * This can be used for when user interacts with the window like resizing
   */
  draw() {
    const instructions = this.$state.chart.instructions[this.type];

    // Reset canvas
    this.canvas.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.type === "yScale") {
      const chartDimension =
        this.$state.global.layout.chartDimensions[this.$state.chart.id];

      // Draw background
      this.canvas.drawBox("#080019", [
        0,
        0,
        chartDimension.width,
        chartDimension.height,
      ]);

      let maxWidth = 0;

      // Loop through all yScale plot instructions and measure the width of all texts and get max width
      for (const key in instructions.plots) {
        // If no instructions for set, continue
        if (!instructions.plots[key].length) continue;

        const [box, text] = instructions.plots[key];
        const { ctx } = this.canvas;

        const textWidth = Math.ceil(ctx.measureText(text.text).width);
        if (textWidth > maxWidth) maxWidth = textWidth;

        // Draw the box and text
        this.canvas.drawBox(box.color, [box.x, box.y, box.w, box.h]);
        this.canvas.drawText(text.color, [text.x, text.y], text.text, {
          font: text.font,
        });
      }

      maxWidth = Math.max((maxWidth += 10), 50);

      // Check if maxWidth is not equal to current width of yScale
      if (maxWidth !== chartDimension.yScale.width) {
        chartDimension.setYScaleWidth(maxWidth);
        this.$state.chart.setVisibleRange({});
      }

      const p = this.$state.global.crosshair.price;
      const { y } =
        this.$state.global.crosshair.crosshairs[this.$state.chart.id];

      if (this.$state.global.crosshair.visible) {
        const { width } =
          this.$state.global.layout.chartDimensions[this.$state.chart.id]
            .yScale;

        this.canvas.drawBox("#424242", [0, y - 10, width, 20]);
        this.canvas.drawText("#fff", [width / 2, y + 3], p);
      }

      return;
    }

    const ids = [...this.renderingOrder];

    const allInstructions = instructions;

    // If no instructions
    if (!allInstructions || typeof allInstructions !== "object") {
      return;
    }

    if (this.type === "xScale") {
      for (const id of ids) {
        let item = this.overlayQueue.get(id);

        // If overlay and not indicator
        if (item) {
          const { overlay } = item;
          overlay.drawFunc.bind(overlay)();
        }
      }
    }

    if (this.type === "main") {
      // Loop through all rendering ids
      for (const id of ids) {
        let item = this.overlayQueue.get(id);

        // If overlay and not indicator
        if (item) {
          const { overlay } = item;
          overlay.drawFunc.bind(overlay)();
          continue;
        }

        // Else, is this an indicator?
        const layer = instructions.layers[0][id];
        if (!layer) continue;

        const times = Object.keys(layer);

        const parseInstruction = (a, i, j) => {
          const { offsetX, offsetY, offsetW, offsetH } = this;

          if (a.type === "line") {
            if (i === undefined || j === undefined) return;
            let b = layer[times[i + 1]];
            if (!b) return;
            b = b[j];
            this.canvas.drawLine(
              a.color,
              [a.x + offsetX, a.y + offsetY, b.x + offsetX, b.y + offsetY],
              a.linewidth
            );
          } else if (a.type === "box") {
            this.canvas.drawBox(a.color, [
              a.x + offsetX,
              a.y + offsetY,
              a.w,
              a.h,
            ]);
          } else if (a.type === "single-line") {
            this.canvas.drawLine(a.color, [
              a.x + offsetX,
              a.y + offsetY,
              a.x2 + offsetX,
              a.y2 + offsetY,
            ]);
          } else if (a.type === "text") {
            this.canvas.drawText(
              a.color,
              [a.x + offsetX, a.y + offsetY],
              a.text,
              { font: a.font }
            );
          }
        };

        if (this.type === "main") {
          for (let i = 0; i < times.length; i++) {
            const instructionsForTime = layer[times[i]];
            for (let j = 0; j < instructionsForTime.length; j++) {
              parseInstruction(instructionsForTime[j], i, j);
            }
          }
        } else {
          parseInstruction(allInstructions[id]);
        }
      }
    }
  }

  addToRenderingOrder(id, index = this.renderingOrder.length) {
    this.renderingOrder.join();
    this.renderingOrder.splice(index, 0, id);
  }

  removeFromRenderingOrder(id) {
    const i = this.renderingOrder.indexOf(id);
    delete instructions[id];
    this.renderingOrder.splice(i, 1);
  }

  adjustInstructions({ newRange, oldRange }) {
    const { width, height } = this.canvas;

    const newRangeWidth = newRange.end - newRange.start;
    const newRangeHeight = newRange.max - newRange.min;

    const leftOffset = oldRange.start - newRange.start;
    const rightOffset = oldRange.end - newRange.end;
    if (leftOffset !== rightOffset) {
    }

    // Calculate percentage difference between widths
    const x = -((newRange.start - oldRange.start) / newRangeWidth) * width;
    const y = ((newRange.min - oldRange.min) / newRangeHeight) * height;
  }

  addOverlay(overlay) {
    let id = Utils.uniqueId();
    do {
      id = Utils.uniqueId();
    } while (this.renderingOrder.includes(id));

    this.overlayQueue.set(id, {
      overlay,
      visible: true,
    });

    this.addToRenderingOrder(id);

    return id;
  }
}
