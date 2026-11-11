//// The evaluator: operators, references and array broadcasting. Function
//// calls are handed to `sutra/functions`.

import gleam/dict
import gleam/float
import gleam/int
import gleam/list
import gleam/option.{None, Some}
import gleam/order
import sutra/ast.{type Expr}
import sutra/env.{type Env, type Val, Grid, Scalar}
import sutra/functions
import sutra/num
import sutra/value.{type Value, Err, Number, Text}

pub fn evaluate(expr: Expr, ctx: Env) -> Val {
  case expr {
    ast.Num(x) -> Scalar(Number(x))
    ast.Str(s) -> Scalar(Text(s))
    ast.Bool(b) -> Scalar(value.Boolean(b))
    ast.ErrorLit(k) -> Scalar(Err(k))
    ast.Missing -> Scalar(value.Empty)
    ast.Ref(sheet, col, row) ->
      case sheet_of(ctx, sheet) {
        Ok(s) -> Grid([[ctx.get(s, col, row)]])
        Error(_) -> Scalar(Err(value.RefErr))
      }
    ast.Area(sheet, range) ->
      case sheet_of(ctx, sheet) {
        Ok(s) -> Grid(area(ctx, s, range))
        Error(_) -> Scalar(Err(value.RefErr))
      }
    ast.Name(name) ->
      case dict.get(ctx.locals, name) {
        Ok(v) -> v
        Error(_) -> Scalar(Err(value.NameErr))
      }
    ast.Call(name, args) -> functions.call(name, args, ctx)
    ast.Neg(e) ->
      env.lift([evaluate(e, ctx)], fn(xs) {
        let assert [x] = xs
        use n <- num.number(x)
        Number(float.negate(n))
      })
    ast.Percent(e) ->
      env.lift([evaluate(e, ctx)], fn(xs) {
        let assert [x] = xs
        use n <- num.number(x)
        Number(n /. 100.0)
      })
    ast.Binary(op, l, r) -> {
      let left = evaluate(l, ctx)
      let right = evaluate(r, ctx)
      env.lift([left, right], fn(xs) {
        let assert [a, b] = xs
        binary(op, a, b)
      })
    }
    ast.ArrayLit(rows) ->
      Grid(
        list.map(rows, fn(row) {
          list.map(row, fn(e) { env.scalar(evaluate(e, ctx)) })
        }),
      )
  }
}

fn sheet_of(ctx: Env, sheet: option.Option(String)) -> Result(String, Nil) {
  case sheet {
    None -> Ok(ctx.sheet)
    Some(name) -> ctx.resolve_sheet(name)
  }
}

/// The values of a range. Whole columns and rows are clipped to the sheet's
/// used area so that A:A does not materialise a million cells.
pub fn area(ctx: Env, sheet: String, range: ast.Range) -> List(List(Value)) {
  let #(used_rows, used_cols) = ctx.extent(sheet)
  // only whole columns and whole rows are clipped; A1:A10 is always 10 cells
  let bottom = case range.bottom == ast.max_rows - 1 {
    True -> int.max(range.top, int.min(range.bottom, used_rows - 1))
    False -> range.bottom
  }
  let right = case range.right == ast.max_cols - 1 {
    True -> int.max(range.left, int.min(range.right, used_cols - 1))
    False -> range.right
  }
  int.range(range.top, bottom + 1, [], fn(acc, r) {
    [
      int.range(range.left, right + 1, [], fn(acc, c) {
        [ctx.get(sheet, c, r), ..acc]
      })
        |> list.reverse,
      ..acc
    ]
  })
  |> list.reverse
}

pub fn binary(op: ast.BinOp, a: Value, b: Value) -> Value {
  case a, b {
    Err(k), _ -> Err(k)
    _, Err(k) -> Err(k)
    _, _ ->
      case op {
        ast.Add -> arith(a, b, num.add)
        ast.Sub -> arith(a, b, num.sub)
        ast.Mul -> arith(a, b, num.mul)
        ast.Div -> arith(a, b, num.div)
        ast.Pow -> arith(a, b, num.pow)
        ast.Concat -> Text(value.to_string(a) <> value.to_string(b))
        ast.Eq -> value.Boolean(value.compare(a, b) == order.Eq)
        ast.Ne -> value.Boolean(value.compare(a, b) != order.Eq)
        ast.Lt -> value.Boolean(value.compare(a, b) == order.Lt)
        ast.Le -> value.Boolean(value.compare(a, b) != order.Gt)
        ast.Gt -> value.Boolean(value.compare(a, b) == order.Gt)
        ast.Ge -> value.Boolean(value.compare(a, b) != order.Lt)
      }
  }
}

fn arith(
  a: Value,
  b: Value,
  f: fn(Float, Float) -> Result(Float, value.ErrorKind),
) -> Value {
  use x <- num.number(a)
  use y <- num.number(b)
  case f(x, y) {
    Ok(z) -> Number(z)
    Error(k) -> Err(k)
  }
}

/// The value a cell shows for a formula result: a lone reference to an
/// empty cell shows 0, as in Excel.
pub fn cell_result(v: Val) -> Val {
  case v {
    Scalar(value.Empty) -> Scalar(Number(0.0))
    Grid([[value.Empty]]) -> Scalar(Number(0.0))
    Grid([[x]]) -> Scalar(x)
    Grid([]) -> Scalar(Err(value.Calc))
    _ -> v
  }
}

/// Evaluate a formula with no workbook around it: references are #REF!.
pub fn standalone(expr: Expr) -> Val {
  let ctx =
    env.Env(
      sheet: "",
      get: fn(_, _, _) { value.Empty },
      resolve_sheet: fn(_) { Error(Nil) },
      extent: fn(_) { #(0, 0) },
      locals: dict.new(),
      eval: evaluate,
    )
  cell_result(evaluate(expr, ctx))
}
