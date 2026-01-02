document.addEventListener("DOMContentLoaded", function(){

  let players=[], history=[], playerColors=[];

  function assignPlayerColors(){
    const colors=["#ff4d4d","#4da6ff","#4dff88","#ffa64d","#b84dff","#ffd24d","#4dffd1","#ff4dd2"];
    playerColors = players.map((_,i)=>colors[i%colors.length]);
  }

  const setupBtn = document.getElementById("setupPlayersBtn");
  const startBtn = document.getElementById("startGameBtn");
  const scoreContainer = document.getElementById("scoreContainer");

  setupBtn.addEventListener("click", ()=>{
    const num = parseInt(document.getElementById("numPlayers").value)||2;
    const container = document.getElementById("playerInputs");
    container.innerHTML="";
    for(let i=0;i<num;i++){
      const input = document.createElement("input");
      input.type="text"; input.placeholder="Nom joueur "+(i+1);
      input.id="player"+i;
      container.appendChild(input);
    }
    startBtn.classList.remove("hidden");
  });

  startBtn.addEventListener("click", ()=>{
    const num = parseInt(document.getElementById("numPlayers").value)||2;
    players=[];
    for(let i=0;i<num;i++){
      const name = document.getElementById("player"+i).value || "Joueur "+(i+1);
      players.push(name);
    }
    history=[];
    assignPlayerColors();
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
    renderScores();
  });

  function renderScores(){
    scoreContainer.innerHTML="";
    const maxTotal = Math.max(...history.flat(),1);
    players.forEach((p,i)=>{
      const total = history.reduce((sum,r)=>sum+r[i],0);
      const last = history.length ? history[history.length-1][i] : 0;

      const row = document.createElement("div");
      row.className="playerRow";

      const nameDiv = document.createElement("div"); nameDiv.className="playerName"; nameDiv.textContent=p;
      const totalDiv = document.createElement("div"); totalDiv.className="playerTotal"; totalDiv.textContent=total;
      const lastDiv = document.createElement("div"); lastDiv.className="playerLast"; lastDiv.textContent=last;
      const inputDiv = document.createElement("div"); inputDiv.className="playerInput";
      const input = document.createElement("input"); input.type="number"; input.value=0; input.id="input"+i;
      inputDiv.appendChild(input);

      const graphDiv = document.createElement("div"); graphDiv.className="playerGraph";
      const bar = document.createElement("div"); bar.className="bar"; bar.style.width=(total/maxTotal*100)+"%"; bar.style.background=playerColors[i];
      graphDiv.appendChild(bar);

      row.append(nameDiv, totalDiv, lastDiv, inputDiv, graphDiv);
      scoreContainer.appendChild(row);
    });
  }

  function addRound(){
    const round = players.map((_,i)=>{
      const val = parseInt(document.getElementById("input"+i).value)||0;
      return val;
    });
    history.push(round);
    // pulse animation
    players.forEach((_,i)=>{
      const row = scoreContainer.children[i];
      row.classList.add("pulse");
      setTimeout(()=>row.classList.remove("pulse"),400);
    });
    // reset inputs
    players.forEach((_,i)=>document.getElementById("input"+i).value=0);
    renderScores();
  }

  function undoRound(){
    if(history.length>0) history.pop();
    renderScores();
  }

  document.getElementById("addRoundBtn").addEventListener("click", addRound);
  document.getElementById("undoRoundBtn").addEventListener("click", undoRound);
  document.getElementById("resetBtn").addEventListener("click", ()=>{
    if(confirm("Réinitialiser la partie ?")) history=[], renderScores();
  });

  document.getElementById("toggleTheme").addEventListener("click", ()=>document.body.classList.toggle("dark"));
});
