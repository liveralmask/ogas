var ogas = this;
opjs.object.inherits( ogas, opjs );

/* Google Apps Scripts */

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
  
  sheet.col_to_row_values = function( values ){
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
  
  sheet.row_to_col_values = function( values ){
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
  
  sheet.values_to_records = function( values ){
    var records = [];
    var keys = values[ 0 ];
    var keys_len = keys.length;
    var values_len = values.length;
    for ( var row = 1; row < values_len; ++row ){
      var value = values[ row ];
      var record = {};
      for ( var col = 0; col < keys_len; ++col ){
        record[ keys[ col ] ] = value[ col ];
      }
      records.push( record );
    }
    return records;
  };
})(ogas.sheet = ogas.sheet || {});

ogas.GASLog = function(){
  this.m_sheet = null;
};
ogas.object.inherits( ogas.GASLog, ogas.Log );
ogas.GASLog.prototype.sheet = function(){
  if ( 1 == arguments.length ) this.m_sheet = arguments[ 0 ];
  return this.m_sheet;
};
ogas.GASLog.prototype.write = function( type, msg ){
  var options = {};
  switch ( type ){
  case "dbg": options = { fc : "blue" }; break;
  case "inf": options = { fc : "black" }; break;
  case "wrn": options = { fc : "olive" }; break;
  case "err": options = { fc : "red" }; break;
  }
  
  if ( null == this.m_sheet ){
    Logger.log( msg ); // Logger.log() is GET method only
    return;
  }
  
  var rows = ogas.sheet.rows( this.m_sheet, this.m_sheet.getLastRow() );
  var values = rows.getValues()[ 0 ];
  var row = rows.getRow();
  var col = values.indexOf( "" ) + 1;
  if ( 0 == col ){
    col = values.length + 1;
    var max_col = this.m_sheet.getMaxColumns();
    if ( max_col < col ){
      col = 1;
      row += 1;
    }
  }
  
  var cell = ogas.sheet.range( this.m_sheet, row, col );
  cell.setValue( msg );
  cell.setFontColor( options.fc );
  cell.setHorizontalAlignment( "left" );
  cell.setVerticalAlignment( "top" );
  cell.setWrap( false );
};
ogas.log.log( new ogas.GASLog() );
ogas.log.sheet = function(){
  if ( 1 == arguments.length ) ogas.log.log().sheet( arguments[ 0 ] );
  return ogas.log.log().sheet();
};

(function( cache ){
  var s_properties = null;
  cache.properties = function(){
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

(function( http ){
  http.content_type = function( type, charset ){
    if ( typeof charset === "undefined" ) charset = "utf-8";
    
    return ogas.string.format( "{0}; charset={1}", type, charset );
  };
  
  http.request = function( url, params ){
    if ( typeof params === "undefined" ) params = { method : "get" };
    
    return UrlFetchApp.fetch( url, params );
  };
  
  http.response = function( type, value ){
    switch ( type ){
    case "json": type = ContentService.MimeType.JSON; break;
    case "text": type = ContentService.MimeType.TEXT; break;
    }
    return ContentService.createTextOutput( value ).setMimeType( type );
  };
})(ogas.http = ogas.http || {});

(function( slack ){
  slack.post = function( url, params ){
    return ogas.http.request( url, {
      method      : "post",
      contentType : ogas.http.content_type( "application/json" ),
      payload     : ogas.json.encode( params )
    } );
  };
})(ogas.slack = ogas.slack || {});

ogas.application.sheet = function( instance, spreadsheet, sheet_name, var_name, method_name ){
  if ( typeof var_name === "undefined" )    var_name = ogas.string.format( "{0}_sheet", sheet_name );
  if ( typeof method_name === "undefined" ) method_name = ogas.string.format( "on_sheet_{0}", sheet_name );
  
  var sheet = ogas.sheet.open( spreadsheet, sheet_name );
  ogas.vars.set( ogas.string.format( var_name, sheet_name ), sheet );
  ogas.method.call( instance, method_name, sheet );
};

ogas.application.add_patterns = function( type, sheet ){
  var records = ogas.sheet.values_to_records( ogas.sheet.range( sheet ).getValues() );
  var records_len = records.length;
  for ( var i = 0; i < records_len; ++i ){
    var rule = records[ i ];
    var pattern = rule.pattern;
    var flags   = rule.flags;
    delete rule.pattern;
    delete rule.flags;
    ogas.pattern.add( type, rule, pattern, flags );
  }
};

ogas.application.input_spreadsheet_id = function(){
  var spreadsheet_id = Browser.inputBox( "Input spreadsheet id." );
  switch ( spreadsheet_id ){
  case "":
  case "cancel":{}break;
  
  default:{
    ogas.cache.set( "spreadsheet_id", spreadsheet_id );
  }break;
  }
};
