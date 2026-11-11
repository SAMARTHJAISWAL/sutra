//// The command-line interface, kept free of IO so it can be tested: it
//// takes the arguments and a way to read files, and returns what to print.

import gleam/dict
import gleam/int
import gleam/list
import gleam/result
import gleam/set.{type Set}
import gleam/string
import sutra/ast
import sutra/csv
import sutra/env
import sutra/eval
import sutra/functions
import sutra/parser
import sutra/value.{type Value}
import sutra/workbook.{type Key, type Workbook, Key}

pub type Output {
  Output(stdout: String, stderr: String, code: Int)
}

pub const version = "0.1.0"

const usage =
  "sutra — an Excel formula engine

Usage:
  sutra eval <file.csv>... [--format table|csv|json]   compute every formula
  sutra check <file.csv>...                           list formula errors
  sutra explain <file.csv>... <cell>                  trace where a value comes from
  sutra calc \"=formula\"                               evaluate one formula
  sutra functions                                     list supported functions

Each CSV file is one sheet, named after the file (sales.csv -> Sales!A1
is written sales!A1). Cells starting with = are formulas.

Options:
  -f, --format    eval output: table (default), csv or json
  -h, --help      show this help
  -v, --version   show the version
"

pub fn run(
  args: List(String),
  read: fn(String) -> Result(String, String),
) -> Output {
  case args {
    [] | ["-h"] | ["--help"] | ["help"] -> Output(usage, "", 0)
    ["-v"] | ["--version"] -> Output("sutra " <> version <> "\n", "", 0)
    ["calc", formula] -> calc(formula)
    ["functions"] -> Output(function_list(), "", 0)
    ["eval", ..rest] -> with_book(rest, read, eval_command)
    ["check", ..rest] -> with_book(rest, read, check_command)
    ["explain", ..rest] ->
      case list.reverse(rest) {
        [cell, ..files] ->
          with_book(list.reverse(files), read, fn(book, _) {
            explain_command(book, cell)
          })
        [] -> usage_error("explain needs files and a cell")
      }
    [cmd, ..] -> usage_error("unknown command " <> cmd)
  }
}

fn usage_error(message: String) -> Output {
  Output("", "error: " <> message <> "\n\n" <> usage, 2)
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

type Options {
  Options(format: String)
}

fn with_book(
  args: List(String),
  read: fn(String) -> Result(String, String),
  k: fn(Workbook, Options) -> Output,
) -> Output {
  case parse_options(args, [], Options("table")) {
    Error(message) -> usage_error(message)
    Ok(#([], _)) -> usage_error("no input files")
    Ok(#(files, options)) ->
      case load(files, read) {
        Ok(book) -> k(book, options)
        Error(message) -> Output("", "error: " <> message <> "\n", 1)
      }
  }
}

fn parse_options(
  args: List(String),
  files: List(String),
  options: Options,
) -> Result(#(List(String), Options), String) {
  case args {
    [] -> Ok(#(list.reverse(files), options))
    ["-f", f, ..rest] | ["--format", f, ..rest] ->
      case f {
        "table" | "csv" | "json" ->
          parse_options(rest, files, Options(format: f))
        _ -> Error("unknown format " <> f)
      }
    ["-f"] | ["--format"] -> Error("--format needs a value")
    ["-" <> flag, ..] -> Error("unknown option -" <> flag)
    [file, ..rest] -> parse_options(rest, [file, ..files], options)
  }
}

/// sales.csv -> "sales"; data/q3-report.tsv -> "q3-report".
pub fn sheet_name(path: String) -> String {
  let base = case list.last(string.split(path, "/")) {
    Ok(b) -> b
    Error(_) -> path
  }
  case string.split(base, ".") {
    [single] -> single
    parts -> string.join(list.take(parts, list.length(parts) - 1), ".")
  }
}

pub fn load(
  files: List(String),
  read: fn(String) -> Result(String, String),
) -> Result(Workbook, String) {
  use texts <- result.try(
    list.try_map(files, fn(f) {
      read(f) |> result.map(fn(text) { #(sheet_name(f), separator(f), text) })
    }),
  )
  let names = list.map(texts, fn(t) { t.0 })
  case
    list.length(list.unique(list.map(names, string.lowercase)))
    == list.length(names)
  {
    False -> Error("two files would make sheets with the same name")
    True -> {
      let cells =
        list.flat_map(texts, fn(t) {
          let #(name, sep, text) = t
          csv.parse(text, sep)
          |> list.index_map(fn(row, r) {
            list.index_map(row, fn(input, c) { #(name, c, r, input) })
          })
          |> list.flatten
          |> list.filter(fn(cell) { cell.3 != "" })
        })
      let #(book, _) = workbook.from_cells(names, cells)
      Ok(book)
    }
  }
}

fn separator(path: String) -> String {
  case string.ends_with(string.lowercase(path), ".tsv") {
    True -> "\t"
    False -> ","
  }
}

// ---------------------------------------------------------------------------
// eval
// ---------------------------------------------------------------------------

/// Cell text for a sheet. Tables show 10 significant digits, like a
/// spreadsheet column; CSV keeps all 15.
fn grid(book: Workbook, sheet: String, digits: Int) -> List(List(String)) {
  let #(rows, cols) = workbook.extent(book, sheet)
  int.range(0, rows, [], fn(acc, r) {
    [
      int.range(0, cols, [], fn(acc, c) {
        [value.display(workbook.value(book, sheet, c, r), digits), ..acc]
      })
        |> list.reverse,
      ..acc
    ]
  })
  |> list.reverse
}

fn eval_command(book: Workbook, options: Options) -> Output {
  let sheets = workbook.sheets(book)
  let text = case options.format {
    "csv" ->
      case sheets {
        [only] -> csv.write(grid(book, only, 15))
        _ ->
          list.map(sheets, fn(s) {
            "# " <> s <> "\n" <> csv.write(grid(book, s, 15))
          })
          |> string.join("\n")
      }
    "json" -> json(book)
    _ ->
      list.map(sheets, fn(s) {
        case sheets {
          [_] -> table(grid(book, s, 10))
          _ -> s <> "\n" <> table(grid(book, s, 10))
        }
      })
      |> string.join("\n")
  }
  Output(text, "", 0)
}

/// A grid with column letters and row numbers, right-aligning numbers.
fn table(rows: List(List(String))) -> String {
  let width = list.fold(rows, 0, fn(acc, r) { int.max(acc, list.length(r)) })
  let header =
    int.range(0, width, [], fn(acc, c) { [ast.column_name(c), ..acc] })
    |> list.reverse
  let body = list.index_map(rows, fn(r, i) { [int.to_string(i + 1), ..r] })
  let all = [["", ..header], ..body]
  let widths =
    int.range(0, width + 1, [], fn(acc, c) {
      [
        list.fold(all, 0, fn(m, row) {
          int.max(m, string.length(env.nth(row, c) |> result.unwrap("")))
        }),
        ..acc
      ]
    })
    |> list.reverse
  all
  |> list.map(fn(row) {
    list.index_map(widths, fn(w, c) {
      let cell = env.nth(row, c) |> result.unwrap("")
      case value.parse_number(cell) {
        Ok(_) -> string.pad_start(cell, w, " ")
        Error(_) -> string.pad_end(cell, w, " ")
      }
    })
    |> string.join("  ")
    |> string.trim_end
  })
  |> string.join("\n")
  |> string.append("\n")
}

fn json(book: Workbook) -> String {
  let sheets =
    list.map(workbook.sheets(book), fn(s) {
      let rows =
        grid_values(book, s)
        |> list.map(fn(row) {
          "[" <> string.join(list.map(row, json_value), ",") <> "]"
        })
      json_string(s) <> ":[" <> string.join(rows, ",") <> "]"
    })
  "{" <> string.join(sheets, ",") <> "}\n"
}

fn grid_values(book: Workbook, sheet: String) -> List(List(Value)) {
  let #(rows, cols) = workbook.extent(book, sheet)
  int.range(0, rows, [], fn(acc, r) {
    [
      int.range(0, cols, [], fn(acc, c) {
        [workbook.value(book, sheet, c, r), ..acc]
      })
        |> list.reverse,
      ..acc
    ]
  })
  |> list.reverse
}

pub fn json_value(v: Value) -> String {
  case v {
    value.Number(_) -> value.to_string(v)
    value.Text(s) -> json_string(s)
    value.Boolean(True) -> "true"
    value.Boolean(False) -> "false"
    value.Empty -> "null"
    value.Err(k) ->
      "{\"error\":" <> json_string(value.error_to_string(k)) <> "}"
  }
}

pub fn json_string(s: String) -> String {
  let escaped =
    s
    |> string.replace("\\", "\\\\")
    |> string.replace("\"", "\\\"")
    |> string.replace("\n", "\\n")
    |> string.replace("\r", "\\r")
    |> string.replace("\t", "\\t")
  "\"" <> escaped <> "\""
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

fn check_command(book: Workbook, _: Options) -> Output {
  let problems =
    workbook.cells(book)
    |> list.filter_map(fn(key) {
      let sheet = workbook.sheet_name(book, key.sheet)
      let content = workbook.content(book, sheet, key.col, key.row)
      let v = workbook.value(book, sheet, key.col, key.row)
      case content, v {
        workbook.Broken(input, e), _ ->
          Ok(
            workbook.key_name(book, key)
            <> "  #ERROR!  "
            <> input
            <> "\n    cannot parse: "
            <> e.message
            <> " (at character "
            <> int.to_string(e.position + 1)
            <> ")",
          )
        workbook.Formula(input, _), value.Err(kind) ->
          Ok(
            workbook.key_name(book, key)
            <> "  "
            <> value.error_to_string(kind)
            <> "  "
            <> input
            <> "\n    "
            <> explain_error(book, key, kind),
          )
        _, _ -> Error(Nil)
      }
    })
  case problems {
    [] -> Output("No formula errors.\n", "", 0)
    _ ->
      Output(
        string.join(problems, "\n")
          <> "\n\n"
          <> int.to_string(list.length(problems))
          <> " formula error"
          <> case problems {
          [_] -> ""
          _ -> "s"
        }
          <> "\n",
        "",
        1,
      )
  }
}

fn explain_error(book: Workbook, key: Key, kind: value.ErrorKind) -> String {
  let from =
    workbook.precedents(book, key)
    |> list.flat_map(fn(dep) { dep_cells(book, dep) })
    |> list.find(fn(k) {
      let sheet = workbook.sheet_name(book, k.sheet)
      workbook.value(book, sheet, k.col, k.row) == value.Err(kind)
    })
  case kind, from {
    value.Cycle, _ -> "circular reference: this cell depends on itself"
    _, Ok(k) -> "comes from " <> workbook.key_name(book, k)
    value.Div0, _ -> "division by zero"
    value.NameErr, _ -> "unknown function or name"
    value.RefErr, _ -> "reference to a sheet that does not exist"
    value.Spill, _ ->
      "the array result has no room to spill: cells below or to the right are not empty"
    value.NA, _ -> "value not available (a lookup found no match)"
    value.ValueErr, _ -> "wrong type of argument, or wrong number of arguments"
    value.NumErr, _ -> "invalid number (too large, or no solution)"
    value.Calc, _ -> "the array result is empty"
    _, _ -> value.error_to_string(kind)
  }
}

fn dep_cells(book: Workbook, dep: workbook.Dep) -> List(Key) {
  case dep {
    workbook.OnCell(k) -> [k]
    workbook.OnArea(sheet, range) -> {
      let #(rows, cols) = workbook.extent(book, sheet)
      let bottom = int.min(range.bottom, rows - 1)
      let right = int.min(range.right, cols - 1)
      int.range(range.top, bottom + 1, [], fn(acc, r) {
        int.range(range.left, right + 1, acc, fn(acc, c) {
          [Key(sheet, c, r), ..acc]
        })
      })
      |> list.reverse
    }
  }
}

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

/// "B7" (first sheet) or "Sales!B7".
fn find_cell(book: Workbook, text: String) -> Result(Key, String) {
  let #(sheet, address) = case string.split_once(text, "!") {
    Ok(#(s, a)) -> #(string.replace(s, "'", ""), a)
    Error(_) -> #(list.first(workbook.sheets(book)) |> result.unwrap(""), text)
  }
  case
    ast.parse_cell(address),
    list.find(workbook.sheets(book), fn(s) {
      string.lowercase(s) == string.lowercase(sheet)
    })
  {
    Ok(#(c, r)), Ok(s) -> Ok(Key(string.lowercase(s), c, r))
    Error(_), _ -> Error("not a cell address: " <> text)
    _, Error(_) -> Error("no sheet named " <> sheet)
  }
}

fn explain_command(book: Workbook, cell: String) -> Output {
  case find_cell(book, cell) {
    Error(message) -> Output("", "error: " <> message <> "\n", 2)
    Ok(key) -> Output(explain(book, key) <> "\n", "", 0)
  }
}

/// Where a cell's value comes from, as an indented tree.
pub fn explain(book: Workbook, key: Key) -> String {
  string.join(trace(book, key, "", 0, set.new()).0, "\n")
}

fn describe(book: Workbook, key: Key) -> String {
  let sheet = workbook.sheet_name(book, key.sheet)
  let v = workbook.value(book, sheet, key.col, key.row)
  let shown = case v {
    value.Text(s) -> "\"" <> s <> "\""
    value.Empty -> "(empty)"
    _ -> value.to_string(v)
  }
  let input = workbook.input(book, sheet, key.col, key.row)
  let origin = case workbook.spilled_from(book, key) {
    Ok(anchor) -> "   (spilled from " <> workbook.key_name(book, anchor) <> ")"
    Error(_) ->
      case string.starts_with(input, "=") {
        True -> "   " <> input
        False -> ""
      }
  }
  workbook.key_name(book, key) <> " = " <> shown <> origin
}

const max_depth = 6

const max_listed = 8

fn trace(
  book: Workbook,
  key: Key,
  indent: String,
  depth: Int,
  seen: Set(String),
) -> #(List(String), Set(String)) {
  let line = indent <> describe(book, key)
  let id = workbook.key_name(book, key)
  case set.contains(seen, id) {
    True -> #([line <> "   (shown above)"], seen)
    False -> {
      let seen = set.insert(seen, id)
      let deps = case workbook.spilled_from(book, key) {
        Ok(anchor) -> [workbook.OnCell(anchor)]
        Error(_) -> workbook.precedents(book, key)
      }
      case depth >= max_depth, deps {
        _, [] -> #([line], seen)
        True, _ -> #([line, indent <> "  …"], seen)
        False, _ -> {
          let #(lines, seen) =
            list.fold(deps, #([], seen), fn(acc, dep) {
              let #(lines, seen) = acc
              let #(more, seen) =
                trace_dep(book, dep, indent <> "  ", depth + 1, seen)
              #(list.append(lines, more), seen)
            })
          #([line, ..lines], seen)
        }
      }
    }
  }
}

fn trace_dep(
  book: Workbook,
  dep: workbook.Dep,
  indent: String,
  depth: Int,
  seen: Set(String),
) -> #(List(String), Set(String)) {
  case dep {
    workbook.OnCell(k) -> trace(book, k, indent, depth, seen)
    workbook.OnArea(sheet, range) -> {
      let cells = dep_cells(book, dep)
      let name =
        workbook.sheet_name(book, sheet) <> "!" <> ast.range_name(range)
      let values =
        list.map(cells, fn(k) {
          workbook.value(book, workbook.sheet_name(book, k.sheet), k.col, k.row)
        })
      let numbers =
        list.filter_map(values, fn(v) {
          case v {
            value.Number(x) -> Ok(x)
            _ -> Error(Nil)
          }
        })
      let summary =
        indent
        <> name
        <> "   "
        <> int.to_string(list.length(cells))
        <> " cells, "
        <> int.to_string(list.length(numbers))
        <> " numbers"
        <> case numbers {
          [] -> ""
          _ -> ", sum " <> value.format_number(sum(numbers), 15)
        }
      let computed =
        list.filter(cells, fn(k) {
          let s = workbook.sheet_name(book, k.sheet)
          string.starts_with(workbook.input(book, s, k.col, k.row), "=")
          || result.is_ok(workbook.spilled_from(book, k))
        })
      let already = set.contains(seen, name)
      let seen = set.insert(seen, name)
      let shown = case already {
        True -> []
        False -> list.take(computed, max_listed)
      }
      let #(lines, seen) =
        list.fold(shown, #([], seen), fn(acc, k) {
          let #(lines, seen) = acc
          let #(more, seen) = trace(book, k, indent <> "  ", depth, seen)
          #(list.append(lines, more), seen)
        })
      let extra = case already {
        True -> 0
        False -> list.length(computed) - list.length(shown)
      }
      let summary = case already && computed != [] {
        True -> summary <> "   (shown above)"
        False -> summary
      }
      let lines = case extra > 0 {
        True ->
          list.append(lines, [
            indent <> "  … " <> int.to_string(extra) <> " more computed cells",
          ])
        False -> lines
      }
      #([summary, ..lines], seen)
    }
  }
}

fn sum(xs: List(Float)) -> Float {
  list.fold(xs, 0.0, fn(a, b) { a +. b })
}

// ---------------------------------------------------------------------------
// calc and functions
// ---------------------------------------------------------------------------

fn calc(formula: String) -> Output {
  let formula = case string.starts_with(formula, "=") {
    True -> formula
    False -> "=" <> formula
  }
  case parser.parse(formula) {
    Error(e) ->
      Output(
        "",
        "error: cannot parse: "
          <> e.message
          <> "\n  "
          <> formula
          <> "\n  "
          <> string.repeat(" ", e.position)
          <> "^\n",
        1,
      )
    Ok(expr) ->
      case eval.standalone(expr) {
        env.Scalar(v) -> Output(value.to_string(v) <> "\n", "", 0)
        env.Grid(rows) ->
          Output(
            table(list.map(rows, fn(r) { list.map(r, value.to_string) })),
            "",
            0,
          )
      }
  }
}

fn function_list() -> String {
  let entries = functions.catalogue()
  let groups =
    list.fold(entries, [], fn(acc, e) {
      case list.contains(acc, e.0) {
        True -> acc
        False -> [e.0, ..acc]
      }
    })
    |> list.reverse
  let by_group = list.group(entries, fn(e) { e.0 })
  list.map(groups, fn(g) {
    let items = dict.get(by_group, g) |> result.unwrap([]) |> list.reverse
    g
    <> " ("
    <> int.to_string(list.length(items))
    <> ")\n"
    <> string.join(list.map(items, fn(e) { "  " <> e.2 }), "\n")
  })
  |> string.join("\n\n")
  |> string.append(
    "\n\n" <> int.to_string(list.length(entries)) <> " functions\n",
  )
}
