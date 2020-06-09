class ParticalSwarmOpt{
  constructor(cfg={iter: 10, size: 128, phi1: 0.5, phi2: 0.5, neighbors: 10, vMax: 0.5}, predict, J) {
    this.cfg = cfg;
    this.predict = predict;
    this.J = J;
  }

  rand(a, b) {
    return (b - a) * Math.random() + a;
  }

  parse_partical(partical, dim_x){
    const theta = partical[0];
    const w = partical.slice(1, 1 + this.J);
    const mt = partical.slice(1 + this.J, 1 + this.J + this.J * dim_x);
    const m = new Array();
    for (let i = 0, j = mt.length; i < j; i += dim_x)
      m.push(mt.slice(i, i + dim_x));
    const sigma = partical.slice(1 + this.J + this.J * dim_x, partical.length);
    return {theta, w, m, sigma};
  }

  mse(partical, data_set) {
    const dim_x = data_set[0].x.length;
    partical = this.parse_partical(partical, dim_x);

    // Calc Score
    let sum = 0;
    data_set.forEach(data => {
      let predict = this.predict(data.x, partical.theta, partical.w, partical.m, partical.sigma);
      sum += Math.abs(data.y - predict);
    });
    return sum / data_set.length;
  }

  fitness(train_set, partical){
    const dim_x = train_set[0].x.length;
    partical = this.parse_partical(partical, dim_x);

    // Calc Score
    let sum = 0;
    train_set.forEach(data => {
      let predict = this.predict(data.x, partical.theta, partical.w, partical.m, partical.sigma);
      sum += (data.y - predict)**2;
    });
    return (sum / 2);
  }

  dis(x, y){
    let l = y.map((v, i) => ((v - x[i]) ** 2));
    return l.reduce((a, b) => a + b) ** 0.5;
  }

  train(train_set){
    const dim_x = train_set[0].x.length;

    // Initialize
    let particals = Array.from({length: this.cfg.size}, () => {
      const theta = this.rand(-1, 1);
      const w = Array.from({length: this.J}, () => this.rand(-1, 1));
      const sigma = Array.from({length: this.J}, () => this.rand(0, 1));
      let m = new Array();
      for (let i = 0; i < this.J; i++)
        m.push(Array.from({length: dim_x}, () => this.rand(-1, 1)));
      m = m.flat();
      w.unshift(theta);
      let x = w.concat(m).concat(sigma);
      return {x, fitness: this.fitness(train_set, x), v: new Array(x.length).fill(0)};
    });

    // Main loop
    let p = {pos: null, fitness: Infinity};
    for (let iter = 0; iter < this.cfg.iter; iter++){
      for(let i = 0; i < particals.length; i++){
        // Glogal best
        if(particals[i].fitness < p.fitness){
          p = {pos: particals[i].x.slice(), fitness: particals[i].fitness};
        }

        // Neighbor best
        let neighbors = particals.map(neighbor => ({pos: neighbor.x, dis: this.dis(neighbor.x, particals[i].x)}));
        neighbors = neighbors.sort(function(a, b) {
          return a.dis > b.dis ? 1 : -1;
        });
        neighbors = neighbors.slice(1, (this.cfg.neighbors + 1));
        let g = {pos: particals[i].x, fitness: particals[i].fitness};
        neighbors.forEach(neighbor => {
          let fitness = this.fitness(train_set, neighbor.pos);
          if(fitness < g.fitness){
            g = {pos: neighbor.pos.slice(), fitness};
          }
        });

        // Update partical
        for(let d = 0; d < particals[i].x.length; d++){
          particals[i].v[d] += this.cfg.phi1 * (p.pos[d] - particals[i].x[d]) + this.cfg.phi2 * (g.pos[d] - particals[i].x[d]);
          if(particals[i].v[d] > this.cfg.vMax) particals[i].v[d] = this.cfg.vMax;
          if(particals[i].v[d] < -this.cfg.vMax) particals[i].v[d] = -this.cfg.vMax;
          particals[i].x[d] += particals[i].v[d];
        }
      }   
      console.log('-------------------------------------------------\nloss:\t' + p.fitness);
      console.log('mse:\t' + this.mse(p.pos, train_set));
    }
    return this.parse_partical(p.pos, dim_x);
  }
}

module.exports = {
  ParticalSwarmOpt
}