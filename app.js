// app.js

const COLORS = ['#007AFF', '#FF2D55', '#34C759', '#FF9500', '#AF52DE', '#5AC8FA', '#5856D6', '#FFCC00', '#8E8E93', '#FF3B30'];

const app = {
  state: {
    mode: null,
    players: [],
    temp: {},
    history: [],
    dealerId: 1,
    activeId: null,
    editIdx: null,
    chart: null
  },

  rules: {
    belote: { max: 162, capot: 252 }
  },

  init() {
    const saved = localStorage.getItem('sm_v7');
    if(saved) this.state = JSON.parse(saved);
    this.showSetup();
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('btn-settings').onclick = () => this.reset();
  },

  save() { localStorage.setItem('sm_v7', JSON.stringify(this.state)); },

  // --------------------
  // INIT GAME
  // --------------------
  initGame(mode) {
    this.state.mode = mode;
    const n = mode === 'belote' ? 2 : (parseInt(prompt("Nombre de joueurs ?", "4")) || 4);
    this.state.players = Array.from({length:n}, (_, i)=>({
      id: i+1,
      name: mode==='belote' ? (i===0?'NOUS':'EUX'):`J${i+1}`,
      color: COLORS[i % COLORS.length],
      total:0
    }));
    this.state.dealerId = mode==='belote'?1:null;
    this.state.temp = {};
    this.state.history = [];
    this.save();
    this.showGame();
  },

  showSetup() {
    document.getElementById('setup').classList.remove('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById('players').innerHTML = '';
    document.getElementById('history').innerHTML = '';
  },

  showGame() {
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    document.getElementById('game-title').innerText = this.state.mode.toUpperCase();
    this.render();
  },

  // --------------------
  // RENDER
  // --------------------
  render() {
    this.renderPlayers();
    this.renderHistory();
    this.renderChart();
  },

  renderPlayers() {
    const container = document.getElementById('players');
    container.innerHTML = '';
    this.state.players.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'player-card';
      card.style.border = (this.state.mode==='belote' && this.state.dealerId===p.id) ? '2px solid #FF9500' : 'none';
      card.onclick = ()=>this.openSheet(p.id);
      card.innerHTML = `
        <div class="player-name" style="color:${p.color}">${p.name}</div>
        <div class="player-score">${p.total + (this.state.temp[p.id]||0)}</div>
      `;
      container.appendChild(card);
    });
  },

  renderHistory() {
    const hist = document.getElementById('history');
    hist.innerHTML = '';
    this.state.history.slice().reverse().forEach((r,i)=>{
      const idx = this.state.history.length -1 - i;
      const row = document.createElement('div');
      row.className='history-row';
      let scores='';
      this.state.players.forEach(p=>{
        scores+=`<div style="text-align:center;color:${p.color};font-weight:700">${r[p.id]||0}</div>`;
      });
      row.innerHTML = `<div>M${idx+1}</div><div style="display:flex;gap:6px">${scores}</div>`;
      hist.appendChild(row);
    });
  },

  renderChart() {
    if(!this.state.players.length) return;
    const ctx = document.getElementById('chart')?.getContext?.('2d');
    if(!ctx) return;
    if(this.state.chart) this.state.chart.destroy();

    const datasets = this.state.players.map(p=>{
      let s=0;
      const data = this.state.history.map(h=>s+=(h[p.id]||0));
      data.push(s + (this.state.temp[p.id]||0));
      return { label:p.name, data:[0,...data], borderColor:p.color, backgroundColor:p.color+'33', tension:0.3, pointRadius:3, borderWidth:2 };
    });

    this.state.chart = new Chart(ctx, {
      type:'line',
      data:{ labels:['0',...this.state.history.map((_,i)=>i+1),'LIVE'], datasets },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false} },
        scales:{ x:{ grid:{display:false} }, y:{ beginAtZero:true, grid:{color:'rgba(128,128,128,.05)'} } }
      }
    });
  },

  // --------------------
  // SHEET / TEMP
  // --------------------
  openSheet(pid) {
    this.state.activeId = pid;
    // init temp
    this.state.players.forEach(p=>{
      if(this.state.temp[p.id]==null) this.state.temp[p.id]=0;
    });
    document.getElementById('sheet').classList.add('active');
  },

  closeSheet() {
    document.getElementById('sheet').classList.remove('active');
    this.render();
  },

  addTemp(value) {
    const id = this.state.activeId;
    this.state.temp[id] = (this.state.temp[id]||0) + value;
    this.render();
  },

  clearTemp() {
    this.state.temp[this.state.activeId] = 0;
    this.render();
  },

  backspaceTemp() {
    const id = this.state.activeId;
    let cur = (this.state.temp[id]||0).toString();
    this.state.temp[id] = cur.length>1 ? parseInt(cur.slice(0,-1)) : 0;
    this.render();
  },

  smartTemp() {
    const id = this.state.activeId;
    if(this.state.mode==='belote') this.state.temp[id] = this.rules.belote.capot;
    else this.state.temp[id] = -(this.state.temp[id]||0);
    this.render();
  },

  validateRound() {
    if(this.state.editIdx!==null){
      const old=this.state.history[this.state.editIdx];
      this.state.players.forEach(p=>p.total-=(old[p.id]||0));
      this.state.history[this.state.editIdx] = {...this.state.temp};
      this.state.players.forEach(p=>p.total+=(this.state.temp[p.id]||0));
      this.state.editIdx=null;
    } else {
      const round={};
      this.state.players.forEach(p=>{
        round[p.id]=this.state.temp[p.id]||0;
        p.total+=round[p.id];
      });
      this.state.history.push(round);
      // rotation dealer only belote
      if(this.state.mode==='belote'){
        const idx=this.state.players.findIndex(p=>p.id===this.state.dealerId);
        this.state.dealerId=this.state.players[(idx+1)%this.state.players.length].id;
      }
    }
    this.state.temp={};
    this.save();
    this.closeSheet();
  },

  reset() {
    if(confirm("Réinitialiser ?")){
      localStorage.removeItem('sm_v7');
      location.reload();
    }
  }
};

// INITIALISATION
document.addEventListener('DOMContentLoaded',()=>app.init());
