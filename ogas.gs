var g_spreadsheet_name = "ogas";
var g_ignore_users = [ "slackbot" ];

function setup(){
  if ( null != ogas.cache.get( "spreadsheet_id" ) ) return;
  
  var spreadsheet = ogas.spreadsheet.create( g_spreadsheet_name );
  ogas.cache.set( "spreadsheet_id", spreadsheet.getId() );
}

function doGet( e ){
  if ( undefined == e ){
    e = {
      parameter : {
        user_name : "test_user",
        text      : "ルール",
        token     : "",
      },
    };
  }
  
  main( e );
}

function doPost( e ){
  main( e );
}

function main( e ){
  try{
    ogas.vars.set( "user_name", e.parameter.user_name );
    ogas.vars.set( "text", e.parameter.text );
    ogas.vars.set( "token", e.parameter.token );
    
    init();
    update();
    exit();
  }catch ( err ){
    ogas.log.err( ogas.string.format( "{0} e={1}\n{2}", err, ogas.json.encode( e ), err.stack ) );
  }
}

function init(){
  var request_time = ogas.time.local_time();
  ogas.vars.set( "request_time", request_time );
  
  var spreadsheet = ogas.spreadsheet.open( ogas.cache.get( "spreadsheet_id" ) );
  ogas.vars.set( "spreadsheet", spreadsheet );
  
  var config_sheet = ogas.sheet.open( spreadsheet, "config" );
  if ( "" == ogas.sheet.get( config_sheet, "A1" ) ){
    ogas.sheet.set( config_sheet, "A1", "slack_incoming_webhook_url" );
    ogas.sheet.set( config_sheet, "A2", "slack_outgoing_webhook_token" );
    ogas.sheet.set( config_sheet, "A3", "ignore_users" );
  }
  ogas.vars.set( "config_sheet", config_sheet );
  set_config( config_sheet );
  
  var save_rules_sheet = ogas.sheet.open( spreadsheet, "save_rules" );
  if ( "" == ogas.sheet.get( save_rules_sheet, "A1" ) ){
    ogas.sheet.add_row( save_rules_sheet, [ "name", "pattern", "flags" ] );
  }
  ogas.vars.set( "save_rules_sheet", save_rules_sheet );
  set_save_rules( save_rules_sheet );
  
  var load_rules_sheet = ogas.sheet.open( spreadsheet, "load_rules" );
  if ( "" == ogas.sheet.get( load_rules_sheet, "A1" ) ){
    ogas.sheet.add_row( load_rules_sheet, [ "name", "pattern", "flags" ] );
  }
  ogas.vars.set( "load_rules_sheet", load_rules_sheet );
  set_load_rules( load_rules_sheet );
  
  var log_sheet = ogas.sheet.open( spreadsheet, "log" );
  ogas.vars.set( "log_sheet", log_sheet );
}

function set_config( sheet ){
  var values = ogas.sheet.gets( sheet );
  var keys = ogas.sheet.column_values( values, 0 );
  var ignore_users_index = keys.indexOf( "ignore_users" );
  var slack_incoming_webhook_url_index = keys.indexOf( "slack_incoming_webhook_url" );
  var slack_outgoing_webhook_token_index = keys.indexOf( "slack_outgoing_webhook_token" );
  var ignore_users = values[ ignore_users_index ].slice( 1 );
  var ignore_users_len = ignore_users.length;
  for ( var i = 0; i < ignore_users_len; ++i ){
    var ignore_user = ignore_users[ i ];
    if ( "" != ignore_user ) g_ignore_users.push( ignore_user );
  }
  
  var slack_incoming_webhook_url = values[ slack_incoming_webhook_url_index ][ 1 ];
  ogas.vars.set( "slack_incoming_webhook_url", slack_incoming_webhook_url );
  
  var slack_outgoing_webhook_token = values[ slack_outgoing_webhook_token_index ][ 1 ];
  ogas.vars.set( "slack_outgoing_webhook_token", slack_outgoing_webhook_token );
}

function set_save_rules( sheet ){
  var values = ogas.sheet.gets( sheet );
  var keys = values.shift();
  var values_len = values.length;
  var name_index = keys.indexOf( "name" );
  var pattern_index = keys.indexOf( "pattern" );
  var flags_index = keys.indexOf( "flags" );
  var slack_text_index = keys.indexOf( "slack_text" );
  for ( var i = 0; i < values_len; ++i ){
    var value = values[ i ];
    var name = value[ name_index ];
    var pattern = value[ pattern_index ];
    var flags = value[ flags_index ];
    var slack_text = value[ slack_text_index ];
    ogas.pattern.add( "save", { name : name, slack_text : slack_text }, pattern, flags );
  }
}

function set_load_rules( sheet ){
  var values = ogas.sheet.gets( sheet );
  var keys = values.shift();
  var values_len = values.length;
  var name_index = keys.indexOf( "name" );
  var pattern_index = keys.indexOf( "pattern" );
  var flags_index = keys.indexOf( "flags" );
  for ( var i = 0; i < values_len; ++i ){
    var value = values[ i ];
    var name = value[ name_index ];
    var pattern = value[ pattern_index ];
    var flags = value[ flags_index ];
    ogas.pattern.add( "load", { name : name }, pattern, flags );
  }
}

function update(){
  var request_time = ogas.vars.get( "request_time" );
  var user_name    = ogas.vars.get( "user_name" );
  var text         = ogas.vars.get( "text" );
  var token        = ogas.vars.get( "token" );
  if ( ! is_update( user_name, token ) ) return;
  
  ogas.log.dbg( "{0} => {1}", user_name, text );
  
  save( request_time, user_name, text );
  load( request_time, user_name, text );
}

function is_update( user_name, token ){
  if ( is_ignore_user( user_name ) ) return false;
  if ( is_invalid_token( token ) ) return false;
  return true;
}

function is_ignore_user( user_name ){
  return ( 0 <= g_ignore_users.indexOf( user_name ) );
}

function is_invalid_token( token ){
  var slack_outgoing_webhook_token = ogas.vars.get( "slack_outgoing_webhook_token" );
  return ( "" == slack_outgoing_webhook_token ) ? false : ( slack_outgoing_webhook_token != token );
}

function exit(){
  
}

function save( request_time, user_name, text ){
  var matches = ogas.pattern.matches( "save", text );
  var matches_len = matches.length;
  var values = {};
  for ( var i = 0; i < matches_len; ++i ){
    var match = matches[ i ];
    
    match.matches.shift();
    var result = ogas.method.call( global, ogas.string.format( "on_save_{0}", match.value.name ), match );
    if ( undefined === result ) result = on_save( match );
    values[ match.value.name ] = result;
  }
  if ( 0 < Object.keys( values ).length ) ogas.action.save( user_name, values, request_time );
}

function on_save( match ){
  if ( "" != match.value.slack_text ){
    var request_time = ogas.vars.get( "request_time" );
    var user_name = ogas.vars.get( "user_name" );
    var time = ogas.time.format( "hm", request_time );
    var text = ogas.string.replace( match.value.slack_text, { user_name : user_name, time : time } );
    slack_post( text );
  }
  return match.matches;
}

function load( request_time, user_name, text ){
  var matches = ogas.pattern.matches( "load", text );
  var matches_len = matches.length;
  for ( var i = 0; i < matches_len; ++i ){
    var match = matches[ i ];
    
    match.matches.shift();
    var result = ogas.method.call( global, ogas.string.format( "on_load_{0}", match.value.name ), match );
    if ( undefined === result ) on_load( match );
  }
}

function on_load( match ){
  return match.matches;
}

function on_load_rule( match ){
  var user_name = ogas.vars.get( "user_name" );
  var save_rules_sheet = ogas.vars.get( "save_rules_sheet" );
  var load_rules_sheet = ogas.vars.get( "load_rules_sheet" );
  var array = [ "<ルール>" ];
  
  var send_rules = ogas.sheet.values_to_tables( ogas.sheet.gets( save_rules_sheet ) );
  var send_rules_len = send_rules.length;
  array.push( ogas.string.format( "[Save] {0}", send_rules_len ) );
  for ( var i = 0; i < send_rules_len; ++i ){
    var send_rule = send_rules[ i ];
    array.push( ogas.string.format( "/{0}/{1}", send_rule.pattern, send_rule.flags ) );
  }
  
  var load_rules = ogas.sheet.values_to_tables( ogas.sheet.gets( load_rules_sheet ) );
  var load_rules_len = load_rules.length;
  array.push( ogas.string.format( "[Load] {0}", load_rules_len ) );
  for ( var i = 0; i < load_rules_len; ++i ){
    var load_rule = load_rules[ i ];
    array.push( ogas.string.format( "/{0}/{1}", load_rule.pattern, load_rule.flags ) );
  }
  
  var text = array.join( "\n" );
  slack_post( ogas.string.format( "@{0} {1}", user_name, text ) );
}

function slack_post( text ){
  var slack_incoming_webhook_url = ogas.vars.get( "slack_incoming_webhook_url" );
  ogas.slack.post( slack_incoming_webhook_url, { text : text, link_names : 1 } );
}

var ogas = ogas || {};

(function( log ){
  function output( value, options ){
    if ( typeof options === "undefined" ) options = {};
    
    var local_time = ogas.time.local_time();
    var msg = "["+ ogas.time.format( "all", local_time ) +"] "+ value;
    var sheet = ogas.vars.get( "log_sheet" );
    if ( null == sheet ){
      Logger.log( msg );
      return;
    }
    ogas.sheet.add_row( sheet, [ msg ] );
    
    var range = ogas.sheet.range( sheet, sheet.getLastRow(), 1 );
    if ( "fc" in options ) range.setFontColor( options.fc );
    if ( "bc" in options ) range.setBackgroundColor( options.bc );
    
    var log_num = sheet.getLastRow();
    var max_log_num = sheet.getMaxRows();
    if ( max_log_num <= log_num ){
      sheet.setName( ogas.string.format( "log_{0}_{1}",
        ogas.time.format( "YMD", local_time ),
        ogas.time.format( "HMS", local_time ) ) );
      ogas.vars.set( "log_sheet", ogas.sheet.open( ogas.vars.get( "spreadsheet" ), "log", sheet.getIndex() - 1 ) );
    }
  }
  
  log.dbg = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "blue" } );
  };
  
  log.inf = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "black" } );
  };
  
  log.wrn = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    output( value, { fc : "olive" } );
  };
  
  log.err = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
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
  spreadsheet.create = function( name ){
    return SpreadsheetApp.create( name );
  };
  
  spreadsheet.open = function( id ){
    return SpreadsheetApp.openById( id );
  };
})(ogas.spreadsheet = ogas.spreadsheet || {});

(function( sheet ){
  sheet.open = function( spreadsheet, name, insert_index ){
    if ( typeof insert_index === "undefined" ) insert_index = spreadsheet.getNumSheets();
    
    var sheet = spreadsheet.getSheetByName( name );
    if ( null == sheet ) sheet = spreadsheet.insertSheet( name, insert_index );
    return sheet;
  };
  
  sheet.range = function(){
    var args = Array.prototype.slice.call( arguments );
    var sheet = args.shift();
    return ( 0 < args.length ) ? sheet.getRange.apply( sheet, args ) : sheet.getDataRange();
  };
  
  sheet.get = function(){
    var args = Array.prototype.slice.call( arguments );
    return sheet.range.apply( sheet, args ).getValue();
  };
  
  sheet.gets = function(){
    var args = Array.prototype.slice.call( arguments );
    return sheet.range.apply( sheet, args ).getValues();
  };
  
  sheet.set = function(){
    var args = Array.prototype.slice.call( arguments );
    var value = args.pop();
    return sheet.range.apply( sheet, args ).setValue( value );
  };
  
  sheet.sets = function(){
    var args = Array.prototype.slice.call( arguments );
    var values = args.pop();
    return sheet.range.apply( sheet, args ).setValues( values );
  };
  
  sheet.add_row = function( sheet, values ){
    sheet.appendRow( values );
  };
  
  sheet.column_values = function( values, column_index ){
    var column_values = [];
    var values_len = values.length;
    for ( var row_index = 0; row_index < values_len; ++row_index ){
      column_values.push( values[ row_index ][ column_index ] );
    }
    return column_values;
  };
  
  sheet.values_to_tables = function( values ){
    var tables = [];
    var keys = values[ 0 ];
    var values_len = values.length;
    for ( var row = 1; row < values_len; ++row ){
      var value = values[ row ];
      var value_len = value.length;
      var record = {};
      for ( var col = 0; col < value_len; ++col ){
        record[ keys[ col ] ] = value[ col ];
      }
      tables.push( record );
    }
    return tables;
  };
})(ogas.sheet = ogas.sheet || {});

(function( string ){
  string.format = function(){
    var args = Array.prototype.slice.call( arguments );
    var head = "";
    var tail = args.shift();
    var pattern = new ogas.Pattern( undefined, "\{([0-9]+)\}" );
    while ( "" != tail ){
      var match = pattern.match( tail );
      if ( null == match ) break;
      
      head += match.head + args[ Number( match.matches[ 1 ] ) ];
      tail = match.tail;
    }
    return head + tail;
  };
  
  string.multi = function( value, count ){
    var array = [];
    for ( var i = 0; i < count; ++i ){
      array.push( value );
    }
    return array.join();
  };
  
  string.padding_zero = function( digit, value ){
    return ( string.multi( "0", digit ) + value ).slice( - digit );
  };
  
  string.replace = function( format, values ){
    var head = "";
    var tail = format;
    var pattern = new ogas.Pattern( undefined, "\{([a-zA-Z0-9_]+)\}" );
    while ( "" != tail ){
      var match = pattern.match( tail );
      if ( null == match ) break;
      
      var key = match.matches[ 1 ];
      head += ( key in values ) ? match.head + values[ key ] : match.matches[ 0 ];
      tail = match.tail;
    }
    return head + tail;
  };
})(ogas.string = ogas.string || {});

ogas.Pattern = function( value, pattern, flags ){
  this.m_value = value;
  this.m_regex = new RegExp( pattern, flags );
};
ogas.Pattern.prototype.match = function( value ){
  var matches = this.m_regex.exec( value );
  return ( null == matches ) ? null : { value : this.m_value, matches : matches, head : RegExp.leftContext, tail : RegExp.rightContext };
};

(function( pattern ){
  var m_patterns = {};
  
  pattern.add = function( type, name, pattern, flags ){
    var add_value = new ogas.Pattern( name, pattern, flags );
    if ( type in m_patterns ){
      m_patterns[ type ].push( add_value );
    }else{
      m_patterns[ type ] = [ add_value ];
    }
  };
  
  pattern.matches = function( type, value ){
    if ( undefined === m_patterns[ type ] ) return [];
    
  　var matches = [];
    var patterns_len = m_patterns[ type ].length;
    for ( var i = 0; i < patterns_len; ++i ){
      var result = m_patterns[ type ][ i ].match( value );
      if ( null != result ) matches.push( result );
    }
    return matches;
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
  
  time.format = function( type, local_time ){
    if ( typeof local_time === "undefined" ) local_time = time.local_time();
    
    var value = "";
    switch ( type ){
    case "all":{
      value = ogas.string.format( "{0}/{1}/{2} {3}:{4}:{5}.{6}",
        local_time.year(),
        ogas.string.padding_zero( 2, local_time.month() ),
        ogas.string.padding_zero( 2, local_time.date() ),
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ),
        ogas.string.padding_zero( 2, local_time.sec() ),
        ogas.string.padding_zero( 3, local_time.msec() ) );
    }break;
    
    case "ymd":{
      value = ogas.string.format( "{0}/{1}/{2}",
        local_time.year(),
        ogas.string.padding_zero( 2, local_time.month() ),
        ogas.string.padding_zero( 2, local_time.date() ) );
    }break;
    
    case "YMD":{
      value = ogas.string.format( "{0}{1}{2}",
        local_time.year(),
        ogas.string.padding_zero( 2, local_time.month() ),
        ogas.string.padding_zero( 2, local_time.date() ) );
    }break;
    
    case "hms":{
      value = ogas.string.format( "{0}:{1}:{2}",
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ),
        ogas.string.padding_zero( 2, local_time.sec() ) );
    }break;
    
    case "HMS":{
      value = ogas.string.format( "{0}{1}{2}",
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ),
        ogas.string.padding_zero( 2, local_time.sec() ) );
    }break;
    
    case "hm":{
      value = ogas.string.format( "{0}:{1}",
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ) );
    }break;
    
    case "HM":{
      value = ogas.string.format( "{0}{1}",
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ) );
    }break;
    }
    return value;
  };
})(ogas.time = ogas.time || {});

(function( action ){
  action.save = function( user_name, matches, request_time ){
    if ( typeof request_time === "undefined" ) request_time = ogas.time.local_time();
    
    var sheet_name = ogas.string.format( "{0}{1}", request_time.year(), ogas.string.padding_zero( 2, request_time.month() ) );
    var sheet = ogas.sheet.open( ogas.vars.get( "spreadsheet" ), sheet_name );
    var max_column_num = sheet.getMaxColumns();
    var add_column_num = 32 - max_column_num;
    if ( 0 < add_column_num ) ogas.sheet.set( sheet, 1, max_column_num + add_column_num, "" );
    var values = ogas.sheet.gets( sheet );
    var user_names = ogas.sheet.column_values( values, 0 );
    var user_index = user_names.indexOf( user_name ) + 1;
    var date_index = request_time.date() + 1;
    if ( 0 == user_index ){
      user_index = user_names.length;
      if ( "" !== user_names[ 0 ] ) user_index += 1;
      ogas.sheet.set( sheet, user_index, 1, user_name );
    }
    var value = save_date( ogas.sheet.get( sheet, user_index, date_index ), matches, request_time );
    ogas.sheet.set( sheet, user_index, date_index, value );
  };
  
  save_date = function( value, matches, request_time ){
    var request_timestamp = ogas.string.format( "{0} {1}",
      ogas.time.format( "YMD", request_time ),
      ogas.time.format( "HMS", request_time ) );
    value = ( "" === value ) ? [] : ogas.json.decode( value );
    value.push({ r : request_timestamp, m : matches });
    return ogas.json.encode( value );
  };
})(ogas.action = ogas.action || {});

(function( method ){
  method.call = function(){
    var args = Array.prototype.slice.call( arguments );
    var instance = args.shift();
    var name = args.shift();
    return ( undefined === instance[ name ] ) ? undefined : instance[ name ].apply( instance, args );
  };
})(ogas.method = ogas.method || {});

(function( slack ){
  slack.post = function( url, params ){
    return UrlFetchApp.fetch( url, { method : "post", contentType : "application/json", payload : ogas.json.encode( params ) } );
  };
})(ogas.slack = ogas.slack || {});

var global = this;
