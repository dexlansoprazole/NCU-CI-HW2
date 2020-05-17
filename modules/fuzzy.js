const {range} = require('lodash')
const SENSOR_LENGTH = {
  center: 5,
  left: 9,
  right: 9
};

const operations = {
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

const membershipFuncs = {
  centerIsClose: (center) => {
    if (center <= 0)
      return 1;
    if (center > 0 && center <= SENSOR_LENGTH.center)
      return -center / SENSOR_LENGTH.center + 1;
    if (center > SENSOR_LENGTH.center)
      return 0;
  },
  leftIsClose: (left) => {
    if (left <= 0)
      return 1;
    if (left > 0 && left <= SENSOR_LENGTH.left)
      return -left / SENSOR_LENGTH.left + 1;
    if (left > SENSOR_LENGTH.left)
      return 0;
  },
  rightIsClose: (right) => {
    if (right <= 0)
      return 1;
    if (right > 0 && right <= SENSOR_LENGTH.right)
      return -right / SENSOR_LENGTH.right + 1;
    if (right > SENSOR_LENGTH.right)
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

const rules = {
  ifCenterIsCloseThenHandleIsRight: (center) => {
    return (handle) => {
      let alpha = membershipFuncs.centerIsClose(center);
      return Math.min(alpha, membershipFuncs.handleIsRight(handle));
    }
  },
  ifLeftIsCloseThenHandleIsRight: (left) => {
    return (handle) => {
      let alpha = membershipFuncs.leftIsClose(left);
      return Math.min(alpha, membershipFuncs.handleIsRight(handle));
    }
  },
  ifRightIsCloseThenHandleIsLeft: (right) => {
    return (handle) => {
      let alpha = membershipFuncs.rightIsClose(right);
      return Math.min(alpha, membershipFuncs.handleIsLeft(handle));
    }
  }
};

const defuzzizier = (set, r) => {
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

const fuzzyHandle = (sensors) => {
  let fuzzySet = operations.or(
    rules.ifCenterIsCloseThenHandleIsRight(sensors.center.val),
    rules.ifLeftIsCloseThenHandleIsRight(sensors.left.val),
    rules.ifRightIsCloseThenHandleIsLeft(sensors.right.val),
  );
  return defuzzizier(fuzzySet, range(-40, 41, 1));
}

module.exports = {
  fuzzyHandle
}