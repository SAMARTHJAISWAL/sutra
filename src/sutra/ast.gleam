//// The formula syntax tree, and A1-style cell addresses.

import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import sutra/value.{type ErrorKind}

/// Excel's grid limits: columns A..XFD, rows 1..1048576.
pub const max_cols = 16_384

pub const max_rows = 1_048_576

/// A rectangle of cells, zero-based and inclusive. A whole column (A:A)
/// runs to the last row of the grid; evaluation clips it to the used area.
pub type Range {
  Range(top: Int, left: Int, bottom: Int, right: Int)
}

pub type BinOp {
  Add
  Sub
  Mul
  Div
  Pow
  Concat
  Eq
  Ne
  Lt
  Le
  Gt
  Ge
}

pub type Expr {
  Num(Float)
  Str(String)
  Bool(Bool)
  ErrorLit(ErrorKind)
  /// A single cell. `sheet` is None for the formula's own sheet.
  Ref(sheet: Option(String), col: Int, row: Int)
  Area(sheet: Option(String), range: Range)
  /// A LET variable, or an unknown name (#NAME?).
  Name(String)
  Call(name: String, args: List(Expr))
  Neg(Expr)
  Percent(Expr)
  Binary(op: BinOp, left: Expr, right: Expr)
  /// An array constant such as {1,2;3,4}: rows of columns.
  ArrayLit(List(List(Expr)))
  /// An argument left out, as in IF(A1,,0).
  Missing
}

// ---------------------------------------------------------------------------
// A1 addresses
// ---------------------------------------------------------------------------

/// 0 -> "A", 25 -> "Z", 26 -> "AA".
pub fn column_name(col: Int) -> String {
  case col < 26 {
    True -> letter(col)
    False -> column_name(col / 26 - 1) <> letter(col % 26)
  }
}

fn letter(i: Int) -> String {
  string.slice("ABCDEFGHIJKLMNOPQRSTUVWXYZ", i, 1)
}

/// "A" -> 0, "xfd" -> 16383. Errors on anything that is not 1-3 letters
/// naming a column inside the grid.
pub fn parse_column(text: String) -> Result(Int, Nil) {
  let letters = string.to_graphemes(string.uppercase(text))
  case letters {
    [] -> Error(Nil)
    _ if letters != [] -> {
      let n = list.length(letters)
      case n > 3 {
        True -> Error(Nil)
        False ->
          list.try_fold(letters, 0, fn(acc, c) {
            case letter_index(c) {
              Ok(i) -> Ok(acc * 26 + i + 1)
              Error(_) -> Error(Nil)
            }
          })
          |> result_then(fn(n) {
            case n <= max_cols {
              True -> Ok(n - 1)
              False -> Error(Nil)
            }
          })
      }
    }
    _ -> Error(Nil)
  }
}

fn result_then(
  r: Result(a, Nil),
  f: fn(a) -> Result(b, Nil),
) -> Result(b, Nil) {
  case r {
    Ok(x) -> f(x)
    Error(_) -> Error(Nil)
  }
}

fn letter_index(c: String) -> Result(Int, Nil) {
  case string.to_utf_codepoints(c) {
    [cp] -> {
      let code = string.utf_codepoint_to_int(cp)
      case code >= 65 && code <= 90 {
        True -> Ok(code - 65)
        False -> Error(Nil)
      }
    }
    _ -> Error(Nil)
  }
}

/// "B12" or "$B$12" -> #(col, row), zero-based.
pub fn parse_cell(text: String) -> Result(#(Int, Int), Nil) {
  let chars = string.to_graphemes(string.replace(text, "$", ""))
  let #(letters, digits) = list.split_while(chars, fn(c) { !value.is_digit(c) })
  case letters, digits {
    [_, ..], [first, ..] if first != "0" ->
      case list.all(digits, value.is_digit) {
        False -> Error(Nil)
        True ->
          case
            parse_column(string.concat(letters)),
            int.parse(string.concat(digits))
          {
            Ok(col), Ok(row) if row >= 1 && row <= max_rows ->
              Ok(#(col, row - 1))
            _, _ -> Error(Nil)
          }
      }
    _, _ -> Error(Nil)
  }
}

pub fn cell_name(col: Int, row: Int) -> String {
  column_name(col) <> int.to_string(row + 1)
}

pub fn range_name(range: Range) -> String {
  let Range(top, left, bottom, right) = range
  case top == 0 && bottom == max_rows - 1, left == 0 && right == max_cols - 1 {
    True, _ -> column_name(left) <> ":" <> column_name(right)
    _, True -> int.to_string(top + 1) <> ":" <> int.to_string(bottom + 1)
    _, _ -> cell_name(left, top) <> ":" <> cell_name(right, bottom)
  }
}

/// Build a range from two corners given in any order.
pub fn range_of(c1: Int, r1: Int, c2: Int, r2: Int) -> Range {
  Range(int.min(r1, r2), int.min(c1, c2), int.max(r1, r2), int.max(c1, c2))
}

pub fn range_contains(range: Range, col: Int, row: Int) -> Bool {
  row >= range.top
  && row <= range.bottom
  && col >= range.left
  && col <= range.right
}

pub fn range_size(range: Range) -> Int {
  { range.bottom - range.top + 1 } * { range.right - range.left + 1 }
}

// ---------------------------------------------------------------------------
// Printing a tree back as formula text
// ---------------------------------------------------------------------------

pub fn to_formula(expr: Expr) -> String {
  "=" <> print(expr)
}

fn sheet_prefix(sheet: Option(String)) -> String {
  case sheet {
    None -> ""
    Some(name) ->
      case is_plain_name(name) {
        True -> name <> "!"
        False -> "'" <> string.replace(name, "'", "''") <> "'!"
      }
  }
}

fn is_plain_name(name: String) -> Bool {
  name != ""
  && list.all(string.to_graphemes(name), fn(c) {
    value.is_digit(c) || c == "_" || letter_index(string.uppercase(c)) |> is_ok
  })
  && !value.is_digit(string.slice(name, 0, 1))
}

fn is_ok(r: Result(a, b)) -> Bool {
  case r {
    Ok(_) -> True
    Error(_) -> False
  }
}

pub fn print(expr: Expr) -> String {
  case expr {
    Num(x) -> value.format_number(x, 15)
    Str(s) -> "\"" <> string.replace(s, "\"", "\"\"") <> "\""
    Bool(True) -> "TRUE"
    Bool(False) -> "FALSE"
    ErrorLit(kind) -> value.error_to_string(kind)
    Ref(sheet, col, row) -> sheet_prefix(sheet) <> cell_name(col, row)
    Area(sheet, range) -> sheet_prefix(sheet) <> range_name(range)
    Name(name) -> name
    Call(name, args) ->
      name <> "(" <> string.join(list.map(args, print), ",") <> ")"
    Neg(e) -> "-" <> print_operand(e)
    Percent(e) -> print_operand(e) <> "%"
    Binary(op, l, r) -> print_operand(l) <> op_text(op) <> print_operand(r)
    ArrayLit(rows) ->
      "{"
      <> string.join(
        list.map(rows, fn(row) { string.join(list.map(row, print), ",") }),
        ";",
      )
      <> "}"
    Missing -> ""
  }
}

fn print_operand(expr: Expr) -> String {
  case expr {
    Binary(..) -> "(" <> print(expr) <> ")"
    _ -> print(expr)
  }
}

pub fn op_text(op: BinOp) -> String {
  case op {
    Add -> "+"
    Sub -> "-"
    Mul -> "*"
    Div -> "/"
    Pow -> "^"
    Concat -> "&"
    Eq -> "="
    Ne -> "<>"
    Lt -> "<"
    Le -> "<="
    Gt -> ">"
    Ge -> ">="
  }
}

/// Every cell and range a formula reads, in the order they appear.
pub fn references(expr: Expr) -> List(Expr) {
  collect(expr, []) |> list.reverse
}

fn collect(expr: Expr, acc: List(Expr)) -> List(Expr) {
  case expr {
    Ref(..) | Area(..) -> [expr, ..acc]
    Call(_, args) -> list.fold(args, acc, fn(acc, a) { collect(a, acc) })
    Neg(e) | Percent(e) -> collect(e, acc)
    Binary(_, l, r) -> collect(r, collect(l, acc))
    ArrayLit(rows) ->
      list.fold(rows, acc, fn(acc, row) {
        list.fold(row, acc, fn(acc, e) { collect(e, acc) })
      })
    _ -> acc
  }
}
