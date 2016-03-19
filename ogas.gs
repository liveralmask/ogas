function setup(){
  if ( null != ogas.cache.get( "spreadsheet_id" ) ) return;
  
  // TODO スプレッドシートを作成し、IDをキャッシュに保存
  
  
  var spreadsheet = SpreadsheetApp.openById( ogas.cache.get( "spreadsheet_id" ) );
  ogas.spreadsheet.set( spreadsheet );
  
  var config_sheet = ogas.spreadsheet.sheet( "config", true );
  
  var log_sheet = ogas.spreadsheet.sheet( "log", true );
  
  var rules_sheet = ogas.spreadsheet.sheet( "rules", true );
  
  
}

function doGet( e ){
  if ( undefined == e ){
    e = {
      parameter : {
        user_name : "user",
        text      : "text",
      },
    };
  }
  
  main( e );
}

function doPost( e ){
  main( e );
}

function main( e ){
  init( e );
  update();
  exit();
}

function init( e ){
  ogas.vars.set( "local_time", ogas.time.local_time() );
  ogas.vars.set( "user_name", e.parameter.user_name );
  ogas.vars.set( "text", e.parameter.text );
  
  var spreadsheet = SpreadsheetApp.openById( ogas.cache.get( "spreadsheet_id" ) );
  ogas.spreadsheet.set( spreadsheet );
  
  var config_sheet = spreadsheet.getSheetByName( "config" );
  ogas.vars.set( "config_sheet", config_sheet );
  
  var log_sheet = spreadsheet.getSheetByName( "log" );
  ogas.vars.set( "log_sheet", log_sheet );
  
  var rules_sheet = spreadsheet.getSheetByName( "rules" );
  ogas.vars.set( "rules_sheet", rules_sheet );
  
  ogas.pattern.add( "TEST", "test" );
}

function update(){
  ogas.log.dbg( "{0} => {1}", ogas.vars.get( "user_name" ), ogas.vars.get( "text" ) );
  
  var result = ogas.pattern.match( "test" );
  if ( null == result ) return;
  
  result.matches.shift();
  var actions = {};
  actions[ result.name ] = result.matches;
  ogas.action.save( ogas.vars.get( "user_name" ), actions, ogas.vars.get( "local_time" ) );
}

function exit(){
  
}

var ogas = ogas || {};

(function( log ){
  function output( value, options ){
    if ( typeof options === "undefined" ) options = {};
    
    var sheet = ogas.vars.get( "log_sheet" );
    var local_time = ogas.time.local_time();
    var timestamp = ogas.string.format( "{0}/{1}/{2} {3}:{4}:{5}.{6}",
      local_time.year(),
      ogas.string.padding_zero( 2, local_time.month() ),
      ogas.string.padding_zero( 2, local_time.date() ),
      ogas.string.padding_zero( 2, local_time.hour() ),
      ogas.string.padding_zero( 2, local_time.min() ),
      ogas.string.padding_zero( 2, local_time.sec() ),
      ogas.string.padding_zero( 3, local_time.msec() ) );
    sheet.appendRow( [ "["+ timestamp +"] "+ value ] );
    
    var cell = sheet.getRange( sheet.getLastRow(), 1 );
    if ( "fc" in options ) cell.setFontColor( options.fc );
    if ( "bc" in options ) cell.setBackgroundColor( options.bc );
  }
  
  log.dbg = function(){
    var value = ogas.string.format.apply( this, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "blue" } );
  };
  
  log.inf = function(){
    var value = ogas.string.format.apply( this, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "black" } );
  };
  
  log.wrn = function(){
    var value = ogas.string.format.apply( this, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "olive" } );
  };
  
  log.err = function(){
    var value = ogas.string.format.apply( this, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "red" } );
  };
})(ogas.log = ogas.log || {});

(function( cache ){
  var m_cache = PropertiesService.getScriptProperties();
  
  cache.set = function( key, value ){
    m_cache.setProperty( key, value );
  };
  
  cache.get = function( key ){
    return m_cache.getProperty( key );
  };
})(ogas.cache = ogas.cache || {});

(function( vars ){
  var m_vars = {};
  
  vars.set = function( key, value ){
    m_vars[ key ] = value;
  };
  
  vars.get = function( key ){
    return m_vars[ key ];
  };
})(ogas.vars = ogas.vars || {});

(function( spreadsheet ){
  var m_spreadsheet = null;
  
  spreadsheet.set = function( value ){
    m_spreadsheet = value;
  };
  
  spreadsheet.get = function(){
    return m_spreadsheet;
  };
  
  spreadsheet.sheet = function( name, is_insert ){
    if ( typeof is_insert === "undefined" ) is_insert = false;
    
    var sheet = m_spreadsheet.getSheetByName( name );
    if ( null == sheet ){
      if ( is_insert ) sheet = m_spreadsheet.insertSheet( name );
    }
    return sheet;
  };
})(ogas.spreadsheet = ogas.spreadsheet || {});

(function( string ){
  string.format = function(){
    var args = Array.prototype.slice.call( arguments );
    var format = args.shift();
    var args_len = args.length;
    for ( var i = args.length - 1; 0 <= i; --i ){
      format = format.replace( "{"+ i +"}", args[ i ] );
    }
    return format;
  };
  
  string.multi = function( value, count ){
    var array = [];
    for ( var i = 0; i < count; ++i ){
      array.push( value );
    }
    return array.join();
  };
  
  string.padding_zero = function( digit, value ){
    return ( string.multi( "0", ( digit - 1 ) ) + value ).slice( - digit );
  };
})(ogas.string = ogas.string || {});

ogas.Pattern = function( name, pattern, flags ){
  this.m_name    = name;
  this.m_regex = new RegExp( pattern, flags );
};
ogas.Pattern.prototype.match = function( value ){
  var matches = this.m_regex.exec( value );
  return ( null == matches ) ? null : { name : this.m_name, matches : matches };
};

(function( pattern ){
  var m_patterns = [];
  
  pattern.clear = function(){
    m_patterns.clear();
  };
  
  pattern.add = function( name, pattern, flags ){
    m_patterns.push( new ogas.Pattern( name, pattern, flags ) );
  };
  
  pattern.match = function( value ){
    var patterns_len = m_patterns.length;
    for ( var i = 0; i < patterns_len; ++i ){
      var result = m_patterns[ i ].match( value );
      if ( null != result ) return result;
    }
    return null;
  };
})(ogas.pattern = ogas.pattern || {});

(function( json ){
  json.encode = function( value ){
    return JSON.stringify( value );
  };
  
  json.decode = function( value ){
    return JSON.parse( value );
  };
})(ogas.json = ogas.json || {});

(function( time ){
  time.LocalTime = function( value ){
    if ( typeof value === "undefined" ) value = new Date();
    
    this.m_value = value;
  };
  time.LocalTime.prototype.year = function(){
    return this.m_value.getFullYear();
  };
  time.LocalTime.prototype.month = function(){
    return this.m_value.getMonth() + 1;
  };
  time.LocalTime.prototype.date = function(){
    return this.m_value.getDate();
  };
  time.LocalTime.prototype.hour = function(){
    return this.m_value.getHours();
  };
  time.LocalTime.prototype.min = function(){
    return this.m_value.getMinutes();
  };
  time.LocalTime.prototype.sec = function(){
    return this.m_value.getSeconds();
  };
  time.LocalTime.prototype.msec = function(){
    return this.m_value.getMilliseconds();
  };
  
  time.local_time = function(){
    return new time.LocalTime();
  };
})(ogas.time = ogas.time || {});

(function( action ){
  action.save = function( user_name, actions, local_time ){
    if ( typeof local_time === "undefined" ) local_time = ogas.time.local_time();
    
    var sheet_name = ogas.string.format( "{0}{1}", local_time.year(), ogas.string.padding_zero( 2, local_time.month() ) );
    var sheet = ogas.spreadsheet.sheet( sheet_name, true );
    var values = sheet.getDataRange().getValues();
    var user_names = values[ 0 ];
    var user_index = user_names.indexOf( user_name ) + 1;
    var date_index = local_time.date() + 1;
    if ( 0 == user_index ){
      user_index = user_names.length;
      if ( "" !== user_names[ 0 ] ) user_index += 1;
      sheet.getRange( 1, user_index ).setValue( user_name );
    }
    var value = merge( sheet.getRange( date_index, user_index ).getValue(), actions, local_time );
    sheet.getRange( date_index, user_index ).setValue( value );
  };
  
  merge = function( value, actions, local_time ){
    var timestamp = ogas.string.format( "{0}:{1}:{2}",
      ogas.string.padding_zero( 2, local_time.hour() ),
      ogas.string.padding_zero( 2, local_time.min() ),
      ogas.string.padding_zero( 2, local_time.sec() ) );
    value = ( "" === value ) ? {} : ogas.json.decode( value );
    for ( var key in actions ){
      var add_value = { t : timestamp };
      var action = actions[ key ];
      if ( 0 < action.length ) add_value[ a ] = action; 
      if ( key in value ){
        value[ key ].push( add_value );
      }else{
        value[ key ] = [ add_value ];
      }
    }
    return ogas.json.encode( value );
  };
})(ogas.action = ogas.action || {});
