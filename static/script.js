


$(document).ready(function () {
    loadData();
    setupSwitcher();
    $('#inputField').on('keydown', function(e) {
        if (e.which === 13) {
            submitModal();
        }
    })
    $(document).on('focus', '.player-circle-score', function () {
        if ($(this).val() === '0') {
            $(this).val('');
        }
    }).on('blur', function () {
        if ($(this).val() === '') {
            $(this).val('0');
        }
    });
    $(document).on('keydown change', '.player-circle-score', function(e) {
        if (e.type === 'keydown' && e.which !== 13) return;
        var value = $(this).val();
        if (!isNaN(value) && value !== '') { // Проверка: значение — число и не пустое
            editScore(this.id);
        }
    });
})


const GAMES = {
    '501': {
        'title': 'Сброс очков',
        'desc': "Необходимо сбросить 501 или другое выбранное количество очков. Последний бросок должен быть в удвоение. Если игрок набирает больше того, что у него осталось, последний круг не засчитывается.",
        'total_score': 501,
    },
    'sectors': {
        'title': 'По секторам',
        'desc': "Поочерёдно попасть в каждый сектор",
    }
}

function loadData() {
    $("#players").empty();
    $("#circles_table").empty();
    $("#board_sectors_row").empty();
    $("#board_501").hide();
    $("#board_sectors").hide();
    $('#modalDialog').modal('hide');
    var players = JSON.parse(localStorage.getItem("players"));
    if (players === null || players == '') {
        localStorage.setItem('players', '[{"name":"Игрок 1","score":0}]')
    }
    var game = localStorage.getItem("curr_game")
    $(`#board_${game}`).show();
    if (game == '501') {
        for (var i = 0; i < players.length; i++) {
            var name = players[i].name;
            var score = players[i].score;
            var leader_gap_txt = "";
            var leader_gap = players[i].leader_gap;
            if (leader_gap > 0) {
                leader_gap_txt = ` +${leader_gap}`
            }
            var player_html = `<div class="col"><div><h2><span style="cursor:pointer;" id="player_${i}_name" onclick="openModal('Переименовать игрока', this.id, 'rename_player');">${name}</span></h2><div class="btn-group btn-group-sm" role="group"><button type="button" class="btn btn-outline-secondary" onclick="movePlayer(${i}, -1)"><i class="fa-solid fa-circle-chevron-left"></i></button><button type="button" class="btn btn-outline-secondary" onclick="deletePlayer(${i})"><i class="fa-regular fa-trash-can"></i></button><button type="button" class="btn btn-outline-secondary" onclick="movePlayer(${i}, +1)"><i class="fa-solid fa-circle-chevron-right"></i></button></div><br><span style="font-size: 2.5rem;"><span class="badge text-bg-secondary mt-2 player_score" id="player_${i}_score">${score}</span></span><br><span style="font-size: 1.5rem;"><span class="text-danger" mb-4 mt-2" id="player_${i}_leader_gap">${leader_gap_txt}</span></span></div></div>`;
            $("#players").append(player_html);
            var id=`#player_${i}_score`
            if (score == 0 || leader_gap_txt == "") {
                $(id).removeClass('text-bg-secondary').addClass('text-bg-success')
            } else {
                $(id).addClass('text-bg-secondary').removeClass('text-bg-success')
            }
            var total_score = localStorage.getItem('total_score')
            if (total_score === null) {
                total_score = GAMES['501']['total_score'];
            }
            $("#501_score").html(total_score);
        }
    
        var circles = JSON.parse(localStorage.getItem("circles"));
        for (var c = 0; c < circles.length; c++) {
            $("#circles_table").prepend(`<tr id='circle_${c}'></tr>`);
            for (var p = 0; p < circles[c].length; p++) {
                var cell = `<td style="cursor:pointer;"><input id="${p}_${c}" type="number" class="w-100 player-circle-score form-control form-control-lg text-center" value="${circles[c][p]}"></td>`;
                var row_id = `#circle_${c}`
                $(row_id).append(cell);
            }
        }
    }
    if (game == 'sectors') {
        for (var i = 0; i < players.length; i++) {
            var name = players[i].name;
            var score = players[i].score;
            var player_html = `<div class="col"><div><h2><span style="cursor:pointer;" id="player_${i}_name" onclick="openModal('Переименовать игрока', this.id, 'rename_player');">${name}</span></h2><div class="btn-group btn-group-sm" role="group"><button type="button" class="btn btn-outline-secondary" onclick="movePlayer(${i}, -1)"><i class="fa-solid fa-circle-chevron-left"></i></button><button type="button" class="btn btn-outline-secondary" onclick="deletePlayer(${i})"><i class="fa-regular fa-trash-can"></i></button><button type="button" class="btn btn-outline-secondary" onclick="movePlayer(${i}, +1)"><i class="fa-solid fa-circle-chevron-right"></i></button></div><br><span style="font-size: 3rem;"><span class="badge text-bg-secondary player_score" id="player_${i}_score">${score}</span></span><br><div class="btn-group mt-2 mb-4" role="group"><button type="button" class="btn btn-outline-secondary" onclick="editPlayerScore(${i}, 'remove')"><i class="fa-solid fa-circle-minus"></i></button><button type="button" class="btn btn-outline-success" onclick="editPlayerScore(${i}, 'add')"><i class="fa-solid fa-circle-plus"></i></button></div></div></div>`;
            $("#board_sectors_row").append(player_html);
            var id=`#player_${i}_score`
            var max_score = localStorage.getItem('max_score');
            if (score == 25 || score == 50 || score == max_score) {
                $(id).removeClass('text-bg-secondary').addClass('text-bg-success')
            } else {
                $(id).removeClass('text-bg-success').addClass('text-bg-secondary')
            }
        }
    }
}


function newGameDialog() {
    $("#newGameList").remove();
    $("#modalDialog").modal('show');
    $("#modalDialog #modalInputs").hide();
    $("#modalDialog .modal-title").hide();
    $("#modalDialog .modal-footer").hide();
    $("#modalDialog .modal-body").append('<div class="list-group" id="newGameList"></div>')
    for (var key in GAMES) {
        var btn = `<button type="button" class="list-group-item list-group-item-action" onclick="newGame_${key}();"><h3>${GAMES[key]['title']}</h3>${GAMES[key]['desc']}</button>`
        $("#newGameList").append(btn);
    }
}


function newGame_501() {
    localStorage.setItem('curr_game', '501');
    localStorage.setItem('total_score', GAMES['501']['total_score']);
    clearTable();
}


function newGame_sectors() {
    localStorage.setItem('curr_game', 'sectors');
    clearTable();
}


function openModal(modalTitle, id, action) {
    $("#newGameList").remove();
    $("#modalDialog #modalInputs").show();
    $("#modalDialog .modal-title").show();
    $("#modalDialog .modal-footer").show();
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
    if (action == 'edit_total_score') {
        document.getElementById('inputField').type = 'number'
    } else {
        document.getElementById('inputField').type = 'text'
    }
}


function calculateLeaderGap() {
    var players = JSON.parse(localStorage.getItem("players"));
    var leader_score = Math.min.apply(Math, players.map(function(o) {return o.score; }));
    for (var p = 0; p < players.length; p++) {
        players[p].leader_gap = players[p].score - leader_score;
    }
    localStorage.setItem('players', JSON.stringify(players));
}


function calculateMaxScore() {
    $(".player_score").removeClass('text-bg-success').addClass('text-bg-secondary');
    var players = JSON.parse(localStorage.getItem("players"));
    var max_score = Math.max.apply(Math, players.map(function(o) {return o.score;}));
    var max_index = getMaxScoreIndices();
    localStorage.setItem('max_score', max_score);
    $(max_index.map(i => `#player_${i}_score`).join(',')).removeClass('text-bg-secondary').addClass('text-bg-success');
}


function getMaxScoreIndices() {
    var players = JSON.parse(localStorage.getItem("players"));
    var max_score = Math.max.apply(Math, players.map(function(o) { return o.score; }));
    var max_indices = players.reduce(function(indices, player, index) {
        if (player.score === max_score) {
            indices.push(index);
        }
        return indices;
    }, []);
    return max_indices;
}


function editScore(target) {
    var val = $("#"+target).val();
    var ids = target.split('_');
    var player = ids[0]
    var circle = ids[1]
    var next_target = `#${Number(player)+1}_${circle}`
    var circles = JSON.parse(localStorage.getItem("circles"));
    circles[circle][player] = Number(val);
    localStorage.setItem('circles', JSON.stringify(circles));
    var players = JSON.parse(localStorage.getItem("players"));
    var score = Number(localStorage.getItem("total_score"))
    for (var c = 0; c < circles.length; c++) {
        if (score >= circles[c][player]) {
            score = score - circles[c][player]
        }
    }
    players[player].score = score;
    localStorage.setItem('players', JSON.stringify(players));
    calculateLeaderGap();
    if (Number(player)+1 == players.length && Number(circle)+1 == circles.length) {
        addCircle();
    } else {
        setTimeout(function() {
            loadData();
        }, 50);
        setTimeout(function() {
            $(next_target).focus();
        }, 100);
    }
}


function submitModal() {
    var action = $("#action").val();
    if (action == 'add_player') {
        addPlayer();
    }
    if (action == 'rename_player') {
        renamePlayer();
    }
    if (action == 'edit_total_score') {
        editTotalScore();
    }
}

function editTotalScore() {
    var new_total_score = $("#inputField").val();
    var old_total_score = Number(localStorage.getItem("total_score"));
    var diff = new_total_score - old_total_score;
    var players = JSON.parse(localStorage.getItem("players"));
    for (var p = 0; p < players.length; p++) {
        players[p].score += diff
    }
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('total_score', new_total_score);
    loadData();
}

function editPlayerScore(player_id, action) {
    var players = JSON.parse(localStorage.getItem("players"));
    var score = players[player_id].score
    if (action == 'add'){
        if (score == 20) {
            score += 5;
        } else if (score == 25) {
            score += 25;
        } else {
            score += 1;
        }
    } else {
        if (score == 50) {
            score -= 25;
        } else if (score == 25) {
            score -= 5;
        } else {
            score -= 1;
        }
    }
    players[player_id].score = score;
    localStorage.setItem('players', JSON.stringify(players));
    $(`#player_${player_id}_score`).html(score);
    calculateMaxScore();
}


function deletePlayer(id) {
    if (confirm('Вы уверены, что хотите удалить игрока?')) {
        var players = JSON.parse(localStorage.getItem("players"));
        players.splice(id, 1);
        localStorage.setItem('players', JSON.stringify(players));
        var circles = JSON.parse(localStorage.getItem("circles"));
        for (var c = 0; c < circles.length; c++) {
            circles[c].splice(id, 1);
        }
        calculateLeaderGap();
        localStorage.setItem('circles', JSON.stringify(circles));
        loadData();
    } else {
        return false;
    }
}


function movePlayer(old_index, value) {
    var new_index = old_index + value;
    var players = JSON.parse(localStorage.getItem("players"));
    if (new_index >= 0 && new_index < players.length) {
        players.splice(new_index, 0, players.splice(old_index, 1)[0]);
        localStorage.setItem('players', JSON.stringify(players));
        var game = localStorage.getItem("curr_game")
        if (game == '501') {
            var circles = JSON.parse(localStorage.getItem("circles"));
            for (var c = 0; c < circles.length; c++) {
                circles[c].splice(new_index, 0, circles[c].splice(old_index, 1)[0]);
            }
            localStorage.setItem('circles', JSON.stringify(circles));
        }
        loadData();
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
    loadData();
    setTimeout(function() {
        $('.player-circle-score').first().val('').focus();
    }, 100);
}


function addPlayer() {
    var players = JSON.parse(localStorage.getItem("players"));
    var name = $("#inputField").val()
    if (localStorage.getItem("curr_game") == "501") {
        var init_score = Number(localStorage.getItem("total_score"))
    }
    if (localStorage.getItem("curr_game") == "sectors") {
        var init_score = 1;
    }
    players.push({"name":name,"score":init_score})
    localStorage.setItem('players', JSON.stringify(players));
    var circles = JSON.parse(localStorage.getItem("circles"));
    for (var c = 0; c < circles.length; c++) {
        circles[c].push(0)
    }
    localStorage.setItem('circles', JSON.stringify(circles));
    calculateLeaderGap();
    loadData();
}


function renamePlayer() {
    var target = $("#targetObj").val();
    var new_name = $("#inputField").val();
    var player = Number(target.split('_')[1]);
    var players = JSON.parse(localStorage.getItem("players"));
    players[player].name = new_name;
    localStorage.setItem('players', JSON.stringify(players));
    loadData();
}


function clearTable() {
    var game = localStorage.getItem("curr_game")
    if (game == '501') {
        var players = JSON.parse(localStorage.getItem("players"));
        var circles = []
        var circle = []
        for (var p = 0; p < players.length; p++) {
            circle.push(0)
            players[p].score = Number(localStorage.getItem("total_score"));
            players[p].leader_gap = 0;
        }
        circles.push(circle)
        localStorage.setItem('circles', JSON.stringify(circles));
        localStorage.setItem('players', JSON.stringify(players));
    }
    if (game == 'sectors') {
        var players = JSON.parse(localStorage.getItem("players"));
        for (var p = 0; p < players.length; p++) {
            players[p].score = 1;
        }
        localStorage.setItem('max_score', 1);
        localStorage.setItem('players', JSON.stringify(players));
    }
    loadData();
}

function checkForSWUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (confirm('Доступно обновление. Перезагрузить страницу?')) {
              navigator.serviceWorker.controller?.postMessage({ type: 'skipWaiting' });
              window.location.reload();
            }
          }
        });
      });
    });
  }
}

// Проверка обновления при загрузке
checkForSWUpdate();