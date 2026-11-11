//// A small API for the browser demo. It returns JSON strings so the page's
//// JavaScript never has to understand Gleam's data structures.

import gleam/int
import gleam/list
import gleam/string
import sutra/ast
import sutra/cli
import sutra/env
import sutra/eval
import sutra/functions
import sutra/parser
import sutra/value.{type Value}
import sutra/workbook.{type Key, type Recalc, type Workbook, Key}

pub fn load(
  sheets: List(String),
  cells: List(#(String, Int, Int, String)),
) -> #(Workbook, String) {
  let #(book, report) = workbook.from_cells(sheets, cells)
  #(book, report_json(book, report))
}

/// Set a cell. Returns the new workbook and a JSON report of what changed.
pub fn set(
  book: Workbook,
  sheet: String,
  col: Int,
  row: Int,
  input: String,
) -> #(Workbook, String) {
  case workbook.set(book, sheet, col, row, input) {
    Ok(#(book, report)) -> #(book, report_json(book, report))
    Error(_) -> #(book, "{\"error\":\"no such sheet\"}")
  }
}

fn keys_json(book: Workbook, keys: List(Key)) -> String {
  "["
  <> string.join(
    list.map(keys, fn(k) {
      "["
      <> cli.json_string(workbook.sheet_name(book, k.sheet))
      <> ","
      <> int.to_string(k.col)
      <> ","
      <> int.to_string(k.row)
      <> "]"
    }),
    ",",
  )
  <> "]"
}

fn report_json(book: Workbook, r: Recalc) -> String {
  "{\"evaluated\":"
  <> int.to_string(list.length(r.evaluated))
  <> ",\"formulas\":"
  <> int.to_string(list.length(workbook.formulas(book)))
  <> ",\"rebuilt\":"
  <> bool(r.rebuilt)
  <> ",\"changed\":"
  <> keys_json(book, r.changed)
  <> ",\"cycles\":"
  <> keys_json(book, r.cycles)
  <> "}"
}

fn bool(b: Bool) -> String {
  case b {
    True -> "true"
    False -> "false"
  }
}

fn kind(v: Value) -> String {
  case v {
    value.Number(_) -> "number"
    value.Text(_) -> "text"
    value.Boolean(_) -> "bool"
    value.Empty -> "empty"
    value.Err(_) -> "error"
  }
}

/// Every cell of a sheet inside `rows` x `cols`, as
/// [[col, row, shown, kind, input, spill], ...] for non-empty cells.
/// `spill` is "" , "anchor" or the A1 name of the array a value spilled from.
pub fn view(book: Workbook, sheet: String, rows: Int, cols: Int) -> String {
  let canonical = string.lowercase(sheet)
  let cells =
    workbook.cells(book)
    |> list.filter(fn(k) {
      k.sheet == canonical && k.row < rows && k.col < cols
    })
    |> list.map(fn(k) {
      let v = workbook.value(book, sheet, k.col, k.row)
      let spill = case
        workbook.spilled_from(book, k),
        workbook.spill_region(book, k)
      {
        Ok(anchor), _ -> ast.cell_name(anchor.col, anchor.row)
        _, Ok(_) -> "anchor"
        _, _ -> ""
      }
      "["
      <> int.to_string(k.col)
      <> ","
      <> int.to_string(k.row)
      <> ","
      <> cli.json_string(value.display(v, 10))
      <> ","
      <> cli.json_string(kind(v))
      <> ","
      <> cli.json_string(workbook.input(book, sheet, k.col, k.row))
      <> ","
      <> cli.json_string(spill)
      <> "]"
    })
  "[" <> string.join(cells, ",") <> "]"
}

/// Details of one cell: full value, what it reads, what reads it, its
/// spill region and the explanation tree.
pub fn inspect(book: Workbook, sheet: String, col: Int, row: Int) -> String {
  let key = Key(string.lowercase(sheet), col, row)
  let v = workbook.value(book, sheet, col, row)
  let precedents =
    workbook.precedents(book, key)
    |> list.map(fn(dep) {
      case dep {
        workbook.OnCell(k) ->
          "{\"sheet\":"
          <> cli.json_string(workbook.sheet_name(book, k.sheet))
          <> ",\"range\":["
          <> int.to_string(k.col)
          <> ","
          <> int.to_string(k.row)
          <> ","
          <> int.to_string(k.col)
          <> ","
          <> int.to_string(k.row)
          <> "]}"
        workbook.OnArea(s, r) -> {
          let #(used_rows, used_cols) = workbook.extent(book, s)
          let bottom = int.min(r.bottom, int.max(used_rows - 1, r.top))
          let right = int.min(r.right, int.max(used_cols - 1, r.left))
          "{\"sheet\":"
          <> cli.json_string(workbook.sheet_name(book, s))
          <> ",\"range\":["
          <> int.to_string(r.left)
          <> ","
          <> int.to_string(r.top)
          <> ","
          <> int.to_string(right)
          <> ","
          <> int.to_string(bottom)
          <> "]}"
        }
      }
    })
  let region = case workbook.spill_region(book, key) {
    Ok(r) ->
      "["
      <> string.join(
        list.map([r.left, r.top, r.right, r.bottom], int.to_string),
        ",",
      )
      <> "]"
    Error(_) -> "null"
  }
  "{\"value\":"
  <> cli.json_string(value.to_string(v))
  <> ",\"kind\":"
  <> cli.json_string(kind(v))
  <> ",\"precedents\":["
  <> string.join(precedents, ",")
  <> "],\"dependents\":"
  <> keys_json(book, workbook.dependents(book, key))
  <> ",\"spill\":"
  <> region
  <> ",\"explain\":"
  <> cli.json_string(cli.explain(book, key))
  <> "}"
}

/// Evaluate a formula on its own (the formula bar's preview).
pub fn calc(formula: String) -> String {
  case parser.parse(formula) {
    Error(e) ->
      "{\"error\":"
      <> cli.json_string(e.message)
      <> ",\"position\":"
      <> int.to_string(e.position)
      <> "}"
    Ok(expr) ->
      case eval.standalone(expr) {
        env.Scalar(v) ->
          "{\"value\":" <> cli.json_string(value.to_string(v)) <> "}"
        env.Grid(_) -> "{\"value\":\"(array)\"}"
      }
  }
}

/// Parse problems for the formula being typed, if any.
pub fn check_formula(formula: String) -> String {
  case formula {
    "=" <> _ ->
      case parser.parse(formula) {
        Ok(_) -> "null"
        Error(e) ->
          "{\"message\":"
          <> cli.json_string(e.message)
          <> ",\"position\":"
          <> int.to_string(e.position)
          <> "}"
      }
    _ -> "null"
  }
}

pub fn catalogue() -> String {
  "["
  <> string.join(
    list.map(functions.catalogue(), fn(e) {
      "["
      <> cli.json_string(e.0)
      <> ","
      <> cli.json_string(e.1)
      <> ","
      <> cli.json_string(e.2)
      <> "]"
    }),
    ",",
  )
  <> "]"
}
