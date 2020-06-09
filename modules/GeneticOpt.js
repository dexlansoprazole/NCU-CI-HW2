const logger = require('./logger');
const {performance} = require('perf_hooks');

class GeneticOpt{
  constructor(cfg = {iter: 10, population_size: 512, prob_mutation: 1, prob_crossover: 1, elite: 1}, predict, J) {
    this.cfg = cfg;
    this.predict = predict;
    this.J = J;
  }

  rand(a, b) {
    return (b - a) * Math.random() + a;
  }

  parse_chromosome(chromosome, dim_x){
    const theta = chromosome[0];
    const w = chromosome.slice(1, 1 + this.J);
    const mt = chromosome.slice(1 + this.J, 1 + this.J + this.J * dim_x);
    const m = new Array();
    for (let i = 0, j = mt.length; i < j; i += dim_x)
      m.push(mt.slice(i, i + dim_x));
    const sigma = chromosome.slice(1 + this.J + this.J * dim_x, chromosome.length);
    return {theta, w, m, sigma};
  }
  
  me(chromosome, data_set) {
    const dim_x = data_set[0].x.length;
    chromosome = this.parse_chromosome(chromosome, dim_x);

    // Calc Score
    let sum = 0;
    data_set.forEach(data => {
      let predict = this.predict(data.x, chromosome.theta, chromosome.w, chromosome.m, chromosome.sigma);
      sum += Math.abs(data.y - predict);
    });
    return sum / data_set.length;
  }

  fitness = (train_set, chromosome) => {
    const dim_x = train_set[0].x.length;
    chromosome = this.parse_chromosome(chromosome, dim_x);

    // Calc Score
    let sum = 0;
    train_set.forEach(data => {
      let predict = this.predict(data.x, chromosome.theta, chromosome.w, chromosome.m, chromosome.sigma);
      sum += (data.y - predict)**2;
    });
    return 1 / (sum / 2);
  }

  train(train_set) {
    let t0 = performance.now();
    const dim_x = train_set[0].x.length;

    // Initialize
    let population = Array.from({length: this.cfg.population_size}, () => {
      const theta = this.rand(-1, 1);
      const w = Array.from({length: this.J}, () => this.rand(-1, 1));
      const sigma = Array.from({length: this.J}, () => this.rand(0, 1));
      let m = new Array();
      for (let i = 0; i < this.J; i++)
        m.push(Array.from({length: dim_x}, () => this.rand(-1, 1)));
      m = m.flat();
      w.unshift(theta);
      return w.concat(m).concat(sigma);
    });
    
    // Main loop
    let best = {c: null, me: Infinity};
    for (let iter = 0; iter < this.cfg.iter; iter++){
      // Selection
      let fitnesses = new Array();
      population.forEach(c => {
        fitnesses.push({chromosome: c, fitness: this.fitness(train_set, c)});
      });
      let reproduce_counts = fitnesses.map(v => {
        return Math.round(v.fitness / fitnesses.reduce((a, b) => ({fitness: a.fitness + b.fitness})).fitness * this.cfg.population_size);
      });
      
      // Get elites 
      let elites = new Array();
      fitnesses = fitnesses.sort(function(a, b) {
        return a.fitness < b.fitness ? 1 : -1;
      });
      for (let i = 0; i < this.cfg.elite; i++) {
        elites.push(fitnesses[i].chromosome);
      }

      // Fix reproduce count
      while (reproduce_counts.reduce((a, b) => a + b) > this.cfg.population_size) {
        const j = Math.round(this.rand(0, reproduce_counts.length-1));
        if (reproduce_counts[j] > 0)
          reproduce_counts[j] -= 1;
      }
      while (reproduce_counts.reduce((a, b) => a + b) < this.cfg.population_size) {
        const j = Math.round(this.rand(0, reproduce_counts.length-1));
        reproduce_counts[j] += 1;
      }

      // Reproduction
      let parents = new Array();
      reproduce_counts.forEach((count, i) => {
        for (let j = 0; j < count; j++){
          parents.push(population[i]);
        }
      });
        
      // Crossover
      let offsprings = new Array();
      while (offsprings.length < (this.cfg.population_size - this.cfg.elite)) {
        let indexes = [...Array(parents.length).keys()];       
        let ip1 = Math.round(this.rand(0, indexes.length - 1));
        ip1 = indexes.splice(ip1, 1)[0];
        let ip2 = Math.round(this.rand(0, indexes.length - 1));
        ip2 = indexes.splice(ip2, 1)[0];
        let sigma = this.rand(-this.noise, this.noise);
        offsprings.push(parents[ip1].map((v, j) => {
          // return v + sigma * (v - parents[ip2][j]);
          let r = this.rand(0, 1);
          return (r <= this.cfg.prob_crossover) ? parents[ip2][j] : v;
        }));
        if (offsprings.length === (this.cfg.population_size - this.cfg.elite)) break;
        offsprings.push(parents[ip2].map((v, j) => {
          // return v + sigma * (v - parents[ip1][j]);
          let r = this.rand(0, 1);
          return (r <= this.cfg.prob_crossover) ? parents[ip1][j] : v;
        }));
      }

      // Mutation
      offsprings = offsprings.map(c => {
        c = c.map((g, ig) => {
          let r = this.rand(0, 1);
          if (r <= this.cfg.prob_mutation) {
            // theta or w or m
            if (ig >= 0 && ig < 1 + this.J + this.J * dim_x)
              g = this.rand(-1, 1);
            // sigma
            if (ig >= 1 + this.J + this.J * dim_x && ig < c.length)
              g = this.rand(0, 1);
          }
          return g;
        });
        return c;
      });

      // Fit domain
      offsprings = offsprings.concat(elites);
      let population_next = offsprings.slice();
      population_next = population_next.map(c => {
        return c.map((g, i, a) => {
          // theta or w or m
          if(i >= 0 && i < 1 + this.J + this.J * dim_x){
            if (g < -1) g = -1;
            if (g > 1) g = 1;
          }
          // sigma
          if(i >= 1 + this.J + this.J * dim_x && i < a.length){
            if (g < 0) g = 0;
            if (g > 1) g = 1;
          }
          return g;
        });
      });

      let results = population_next.map(c => {
        let me = this.me(c, train_set);
        if (me < best.me) best = {c, me: me};
        return {c, me: me};
      });
      logger(
        '-------------------------------------------------\nloss:\t' + (1 / Math.max(...fitnesses.map(o => o.fitness))) + '\n' + 
        'mean error:\t' + Math.min(...results.map(r => r.me)) + '\n' + 
        'parant count: ' + parents.length + '\toffspring count: ' + offsprings.length);
      population = population_next.slice();
    }
    let t1 = performance.now();
    logger('best mean error: ' + best.me);
    logger('time: ' + (t1 - t0) / 1000 + ' sec');

    // Parse chromosome
    return this.parse_chromosome(best.c, dim_x);
  }
}

module.exports = {
  GeneticOpt
}