import EventEmitter from "../../events/event_emitter";

export default class EventsState extends EventEmitter {
  constructor({ $global }) {
    super();

    this.$global = $global;
  }

  init() {
    this.mouseDownListener = this.onMouseDown.bind(this);
    window.addEventListener("mousedown", this.mouseDownListener);
    this.mouseUpListener = this.onMouseUp.bind(this);
    window.addEventListener("mouseup", this.mouseUpListener);
    this.mouseMoveListener = this.onMouseMove.bind(this);
    window.addEventListener("mousemove", this.mouseMoveListener);
    this.keyUpListener = this.onKeyUp.bind(this);
    window.addEventListener("keyup", this.keyUpListener);
  }

  destroy() {
    window.removeEventListener("mousedown", this.mouseDownListener);
    window.removeEventListener("mouseup", this.mouseUpListener);
    window.removeEventListener("mousemove", this.mouseMoveListener);
    window.removeEventListener("keyup", this.keyUpListener);
  }

  onMouseDown(e) {
    this.fireEvent("mousedown", e);
  }

  onMouseUp(e) {
    this.fireEvent("mouseup", e);
  }

  onMouseMove(e) {
    this.fireEvent("mousemove", e);
  }

  onKeyUp(e) {
    const { code } = e;
    if (code === "Delete") this.$global.deleteSelectedChart();

    this.fireEvent("keyup", e);
  }
}
