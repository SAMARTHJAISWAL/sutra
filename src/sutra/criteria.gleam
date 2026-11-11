//// The criteria language of SUMIF, COUNTIFS and friends: ">=10", "<>",
//// "North", "A*", "?b?", "~*" and plain values.

import gleam/list
import gleam/order.{type Order}
import gleam/string
import sutra/value.{type Value, Boolean, Empty, Number, Text}

pub type Op {
  Equal
  NotEqual
  Less
  LessEq
  Greater
  GreaterEq
}

pub type Criterion {
  Criterion(op: Op, operand: Value)
}

pub fn parse(crit: Value) -> Criterion {
  case crit {
    Text(s) -> {
      let #(op, rest) = case s {
        ">=" <> rest -> #(GreaterEq, rest)
        "<=" <> rest -> #(LessEq, rest)
        "<>" <> rest -> #(NotEqual, rest)
        ">" <> rest -> #(Greater, rest)
        "<" <> rest -> #(Less, rest)
        "=" <> rest -> #(Equal, rest)
        _ -> #(Equal, s)
      }
      let operand = case rest {
        "" -> Empty
        _ ->
          case value.parse_number(rest) {
            Ok(x) -> Number(x)
            Error(_) ->
              case string.uppercase(rest) {
                "TRUE" -> Boolean(True)
                "FALSE" -> Boolean(False)
                _ -> Text(rest)
              }
          }
      }
      Criterion(op, operand)
    }
    Empty -> Criterion(Equal, Empty)
    _ -> Criterion(Equal, crit)
  }
}

pub fn matches(c: Criterion, cell: Value) -> Bool {
  case c.operand {
    // "=" or "" matches blank cells; "<>" matches anything not blank
    Empty ->
      case c.op {
        Equal -> is_blank(cell)
        NotEqual -> !is_blank(cell)
        _ -> False
      }
    Text(pattern) ->
      case c.op {
        Equal -> text_match(pattern, cell)
        NotEqual -> !text_match(pattern, cell)
        _ ->
          case cell {
            Text(s) ->
              test_order(
                c.op,
                string.compare(string.lowercase(s), string.lowercase(pattern)),
              )
            _ -> False
          }
      }
    Number(x) ->
      case cell {
        Number(y) -> test_order(c.op, value.compare_numbers(y, x))
        // a number written as text matches an equality test
        Text(s) ->
          case c.op, value.parse_number(s) {
            Equal, Ok(y) -> value.compare_numbers(y, x) == order.Eq
            NotEqual, Ok(y) -> value.compare_numbers(y, x) != order.Eq
            NotEqual, _ -> True
            _, _ -> False
          }
        _ -> c.op == NotEqual
      }
    Boolean(b) ->
      case cell {
        Boolean(v) -> test_order(c.op, value.compare(Boolean(v), Boolean(b)))
        _ -> c.op == NotEqual
      }
    value.Err(k) ->
      case c.op {
        Equal -> cell == value.Err(k)
        NotEqual -> cell != value.Err(k)
        _ -> False
      }
  }
}

fn is_blank(v: Value) -> Bool {
  v == Empty || v == Text("")
}

fn test_order(op: Op, o: Order) -> Bool {
  case op, o {
    Equal, order.Eq -> True
    NotEqual, order.Lt | NotEqual, order.Gt -> True
    Less, order.Lt -> True
    LessEq, order.Lt | LessEq, order.Eq -> True
    Greater, order.Gt -> True
    GreaterEq, order.Gt | GreaterEq, order.Eq -> True
    _, _ -> False
  }
}

fn text_match(pattern: String, cell: Value) -> Bool {
  case cell {
    Text(s) -> wildcard(pattern, s)
    Empty -> pattern == ""
    _ -> False
  }
}

/// Excel wildcards, case-insensitive: * is any run, ? is one character and
/// ~ escapes the next character.
pub fn wildcard(pattern: String, text: String) -> Bool {
  go(
    string.to_graphemes(string.lowercase(pattern)),
    string.to_graphemes(string.lowercase(text)),
  )
}

fn go(p: List(String), t: List(String)) -> Bool {
  case p, t {
    [], [] -> True
    [], _ -> False
    ["*", ..rest], _ ->
      // collapse runs of stars, then try every split point
      case rest {
        ["*", ..] -> go(rest, t)
        _ -> try_suffixes(rest, t)
      }
    ["~", c, ..rest], [x, ..ts] -> c == x && go(rest, ts)
    ["?", ..rest], [_, ..ts] -> go(rest, ts)
    [c, ..rest], [x, ..ts] -> c == x && go(rest, ts)
    _, [] -> False
  }
}

fn try_suffixes(p: List(String), t: List(String)) -> Bool {
  case go(p, t) {
    True -> True
    False ->
      case t {
        [] -> False
        [_, ..rest] -> try_suffixes(p, rest)
      }
  }
}

pub fn has_wildcards(pattern: String) -> Bool {
  list.any(string.to_graphemes(pattern), fn(c) {
    c == "*" || c == "?" || c == "~"
  })
}
