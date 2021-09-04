export class HeartBeat {
  private _key: string;
  private _heartBeatIntervalTime: number;
  private _heartBeatDetectIntervalTime: number;
  private _heartBeatIntervalId: null | ReturnType<typeof setTimeout> = null;
  private _heartBeatDetectIntervalId: null | ReturnType<typeof setTimeout> =
    null;
  constructor({
    key,
    heartBeatIntervalTime = 1000,
    heartBeatDetectIntervalTime = 1000 * 2,
  }: {
    key: string;
    heartBeatIntervalTime?: number;
    heartBeatDetectIntervalTime?: number;
  }) {
    this._key = key;
    this._heartBeatIntervalTime = heartBeatIntervalTime;
    this._heartBeatDetectIntervalTime = heartBeatDetectIntervalTime;
    window.addEventListener("unload", () => {
      this.destroy();
    });
  }

  start() {
    this._heartBeatIntervalId = setInterval(() => {
      this._setLocalTime();
    }, this._heartBeatIntervalTime);
  }

  destroy() {
    if (this._heartBeatIntervalId) {
      clearInterval(this._heartBeatIntervalId);
    }
    if (this._heartBeatDetectIntervalId) {
      clearInterval(this._heartBeatDetectIntervalId);
    }
  }

  private _setLocalTime() {
    window.localStorage.setItem(this._key, Date.now().toString());
  }

  detect(cb: () => void) {
    this._heartBeatDetectIntervalId = setInterval(() => {
      cb();
    }, this._heartBeatDetectIntervalTime);
  }
}
