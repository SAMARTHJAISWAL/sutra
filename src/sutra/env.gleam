//// What a formula evaluates to, and what it can see while evaluating.

import gleam/dict.{type Dict}
import gleam/int
import gleam/list
import sutra/ast.{type Expr}
import sutra/value.{type Value}

/// A formula value: one value, or a grid (rows of columns). A reference to
/// a single cell is a 1x1 grid, which lets functions such as SUM tell
/// "a cell holding text" (ignored) from "a text argument" (coerced).
pub type Val {
  Scalar(Value)
  Grid(List(List(Value)))
}

pub type Env {
  Env(
    /// The sheet the formula lives on (canonical, lower case).
    sheet: String,
    /// Value of a cell: sheet (canonical), column, row.
    get: fn(String, Int, Int) -> Value,
    /// Canonical name of a sheet, if the workbook has it.
    resolve_sheet: fn(String) -> Result(String, Nil),
    /// Used area of a sheet as #(rows, cols), to clip whole-column ranges.
    extent: fn(String) -> #(Int, Int),
    /// LET variables in scope, upper case.
    locals: Dict(String, Val),
    /// The evaluator itself, so function code can evaluate its arguments.
    eval: fn(Expr, Env) -> Val,
  )
}

pub fn eval(env: Env, expr: Expr) -> Val {
  env.eval(expr, env)
}

/// A single value out of a Val: a 1x1 grid unwraps; a bigger grid is
/// only allowed where Excel would implicitly take one value, so it is #VALUE!.
pub fn scalar(v: Val) -> Value {
  case v {
    Scalar(x) -> x
    Grid([[x]]) -> x
    Grid(_) -> value.Err(value.ValueErr)
  }
}

pub fn rows(v: Val) -> List(List(Value)) {
  case v {
    Scalar(x) -> [[x]]
    Grid(r) -> r
  }
}

pub fn dims(v: Val) -> #(Int, Int) {
  case v {
    Scalar(_) -> #(1, 1)
    Grid(rows) ->
      case rows {
        [] -> #(0, 0)
        [first, ..] -> #(list.length(rows), list.length(first))
      }
  }
}

pub fn is_multi(v: Val) -> Bool {
  let #(r, c) = dims(v)
  r * c > 1
}

pub fn flatten(v: Val) -> List(Value) {
  list.flatten(rows(v))
}

pub fn map(v: Val, f: fn(Value) -> Value) -> Val {
  case v {
    Scalar(x) -> Scalar(f(x))
    Grid(rows) -> Grid(list.map(rows, fn(r) { list.map(r, f) }))
  }
}

/// Element (row, col) of a grid broadcast to a bigger shape: a single row
/// or column repeats; anything else out of bounds is #N/A, as in Excel.
pub fn at(rows: List(List(Value)), r: Int, c: Int) -> Value {
  let height = list.length(rows)
  let width = case rows {
    [first, ..] -> list.length(first)
    [] -> 0
  }
  let r = case height == 1 {
    True -> 0
    False -> r
  }
  let c = case width == 1 {
    True -> 0
    False -> c
  }
  case r < height && c < width {
    False -> value.Err(value.NA)
    True ->
      case nth(rows, r) {
        Ok(row) ->
          case nth(row, c) {
            Ok(x) -> x
            Error(_) -> value.Err(value.NA)
          }
        Error(_) -> value.Err(value.NA)
      }
  }
}

pub fn nth(items: List(a), i: Int) -> Result(a, Nil) {
  case i < 0 {
    True -> Error(Nil)
    False -> list.drop(items, i) |> list.first
  }
}

/// Apply `f` element-wise across several values, broadcasting singles.
/// Returns a scalar when nothing is a multi-cell grid.
pub fn lift(args: List(Val), f: fn(List(Value)) -> Value) -> Val {
  case list.any(args, is_multi) {
    False -> Scalar(f(list.map(args, scalar)))
    True -> {
      let shapes = list.map(args, dims)
      let height = list.fold(shapes, 1, fn(acc, d) { int.max(acc, d.0) })
      let width = list.fold(shapes, 1, fn(acc, d) { int.max(acc, d.1) })
      let grids = list.map(args, rows)
      Grid(
        int.range(0, height, [], fn(acc, r) {
          [
            int.range(0, width, [], fn(acc, c) {
              [f(list.map(grids, fn(g) { at(g, r, c) })), ..acc]
            })
              |> list.reverse,
            ..acc
          ]
        })
        |> list.reverse,
      )
    }
  }
}
