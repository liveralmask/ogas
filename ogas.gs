var ogas = this;

(function( log ){
  var s_sheet = null;
  log.sheet = function(){
    if ( 1 == arguments.length ) s_sheet = arguments[ 0 ];
    return s_sheet;
  };
  
  log.timestamp = function( local_time ){
    if ( typeof local_time === "undefined" ) local_time = ogas.time.local_time();
    
    return ogas.string.format( "[{0}]", ogas.time.format( "all", local_time ) );
  };
  
  log.write = function( value, options ){
    if ( typeof options === "undefined" ) options = {};
    
    if ( null == s_sheet ){
      Logger.log( value ); // Logger.log() is GET method only
      return;
    }
    
    var rows = ogas.sheet.range_rows( s_sheet, s_sheet.getLastRow() );
    var values = rows.getValues()[ 0 ];
    var row = rows.getRow();
    var col = values.indexOf( "" ) + 1;
    if ( 0 == col ){
      col = values.length + 1;
      var max_col = s_sheet.getMaxColumns();
      if ( max_col < col ){
        col = 1;
        row += 1;
      }
    }
    
    var cell = ogas.sheet.range( s_sheet, row, col );
    cell.setValue( value );
    if ( "fc" in options ) cell.setFontColor( options.fc );
    if ( "bc" in options ) cell.setBackgroundColor( options.bc );
    if ( "ha" in options ) cell.setHorizontalAlignment( options.ha );
    if ( "va" in options ) cell.setVerticalAlignment( options.va );
    if ( "wp" in options ) cell.setWrap( options.wp );
  }
  
  log.dbg = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.write( value, { fc : "blue", ha : "left", va : "top", wp : false } );
  };
  
  log.inf = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.write( value, { fc : "black", ha : "left", va : "top", wp : false } );
  };
  
  log.wrn = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.write( value, { fc : "olive", ha : "left", va : "top", wp : false } );
  };
  
  log.err = function(){
    var value = ogas.string.format.apply( null, Array.prototype.slice.call( arguments ) );
    log.write( value, { fc : "red", ha : "left", va : "top", wp : false } );
  };
})(ogas.log = ogas.log || {});

(function( cache ){
  var s_properties = PropertiesService.getScriptProperties();
  cache.properties = function( value ){
    if ( 1 == arguments.length ) s_properties = arguments[ 0 ];
    return s_properties;
  };
  
  cache.set = function( key, value ){
    s_properties.setProperty( key, value );
  };
  
  cache.get = function( key ){
    return s_properties.getProperty( key );
  };
})(ogas.cache = ogas.cache || {});

(function( vars ){
  var s_vars = {};
  
  vars.set = function( key, value ){
    s_vars[ key ] = value;
  };
  
  vars.get = function( key ){
    return s_vars[ key ];
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
  sheet.get = function( spreadsheet, name ){
    return spreadsheet.getSheetByName( name );
  };
  
  sheet.open = function( spreadsheet, name, insert_index ){
    if ( typeof insert_index === "undefined" ) insert_index = spreadsheet.getNumSheets();
    
    var _sheet = sheet.get( spreadsheet, name );
    if ( null == _sheet ) _sheet = spreadsheet.insertSheet( name, insert_index );
    return _sheet;
  };
  
  sheet.range = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
//    Logger.log( ogas.string.format( "sheet.range args={0}\n{1}", ogas.json.encode( args ), ogas.stack.get() ) );
    return ( 0 < args.length ) ? _sheet.getRange.apply( _sheet, args ) : _sheet.getDataRange();
  };
  
  sheet.range_rows = function(){
    var args = Array.prototype.slice.call( arguments );
    var _sheet = args.shift();
    var row = args.pop();
    if ( 0 == row ) row = 1;
    var last_col = _sheet.getLastColumn();
    if ( 0 == last_col ) last_col = 1;
    return sheet.range.apply( sheet, [ _sheet, row, 1, 1, last_col ] );
  };
  
  sheet.range_cols = function(){
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
  var s_patterns = {};
  
  pattern.add = function( type, name, pattern, flags ){
    var add_value = new ogas.Pattern( name, pattern, flags );
    if ( type in s_patterns ){
      s_patterns[ type ].push( add_value );
    }else{
      s_patterns[ type ] = [ add_value ];
    }
  };
  
  pattern.match = function( type, value ){
    if ( undefined === s_patterns[ type ] ) return null;
    
    var patterns_len = s_patterns[ type ].length;
    for ( var i = 0; i < patterns_len; ++i ){
      var result = s_patterns[ type ][ i ].match( value );
      if ( null != result ) return result;
    }
    return null;
  };
  
  pattern.matches = function( type, value ){
    if ( undefined === s_patterns[ type ] ) return [];
    
  　var matches = [];
    var patterns_len = s_patterns[ type ].length;
    for ( var i = 0; i < patterns_len; ++i ){
      var result = s_patterns[ type ][ i ].match( value );
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
  time.LocalTime.prototype.toJSON = function(){
    return this.toString();
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
  
  time.string_days = function(){
    return [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
  };
  
  time.dates = function( year, month, string_days ){
    if ( typeof string_days === "undefined" ) string_days = time.string_days();
    
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

(function ( class ){
  class.inherits = function( self, parent ){
    self.prototype = new parent();
  };
})(ogas.class = ogas.class || {});

ogas.Application = function(){
  this.m_is_update = false;
  this.m_request = {};
};
ogas.Application.prototype.is_update = function(){
  if ( 1 == arguments.length ) this.m_is_update = arguments[ 0 ];
  return this.m_is_update;
};
ogas.Application.prototype.request = function(){
  if ( 1 == arguments.length ) this.m_request = arguments[ 0 ];
  return this.m_request;
};
ogas.Application.prototype.start = function(){};
ogas.Application.prototype.update = function(){};
ogas.Application.prototype.end = function(){};

(function( application ){
  application.run = function( application_type, request ){
    if ( typeof request === "undefined" ) request = {};
    
    try{
      var _application = new application_type();
      _application.request( request );
      _application.start();
      if ( _application.is_update() ) _application.update();
      _application.end();
    }catch ( err ){
      ogas.log.err( ogas.string.format( "{0}\n{1}\n{2}", err, err.stack, ogas.json.encode( this.m_request ) ) );
    }
  };
  
  application.add_patterns = function( type, sheet ){
    var tables = ogas.sheet.values_to_tables( ogas.sheet.range( sheet ).getValues() );
    var tables_len = tables.length;
    for ( var i = 0; i < tables_len; ++i ){
      var rule = tables[ i ];
      var pattern = rule.pattern;
      var flags   = rule.flags;
      delete rule.pattern;
      delete rule.flags;
      ogas.pattern.add( type, rule, pattern, flags );
    }
  };
  
  application.rules_to_array = function( rules, title ){
    var array = ( typeof title === "undefined" ) ? [] : [ title ];
    var rules_len = rules.length;
    for ( var i = 0; i < rules_len; ++i ){
      var rule = rules[ i ];
      array.push( ogas.string.format( "{0}\t/{1}/{2}", rule.name, rule.pattern, rule.flags ) );
    }
    return array;
  };
})(ogas.application = ogas.application || {});

function spec(){
  // TODO
}
