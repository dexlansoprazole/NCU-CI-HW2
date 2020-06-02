const {app} = require('electron');
const fs = require('fs');
const path = require('path');
const {GeneticOpt} = require('./GeneticOpt');

class RBFN {
  constructor(neuron_count, opt='genetic', opt_cfg = {iterations: 10, population_size: 512, prob_mutation: 1, prob_crossover: 0}) {
    this.J = neuron_count; 
    this.theta = 0;
    this.w = new Array(this.J).fill(0.0);
    this.m = new Array(this.J);
    this.sigma = new Array(this.J).fill(0.0);
    switch (opt) {
      case 'genetic':
        this.optimizer = new GeneticOpt(opt_cfg, this.predict, neuron_count);
        break;
      case 'pso':
        this.optimizer = new GeneticOpt(opt_cfg, this.predict, neuron_count);
        break;
    }
  }

  makeMatrix(I, J, fill) {
    var m = [];
    for (var i = 0; i < I; i++)
      m.push(new Array(J).fill(fill()));
    return m;
  }

  fit(train_set) {
    let result = this.optimizer.train(train_set);
    this.theta = result.theta;
    this.w = result.w;
    this.m = result.m;
    this.sigma = result.sigma;
  }

  predict(x, theta = this.theta, w = this.w, m = this.m, sigma = this.sigma) {
    const gaussian = (x, m, sigma) => {
      let l = m.map((v, i) => ((x[i] - v) ** 2));
      let sum = l.reduce((a, b) => a + b);
      let res = Math.exp(-sum / (2 * sigma ** 2));
      return res;
    }

    let result = 0;
    for (let j = 0; j < this.J; j++){
      result += w[j] * gaussian(x, m[j], sigma[j]);
    }
    result += theta;
    return result;
  }

  save() {
    let params = [this.theta];
    this.w.forEach((w, i) => {
      params.push((new Array()).concat(w, this.m[i], this.sigma[i]).join(' '));
    });
    params = params.join('\n');
    let outputPath = app.isPackaged ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'weights') : './weights';
    if (!fs.existsSync(outputPath))
      fs.mkdirSync(outputPath);
    fs.writeFileSync(path.join(outputPath, 'RBFN_params.txt'), params);
  }

  handle(x, y, sensors){
    return (this.predict(Object.values(sensors).map(v => v.val).concat(x, y)) + 1) / 2 * 80 - 40;
  }
}

module.exports = {
  RBFN
}