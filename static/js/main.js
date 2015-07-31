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

