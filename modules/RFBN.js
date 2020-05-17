class RFBN {
  constructor(neuron_count, opt_cfg = {iterations: 500, population_size: 1000, prob_mutation: 0.033, prob_crossover: 0.6}) {
    this.J = neuron_count;
    this.opt_cfg = opt_cfg;
    this.theta = 0;
    this.w = new Array(this.J).fill(0.0);
    this.m = new Array(this.J);
    this.sigma = new Array(this.J).fill(0.0);
    this.noise = 0.1;
    this.parant_rate = 0;
    this.elite_rate = 0.5;
  }

  makeMatrix(I, J, fill) {
    var m = [];
    for (var i = 0; i < I; i++)
      m.push(new Array(J).fill(fill()));
    return m;
  }

  rand(a, b) {
    return (b - a) * Math.random() + a;
  }

  gaussian(x, m, sigma) {
    let l = x.map((v, i) => ((v - m[i]) ** 2));
    let sum = l.reduce((a, b) => a + b);
    let res = Math.exp(-sum / (2 * sigma ** 2));
    return res;
  }

  mse(chromosome, data_set) {
    const dim_x = data_set[0].x.length;

    // Parse chromosome
    const theta = chromosome[0];
    const w = chromosome.slice(1, 1 + this.J);
    const mt = chromosome.slice(1 + this.J, 1 + this.J + this.J * dim_x);
    const m = new Array();
    for (let i = 0, j = mt.length; i < j; i += dim_x)
      m.push(mt.slice(i, i + dim_x));
    const sigma = chromosome.slice(1 + this.J + this.J * dim_x, chromosome.length);

    // Calc Score
    let sum = 0;
    data_set.forEach(data => {
      let predict = this.predict(data.x, theta, w, m, sigma);
      sum += Math.abs(data.y - predict);
      // console.log(predict);
    });
    return sum / data_set.length;
  }

  fit(train_set) {
    const dim_x = train_set[0].x.length;
    const fitness_function = (chromosome) => {
      // Parse chromosome
      const theta = chromosome[0];
      const w = chromosome.slice(1, 1 + this.J);
      const mt = chromosome.slice(1 + this.J, 1 + this.J + this.J * dim_x);
      const m = new Array();
      for (let i = 0, j = mt.length; i < j; i += dim_x)
        m.push(mt.slice(i, i + dim_x));
      const sigma = chromosome.slice(1 + this.J + this.J * dim_x, chromosome.length);

      // Calc Score
      let sum = 0;
      train_set.forEach(data => {
        let predict = this.predict(data.x, theta, w, m, sigma);
        sum += (data.y - predict)**2;
        // console.log(predict);
      });
      return 1 / (sum / 2);
    }

    // Initialize
    let population = Array.from({length: this.opt_cfg.population_size}, () => {
      const theta = this.rand(-1, 1);
      const w = Array.from({length: this.J}, () => this.rand(-1, 1));
      const sigma = Array.from({length: this.J}, () => this.rand(0, 1));
      let m = new Array();
      for (let i = 0; i < this.J; i++)
        m.push(Array.from({length: dim_x}, () => this.rand(-1, 1)));
      // for (let i = 0; i < this.J; i++)
      //   m.push(Array.from({length: 3}, () => this.rand(0, 4105**0.5)));
      // if (dim_x === 5) {
      //   m.forEach(v => {
      //     v.unshift(this.rand(-6, 30), this.rand(-3, 50));
      //   });
      // }
      m = m.flat();
      w.unshift(theta);
      return w.concat(m).concat(sigma);
    });

    // Main loop
    let best = {c: null, mse: 1};
    for (let iter = 0; iter < this.opt_cfg.iterations; iter++){
      // Selection
      let fitnesses = new Array();
      population.forEach(c => {
        fitnesses.push(fitness_function(c));
      });
      let reproduce_counts = fitnesses.map(v => Math.round(v / fitnesses.reduce((a, b) => a + b) * this.opt_cfg.population_size));

      // Fix reproduce count
      let sum_reproduce_counts = reproduce_counts.reduce((a, b) => a + b);
      if (sum_reproduce_counts > this.opt_cfg.population_size) {
        for (let i = 0; i < sum_reproduce_counts - this.opt_cfg.population_size; i++){
          for (let j = 0; j < reproduce_counts.length; j++) {
            if (reproduce_counts[j] > 0) {
              reproduce_counts[j] -= 1;
              break;
            }
          }
        }
      }
      if (sum_reproduce_counts < this.opt_cfg.population_size) {
        for (let i = 0; i < this.opt_cfg.population_size - sum_reproduce_counts; i++) {
          const j = Math.round(this.rand(0, reproduce_counts.length));
          reproduce_counts[j] += 1;
        }
      }

      // Reproduction
      let parents = new Array();
      reproduce_counts.forEach((count, i) => {
        for (let j = 0; j < count; j++){
          parents.push(population[i]);
        }
      });

      // Add noise
      parents = parents.map(c => {
        return this.rand(0, 1) < 0.5 ? c.map(v => v + this.rand(-this.noise, this.noise)) : c;
      })
        
      // Crossover
      let offsprings = new Array();
      while (offsprings.length < this.opt_cfg.population_size * (1 - this.parant_rate)) {
        let indexes = [...Array(parents.length).keys()];       
        let ip1 = Math.round(this.rand(0, indexes.length - 1));
        ip1 = indexes.splice(ip1, 1)[0];
        let ip2 = Math.round(this.rand(0, indexes.length - 1));
        ip2 = indexes.splice(ip2, 1)[0];
        let sigma = this.rand(-this.noise, this.noise);
        offsprings.push(parents[ip1].map((v, j) => {
          return v + sigma * (v - parents[ip2][j]);
        }));
        if (offsprings.length === this.opt_cfg.population_size * (1 - this.parant_rate)) break;
        offsprings.push(parents[ip2].map((v, j) => {
          return v + sigma * (v - parents[ip1][j]);
        }));
      }

      // Mutation
      let mutation_count = Math.round(offsprings.length * this.opt_cfg.prob_mutation);
      let indexes = [...Array(offsprings.length).keys()];
      for (let i = 0; i < mutation_count; i++) {
        let im = Math.round(this.rand(0, indexes.length - 1));
        im = indexes.splice(im, 1)[0];
        let ig = Math.round(this.rand(0, dim_x - 1));
        offsprings[im][ig] = offsprings[im][ig] + 50 * this.rand(-this.noise, this.noise);
      }

      // Fit domain
      let population_next = offsprings;
      population_next = population_next.map(c => {
        return c.map(g => {
          if (g < -1) g = -1;
          if (g > 1) g = 1;
          return g;
        });
      });

      let results = population_next.map(c => {
        let mse = this.mse(c, train_set);
        if (mse < best.mse) best = {c, mse};
        return {c, mse};
      });
      console.log('-------------------------------------------------\nloss:\t' + (1 / Math.max(...fitnesses)));
      console.log('mse:\t' + Math.min(...results.map(r => r.mse)));
      console.log('parant count: ' + parents.length + '\toffspring count: ' + offsprings.length);
      
      
      population = population_next.slice();
    }

    console.log('best mse: ' + best.mse);

    // Parse chromosome
    const theta = best.c[0];
    const w = best.c.slice(1, 1 + this.J);
    const mt = best.c.slice(1 + this.J, 1 + this.J + this.J * dim_x);
    const m = new Array();
    for (let i = 0, j = mt.length; i < j; i += dim_x)
      m.push(mt.slice(i, i + dim_x));
    const sigma = best.c.slice(1 + this.J + this.J * dim_x, best.c.length);
    this.theta = theta;
    this.w = w;
    this.m = m;
    this.sigma = sigma;
  }

  predict(x, theta = this.theta, w = this.w, m = this.m, sigma = this.sigma) {
    let result = 0;
    for (let j = 0; j < this.J; j++){
      result += w[j] * this.gaussian(x, m[j], sigma[j]);
    }
    result += theta;
    return result;
  }
}

module.exports = {
  RFBN
}