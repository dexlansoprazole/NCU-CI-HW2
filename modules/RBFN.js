const {app} = require('electron');
const fs = require('fs');
const path = require('path');
const {GeneticOpt} = require('./GeneticOpt');
const {ParticalSwarmOpt} = require('./ParticalSwarmOpt');

class RBFN {
  constructor(
    neuron_count,
    opt = 'genetic',
    opt_cfg = undefined,
    params = {theta: 0, w: new Array(neuron_count).fill(0.0), m: new Array(neuron_count), sigma: new Array(neuron_count).fill(0.0)}
  ) {
    this.J = neuron_count;
    this.theta = params.theta;
    this.w = params.w;
    this.m = params.m;
    this.sigma = params.sigma;
    switch (opt) {
      case 'gene':
        this.optimizer = new GeneticOpt(opt_cfg, this.predict, neuron_count);
        break;
      case 'pso':
        this.optimizer = new ParticalSwarmOpt(opt_cfg, this.predict, neuron_count);
        break;
    }
  }

  normalization(dataset) {
    dataset = dataset.map(data => {
      let x = data.x;
      let y = data.y;
      const dim_x = x.length;
      if (dim_x === 3) {
        x = x.map(v => (v / 4105 ** 0.5 * 2 - 1));
      }
      if (dim_x === 5) {
        x = x.map((v, i) => {
          if (i === 0)
            return ((v + 6) / 36 * 2 - 1);
          else if (i === 1)
            return ((v + 3) / 53 * 2 - 1);
          else
            return (v / 4105 ** 0.5 * 2 - 1);
        });
      }
      y = (y + 40) / 80 * 2 - 1;
      return {x, y};
    })
    return dataset;
  }

  fit(train_set) {
    this.train_set = train_set;
    let train_set_norm = this.normalization(train_set);
    let result = this.optimizer.train(train_set_norm);
    this.theta = result.theta;
    this.w = result.w;
    this.m = result.m;
    this.sigma = result.sigma;
    return train_set_norm;
  }

  predict(x, theta = this.theta, w = this.w, m = this.m, sigma = this.sigma) {
    const gaussian = (x, m, sigma) => {
      let l = m.map((v, i) => ((x[i] - v) ** 2));
      let sum = l.reduce((a, b) => a + b);
      let res = Math.exp(-(sum / (2 * (sigma ** 2))));
      return res;
    }

    let result = 0;
    for (let j = 0; j < this.J; j++){
      result += w[j] * gaussian(x, m[j], sigma[j]);
    }
    result += theta;
    if (result > 1) result = 1;
    if (result < -1) result = -1;
    return result;
  }

  getParams() {
    let params = [this.theta];
    this.w.forEach((w, i) => {
      params.push((new Array()).concat(w, this.m[i], this.sigma[i]).join(' '));
    });
    params = params.join('\n');
    return params;
  }

  handle(x, y, sensors) {
    // Normalization
    const dim_x = this.m[0].length;
    sensors = [sensors.center.val, sensors.right.val, sensors.left.val];
    sensors = sensors.map(v => (v / 4105 ** 0.5 * 2 - 1));
    x = ((x + 6) / 36 * 2 - 1);
    y = ((y + 3) / 53 * 2 - 1);
    
    let data = null;
    if (dim_x === 3) {
      data = sensors.slice();
    }
    else if (dim_x === 5) {
      data = [x, y].concat(sensors);
    }
    return (this.predict(data) + 1) / 2 * 80 - 40;
  }
}

module.exports = {
  RBFN
}