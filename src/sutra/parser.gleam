//// Lexer and Pratt parser for Excel formulas.
////
//// Operator precedence follows Excel, which differs from most languages:
//// unary minus binds tighter than `^` (so =-2^2 is 4) and `^` is
//// left-associative (=2^3^2 is 64).

import gleam/float
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import sutra/ast.{type BinOp, type Expr}
import sutra/value

pub type ParseError {
  ParseError(message: String, position: Int)
}

type Tok {
  TNum(Float)
  TStr(String)
  TBool(Bool)
  TErr(value.ErrorKind)
  TCell(col: Int, row: Int)
  TCols(Int, Int)
  TRows(Int, Int)
  TSheet(String)
  TIdent(String)
  TOp(String)
  TLParen
  TRParen
  TComma
  TSemi
  TLBrace
  TRBrace
  TColon
  TEnd
}

type Token =
  #(Tok, Int)

/// Parse a formula. A leading "=" is optional.
pub fn parse(text: String) -> Result(Expr, ParseError) {
  let body = case text {
    "=" <> rest -> rest
    _ -> text
  }
  let offset = string.length(text) - string.length(body)
  use tokens <- result.try(lex(string.to_graphemes(body), offset, []))
  use #(expr, rest) <- result.try(expression(tokens, 0))
  case rest {
    [#(TEnd, _), ..] -> Ok(expr)
    [#(tok, pos), ..] -> Error(ParseError("unexpected " <> describe(tok), pos))
    [] -> Ok(expr)
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

const error_literals = [
  "#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "#SPILL!",
  "#CYCLE!", "#CALC!", "#ERROR!",
]

fn lex(
  chars: List(String),
  pos: Int,
  acc: List(Token),
) -> Result(List(Token), ParseError) {
  case chars {
    [] -> Ok(list.reverse([#(TEnd, pos), ..acc]))
    [c, ..rest] if c == " " || c == "\t" || c == "\n" || c == "\r" ->
      lex(rest, pos + 1, acc)
    ["\"", ..rest] -> {
      use #(text, rest, used) <- result.try(string_body(rest, pos, []))
      lex(rest, pos + used, [#(TStr(text), pos), ..acc])
    }
    ["'", ..rest] -> {
      use #(name, rest, used) <- result.try(quoted_sheet(rest, pos, []))
      case rest {
        ["!", ..rest] ->
          lex(rest, pos + used + 1, [#(TSheet(name), pos), ..acc])
        _ ->
          Error(ParseError("expected ! after a quoted sheet name", pos + used))
      }
    }
    ["#", ..] -> {
      let upper = string.uppercase(string.concat(list.take(chars, 7)))
      case list.find(error_literals, fn(e) { string.starts_with(upper, e) }) {
        Ok(lit) -> {
          let n = string.length(lit)
          let assert Ok(kind) = value.error_from_string(lit)
          lex(list.drop(chars, n), pos + n, [#(TErr(kind), pos), ..acc])
        }
        Error(_) -> Error(ParseError("unknown error value", pos))
      }
    }
    ["<", ">", ..rest] -> lex(rest, pos + 2, [#(TOp("<>"), pos), ..acc])
    ["<", "=", ..rest] -> lex(rest, pos + 2, [#(TOp("<="), pos), ..acc])
    [">", "=", ..rest] -> lex(rest, pos + 2, [#(TOp(">="), pos), ..acc])
    ["(", ..rest] -> lex(rest, pos + 1, [#(TLParen, pos), ..acc])
    [")", ..rest] -> lex(rest, pos + 1, [#(TRParen, pos), ..acc])
    [",", ..rest] -> lex(rest, pos + 1, [#(TComma, pos), ..acc])
    [";", ..rest] -> lex(rest, pos + 1, [#(TSemi, pos), ..acc])
    ["{", ..rest] -> lex(rest, pos + 1, [#(TLBrace, pos), ..acc])
    ["}", ..rest] -> lex(rest, pos + 1, [#(TRBrace, pos), ..acc])
    [":", ..rest] -> lex(rest, pos + 1, [#(TColon, pos), ..acc])
    [c, ..rest]
      if c == "+"
      || c == "-"
      || c == "*"
      || c == "/"
      || c == "^"
      || c == "&"
      || c == "%"
      || c == "="
      || c == "<"
      || c == ">"
    -> lex(rest, pos + 1, [#(TOp(c), pos), ..acc])
    [c, ..] ->
      case value.is_digit(c) || c == "." {
        True -> number(chars, pos, acc)
        False ->
          case is_word_char(c) {
            True -> word(chars, pos, acc)
            False -> Error(ParseError("unexpected character " <> c, pos))
          }
      }
  }
}

fn string_body(
  chars: List(String),
  start: Int,
  acc: List(String),
) -> Result(#(String, List(String), Int), ParseError) {
  case chars {
    ["\"", "\"", ..rest] -> string_body(rest, start, ["\"", ..acc])
    ["\"", ..rest] -> {
      let text = string.concat(list.reverse(acc))
      // opening quote + body (with doubled quotes) + closing quote
      Ok(#(text, rest, 2 + string.length(text) + count(acc, "\"")))
    }
    [c, ..rest] -> string_body(rest, start, [c, ..acc])
    [] -> Error(ParseError("unterminated string", start))
  }
}

fn quoted_sheet(
  chars: List(String),
  start: Int,
  acc: List(String),
) -> Result(#(String, List(String), Int), ParseError) {
  case chars {
    ["'", "'", ..rest] -> quoted_sheet(rest, start, ["'", ..acc])
    ["'", ..rest] -> {
      let text = string.concat(list.reverse(acc))
      Ok(#(text, rest, 2 + string.length(text) + count(acc, "'")))
    }
    [c, ..rest] -> quoted_sheet(rest, start, [c, ..acc])
    [] -> Error(ParseError("unterminated sheet name", start))
  }
}

fn count(items: List(String), item: String) -> Int {
  list.count(items, fn(x) { x == item })
}

fn is_word_char(c: String) -> Bool {
  c == "_"
  || c == "$"
  || c == "\\"
  || value.is_digit(c)
  || string.lowercase(c) != string.uppercase(c)
}

fn number(
  chars: List(String),
  pos: Int,
  acc: List(Token),
) -> Result(List(Token), ParseError) {
  let #(whole, rest) = list.split_while(chars, value.is_digit)
  // 1:3 is a range of whole rows
  case whole, rest {
    [_, ..], [":", ..after] -> {
      let #(after_dollar, skip) = case after {
        ["$", ..a] -> #(a, 1)
        _ -> #(after, 0)
      }
      let #(second, rest2) = list.split_while(after_dollar, value.is_digit)
      case second, rows_of(whole, second) {
        [_, ..], Ok(#(r1, r2)) -> {
          let used = list.length(whole) + 1 + skip + list.length(second)
          lex(rest2, pos + used, [#(TRows(r1, r2), pos), ..acc])
        }
        _, _ -> plain_number(chars, pos, acc)
      }
    }
    _, _ -> plain_number(chars, pos, acc)
  }
}

fn rows_of(a: List(String), b: List(String)) -> Result(#(Int, Int), Nil) {
  use r1 <- result.try(int.parse(string.concat(a)))
  use r2 <- result.try(int.parse(string.concat(b)))
  case r1 >= 1 && r2 >= 1 && r1 <= ast.max_rows && r2 <= ast.max_rows {
    True -> Ok(#(int.min(r1, r2) - 1, int.max(r1, r2) - 1))
    False -> Error(Nil)
  }
}

fn plain_number(
  chars: List(String),
  pos: Int,
  acc: List(Token),
) -> Result(List(Token), ParseError) {
  let #(mantissa, rest) =
    list.split_while(chars, fn(c) { value.is_digit(c) || c == "." })
  let #(exponent, rest) = case rest {
    [e, sign, d, ..more]
      if { e == "e" || e == "E" } && { sign == "+" || sign == "-" }
    ->
      case value.is_digit(d) {
        True -> {
          let #(ds, rest) = list.split_while([d, ..more], value.is_digit)
          #([e, sign, ..ds], rest)
        }
        False -> #([], rest)
      }
    [e, d, ..more] if e == "e" || e == "E" ->
      case value.is_digit(d) {
        True -> {
          let #(ds, rest) = list.split_while([d, ..more], value.is_digit)
          #([e, ..ds], rest)
        }
        False -> #([], rest)
      }
    _ -> #([], rest)
  }
  let text = string.concat(list.append(mantissa, exponent))
  case value.parse_number(text) {
    Ok(x) -> lex(rest, pos + string.length(text), [#(TNum(x), pos), ..acc])
    Error(_) -> Error(ParseError("bad number " <> text, pos))
  }
}

fn word(
  chars: List(String),
  pos: Int,
  acc: List(Token),
) -> Result(List(Token), ParseError) {
  let #(letters, rest) =
    list.split_while(chars, fn(c) { is_word_char(c) || c == "." })
  let text = string.concat(letters)
  let used = list.length(letters)
  let next = pos + used
  let upper = string.uppercase(text)
  case rest {
    ["!", ..rest] -> lex(rest, next + 1, [#(TSheet(text), pos), ..acc])
    ["(", ..] -> {
      let name = case upper {
        "_XLFN." <> n -> n
        _ -> upper
      }
      lex(rest, next, [#(TIdent(name), pos), ..acc])
    }
    _ ->
      case cell_ref(text) {
        Ok(#(col, row)) -> lex(rest, next, [#(TCell(col, row), pos), ..acc])
        Error(_) ->
          case column_word(text), rest {
            Ok(c1), [":", ..after] -> {
              let #(second, rest2) =
                list.split_while(after, fn(c) { is_word_char(c) })
              case column_word(string.concat(second)) {
                Ok(c2) -> {
                  let used2 = used + 1 + list.length(second)
                  lex(rest2, pos + used2, [
                    #(TCols(int.min(c1, c2), int.max(c1, c2)), pos),
                    ..acc
                  ])
                }
                Error(_) -> ident(upper, rest, next, pos, acc)
              }
            }
            _, _ -> ident(upper, rest, next, pos, acc)
          }
      }
  }
}

fn ident(
  upper: String,
  rest: List(String),
  next: Int,
  pos: Int,
  acc: List(Token),
) -> Result(List(Token), ParseError) {
  let tok = case upper {
    "TRUE" -> TBool(True)
    "FALSE" -> TBool(False)
    _ -> TIdent(upper)
  }
  lex(rest, next, [#(tok, pos), ..acc])
}

/// A1, $A$1, a1 — but not A$ or 1A.
fn cell_ref(text: String) -> Result(#(Int, Int), Nil) {
  let chars = string.to_graphemes(text)
  let #(col_part, rest) = case chars {
    ["$", ..rest] -> #(["$"], rest)
    _ -> #([], chars)
  }
  let #(letters, rest) =
    list.split_while(rest, fn(c) { !value.is_digit(c) && c != "$" })
  let #(dollar, digits) = case rest {
    ["$", ..d] -> #(["$"], d)
    _ -> #([], rest)
  }
  let _ = col_part
  let _ = dollar
  case letters, digits, list.all(digits, value.is_digit) {
    [_, ..], [_, ..], True ->
      ast.parse_cell(string.concat(letters) <> string.concat(digits))
    _, _, _ -> Error(Nil)
  }
}

fn column_word(text: String) -> Result(Int, Nil) {
  ast.parse_column(string.replace(text, "$", ""))
  |> result.try(fn(col) {
    case string.ends_with(text, "$") {
      True -> Error(Nil)
      False -> Ok(col)
    }
  })
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

fn binary_op(op: String) -> Result(#(BinOp, Int), Nil) {
  case op {
    "=" -> Ok(#(ast.Eq, 1))
    "<>" -> Ok(#(ast.Ne, 1))
    "<" -> Ok(#(ast.Lt, 1))
    "<=" -> Ok(#(ast.Le, 1))
    ">" -> Ok(#(ast.Gt, 1))
    ">=" -> Ok(#(ast.Ge, 1))
    "&" -> Ok(#(ast.Concat, 2))
    "+" -> Ok(#(ast.Add, 3))
    "-" -> Ok(#(ast.Sub, 3))
    "*" -> Ok(#(ast.Mul, 4))
    "/" -> Ok(#(ast.Div, 4))
    "^" -> Ok(#(ast.Pow, 5))
    _ -> Error(Nil)
  }
}

fn expression(
  tokens: List(Token),
  min: Int,
) -> Result(#(Expr, List(Token)), ParseError) {
  use #(left, rest) <- result.try(unary(tokens))
  climb(left, rest, min)
}

fn climb(
  left: Expr,
  tokens: List(Token),
  min: Int,
) -> Result(#(Expr, List(Token)), ParseError) {
  case tokens {
    [#(TOp(op), _), ..rest] ->
      case binary_op(op) {
        Ok(#(bin, prec)) if prec >= min -> {
          use #(right, rest) <- result.try(expression(rest, prec + 1))
          climb(ast.Binary(bin, left, right), rest, min)
        }
        _ -> Ok(#(left, tokens))
      }
    _ -> Ok(#(left, tokens))
  }
}

fn unary(tokens: List(Token)) -> Result(#(Expr, List(Token)), ParseError) {
  case tokens {
    [#(TOp("-"), _), ..rest] -> {
      use #(e, rest) <- result.try(unary(rest))
      Ok(#(ast.Neg(e), rest))
    }
    [#(TOp("+"), _), ..rest] -> unary(rest)
    _ -> {
      use #(e, rest) <- result.try(primary(tokens))
      Ok(percents(e, rest))
    }
  }
}

fn percents(e: Expr, tokens: List(Token)) -> #(Expr, List(Token)) {
  case tokens {
    [#(TOp("%"), _), ..rest] -> percents(ast.Percent(e), rest)
    _ -> #(e, tokens)
  }
}

fn primary(tokens: List(Token)) -> Result(#(Expr, List(Token)), ParseError) {
  case tokens {
    [#(TNum(x), _), ..rest] -> Ok(#(ast.Num(x), rest))
    [#(TStr(s), _), ..rest] -> Ok(#(ast.Str(s), rest))
    [#(TBool(b), _), ..rest] -> Ok(#(ast.Bool(b), rest))
    [#(TErr(k), _), ..rest] -> Ok(#(ast.ErrorLit(k), rest))
    [#(TSheet(name), pos), ..rest] ->
      case rest {
        [#(TCell(..), _), ..] | [#(TCols(..), _), ..] | [#(TRows(..), _), ..] ->
          reference(Some(name), rest)
        _ ->
          Error(ParseError(
            "expected a cell or range after " <> name <> "!",
            pos,
          ))
      }
    [#(TCell(..), _), ..] | [#(TCols(..), _), ..] | [#(TRows(..), _), ..] ->
      reference(None, tokens)
    [#(TIdent(name), _), #(TLParen, _), ..rest] -> {
      use #(args, rest) <- result.try(arguments(rest, []))
      Ok(#(ast.Call(name, args), rest))
    }
    [#(TIdent(name), _), ..rest] -> Ok(#(ast.Name(name), rest))
    [#(TLParen, pos), ..rest] -> {
      use #(e, rest) <- result.try(expression(rest, 0))
      case rest {
        [#(TRParen, _), ..rest] -> Ok(#(e, rest))
        _ -> Error(ParseError("missing )", pos))
      }
    }
    [#(TLBrace, pos), ..rest] -> array(rest, pos, [], [])
    [#(TEnd, pos), ..] -> Error(ParseError("formula ends too early", pos))
    [#(tok, pos), ..] -> Error(ParseError("unexpected " <> describe(tok), pos))
    [] -> Error(ParseError("formula ends too early", 0))
  }
}

fn reference(
  sheet: Option(String),
  tokens: List(Token),
) -> Result(#(Expr, List(Token)), ParseError) {
  case tokens {
    [#(TCell(c1, r1), _), #(TColon, _), #(TCell(c2, r2), _), ..rest] ->
      Ok(#(ast.Area(sheet, ast.range_of(c1, r1, c2, r2)), rest))
    [#(TCell(_, _), _), #(TColon, pos), ..] ->
      Error(ParseError("a range needs a cell on both sides of :", pos))
    [#(TCell(c, r), _), ..rest] -> Ok(#(ast.Ref(sheet, c, r), rest))
    [#(TCols(c1, c2), _), ..rest] ->
      Ok(#(ast.Area(sheet, ast.Range(0, c1, ast.max_rows - 1, c2)), rest))
    [#(TRows(r1, r2), _), ..rest] ->
      Ok(#(ast.Area(sheet, ast.Range(r1, 0, r2, ast.max_cols - 1)), rest))
    _ -> Error(ParseError("expected a reference", 0))
  }
}

fn arguments(
  tokens: List(Token),
  acc: List(Expr),
) -> Result(#(List(Expr), List(Token)), ParseError) {
  case tokens, acc {
    // F()
    [#(TRParen, _), ..rest], [] -> Ok(#([], rest))
    _, _ -> {
      use #(arg, rest) <- result.try(case tokens {
        [#(TComma, _), ..] | [#(TRParen, _), ..] -> Ok(#(ast.Missing, tokens))
        _ -> expression(tokens, 0)
      })
      case rest {
        [#(TComma, _), ..rest] -> arguments(rest, [arg, ..acc])
        [#(TRParen, _), ..rest] -> Ok(#(list.reverse([arg, ..acc]), rest))
        [#(TEnd, pos), ..] ->
          Error(ParseError("missing ) after arguments", pos))
        [#(tok, pos), ..] ->
          Error(ParseError(
            "unexpected " <> describe(tok) <> " in arguments",
            pos,
          ))
        [] -> Error(ParseError("missing )", 0))
      }
    }
  }
}

fn array(
  tokens: List(Token),
  start: Int,
  row: List(Expr),
  rows: List(List(Expr)),
) -> Result(#(Expr, List(Token)), ParseError) {
  use #(item, rest) <- result.try(array_item(tokens))
  let row = [item, ..row]
  case rest {
    [#(TComma, _), ..rest] -> array(rest, start, row, rows)
    [#(TSemi, _), ..rest] -> array(rest, start, [], [list.reverse(row), ..rows])
    [#(TRBrace, _), ..rest] -> {
      let rows = list.reverse([list.reverse(row), ..rows])
      let width = list.length(list.first(rows) |> result.unwrap([]))
      case list.all(rows, fn(r) { list.length(r) == width }) {
        True -> Ok(#(ast.ArrayLit(rows), rest))
        False -> Error(ParseError("array rows must be the same length", start))
      }
    }
    _ -> Error(ParseError("missing } in array constant", start))
  }
}

fn array_item(tokens: List(Token)) -> Result(#(Expr, List(Token)), ParseError) {
  case tokens {
    [#(TOp("-"), _), #(TNum(x), _), ..rest] ->
      Ok(#(ast.Num(float.negate(x)), rest))
    [#(TNum(x), _), ..rest] -> Ok(#(ast.Num(x), rest))
    [#(TStr(s), _), ..rest] -> Ok(#(ast.Str(s), rest))
    [#(TBool(b), _), ..rest] -> Ok(#(ast.Bool(b), rest))
    [#(TErr(k), _), ..rest] -> Ok(#(ast.ErrorLit(k), rest))
    [#(_, pos), ..] ->
      Error(ParseError("array constants may only hold values", pos))
    [] -> Error(ParseError("missing } in array constant", 0))
  }
}

fn describe(tok: Tok) -> String {
  case tok {
    TNum(x) -> value.format_number(x, 15)
    TStr(s) -> "\"" <> s <> "\""
    TBool(True) -> "TRUE"
    TBool(False) -> "FALSE"
    TErr(k) -> value.error_to_string(k)
    TCell(c, r) -> ast.cell_name(c, r)
    TCols(a, b) -> ast.column_name(a) <> ":" <> ast.column_name(b)
    TRows(a, b) -> int.to_string(a + 1) <> ":" <> int.to_string(b + 1)
    TSheet(s) -> s <> "!"
    TIdent(s) -> s
    TOp(s) -> s
    TLParen -> "("
    TRParen -> ")"
    TComma -> ","
    TSemi -> ";"
    TLBrace -> "{"
    TRBrace -> "}"
    TColon -> ":"
    TEnd -> "end of formula"
  }
}
