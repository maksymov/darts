$(document).ready(function () {
    loadData();
  })


function loadData() {
    var players = JSON.parse(localStorage.getItem("players"));
    for (var i = 0; i < players.length; i++) {
        var name = players[i].name;
        var score = players[i].score;
        var player_html = `<div class="col"><div><h1><i class="fa-regular fa-circle-user"></i><span style="cursor:pointer;" id="player_${i}_name" onclick="openModal('Переименовать игрока', this.id, 'rename_player');">${name}</span></h1><h2><span class="badge text-bg-secondary" id="player_${i}_score">${score}</span></h2></div></div>`;
        $("#players").append(player_html);
        var id=`#player_${i}_score`
        if (score == 0) {
            $(id).removeClass('text-bg-secondary').addClass('text-bg-success')
        } else {
            $(id).addClass('text-bg-secondary').removeClass('text-bg-success')
        }
    }

    var circles = JSON.parse(localStorage.getItem("circles"));
    for (var c = 0; c < circles.length; c++) {
        $("#circles_table").prepend(`<tr id='circle_${c}'></tr>`);
        for (var p = 0; p < circles[c].length; p++) {
            var cell = `<td><span id="${p}_${c}" style="cursor:pointer" onclick="openModal('Выбил', this.id, 'edit_score');">${circles[c][p]}</span></td>`
            var row_id = `#circle_${c}`
            $(row_id).append(cell);
        }
    }
}


function openModal(modalTitle, id, action) {
    $("#modalDialog").modal('show');
    $(".modal-title").html(modalTitle);
    var val = $("#"+id).html();
    if (val != 0) {
        $("#inputField").val(val);
    } else {
        $("#inputField").val('');
    }
    $("#targetObj").val(id);
    $("#action").val(action);
    if (action == "new_game") {
        $(".init-player").show();
    } else {
        $(".init-player").hide();
    }
    if (action == "new_game" || action == 'edit_score') {
        document.getElementById('inputField').type = 'number'
    } else {
        document.getElementById('inputField').type = 'text'
    }
}


function submitModal(action) {
    var action = $("#action").val();
    if (action == 'edit_score') {
        var target = $("#targetObj").val();
        var val = $("#inputField").val();
        $("#"+target).html(val);
        var ids = target.split('_');
        var player = ids[0]
        var circle = ids[1]
        var circles = JSON.parse(localStorage.getItem("circles"));
        circles[circle][player] = Number(val);
        localStorage.setItem('circles', JSON.stringify(circles));
        var players = JSON.parse(localStorage.getItem("players"));
        var score = localStorage.getItem("max_val")
        for (var c = 0; c < circles.length; c++) {
            if (score >= circles[c][player]) {
                score = score - circles[c][player]
            }
        }
        players[player].score = score;
        localStorage.setItem('players', JSON.stringify(players));
        location.reload();
    }
    if (action == 'new_game') {
        newGame();
    }
    if (action == 'add_player') {
        addPlayer();
    }
    if (action == 'rename_player') {
        renamePlayer();
    }
}


function addCircle() {
    var circles = JSON.parse(localStorage.getItem("circles"));
    var players = JSON.parse(localStorage.getItem("players"));
    var new_circle = []
    for (var i = 0; i < players.length; i++) {
        new_circle.push(0)
    }
    circles.push(new_circle)
    localStorage.setItem('circles', JSON.stringify(circles));
    location.reload()
}

function newGame() {
    var max_val = Number($("#inputField").val());
    var player1 = $("#player1").val()
    var player2 = $("#player2").val()
    var players = `[{"name":"${player1}","score":${max_val}},{"name":"${player2}","score":${max_val}}]`
    var circles = '[[0,0]]'
    localStorage.setItem('players', players);
    localStorage.setItem('circles', circles);
    localStorage.setItem('max_val', max_val);
    location.reload()
}

function addPlayer() {
    var players = JSON.parse(localStorage.getItem("players"));
    var name = $("#inputField").val()
    players.push({"name":name,"score":localStorage.getItem("max_val")})
    localStorage.setItem('players', JSON.stringify(players));
    var circles = JSON.parse(localStorage.getItem("circles"));
    for (var c = 0; c < circles.length; c++) {
        circles[c].push(0)
    }
    localStorage.setItem('circles', JSON.stringify(circles));
    location.reload();
}

function renamePlayer() {
    var target = $("#targetObj").val();
    var new_name = $("#inputField").val();
    var player = Number(target.split('_')[1]);
    var players = JSON.parse(localStorage.getItem("players"));
    players[player].name = new_name;
    localStorage.setItem('players', JSON.stringify(players));
    location.reload();
}
