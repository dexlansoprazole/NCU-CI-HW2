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
    // dataset = dataset.map(data => {
    //   let x = data.x;
    //   let y = data.y;
    //   const dim_x = x.length;
    //   if (dim_x === 3) {
    //     x = x.map(v => (v / 4105 ** 0.5 * 2 - 1));
    //   }
    //   if (dim_x === 5) {
    //     x = x.map((v, i) => {
    //       if (i === 0)
    //         return ((v + 6) / 36 * 2 - 1);
    //       else if (i === 1)
    //         return ((v + 3) / 53 * 2 - 1);
    //       else
    //         return (v / 4105 ** 0.5 * 2 - 1);
    //     });
    //   }
    //   y = (y + 40) / 80 * 2 - 1;
    //   return {x, y};
    // })
    let dim_x = dataset[0].x.length;
    let maxs_x = new Array(dim_x).fill(-Infinity);
    let mins_x = new Array(dim_x).fill(Infinity);
    let avgs_x = new Array(dim_x).fill(0);
    let max_y = -Infinity;
    let min_y = Infinity;
    let avg_y = 0;
    if (dim_x === 3) {
      avg_y = -0.22901084745762695
      avgs_x = [18.08846766101695, 12.619113694915251, 12.939964610169515]
      max_y = 40
      maxs_x = [33.5245, 40.1364, 36.7269]
      min_y = -40
      mins_x = [8.306, 4.6436, 4.8617]
    }
    else if (dim_x === 5) {
      avg_y = -0.22901084745762695
      avgs_x = [
        13.466855593220322,
        17.745421966101706,
        18.08846766101695,
        12.619113694915251,
        12.939964610169515
      ]
      max_y = 40
      maxs_x = [26.5484, 37.9961, 33.5245, 40.1364, 36.7269]
      min_y = -40
      mins_x = [-0.1449, 0, 8.306, 4.6436, 4.8617]
    }


    dataset = dataset.map(data => {
      let x = data.x;
      let y = data.y;
      x = x.map((v, i) => (v - avgs_x[i]) / (maxs_x[i] - mins_x[i]));

      y = (y - avg_y) / (max_y - min_y);
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
    let maxs_x = new Array(dim_x).fill(-Infinity);
    let mins_x = new Array(dim_x).fill(Infinity);
    let avgs_x = new Array(dim_x).fill(0);
    let max_y = -Infinity;
    let min_y = Infinity;
    let avg_y = 0;
    if (dim_x === 3) {
      avg_y = -0.22901084745762695
      avgs_x = [18.08846766101695, 12.619113694915251, 12.939964610169515]
      max_y = 40
      maxs_x = [33.5245, 40.1364, 36.7269]
      min_y = -40
      mins_x = [8.306, 4.6436, 4.8617]
    }
    else if (dim_x === 5) {
      avg_y = -0.22901084745762695
      avgs_x = [
        13.466855593220322,
        17.745421966101706,
        18.08846766101695,
        12.619113694915251,
        12.939964610169515
      ]
      max_y = 40
      maxs_x = [26.5484, 37.9961, 33.5245, 40.1364, 36.7269]
      min_y = -40
      mins_x = [-0.1449, 0, 8.306, 4.6436, 4.8617]
    }

    sensors = [sensors.center.val, sensors.right.val, sensors.left.val];
    // sensors = sensors.map(v => (v / 4105 ** 0.5 * 2 - 1));
    // x = ((x + 6) / 36 * 2 - 1);
    // y = ((y + 3) / 53 * 2 - 1);
    
    let data = null;
    if (dim_x === 3) {
      // data = sensors.slice();
      data = sensors.map((v, i) => (v - avgs_x[i]) / (maxs_x[i] - mins_x[i]));
    }
    else if (dim_x === 5) {
      data = [x, y].concat(sensors);
      data = data.map((v, i) => (v - avgs_x[i]) / (maxs_x[i] - mins_x[i]));
    }

    // return this.predict(Object.values(sensors).map(v => v.val).concat(x, y));
    return this.predict(data) * (max_y - min_y) + avg_y;
    return (this.predict(data) + 1) / 2 * 80 - 40;
  }
}

module.exports = {
  RBFN
}