import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
} from "../gleam.mjs";

function go(loop$chars, loop$sep, loop$field, loop$row, loop$rows, loop$quoted) {
  while (true) {
    let chars = loop$chars;
    let sep = loop$sep;
    let field = loop$field;
    let row = loop$row;
    let rows = loop$rows;
    let quoted = loop$quoted;
    if (chars instanceof $Empty) {
      return $list.reverse(
        listPrepend($list.reverse(listPrepend(field, row)), rows),
      );
    } else if (quoted) {
      let $ = chars.tail;
      if ($ instanceof $Empty) {
        let $1 = chars.head;
        if ($1 === "\"") {
          let rest = $;
          loop$chars = rest;
          loop$sep = sep;
          loop$field = field;
          loop$row = row;
          loop$rows = rows;
          loop$quoted = false;
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$sep = sep;
          loop$field = field + c;
          loop$row = row;
          loop$rows = rows;
          loop$quoted = true;
        }
      } else {
        let $1 = chars.head;
        if ($1 === "\"") {
          if ($.head === "\"") {
            let rest = $.tail;
            loop$chars = rest;
            loop$sep = sep;
            loop$field = field + "\"";
            loop$row = row;
            loop$rows = rows;
            loop$quoted = true;
          } else {
            let rest = $;
            loop$chars = rest;
            loop$sep = sep;
            loop$field = field;
            loop$row = row;
            loop$rows = rows;
            loop$quoted = false;
          }
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$sep = sep;
          loop$field = field + c;
          loop$row = row;
          loop$rows = rows;
          loop$quoted = true;
        }
      }
    } else {
      let $ = chars.head;
      if ($ === "\"" && field === "") {
        let rest = chars.tail;
        loop$chars = rest;
        loop$sep = sep;
        loop$field = field;
        loop$row = row;
        loop$rows = rows;
        loop$quoted = true;
      } else if ($ === "\r\n") {
        let rest = chars.tail;
        loop$chars = rest;
        loop$sep = sep;
        loop$field = "";
        loop$row = $List$Empty$const;
        loop$rows = listPrepend($list.reverse(listPrepend(field, row)), rows);
        loop$quoted = false;
      } else if ($ === "\n") {
        let rest = chars.tail;
        loop$chars = rest;
        loop$sep = sep;
        loop$field = "";
        loop$row = $List$Empty$const;
        loop$rows = listPrepend($list.reverse(listPrepend(field, row)), rows);
        loop$quoted = false;
      } else if ($ === "\r") {
        let rest = chars.tail;
        loop$chars = rest;
        loop$sep = sep;
        loop$field = field;
        loop$row = row;
        loop$rows = rows;
        loop$quoted = false;
      } else {
        let c = $;
        if (c === sep) {
          let rest = chars.tail;
          loop$chars = rest;
          loop$sep = sep;
          loop$field = "";
          loop$row = listPrepend(field, row);
          loop$rows = rows;
          loop$quoted = false;
        } else {
          let c$1 = $;
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$sep = sep;
          loop$field = field + c$1;
          loop$row = row;
          loop$rows = rows;
          loop$quoted = false;
        }
      }
    }
  }
}

export function parse(text, separator) {
  let rows = go(
    $string.to_graphemes(text),
    separator,
    "",
    $List$Empty$const,
    $List$Empty$const,
    false,
  );
  let $ = $list.reverse(rows);
  if ($ instanceof $Empty) {
    return rows;
  } else {
    let $1 = $.head;
    if ($1 instanceof $Empty) {
      return rows;
    } else if ($1.tail instanceof $Empty && $1.head === "") {
      let rest = $.tail;
      return $list.reverse(rest);
    } else {
      return rows;
    }
  }
}

export function field(text) {
  let $ = ($string.contains(text, ",") || $string.contains(text, "\"")) || $string.contains(
    text,
    "\n",
  );
  if ($) {
    return ("\"" + $string.replace(text, "\"", "\"\"")) + "\"";
  } else {
    return text;
  }
}

export function write(rows) {
  let _pipe = rows;
  let _pipe$1 = $list.map(
    _pipe,
    (row) => { return $string.join($list.map(row, field), ","); },
  );
  let _pipe$2 = $string.join(_pipe$1, "\n");
  return $string.append(_pipe$2, "\n");
}
