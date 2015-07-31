var express=require('express');
var path=require('path');
var app=express();

app.use(express.static(path.join(__dirname,'./static')));
app.set('views',path.join(__dirname,'./views'));
app.set('view engine','ejs');

app.get('/',function(req,res){
	res.render('index');
})

var server=app.listen(8000,function(){
	console.log("listening, 8000");
})

var io = require('socket.io').listen(server)

var Player=function(name){
	this.name=name;
	this.score=0;

	this.updateScore=function(points){
		this.score+=points;
	}
}

var Cell=function(player,id){
	this.player=player;
	this.id=id;
	this.active=false;
	this.activation_time=0;
	this.deactivation_time=0;
	this.time_active=0;
}
var Game=function(ids,players){
	this.player1=players[0];
	this.player2=players[1];

	this.id=ids[0]+ids[1];
	this.p1id=ids[0];
	this.p2id=ids[1];

	this.ready=0;

	this.cells=[];
}


var users=[];
var cells=[];
var score_limit=100;
var games=[];
var game={};
io.sockets.on('connection', function (socket) {

	socket.on('new_user',function(name){
		var user_name=name.replace(/[^a-zA-Z0-9]+[^a-zA-Z0-9 ]/gi,'');
		user_name=user_name.replace(/\s\s+/g,' ');
		if(user_name===''||user_name===' '){
			user_name='Spacey';
		}

		users.push({name:user_name,id:socket.id});

		if(users.length>=2){
			//start new game
			players=[];
			
			var player1=new Player(users[0].name);
			var player2=new Player(users[1].name);
			game=new Game([users[0].id,users[1].id],[player1,player2]);

			games[game.id]=game;
			users.splice(1,1);
			users.splice(0,1);

			players[0]=player1;
			players[1]=player2;

			initializeAndOrReset(game.id);

			io.to(game.p1id).emit('start',players,game.id);
			io.to(game.p2id).emit('start',players,game.id);
		}
	})

	function initializeAndOrReset(game_id){
		var cell={};
		games[game_id].cells=[];
		games[game_id].player1.score=0;
		games[game_id].player2.score=0;

		for(i=0;i<16;i++){
			cell=new Cell(games[game_id].player1,i);
			games[game_id].cells.push(cell);
		}
		for(i=16;i<32;i++){
			cell=new Cell(games[game_id].player2,i);
			games[game_id].cells.push(cell);
		}
	}

	socket.on('players_ready',function(game_id){
		initializeAndOrReset(game_id);
	})

	socket.on('challengeRematch',function(game_id){
		games[game_id].ready++;

		if(socket.id==games[game_id].p1id){
			io.to(games[game_id].p2id).emit('challenged',games[game_id].player1.name);
		}
		else{
			io.to(games[game_id].p1id).emit('challenged',games[game_id].player2.name);
		}

		if(games[game_id].ready>1){
			initializeAndOrReset(game_id);
			io.to(games[game_id].p1id).emit('rematch',[games[game_id].player1,games[game_id].player2],game_id);
			io.to(games[game_id].p2id).emit('rematch',[games[game_id].player1,games[game_id].player2],game_id);
			games[game_id].ready=0;
		}
		
	})


	socket.on('cell_clicked',function(id,game_id){
		if(!games[game_id].cells[id].active){
			games[game_id].cells[id].active=true;
			games[game_id].cells[id].activation_time=new Date().getTime();
			io.to(games[game_id].p1id).emit('cell_activated',id);
			io.to(games[game_id].p2id).emit('cell_activated',id);
			
		}
		else{
			games[game_id].cells[id].active=false;
			games[game_id].cells[id].deactivation_time=new Date().getTime();
			var new_points=Math.floor((games[game_id].cells[id].deactivation_time-games[game_id].cells[id].activation_time)/100);
			

			
			if(games[game_id].player1.name==games[game_id].cells[id].player.name){
				games[game_id].player2.updateScore(new_points);

				io.to(games[game_id].p1id).emit('cell_deactivated',id,games[game_id].player2,new_points);
				io.to(games[game_id].p2id).emit('cell_deactivated',id,games[game_id].player2,new_points);
			}
			else if(games[game_id].player2.name==games[game_id].cells[id].player.name){
				games[game_id].player1.updateScore(new_points);
				io.to(games[game_id].p1id).emit('cell_deactivated',id,games[game_id].player1,new_points);
				io.to(games[game_id].p2id).emit('cell_deactivated',id,games[game_id].player1,new_points);
			}
		
			//check if score is over limit upon deactivation
			if(games[game_id].player1.score>=score_limit||games[game_id].player2.score>=score_limit){
				
				//deactivate remaining cells and tally points
				for(i=0;i<games[game_id].cells.length;i++){
					if(games[game_id].cells[i].active){
						games[game_id].cells[i].active=false;
						
						games[game_id].cells[i].deactivation_time=new Date().getTime();
						var end_points=Math.floor((games[game_id].cells[i].deactivation_time-games[game_id].cells[i].activation_time)/100);

						if(games[game_id].player1.name==games[game_id].cells[i].player.name){
							games[game_id].player2.updateScore(end_points);
						}
						else if(games[game_id].player2.name==games[game_id].cells[i].player.name){
							games[game_id].player1.updateScore(end_points);
						}						
					}
				}
				//check for winner
				if(games[game_id].player1.score>games[game_id].player2.score){
					var winner=games[game_id].player1.name;
				}
				else{
					var winner=games[game_id].player2.name;
				}

				io.to(games[game_id].p1id).emit('game_over',games[game_id].player1,games[game_id].player2,winner,game_id);
				io.to(games[game_id].p2id).emit('game_over',games[game_id].player1,games[game_id].player2,winner,game_id);

			}
		}
	})


});