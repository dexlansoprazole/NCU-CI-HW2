const {range} = require('lodash');
class Fuzzy{
  constructor(SENSOR_LENGTH = {center: 5, left: 9, right: 9}) {
    this.SENSOR_LENGTH = SENSOR_LENGTH;
    this.operations = {
      and: (...funcs) => {
        return (v) => {
          return Math.min(...funcs.map(func => func(v)));
        }
      },
      or: (...funcs) => {
        return (v) => {
          return Math.max(...funcs.map(func => func(v)));
        }
      }
    }
  
    this.membershipFuncs = {
      centerIsClose: (center) => {
        if (center <= 0)
          return 1;
        if (center > 0 && center <= this.SENSOR_LENGTH.center)
          return -center / this.SENSOR_LENGTH.center + 1;
        if (center > this.SENSOR_LENGTH.center)
          return 0;
      },
      leftIsClose: (left) => {
        if (left <= 0)
          return 1;
        if (left > 0 && left <= this.SENSOR_LENGTH.left)
          return -left / this.SENSOR_LENGTH.left + 1;
        if (left > this.SENSOR_LENGTH.left)
          return 0;
      },
      rightIsClose: (right) => {
        if (right <= 0)
          return 1;
        if (right > 0 && right <= this.SENSOR_LENGTH.right)
          return -right / this.SENSOR_LENGTH.right + 1;
        if (right > this.SENSOR_LENGTH.right)
          return 0;
      },
      handleIsRight: (handle) => {
        if (handle <= 0)
          return 0;
        return handle / 40;
      },
      handleIsLeft: (handle) => {
        if (handle >= 0)
          return 0;
        return -handle / 40;
      }
    };
  
    this.rules = {
      ifCenterIsCloseThenHandleIsRight: (center) => {
        return (handle) => {
          let alpha = this.membershipFuncs.centerIsClose(center);
          return Math.min(alpha, this.membershipFuncs.handleIsRight(handle));
        }
      },
      ifLeftIsCloseThenHandleIsRight: (left) => {
        return (handle) => {
          let alpha = this.membershipFuncs.leftIsClose(left);
          return Math.min(alpha, this.membershipFuncs.handleIsRight(handle));
        }
      },
      ifRightIsCloseThenHandleIsLeft: (right) => {
        return (handle) => {
          let alpha = this.membershipFuncs.rightIsClose(right);
          return Math.min(alpha, this.membershipFuncs.handleIsLeft(handle));
        }
      }
    };
  }

  defuzzizier(set, r){
    let samples = r.map(v => set(v));
    let max = Math.max(...samples);
    let ys = new Array();
    samples.forEach((s, i) => {
      if (s === max)
        ys.push(r[i]);
    });
    let y = ys.reduce((a, b) => a + b) / ys.length;
    return y;
  }

  handle(sensors){
    let fuzzySet = this.operations.or(
      this.rules.ifCenterIsCloseThenHandleIsRight(sensors.center.val),
      this.rules.ifLeftIsCloseThenHandleIsRight(sensors.left.val),
      this.rules.ifRightIsCloseThenHandleIsLeft(sensors.right.val),
    );
    return this.defuzzizier(fuzzySet, range(-40, 41, 1));
  }
}

module.exports = {
  Fuzzy
}