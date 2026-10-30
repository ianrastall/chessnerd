export const navigation = [
  { name:'Games & archives', icon:'archive', links:[
    {name:'Tournament search',href:'/#games'},
    {name:'Chess.com tournaments',href:'/chesscom-tournaments.html',keywords:'titled tuesday bullet brawl thursday ccc events downloads'},
    {name:'Tournament archive',href:'/tournament-archive.html',keywords:'ctml pgntours'},
    {name:'PGN downloads',href:'/pgn-downloads.html'}]},
  { name:'Players & ratings', icon:'players', links:[
    {name:'FIDE player profiles',href:'/fide-player.html',keywords:'rating history surname id'},
    {name:'FIDE 2500+ players',href:'/fide-2500.html'},
    {name:'Chess.com titled players',href:'/titled-players.html'},
    {name:'FIDE rating lists',href:'/fide-archive.html',keywords:'archive historical'}]},
  { name:'Analysis & play', icon:'analysis', links:[
    {name:'PGN information',href:'/pgn-info.html',keywords:'file statistics analyze'},
    {name:'Opening explorer',href:'/eco-code.html',keywords:'eco codes'},
    {name:'Play an engine',href:'/play-engine.html',keywords:'game board lozza'},
    {name:'Board colors',href:'/board-colors.html',keywords:'palette'}]},
  { name:'Engines & software', icon:'engines', links:[
    {name:'Engine releases',href:'/engines.html'},
    {name:'Stockfish commits',href:'/stockfish-commits.html'},
    {name:'Software catalogue',href:'/software.html'}]},
  { name:'Developer reference', icon:'developer', links:[
    {name:'Chess.com API',href:'/chesscom-api.html'}]}
] as const;
