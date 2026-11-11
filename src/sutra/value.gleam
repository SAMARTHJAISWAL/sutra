//// Cell values, Excel's error codes, and the coercions between them.
////
//// Every number is a Float, as in Excel. Formatting is done here rather than
//// with `float.to_string` so that the Erlang and JavaScript targets print
//// exactly the same text for the same number.

import gleam/float
import gleam/int
import gleam/list
import gleam/order.{type Order}
import gleam/string

pub type ErrorKind {
  Div0
  NA
  NameErr
  NullErr
  NumErr
  RefErr
  ValueErr
  /// A dynamic array could not spill because something is in the way.
  Spill
  /// The cell takes part in a circular reference.
  Cycle
  /// A function produced an empty array, e.g. FILTER with no matches.
  Calc
  /// The formula could not be parsed.
  ParseError
}

pub type Value {
  Number(Float)
  Text(String)
  Boolean(Bool)
  Empty
  Err(ErrorKind)
}

pub fn error_to_string(kind: ErrorKind) -> String {
  case kind {
    Div0 -> "#DIV/0!"
    NA -> "#N/A"
    NameErr -> "#NAME?"
    NullErr -> "#NULL!"
    NumErr -> "#NUM!"
    RefErr -> "#REF!"
    ValueErr -> "#VALUE!"
    Spill -> "#SPILL!"
    Cycle -> "#CYCLE!"
    Calc -> "#CALC!"
    ParseError -> "#ERROR!"
  }
}

pub fn error_from_string(text: String) -> Result(ErrorKind, Nil) {
  case string.uppercase(text) {
    "#DIV/0!" -> Ok(Div0)
    "#N/A" -> Ok(NA)
    "#NAME?" -> Ok(NameErr)
    "#NULL!" -> Ok(NullErr)
    "#NUM!" -> Ok(NumErr)
    "#REF!" -> Ok(RefErr)
    "#VALUE!" -> Ok(ValueErr)
    "#SPILL!" -> Ok(Spill)
    "#CYCLE!" -> Ok(Cycle)
    "#CALC!" -> Ok(Calc)
    "#ERROR!" -> Ok(ParseError)
    _ -> Error(Nil)
  }
}

/// The text Excel would show for a value converted to a string, e.g. by `&`.
/// Numbers keep up to 15 significant digits, Excel's precision.
pub fn to_string(value: Value) -> String {
  case value {
    Number(x) -> format_number(x, 15)
    Text(s) -> s
    Boolean(True) -> "TRUE"
    Boolean(False) -> "FALSE"
    Empty -> ""
    Err(kind) -> error_to_string(kind)
  }
}

/// Like `to_string`, but numbers are cut to `digits` significant digits,
/// which is what a narrow grid cell shows.
pub fn display(value: Value, digits: Int) -> String {
  case value {
    Number(x) -> format_number(x, digits)
    _ -> to_string(value)
  }
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/// A finite float as `0.DIGITS × 10^point`, with no leading or trailing
/// zeros in DIGITS. Zero is `#("", 0)`.
pub fn decompose(x: Float) -> #(String, Int) {
  // absolute_value(-0.0) keeps the sign, so drop it from the text instead
  let text = case float.to_string(x) {
    "-" <> rest -> rest
    t -> t
  }
  let #(mantissa, exponent) = case string.split_once(text, "e") {
    Ok(#(m, e)) -> #(m, result_or(int.parse(string.replace(e, "+", "")), 0))
    Error(_) -> #(text, 0)
  }
  let #(whole, fraction) = case string.split_once(mantissa, ".") {
    Ok(pair) -> pair
    Error(_) -> #(mantissa, "")
  }
  let digits = whole <> fraction
  let point = string.length(whole) + exponent
  let #(digits, point) = strip_leading_zeros(digits, point)
  let digits = strip_trailing_zeros(digits)
  case digits {
    "" -> #("", 0)
    _ -> #(digits, point)
  }
}

fn result_or(r: Result(a, b), default: a) -> a {
  case r {
    Ok(x) -> x
    Error(_) -> default
  }
}

fn strip_leading_zeros(digits: String, point: Int) -> #(String, Int) {
  case digits {
    "0" <> rest -> strip_leading_zeros(rest, point - 1)
    _ -> #(digits, point)
  }
}

fn strip_trailing_zeros(digits: String) -> String {
  case string.ends_with(digits, "0") {
    True -> strip_trailing_zeros(string.drop_end(digits, 1))
    False -> digits
  }
}

/// Round a digit string to `n` significant digits.
pub fn round_digits(digits: String, point: Int, n: Int) -> #(String, Int) {
  case string.length(digits) <= n {
    True -> #(digits, point)
    False -> {
      let kept = string.slice(digits, 0, n)
      let next = string.slice(digits, n, 1)
      case result_or(int.parse(next), 0) >= 5 {
        False -> #(strip_trailing_zeros(kept), point)
        True -> {
          let #(bumped, carried) = increment(kept)
          case carried {
            True -> #(strip_trailing_zeros("1" <> bumped), point + 1)
            False -> #(strip_trailing_zeros(bumped), point)
          }
        }
      }
    }
  }
}

/// Add one to a string of decimal digits. Returns the new digits (same
/// length) and whether a carry came out of the top.
pub fn increment(digits: String) -> #(String, Bool) {
  let #(out, carry) =
    digits
    |> string.to_graphemes
    |> list.reverse
    |> list.fold(#([], True), fn(acc, d) {
      let #(out, carry) = acc
      case carry, d {
        True, "9" -> #(["0", ..out], True)
        True, _ -> #(
          [int.to_string(result_or(int.parse(d), 0) + 1), ..out],
          False,
        )
        False, _ -> #([d, ..out], False)
      }
    })
  #(string.concat(out), carry)
}

/// Excel's "General" format with `sig` significant digits: plain decimals
/// for ordinary magnitudes, scientific notation (1.5E+20) otherwise.
pub fn format_number(x: Float, sig: Int) -> String {
  let #(digits, point) = round_digits_of(x, sig)
  case digits {
    "" -> "0"
    _ -> {
      let sign = case x <. 0.0 {
        True -> "-"
        False -> ""
      }
      let e = point - 1
      case e >= -9 && e < sig {
        True -> sign <> plain(digits, point)
        False -> sign <> scientific(digits, e)
      }
    }
  }
}

fn round_digits_of(x: Float, sig: Int) -> #(String, Int) {
  let #(digits, point) = decompose(x)
  round_digits(digits, point, sig)
}

fn plain(digits: String, point: Int) -> String {
  let n = string.length(digits)
  case point <= 0, point >= n {
    True, _ -> "0." <> string.repeat("0", -point) <> digits
    False, True -> digits <> string.repeat("0", point - n)
    False, False ->
      string.slice(digits, 0, point) <> "." <> string.drop_start(digits, point)
  }
}

fn scientific(digits: String, e: Int) -> String {
  let head = string.slice(digits, 0, 1)
  let tail = string.drop_start(digits, 1)
  let mantissa = case tail {
    "" -> head
    _ -> head <> "." <> tail
  }
  let sign = case e < 0 {
    True -> "-"
    False -> "+"
  }
  mantissa
  <> "E"
  <> sign
  <> string.pad_start(int.to_string(int.absolute_value(e)), 2, "0")
}

// ---------------------------------------------------------------------------
// Parsing numbers typed by people
// ---------------------------------------------------------------------------

/// Parse a number the way Excel reads one typed into a cell or passed to
/// VALUE: optional sign, thousands separators, decimals, an exponent and a
/// trailing percent sign. "1,234.5", "-3e2", "12.5%" and ".5" all parse.
pub fn parse_number(text: String) -> Result(Float, Nil) {
  let text = string.trim(text)
  let #(text, scale) = case string.ends_with(text, "%") {
    True -> #(string.trim_end(string.drop_end(text, 1)), 0.01)
    False -> #(text, 1.0)
  }
  let #(negative, text) = case text {
    "-" <> rest -> #(True, rest)
    "+" <> rest -> #(False, rest)
    _ -> #(False, text)
  }
  case scan_number(string.to_graphemes(text)) {
    Ok(x) -> {
      let x = x *. scale
      case negative {
        True -> Ok(float.negate(x))
        False -> Ok(x)
      }
    }
    Error(_) -> Error(Nil)
  }
}

fn scan_number(chars: List(String)) -> Result(Float, Nil) {
  let #(whole, rest) = take_digits(chars, True)
  let #(fraction, rest) = case rest {
    [".", ..rest] -> take_digits(rest, False)
    _ -> #("", rest)
  }
  let #(exponent, rest) = case rest {
    [e, ..rest] if e == "e" || e == "E" -> {
      let #(sign, rest) = case rest {
        ["-", ..rest] -> #("-", rest)
        ["+", ..rest] -> #("", rest)
        _ -> #("", rest)
      }
      let #(digits, rest) = take_digits(rest, False)
      case digits {
        "" -> #("bad", rest)
        _ -> #(sign <> digits, rest)
      }
    }
    _ -> #("0", rest)
  }
  let whole_digits = string.replace(whole, ",", "")
  case rest, whole_digits, fraction, exponent {
    _, _, _, "bad" -> Error(Nil)
    [_, ..], _, _, _ -> Error(Nil)
    [], "", "", _ -> Error(Nil)
    [], _, _, _ ->
      case valid_grouping(whole) {
        False -> Error(Nil)
        True -> {
          let w = case whole_digits {
            "" -> "0"
            _ -> whole_digits
          }
          let f = case fraction {
            "" -> "0"
            _ -> fraction
          }
          float.parse(w <> "." <> f <> "e" <> exponent)
        }
      }
  }
}

fn take_digits(
  chars: List(String),
  allow_comma: Bool,
) -> #(String, List(String)) {
  let #(taken, rest) =
    list.split_while(chars, fn(c) { is_digit(c) || { allow_comma && c == "," } })
  #(string.concat(taken), rest)
}

/// "1,234,567" is fine; "1,23" and ",123" are not numbers.
fn valid_grouping(whole: String) -> Bool {
  case string.split(whole, ",") {
    [_] -> True
    [first, ..rest] ->
      first != ""
      && string.length(first) <= 3
      && list.all(rest, fn(g) { string.length(g) == 3 })
    [] -> True
  }
}

pub fn is_digit(c: String) -> Bool {
  case c {
    "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" -> True
    _ -> False
  }
}

/// What a person typed into a cell, as a constant value. Formulas are
/// handled by the parser; this only covers literals.
pub fn from_input(text: String) -> Value {
  case text {
    "" -> Empty
    "'" <> rest -> Text(rest)
    _ ->
      case parse_number(text) {
        Ok(x) -> Number(x)
        Error(_) ->
          case string.uppercase(string.trim(text)) {
            "TRUE" -> Boolean(True)
            "FALSE" -> Boolean(False)
            upper ->
              case error_from_string(upper) {
                Ok(kind) -> Err(kind)
                Error(_) -> Text(text)
              }
          }
      }
  }
}

// ---------------------------------------------------------------------------
// Coercions
// ---------------------------------------------------------------------------

pub fn to_number(value: Value) -> Result(Float, ErrorKind) {
  case value {
    Number(x) -> Ok(x)
    Boolean(True) -> Ok(1.0)
    Boolean(False) -> Ok(0.0)
    Empty -> Ok(0.0)
    Text(s) ->
      case parse_number(s) {
        Ok(x) -> Ok(x)
        Error(_) -> Error(ValueErr)
      }
    Err(kind) -> Error(kind)
  }
}

pub fn to_text(value: Value) -> Result(String, ErrorKind) {
  case value {
    Err(kind) -> Error(kind)
    _ -> Ok(to_string(value))
  }
}

pub fn to_bool(value: Value) -> Result(Bool, ErrorKind) {
  case value {
    Boolean(b) -> Ok(b)
    Number(x) -> Ok(x != 0.0)
    Empty -> Ok(False)
    Text(s) ->
      case string.uppercase(s) {
        "TRUE" -> Ok(True)
        "FALSE" -> Ok(False)
        _ -> Error(ValueErr)
      }
    Err(kind) -> Error(kind)
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/// Two numbers are equal if they agree to about 15 significant digits, so
/// =0.1+0.2=0.3 is TRUE, as in Excel.
pub fn compare_numbers(a: Float, b: Float) -> Order {
  case a == b {
    True -> order.Eq
    False -> {
      let scale = float.max(float.absolute_value(a), float.absolute_value(b))
      case float.absolute_value(a -. b) <=. scale *. 1.0e-15 {
        True -> order.Eq
        False -> float.compare(a, b)
      }
    }
  }
}

fn rank(value: Value) -> Int {
  case value {
    Number(_) -> 0
    Text(_) -> 1
    Boolean(_) -> 2
    Empty -> 0
    Err(_) -> 3
  }
}

/// Excel's ordering for comparison operators and sorting: numbers sort
/// before text, text before logicals; text compares case-insensitively; an
/// empty cell acts as 0, "" or FALSE depending on the other side.
pub fn compare(a: Value, b: Value) -> Order {
  case a, b {
    Empty, Empty -> order.Eq
    Empty, Text(_) -> compare(Text(""), b)
    Text(_), Empty -> compare(a, Text(""))
    Empty, Boolean(_) -> compare(Boolean(False), b)
    Boolean(_), Empty -> compare(a, Boolean(False))
    Empty, _ -> compare(Number(0.0), b)
    _, Empty -> compare(a, Number(0.0))
    Number(x), Number(y) -> compare_numbers(x, y)
    Text(x), Text(y) -> string.compare(string.lowercase(x), string.lowercase(y))
    Boolean(x), Boolean(y) ->
      case x, y {
        False, True -> order.Lt
        True, False -> order.Gt
        _, _ -> order.Eq
      }
    _, _ -> int.compare(rank(a), rank(b))
  }
}

pub fn is_error(value: Value) -> Bool {
  case value {
    Err(_) -> True
    _ -> False
  }
}
