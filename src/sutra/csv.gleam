//// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes,
//// CRLF or LF line endings. Tab-separated files use the same rules.

import gleam/list
import gleam/string

pub fn parse(text: String, separator: String) -> List(List(String)) {
  let rows = go(string.to_graphemes(text), separator, "", [], [], False)
  // a trailing newline does not make an extra empty row
  case list.reverse(rows) {
    [[""], ..rest] -> list.reverse(rest)
    _ -> rows
  }
}

fn go(
  chars: List(String),
  sep: String,
  field: String,
  row: List(String),
  rows: List(List(String)),
  quoted: Bool,
) -> List(List(String)) {
  case chars, quoted {
    [], _ -> list.reverse([list.reverse([field, ..row]), ..rows])
    ["\"", "\"", ..rest], True -> go(rest, sep, field <> "\"", row, rows, True)
    ["\"", ..rest], True -> go(rest, sep, field, row, rows, False)
    [c, ..rest], True -> go(rest, sep, field <> c, row, rows, True)
    ["\"", ..rest], False if field == "" -> go(rest, sep, field, row, rows, True)
    ["\r\n", ..rest], False | ["\n", ..rest], False ->
      go(rest, sep, "", [], [list.reverse([field, ..row]), ..rows], False)
    ["\r", ..rest], False -> go(rest, sep, field, row, rows, False)
    [c, ..rest], False if c == sep ->
      go(rest, sep, "", [field, ..row], rows, False)
    [c, ..rest], False -> go(rest, sep, field <> c, row, rows, False)
  }
}

pub fn field(text: String) -> String {
  case
    string.contains(text, ",")
    || string.contains(text, "\"")
    || string.contains(text, "\n")
  {
    True -> "\"" <> string.replace(text, "\"", "\"\"") <> "\""
    False -> text
  }
}

pub fn write(rows: List(List(String))) -> String {
  rows
  |> list.map(fn(row) { string.join(list.map(row, field), ",") })
  |> string.join("\n")
  |> string.append("\n")
}
