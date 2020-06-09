const {range} = require('lodash');
class Fuzzy{
  constructor(SENSOR_LENGTH = {center: 8, left: 12, right: 12}) {
    this.SENSOR_LENGTH = SENSOR_LENGTH;
    this.CAR_SIZE = 3;
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
        if (center <= this.CAR_SIZE)
          return 1;
        if (center > this.CAR_SIZE && center <= this.SENSOR_LENGTH.center)
          return -center / this.SENSOR_LENGTH.center + 1;
        if (center > this.SENSOR_LENGTH.center)
          return 0;
      },
      leftIsClose: (left) => {
        if (left <= this.CAR_SIZE)
          return 1;
        if (left > this.CAR_SIZE && left <= this.SENSOR_LENGTH.left)
          return -left / this.SENSOR_LENGTH.left + 1;
        if (left > this.SENSOR_LENGTH.left)
          return 0;
      },
      rightIsClose: (right) => {
        if (right <= this.CAR_SIZE)
          return 1;
        if (right > this.CAR_SIZE && right <= this.SENSOR_LENGTH.right)
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