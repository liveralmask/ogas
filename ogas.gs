var global = this;
var g_spreadsheet_name = "ogas";
var g_ignore_users = [ "slackbot" ];
var g_is_update = false;
var g_debug_parameter = {
  user_name : "OGAS-TEST",
  text      : "test",
  token     : "",
};

/* ----- action_rules function ----- */

global.on_action = function(){
  var match = ogas.pattern.match( "action", ogas.vars.get( "text" ) );
  do{
    if ( null == match ) break;
    
    ogas.vars.set( "target_time", parse_target_time( ogas.vars.get( "text" ), ogas.vars.get( "request_time" ) ) );
    var params = {
      request_time : ogas.vars.get( "request_time" ).toString(),
      target_time  : ogas.vars.get( "target_time" ).toString(),
      user_name    : ogas.vars.get( "user_name" ),
      text         : ogas.vars.get( "text" ),
      match        : match,
    };
    ogas.log.inf( ogas.json.encode( params ) );
    ogas.method.call( global, ogas.string.format( "on_action_{0}", match.value.name ), match );
  }while ( false );
}

global.on_action_test = function( match ){
  ogas.log.dbg( "on_action_test {0}", ogas.json.encode( match ) );
}

global.on_action_rule = function( match ){
  var action_rules_sheet = ogas.vars.get( "action_rules_sheet" );
  var time_rules_sheet = ogas.vars.get( "time_rules_sheet" );
  var array = [ "<ルール>" ];
  
  var action_rules = ogas.sheet.values_to_tables( ogas.sheet.range( action_rules_sheet ).getValues() );
  var action_rules_array = rules_to_array( action_rules, ogas.string.format( "[Action] {0}", action_rules.length ) );
  
  var time_rules = ogas.sheet.values_to_tables( ogas.sheet.range( time_rules_sheet ).getValues() );
  var time_rules_array = rules_to_array( time_rules, ogas.string.format( "[Time] {0}", time_rules.length ) );
  
  slack_post( ogas.string.format( "@channel {0}", array.concat( action_rules_array, time_rules_array ).join( "\n" ) ) );
}

global.rules_to_array = function( rules, header ){
  var array = [ header ];
  var rules_len = rules.length;
  for ( var i = 0; i < rules_len; ++i ){
    var rule = rules[ i ];
    array.push( ogas.string.format( "/{0}/{1}", rule.pattern, rule.flags ) );
  }
  return array;
}

global.on_action_in = function( match ){
  var target_time = ogas.vars.get( "target_time" );
  var user_name = ogas.vars.get( "user_name" );
  var value = load( target_time, user_name );
  value[ match.value.name ] = ogas.time.format( "hms", target_time );
  save( target_time, user_name, value );
  
  slack_post( ogas.string.format( "@{0} {1} 出勤", user_name, ogas.time.format( "ymdhm", target_time ) ) );
}

global.on_action_out = function( match ){
  var target_time = ogas.vars.get( "target_time" );
  var user_name = ogas.vars.get( "user_name" );
  var value = load( target_time, user_name );
  value[ match.value.name ] = ogas.time.format( "hms", target_time );
  save( target_time, user_name, value );
  
  slack_post( ogas.string.format( "@{0} {1} 退勤", user_name, ogas.time.format( "ymdhm", target_time ) ) );
}

global.user_cell = function( sheet, target_time, user_name ){
  var row = target_time.date() + 1;
  var user_names = ogas.sheet.rows( sheet, 1 ).getValues()[ 0 ];
  user_names.shift();
  var col = user_names.indexOf( user_name );
  if ( -1 == col ) col = user_names.length;
  col += 2;
  return { row : row, col : col };
}

global.load = function( target_time, user_name ){
  var sheet_name = ogas.string.format( "{0}{1}", target_time.year(), ogas.string.padding_zero( 2, target_time.month() ) );
  var sheet = ogas.sheet.open( ogas.vars.get( "spreadsheet" ), sheet_name );
  
  var value_cell = user_cell( sheet, target_time, user_name );
  var value = ogas.sheet.range( sheet, value_cell.row, value_cell.col ).getValue();
  return ( "" == value ) ? {} : ogas.json.decode( value );
}

global.save = function( target_time, user_name, value ){
  var sheet_name = ogas.string.format( "{0}{1}", target_time.year(), ogas.string.padding_zero( 2, target_time.month() ) );
  var sheet = ogas.sheet.open( ogas.vars.get( "spreadsheet" ), sheet_name );
  if ( "" == ogas.sheet.range( sheet, "A1" ).getValue() ){
    ogas.sheet.range( sheet, "A1" ).setValue( "dates" );
    var dates = ogas.time.dates( target_time.year(), target_time.month(), ogas.vars.get( "days" ) );
    var dates_len = dates.length;
    for ( var i = 0; i < dates_len; ++i ){
      var date = dates[ i ];
      
      var cell = ogas.sheet.range( sheet, 2 + i, 1 );
      cell.setValue( ogas.string.format( "{0}({1})", date.date, date.day.string ) );
      
      var fc = "black";
      switch ( date.day.index ){
      case 0:{
        fc = "red";
      }break;
      
      case 6:{
        fc = "blue";
      }break;
      }
      cell.setFontColor( fc );
    }
  }
  
  var value_cell = user_cell( sheet, target_time, user_name );
  var user_name_cell = ogas.sheet.range( sheet, 1, value_cell.col );
  if ( "" == user_name_cell.getValue() ) user_name_cell.setValue( user_name );
  ogas.sheet.range( sheet, value_cell.row, value_cell.col ).setValue( ogas.json.encode( value ) );
}

/* ----- time_rules function ----- */

global.parse_target_time = function( text, request_time ){
  var target_time = request_time;
  var match = ogas.pattern.match( "time", ogas.vars.get( "text" ) );
  do{
    if ( null == match ) break;
    
    var result = ogas.method.call( global, ogas.string.format( "on_time_{0}", match.value.name ), match, request_time );
    if ( undefined !== result ) target_time = result;
  }while ( false );
  return target_time;
}

global.on_time_hm = function( match, request_time ){
  var hour = Number( match.matches[ 1 ] );
  var min = Number( match.matches[ 2 ] );
  var target_time = ogas.time.local_time( request_time.year(), request_time.month(), request_time.date(), hour, min );
  return target_time;
}

global.on_time_md = function( match, request_time ){
  var month = Number( match.matches[ 1 ] );
  var date = Number( match.matches[ 2 ] );
  var target_time = ogas.time.local_time( request_time.year(), month, date );
  return target_time;
}

global.on_time_mdhm = function( match, request_time ){
  var month = Number( match.matches[ 1 ] );
  var date = Number( match.matches[ 2 ] );
  var hour = Number( match.matches[ 3 ] );
  var min = Number( match.matches[ 4 ] );
  var target_time = ogas.time.local_time( request_time.year(), month, date, hour, min );
  return target_time;
}

global.on_time_tomorrow = function( match, request_time ){
  var target_time = ogas.time.local_time( request_time.year(), request_time.month(), request_time.date() + 1 );
  return target_time;
}

/* ----- Web Application ----- */

function setup(){
  try{
    if ( null != ogas.cache.get( "spreadsheet_id" ) ) return;
    
    var spreadsheet = ogas.spreadsheet.create( g_spreadsheet_name );
    ogas.cache.set( "spreadsheet_id", spreadsheet.getId() );
    
    init();
  }catch ( err ){
    ogas.log.err( ogas.string.format( "{0}\n{1}", err, err.stack ) );
  }
}

function doGet( e ){
  main( e );
}

function doPost( e ){
  main( e );
}

global.on_init_config = function( sheet ){
  if ( "" == ogas.sheet.range( sheet, "A1" ).getValue() ){
    ogas.sheet.add_col( sheet, [ "slack_incoming_webhook_url", "slack_outgoing_webhook_token", "days" ] );
    ogas.sheet.add_col( sheet, [ "", "", ogas.json.encode( [ "日", "月", "火", "水", "木", "金", "土" ] ) ] );
  }
  
  var values = ogas.sheet.cols_to_rows( ogas.sheet.range( sheet ).getValues() );
  values = [ values[ 0 ], values[ 1 ] ];
  var data = ogas.sheet.values_to_tables( values )[ 0 ];
  
  ogas.vars.set( "slack_incoming_webhook_url", data.slack_incoming_webhook_url );
  ogas.vars.set( "slack_outgoing_webhook_token", data.slack_outgoing_webhook_token );
  ogas.vars.set( "days", ogas.json.decode( data.days ) );
}

global.on_init_action_rules = function( sheet ){
  if ( "" == ogas.sheet.range( sheet, "A1" ).getValue() ){
    ogas.sheet.add_row( sheet, [ "name", "pattern", "flags" ] );
    ogas.sheet.add_row( sheet, [ "test", "test" ] );
    ogas.sheet.add_row( sheet, [ "rule", "ルール" ] );
    ogas.sheet.add_row( sheet, [ "in",   "お[っ]?は|出[勤|社]" ] );
    ogas.sheet.add_row( sheet, [ "out",  "お[っ]?つ|退[勤|社]" ] );
  }
  
  var tables = ogas.sheet.values_to_tables( ogas.sheet.range( sheet ).getValues() );
  var tables_len = tables.length;
  for ( var i = 0; i < tables_len; ++i ){
    var rule = tables[ i ];
    
    ogas.pattern.add( "action", { name : rule.name }, rule.pattern, rule.flags );
  }
}

global.on_init_time_rules = function( sheet ){
  if ( "" == ogas.sheet.range( sheet, "A1" ).getValue() ){
    ogas.sheet.add_row( sheet, [ "name", "pattern", "flags" ] );
    ogas.sheet.add_row( sheet, [ "mdhm", "([0-9]{1,2})/([0-9]{1,2}) ([0-9]{1,2}):([0-9]{1,2})" ] );
    ogas.sheet.add_row( sheet, [ "md", "([0-9]{1,2})/([0-9]{1,2})" ] );
    ogas.sheet.add_row( sheet, [ "hm", "([0-9]{1,2}):([0-9]{1,2})" ] );
    ogas.sheet.add_row( sheet, [ "tomorrow", "明日" ] );
  }
  
  var tables = ogas.sheet.values_to_tables( ogas.sheet.range( sheet ).getValues() );
  var tables_len = tables.length;
  for ( var i = 0; i < tables_len; ++i ){
    var rule = tables[ i ];
    
    ogas.pattern.add( "time", { name : rule.name }, rule.pattern, rule.flags );
  }
}

global.on_update = function(){
  on_action();
}

global.main = function( e ){
  try{
    if ( undefined == e ){
      e = {
        parameter : g_debug_parameter,
      };
    }
    ogas.vars.set( "user_name", e.parameter.user_name );
    ogas.vars.set( "text", e.parameter.text );
    ogas.vars.set( "token", e.parameter.token );
    
    init();
    if ( g_is_update ) update();
    exit();
  }catch ( err ){
    ogas.log.err( ogas.string.format( "{0}\n{1}\n{2}", err, err.stack, ogas.json.encode( { e : e } ) ) );
  }
}

global.init = function(){
  var request_time = ogas.time.local_time();
  ogas.vars.set( "request_time", request_time );
  
  var spreadsheet = ogas.spreadsheet.open( ogas.cache.get( "spreadsheet_id" ) );
  if ( null == spreadsheet ) return;
  ogas.vars.set( "spreadsheet", spreadsheet );
  
  var log_sheet = ogas.sheet.open( spreadsheet, "log" );
  ogas.vars.set( "log_sheet", log_sheet );
  
  var config_sheet = ogas.sheet.open( spreadsheet, "config" );
  ogas.vars.set( "config_sheet", config_sheet );
  on_init_config( config_sheet );
  
  var action_rules_sheet = ogas.sheet.open( spreadsheet, "action_rules" );
  ogas.vars.set( "action_rules_sheet", action_rules_sheet );
  on_init_action_rules( action_rules_sheet );
  
  var time_rules_sheet = ogas.sheet.open( spreadsheet, "time_rules" );
  ogas.vars.set( "time_rules_sheet", time_rules_sheet );
  on_init_time_rules( time_rules_sheet );
  
  g_is_update = true;
}

global.update = function(){
  g_is_update = is_update();
  if ( g_is_update ) on_update();
}

global.is_update = function(){
  if ( is_ignore_user( ogas.vars.get( "user_name" ) ) ) return false;
  if ( is_invalid_token( ogas.vars.get( "slack_outgoing_webhook_token" ), ogas.vars.get( "token" ) ) ) return false;
  return true;
}

global.is_ignore_user = function( user_name ){
  return ( 0 <= g_ignore_users.indexOf( user_name ) );
}

global.is_invalid_token = function( slack_outgoing_webhook_token, token ){
  return ( "" == slack_outgoing_webhook_token ) ? false : ( slack_outgoing_webhook_token != token );
}

global.exit = function(){
  
}

global.slack_post = function( text ){
  ogas.slack.post( ogas.vars.get( "slack_incoming_webhook_url" ), { text : text, link_names : 1 } );
}

/* ----- ogas ----- */

var ogas = ogas || {};

(function( log ){
  log.timestamp = function( local_time ){
    if ( typeof local_time === "undefined" ) local_time = ogas.time.local_time();
    
    return ogas.string.format( "[{0}]", ogas.time.format( "all", local_time ) );
  };
  
  log.output = function( value, options ){
    if ( typeof options === "undefined" ) options = {};
    
    var sheet = ogas.vars.get( "log_sheet" );
    if ( null == sheet ){
      Logger.log( value );
      return;
    }
    
    var rows = ogas.sheet.rows( sheet, sheet.getLastRow() );
    var values = rows.getValues()[ 0 ];
    var row = rows.getRow();
    var col = values.indexOf( "" ) + 1;
    if ( 0 == col ){
      col = values.length + 1;
      var max_col = sheet.getMaxColumns();
      if ( max_col < col ){
        col = 1;
        row += 1;
      }
    }
    
    var cell = ogas.sheet.range( sheet, row, col );
    cell.setValue( value );
    if ( "fc" in options ) cell.setFontColor( options.fc );
    if ( "bc" in options ) cell.setBackgroundColor( options.bc );
    if ( "ha" in options ) cell.setHorizontalAlignment( options.ha );
    if ( "va" in options ) cell.setVerticalAlignment( options.va );
    if ( "wp" in options ) cell.setWrap( options.wp );
  }
  
  log.dbg = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.output( value, { fc : "blue", ha : "left", va : "top", wp : false } );
  };
  
  log.inf = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.output( value, { fc : "black", ha : "left", va : "top", wp : false } );
  };
  
  log.wrn = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.output( value, { fc : "olive", ha : "left", va : "top", wp : false } );
  };
  
  log.err = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.output( value, { fc : "red", ha : "left", va : "top", wp : false } );
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
    var _sheet = args.shift();
//    Logger.log( ogas.string.format( "sheet.range args={0}\n{1}", ogas.json.encode( args ), ogas.stack.get() ) );
    return ( 0 < args.length ) ? _sheet.getRange.apply( _sheet, args ) : _sheet.getDataRange();
  };
  
  sheet.rows = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
    var row = args.pop();
    if ( 0 == row ) row = 1;
    var last_col = _sheet.getLastColumn();
    if ( 0 == last_col ) last_col = 1;
    return sheet.range.apply( sheet, [ _sheet, row, 1, 1, last_col ] );
  };
  
  sheet.cols = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
    var col = args.pop();
    if ( 0 == col ) col = 1;
    var last_row = _sheet.getLastRow();
    if ( 0 == last_row ) last_row = 1;
    return sheet.range.apply( sheet, [ _sheet, 1, col, last_row, 1 ] );
  };
  
  sheet.add_row = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
    var values = args.pop();
    var last_row = _sheet.getLastRow() + 1;
    sheet.range( _sheet, last_row, 1, 1, values.length ).setValues( [ values ] );
  };
  
  sheet.add_col = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
    var values = args.pop();
    var values_len = values.length;
    var last_col = _sheet.getLastColumn() + 1;
    for ( var i = 0; i < values_len; ++i ){
      sheet.range( _sheet, 1 + i, last_col, 1, 1 ).setValue( values[ i ] );
    }
  };
  
  sheet.cols_to_rows = function( values ){
    var new_values = [];
    var row_len = values.length;
    var col_len = values[ 0 ].length;
    for ( var col = 0; col < col_len; ++col ){
      var value = [];
      for ( var row = 0; row < row_len; ++row ){
        value.push( values[ row ][ col ] );
      }
      new_values.push( value );
    }
    return new_values;
  };
  
  sheet.rows_to_cols = function( values ){
    var new_values = [];
    var row_len = values[ 0 ].length;
    var col_len = values.length;
    for ( var row = 0; row < row_len; ++row ){
      var value = [];
      for ( var col = 0; col < col_len; ++col ){
        value.push( values[ row ][ col ] );
      }
      new_values.push( value );
    }
    return new_values;
  };
  
  sheet.values_to_tables = function( values ){
    var tables = [];
    var keys = values[ 0 ];
    var keys_len = keys.length;
    var values_len = values.length;
    for ( var row = 1; row < values_len; ++row ){
      var value = values[ row ];
      var record = {};
      for ( var col = 0; col < keys_len; ++col ){
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
    return array.join( "" );
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
  
  pattern.match = function( type, value ){
    if ( undefined === m_patterns[ type ] ) return null;
    
    var patterns_len = m_patterns[ type ].length;
    for ( var i = 0; i < patterns_len; ++i ){
      var result = m_patterns[ type ][ i ].match( value );
      if ( null != result ) return result;
    }
    return null;
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
  time.LocalTime = function( year, month, date, hour, min, sec ){
    if ( typeof hour === "undefined" ) hour = 0;
    if ( typeof min === "undefined" )  min = 0;
    if ( typeof sec === "undefined" )  sec = 0;
    
    var value = ( typeof year === "undefined" ) ? new Date() : new Date( year, month - 1, date, hour, min, sec );
    
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
  time.LocalTime.prototype.day = function(){
    return this.m_value.getDay();
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
  time.LocalTime.prototype.toString = function(){
    return time.format( "all", this );
  };
  
  time.local_time = function( year, month, date, hour, min, sec ){
    return new time.LocalTime( year, month, date, hour, min, sec );
  };
  
  time.first_date_time = function( year, month ){
    return time.local_time( year, month, 1 );
  };
  
  time.last_date_time = function( year, month ){
    return time.local_time( year, month + 1, 0 );
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
    
    case "ymdhm":{
      value = ogas.string.format( "{0}/{1}/{2} {3}:{4}",
        local_time.year(),
        ogas.string.padding_zero( 2, local_time.month() ),
        ogas.string.padding_zero( 2, local_time.date() ),
        ogas.string.padding_zero( 2, local_time.hour() ),
        ogas.string.padding_zero( 2, local_time.min() ) );
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
  
  time.dates = function( year, month, string_days ){
    if ( typeof string_days === "undefined" ) string_days = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
    
    var dates = [];
    var first_date_time = time.first_date_time( year, month );
    var last_date_time = time.last_date_time( year, month );
    var last_date = last_date_time.date();
    var day = first_date_time.day();
    for ( var date = 1; date <= last_date; ++date, day = time.add_day( day ) ){
      dates.push({ date : date, day : { index : day, string : string_days[ day ] } });
    }
    return dates;
  };
  
  time.add_day = function( base, add ){
    if ( typeof add === "undefined" ) add = 1;
    
    return ( base + add ) % 7;
  };
})(ogas.time = ogas.time || {});

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

(function( stack ){
  stack.get = function( offset ){
    if ( typeof offset === "undefined" ) offset = 0;
    
    var stacks = [];
    try{
      throw new Error();
    }catch ( err ){
      stacks = err.stack.split( "\n" );
      stacks.shift();
      stacks = stacks.slice( offset );
    }
    return stacks.join( "\n" );
  };
})(ogas.stack = ogas.stack || {});
