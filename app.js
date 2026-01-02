document.addEventListener("DOMContentLoaded", function(){

  let players=[], history=[], playerColors=[];

  // assigner couleurs
  function assignPlayerColors(){
    const colors=["#ff4d4d","#4da6ff","#4dff88","#ffa64d","#b84dff","#ffd24d","#4dffd1","#ff4dd2"];
    playerColors = players.map((_,i)=>colors[i%colors.length]);
  }

  // Configurer les joueurs
  const setupBtn = document.getElementById("setupPlayersBtn");
  const startBtn = document.getElementById("startGameBtn");
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

  // Démarrer partie
  startBtn.addEventListener("click", ()=>{
    players=[];
    const num = parseInt(document.getElementById("numPlayers").value)||2;
    for(let i=0;i<num;i++){
      const name = document.getElementById("player"+i).value || "Joueur "+(i+1);
      players.push(name);
    }
    history=[]; assignPlayerColors();
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
    renderScoreTable();
    renderGraph();
  });

  // Tableau interactif
  function renderScoreTable(){
    const container=document.getElementById("scoreTable");
    container.innerHTML="";
    let table="<table><tr><th>Joueur</th><th>Total</th><th>Dernière Manche</th><th>Points à ajouter</th></tr>";
    players.forEach((p,i)=>{
      const last=history.length ? history[history.length-1][i] : 0;
      const total=history.reduce((sum,r)=>sum+r[i],0);
      table+=`<tr>
        <td>${p}</td>
        <td id="total${i}">${total}</td>
        <td id="last${i}">${last}</td>
        <td><input type="number" id="input${i}" value="0"></td>
      </tr>`;
    });
    table+="</table>";
    container.innerHTML=table;
  }

  // Ajouter manche
  document.getElementById("addRoundBtn").addEventListener("click", ()=>{
    const round=players.map((_,i)=>{
      const val=parseInt(document.getElementById("input"+i).value)||0;
      const line=document.getElementById("total"+i);
      line.parentElement.classList.add("pulse");
      setTimeout(()=>line.parentElement.classList.remove("pulse"),400);
      return val;
    });
    history.push(round);
    renderScoreTable();
    renderGraph();
    players.forEach((_,i)=>document.getElementById("input"+i).value=0);
  });

  // Annuler dernière manche
  document.getElementById("undoRoundBtn").addEventListener("click", ()=>{
    if(history.length>0) history.pop();
    renderScoreTable();
    renderGraph();
  });

  // Historique graphique
  function renderGraph(){
    const container=document.getElementById("historyGraph");
    container.innerHTML="";
    if(!history.length) return;
    const max=Math.max(...history.flat(),1);
    history.forEach((round,r)=>{
      const mancheLabel=document.createElement("div");
      mancheLabel.style.width="100%"; mancheLabel.style.textAlign="center"; mancheLabel.style.fontSize="12px";
      mancheLabel.textContent="Manche "+(r+1);
      container.appendChild(mancheLabel);
      round.forEach((val,i)=>{
        const bar=document.createElement("div");
        bar.className="bar"; bar.style.height=(val/max*100)+"px"; bar.style.background=playerColors[i];
        const label=document.createElement("span"); label.textContent=val;
        bar.appendChild(label); container.appendChild(bar);
      });
    });
  }

  // Reset / menu
  document.getElementById("resetBtn").addEventListener("click", ()=>{
    if(confirm("Réinitialiser la partie ?")) location.reload();
  });
  document.getElementById("backBtn").addEventListener("click", ()=>{
    location.reload();
  });

  // Dark mode
  document.getElementById("toggleTheme").addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
  });

});
