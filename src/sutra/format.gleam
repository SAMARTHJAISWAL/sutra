//// Number formats for the TEXT function: the common subset of Excel's
//// format codes used in reports.
////
////   0  0.00  #,##0  #,##0.00  0%  0.0%  $#,##0  #,##0;(#,##0)  0.00E+00
////   yyyy-mm-dd  dd/mm/yyyy  mmm yyyy  mmmm d, yyyy  ddd  dddd  "text"

import gleam/float
import gleam/int
import gleam/list
import gleam/string
import sutra/dates
import sutra/num
import sutra/value

pub fn text(x: Float, code: String) -> Result(String, Nil) {
  let sections = split_sections(code)
  case is_date_format(code) {
    True -> date(x, code)
    False ->
      case sections, x <. 0.0, x == 0.0 {
        [_, _, zero, ..], _, True -> number(0.0, zero)
        [_, neg, ..], True, _ -> number(float.negate(x), neg)
        [pos, ..], True, _ ->
          number(float.negate(x), pos) |> map_ok(fn(s) { "-" <> s })
        [pos, ..], False, _ -> number(x, pos)
        [], _, _ -> Ok(value.format_number(x, 15))
      }
  }
}

fn map_ok(r: Result(a, e), f: fn(a) -> b) -> Result(b, e) {
  case r {
    Ok(x) -> Ok(f(x))
    Error(e) -> Error(e)
  }
}

/// Split on ';' outside quotes.
fn split_sections(code: String) -> List(String) {
  let #(sections, current, _) =
    list.fold(string.to_graphemes(code), #([], "", False), fn(acc, c) {
      let #(done, cur, quoted) = acc
      case c, quoted {
        "\"", _ -> #(done, cur <> c, !quoted)
        ";", False -> #([cur, ..done], "", False)
        _, _ -> #(done, cur <> c, quoted)
      }
    })
  list.reverse([current, ..sections])
}

fn strip_quoted(code: String) -> String {
  let #(out, _) =
    list.fold(string.to_graphemes(code), #("", False), fn(acc, c) {
      let #(out, quoted) = acc
      case c, quoted {
        "\"", _ -> #(out, !quoted)
        _, True -> #(out, True)
        _, False -> #(out <> c, False)
      }
    })
  out
}

fn is_date_format(code: String) -> Bool {
  let bare = string.lowercase(strip_quoted(code))
  let has_digit_placeholder =
    string.contains(bare, "0") || string.contains(bare, "#")
  string.contains(bare, "y")
  || string.contains(bare, "d")
  || { string.contains(bare, "m") && !has_digit_placeholder }
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

type Part {
  Literal(String)
  Digits(String)
}

/// Break a section into literal text and the one run of digit placeholders.
fn parts(section: String) -> List(Part) {
  let #(parts, cur, kind, _) =
    list.fold(string.to_graphemes(section), #([], "", "lit", False), fn(acc, c) {
      let #(parts, cur, kind, quoted) = acc
      case quoted, c {
        True, "\"" -> #(parts, cur, kind, False)
        True, _ -> append(parts, cur, kind, "lit", c, True)
        False, "\"" -> #(parts, cur, kind, True)
        False, _ ->
          case is_placeholder(c) {
            True -> append(parts, cur, kind, "num", c, False)
            False ->
              case c {
                "\\" -> #(parts, cur, kind, quoted)
                _ -> append(parts, cur, kind, "lit", c, False)
              }
          }
      }
    })
  list.reverse(flush(parts, cur, kind))
}

fn is_placeholder(c: String) -> Bool {
  c == "0"
  || c == "#"
  || c == ","
  || c == "."
  || c == "?"
  || c == "E"
  || c == "e"
  || c == "+"
}

fn append(parts, cur, kind, new_kind, c, quoted) {
  case kind == new_kind {
    True -> #(parts, cur <> c, kind, quoted)
    False -> #(flush(parts, cur, kind), c, new_kind, quoted)
  }
}

fn flush(parts: List(Part), cur: String, kind: String) -> List(Part) {
  case cur, kind {
    "", _ -> parts
    _, "num" -> [Digits(cur), ..parts]
    _, _ -> [Literal(cur), ..parts]
  }
}

fn number(x: Float, section: String) -> Result(String, Nil) {
  let ps = parts(section)
  let percent =
    list.any(ps, fn(p) {
      case p {
        Literal(s) -> string.contains(s, "%")
        _ -> False
      }
    })
  let x = case percent {
    True -> x *. 100.0
    False -> x
  }
  let #(out, _) =
    list.fold(ps, #("", False), fn(acc, p) {
      let #(out, used) = acc
      case p, used {
        Literal(s), _ -> #(out <> s, used)
        Digits(d), False -> #(out <> digits(x, d), True)
        Digits(d), True -> #(out <> d, True)
      }
    })
  Ok(out)
}

/// Format |x| with one placeholder run such as "#,##0.00" or "0.0E+00".
fn digits(x: Float, pattern: String) -> String {
  let upper = string.uppercase(pattern)
  case string.split_once(upper, "E") {
    Ok(#(mantissa, _)) -> scientific(x, mantissa)
    Error(_) -> {
      let #(int_pat, frac_pat) = case string.split_once(pattern, ".") {
        Ok(pair) -> pair
        Error(_) -> #(pattern, "")
      }
      let grouping = string.contains(int_pat, ",")
      let min_int = count(int_pat, "0")
      let decimals = count(frac_pat, "0") + count(frac_pat, "#")
      let min_dec = count(frac_pat, "0")
      fixed(x, decimals, min_dec, min_int, grouping)
    }
  }
}

fn count(s: String, c: String) -> Int {
  list.count(string.to_graphemes(s), fn(x) { x == c })
}

pub fn fixed(
  x: Float,
  decimals: Int,
  min_dec: Int,
  min_int: Int,
  grouping: Bool,
) -> String {
  let rounded = num.round(float.absolute_value(x), decimals, num.HalfUp)
  let #(digits, point) = value.decompose(rounded)
  let #(int_digits, frac_digits) = case digits {
    "" -> #("", "")
    _ ->
      case point <= 0 {
        True -> #("", string.repeat("0", -point) <> digits)
        False ->
          case point >= string.length(digits) {
            True -> #(
              digits <> string.repeat("0", point - string.length(digits)),
              "",
            )
            False -> #(
              string.slice(digits, 0, point),
              string.drop_start(digits, point),
            )
          }
      }
  }
  let int_digits = string.pad_start(int_digits, min_int, "0")
  let int_digits = case grouping {
    True -> group(int_digits)
    False -> int_digits
  }
  let frac = string.slice(frac_digits, 0, decimals)
  let frac = case string.length(frac) < min_dec {
    True -> string.pad_end(frac, min_dec, "0")
    False -> frac
  }
  case frac {
    "" -> int_digits
    _ -> int_digits <> "." <> frac
  }
}

fn group(digits: String) -> String {
  digits
  |> string.to_graphemes
  |> list.reverse
  |> list.sized_chunk(3)
  |> list.map(fn(chunk) { string.concat(list.reverse(chunk)) })
  |> list.reverse
  |> string.join(",")
}

fn scientific(x: Float, mantissa_pattern: String) -> String {
  let #(_, frac_pat) = case string.split_once(mantissa_pattern, ".") {
    Ok(pair) -> pair
    Error(_) -> #(mantissa_pattern, "")
  }
  let decimals = string.length(frac_pat)
  let #(digits, point) = value.decompose(x)
  case digits {
    "" -> fixed(0.0, decimals, decimals, 1, False) <> "E+00"
    _ -> {
      let #(digits, point) = value.round_digits(digits, point, decimals + 1)
      let mantissa = num.from_digits(digits, 1)
      let e = point - 1
      let sign = case e < 0 {
        True -> "-"
        False -> "+"
      }
      fixed(mantissa, decimals, decimals, 1, False)
      <> "E"
      <> sign
      <> string.pad_start(int.to_string(int.absolute_value(e)), 2, "0")
    }
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const month_names = [
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
]

const day_names = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

fn date(x: Float, code: String) -> Result(String, Nil) {
  case x <. 0.0 || x >. 2_958_465.0 {
    True -> Error(Nil)
    False -> {
      let serial = float.truncate(x)
      let #(y, m, d) = dates.ymd(serial)
      let wd = dates.weekday(serial)
      Ok(render_date(string.to_graphemes(code), y, m, d, wd, ""))
    }
  }
}

fn render_date(
  chars: List(String),
  y: Int,
  m: Int,
  d: Int,
  wd: Int,
  out: String,
) -> String {
  case chars {
    [] -> out
    ["\"", ..rest] -> {
      let #(lit, rest) = list.split_while(rest, fn(c) { c != "\"" })
      render_date(list.drop(rest, 1), y, m, d, wd, out <> string.concat(lit))
    }
    [c, ..] -> {
      let lower = string.lowercase(c)
      case lower == "y" || lower == "m" || lower == "d" {
        False -> render_date(list.drop(chars, 1), y, m, d, wd, out <> c)
        True -> {
          let #(run, rest) =
            list.split_while(chars, fn(x) { string.lowercase(x) == lower })
          let n = list.length(run)
          let piece = case lower, n {
            "y", 1 | "y", 2 -> string.pad_start(int.to_string(y % 100), 2, "0")
            "y", _ -> int.to_string(y)
            "m", 1 -> int.to_string(m)
            "m", 2 -> string.pad_start(int.to_string(m), 2, "0")
            "m", 3 -> string.slice(name(month_names, m - 1), 0, 3)
            "m", 5 -> string.slice(name(month_names, m - 1), 0, 1)
            "m", _ -> name(month_names, m - 1)
            "d", 1 -> int.to_string(d)
            "d", 2 -> string.pad_start(int.to_string(d), 2, "0")
            "d", 3 -> string.slice(name(day_names, wd - 1), 0, 3)
            _, _ -> name(day_names, wd - 1)
          }
          render_date(rest, y, m, d, wd, out <> piece)
        }
      }
    }
  }
}

fn name(names: List(String), i: Int) -> String {
  case list.drop(names, i) {
    [n, ..] -> n
    [] -> ""
  }
}
