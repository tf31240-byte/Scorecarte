let players = [];
let history = [];
let currentRound = [];
let chart;

const setup = document.getElementById("setup");
const game = document.getElementById("game");
const playersDiv = document.getElementById("players");
const roundLabel = document.getElementById("roundLabel");

document.getElementById("toggleTheme").onclick = () =>
  document.body.classList.toggle("dark");

// -------- SETUP --------
document.getElementById("createPlayers").onclick = () => {
  const n = +numPlayers.value;
  playerNames.innerHTML = "";
  for(let i=0;i<n;i++){
    const input = document.createElement("input");
    input.placeholder = "Nom " + (i+1);
    input.id = "name"+i;
    playerNames.appendChild(input);
  }
  startGame.classList.remove("hidden");
};

startGame.onclick = () => {
  players = [];
  history = [];
  currentRound = [];

  document.querySelectorAll("#playerNames input")
    .forEach((i,idx)=>{
      players.push(i.value || "Joueur "+(idx+1));
      currentRound.push(0);
    });

  setup.classList.add("hidden");
  game.classList.remove("hidden");
  render();
};

// -------- CALCULS --------
function totalScore(index){
  let sum = currentRound[index];
  history.forEach(r => sum += r[index]);
  return sum;
}

// -------- RENDER --------
function render(){
  playersDiv.innerHTML = "";
  roundLabel.textContent = "Manche " + (history.length + 1);

  const totals = players.map((_,i)=>totalScore(i));
  const max = Math.max(...totals,1);

  players.forEach((p,i)=>{
    const div = document.createElement("div");
    div.className = "player";
    if(totals[i] === Math.max(...totals)) div.classList.add("leader");

    div.innerHTML = `
      <div class="row">
        <strong>${p}</strong>
        <strong>${totals[i]}</strong>
      </div>
      <div class="row controls">
        <button onclick="change(${i},-1)">−</button>
        <div>${currentRound[i]}</div>
        <button onclick="change(${i},1)">+</button>
      </div>
      <div class="bar">
        <div class="fill" style="width:${totals[i]/max*100}%"></div>
      </div>
    `;
    playersDiv.appendChild(div);
  });

  renderChart();
}

// -------- INTERACTIONS --------
function change(i,delta){
  currentRound[i] += delta;
  if(navigator.vibrate) navigator.vibrate(30);
  render();
}

validateRound.onclick = () => {
  history.push([...currentRound]);
  currentRound.fill(0);
  if(navigator.vibrate) navigator.vibrate(60);
  render();
};

undoRound.onclick = () => {
  if(history.length){
    history.pop();
    render();
  }
};

// -------- GRAPH --------
function renderChart(){
  if(chart) chart.destroy();
  if(history.length === 0) return;

  const labels = history.map((_,i)=>"Manche "+(i+1));

  const datasets = players.map((p,i)=>{
    let c=0;
    return {
      label:p,
      data:history.map(r=>c+=r[i]),
      borderWidth:2,
      tension:0.3
    };
  });

  chart = new Chart(document.getElementById("chart"),{
    type:"line",
    data:{labels,datasets},
    options:{responsive:true}
  });
}
