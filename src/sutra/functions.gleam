//// The function library.
////
//// Three kinds of function live here:
////   - lazy ones (IF, IFERROR, LET, ...) that decide which arguments to
////     evaluate;
////   - scalar ones (LEN, ROUND, DATE, ...) that are lifted element-wise
////     over arrays, so =LEN(A1:A3) returns three lengths;
////   - array ones (SUM, VLOOKUP, SORT, ...) that see whole ranges.

import gleam/dict
import gleam/float
import gleam/int
import gleam/list
import gleam/option.{Some}
import gleam/order
import gleam/result
import gleam/string
import sutra/ast.{type Expr}
import sutra/criteria
import sutra/dates
import sutra/env.{type Env, type Val, Grid, Scalar}
import sutra/format
import sutra/num
import sutra/value.{
  type ErrorKind, type Value, Boolean, Empty, Err, Number, Text,
}

pub fn call(name: String, args: List(Expr), ctx: Env) -> Val {
  case name {
    "IF" -> if_(args, ctx)
    "IFS" -> ifs(args, ctx)
    "IFERROR" -> if_error(args, ctx, fn(_) { True })
    "IFNA" -> if_error(args, ctx, fn(k) { k == value.NA })
    "SWITCH" -> switch(args, ctx)
    "CHOOSE" -> choose(args, ctx)
    "LET" -> let_(args, ctx)
    _ -> eager(name, list.map(args, fn(a) { ctx.eval(a, ctx) }))
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn fail(kind: ErrorKind) -> Val {
  Scalar(Err(kind))
}

fn arity(vals: List(a), min: Int, max: Int, k: fn() -> Val) -> Val {
  let n = list.length(vals)
  case n >= min && n <= max {
    True -> k()
    False -> fail(value.ValueErr)
  }
}

/// A scalar function lifted over arrays.
fn lifted(
  vals: List(Val),
  min: Int,
  max: Int,
  f: fn(List(Value)) -> Value,
) -> Val {
  use <- arity(vals, min, max)
  env.lift(vals, f)
}

fn opt(args: List(Value), i: Int, default: Value) -> Value {
  case env.nth(args, i) {
    Ok(Empty) -> default
    Ok(v) -> v
    Error(_) -> default
  }
}

fn arg(args: List(Value), i: Int) -> Value {
  opt(args, i, Empty)
}

fn number1(
  f: fn(Float) -> Result(Float, ErrorKind),
) -> fn(List(Value)) -> Value {
  fn(args) {
    use x <- num.number(arg(args, 0))
    num.result(f(x))
  }
}

fn boolean(b: Bool) -> Value {
  Boolean(b)
}

/// The numbers SUM-like functions use. A value given directly is coerced
/// (so SUM("2", TRUE) is 3); inside a range only real numbers count and
/// text or logicals are skipped. Errors anywhere win.
fn numbers(vals: List(Val)) -> Result(List(Float), ErrorKind) {
  list.try_fold(vals, [], fn(acc, v) {
    case v {
      Scalar(x) ->
        case value.to_number(x) {
          Ok(n) -> Ok([n, ..acc])
          Error(e) -> Error(e)
        }
      Grid(_) ->
        list.try_fold(env.flatten(v), acc, fn(acc, x) {
          case x {
            Number(n) -> Ok([n, ..acc])
            Err(e) -> Error(e)
            _ -> Ok(acc)
          }
        })
    }
  })
  |> result.map(list.reverse)
}

fn with_numbers(vals: List(Val), k: fn(List(Float)) -> Value) -> Val {
  case numbers(vals) {
    Ok(xs) -> Scalar(k(xs))
    Error(e) -> fail(e)
  }
}

fn sum_value(xs: List(Float)) -> Value {
  num.result(num.sum(xs))
}

fn first_error(values: List(Value)) -> Result(Nil, ErrorKind) {
  case list.find(values, value.is_error) {
    Ok(Err(e)) -> Error(e)
    _ -> Ok(Nil)
  }
}

/// A one-dimensional array: a single row or a single column.
fn vector(v: Val) -> Result(List(Value), ErrorKind) {
  let #(r, c) = env.dims(v)
  case r == 1 || c == 1 {
    True -> Ok(env.flatten(v))
    False -> Error(value.ValueErr)
  }
}

fn to_int(v: Value) -> Result(Int, ErrorKind) {
  case value.to_number(v) {
    Ok(x) ->
      case float.absolute_value(x) >. 1.0e15 {
        True -> Error(value.NumErr)
        False -> Ok(float.truncate(x))
      }
    Error(e) -> Error(e)
  }
}

fn scalar_int(v: Val) -> Result(Int, ErrorKind) {
  to_int(env.scalar(v))
}

fn transpose(rows: List(List(Value))) -> List(List(Value)) {
  list.transpose(rows)
}

fn grid_or_scalar(rows: List(List(Value))) -> Val {
  case rows {
    [] | [[]] -> fail(value.Calc)
    _ -> Grid(rows)
  }
}

// ---------------------------------------------------------------------------
// Lazy functions
// ---------------------------------------------------------------------------

fn if_(args: List(Expr), ctx: Env) -> Val {
  use <- arity(args, 1, 3)
  let cond = ctx.eval(first(args), ctx)
  let then = fn() { branch(args, 1, Boolean(True), ctx) }
  let else_ = fn() { branch(args, 2, Boolean(False), ctx) }
  case env.is_multi(cond) {
    True -> {
      let t = then()
      let e = else_()
      env.lift([cond, t, e], fn(xs) {
        let assert [c, t, e] = xs
        case value.to_bool(c) {
          Ok(True) -> t
          Ok(False) -> e
          Error(k) -> Err(k)
        }
      })
    }
    False ->
      case value.to_bool(env.scalar(cond)) {
        Ok(True) -> then()
        Ok(False) -> else_()
        Error(k) -> fail(k)
      }
  }
}

fn first(args: List(Expr)) -> Expr {
  case args {
    [a, ..] -> a
    [] -> ast.Missing
  }
}

/// Argument `i`, or `default` when it was not written at all. An argument
/// left empty, as in IF(A1,,1), is Empty, which shows as 0.
fn branch(args: List(Expr), i: Int, default: Value, ctx: Env) -> Val {
  case env.nth(args, i) {
    Ok(e) -> ctx.eval(e, ctx)
    Error(_) -> Scalar(default)
  }
}

fn ifs(args: List(Expr), ctx: Env) -> Val {
  case args {
    [] -> fail(value.ValueErr)
    [_] -> fail(value.ValueErr)
    [c, v, ..rest] ->
      case value.to_bool(env.scalar(ctx.eval(c, ctx))) {
        Ok(True) -> ctx.eval(v, ctx)
        Ok(False) ->
          case rest {
            [] -> fail(value.NA)
            _ -> ifs(rest, ctx)
          }
        Error(k) -> fail(k)
      }
  }
}

fn if_error(args: List(Expr), ctx: Env, catches: fn(ErrorKind) -> Bool) -> Val {
  case args {
    [x, alt] -> {
      let v = ctx.eval(x, ctx)
      let caught = fn(val: Value) {
        case val {
          Err(k) -> catches(k)
          _ -> False
        }
      }
      case v {
        Scalar(val) ->
          case caught(val) {
            True -> ctx.eval(alt, ctx)
            False -> v
          }
        Grid(_) ->
          case env.is_multi(v) {
            False ->
              case caught(env.scalar(v)) {
                True -> ctx.eval(alt, ctx)
                False -> v
              }
            True ->
              case list.any(env.flatten(v), caught) {
                False -> v
                True -> {
                  let replacement = env.scalar(ctx.eval(alt, ctx))
                  env.map(v, fn(x) {
                    case caught(x) {
                      True -> replacement
                      False -> x
                    }
                  })
                }
              }
          }
      }
    }
    _ -> fail(value.ValueErr)
  }
}

fn switch(args: List(Expr), ctx: Env) -> Val {
  case args {
    [subject, ..cases] if cases != [] -> {
      let s = env.scalar(ctx.eval(subject, ctx))
      case s {
        Err(k) -> fail(k)
        _ -> switch_cases(s, cases, ctx)
      }
    }
    _ -> fail(value.ValueErr)
  }
}

fn switch_cases(s: Value, cases: List(Expr), ctx: Env) -> Val {
  case cases {
    [] -> fail(value.NA)
    [default] -> ctx.eval(default, ctx)
    [candidate, result, ..rest] -> {
      let c = env.scalar(ctx.eval(candidate, ctx))
      case c {
        Err(k) -> fail(k)
        _ ->
          case same(s, c) {
            True -> ctx.eval(result, ctx)
            False -> switch_cases(s, rest, ctx)
          }
      }
    }
  }
}

/// Equal values of the same kind (1 does not equal "1").
fn same(a: Value, b: Value) -> Bool {
  case a, b {
    Number(_), Number(_) | Text(_), Text(_) | Boolean(_), Boolean(_) ->
      value.compare(a, b) == order.Eq
    Empty, Empty -> True
    _, _ -> False
  }
}

fn choose(args: List(Expr), ctx: Env) -> Val {
  case args {
    [index, ..options] if options != [] ->
      case scalar_int(ctx.eval(index, ctx)) {
        Ok(i) ->
          case env.nth(options, i - 1) {
            Ok(e) -> ctx.eval(e, ctx)
            Error(_) -> fail(value.ValueErr)
          }
        Error(k) -> fail(k)
      }
    _ -> fail(value.ValueErr)
  }
}

fn let_(args: List(Expr), ctx: Env) -> Val {
  case args {
    [body] -> ctx.eval(body, ctx)
    [ast.Name(name), bound, ..rest] if rest != [] -> {
      let v = ctx.eval(bound, ctx)
      let ctx = env.Env(..ctx, locals: dict.insert(ctx.locals, name, v))
      let_(rest, ctx)
    }
    _ -> fail(value.ValueErr)
  }
}

// ---------------------------------------------------------------------------
// Eager functions
// ---------------------------------------------------------------------------

fn eager(name: String, vals: List(Val)) -> Val {
  case name {
    // -- math ---------------------------------------------------------------
    "SUM" -> with_numbers(vals, sum_value)
    "SUMSQ" ->
      with_numbers(vals, fn(xs) {
        list.try_map(xs, fn(x) { num.mul(x, x) })
        |> result.try(num.sum)
        |> num.result
      })
    "PRODUCT" ->
      with_numbers(vals, fn(xs) {
        case xs {
          [] -> Number(0.0)
          _ -> list.try_fold(xs, 1.0, num.mul) |> num.result
        }
      })
    "AVERAGE" -> with_numbers(vals, average)
    "MIN" ->
      with_numbers(vals, fn(xs) {
        Number(list.fold(xs, first_or(xs), float.min))
      })
    "MAX" ->
      with_numbers(vals, fn(xs) {
        Number(list.fold(xs, first_or(xs), float.max))
      })
    "COUNT" -> Scalar(Number(int.to_float(count(vals))))
    "COUNTA" ->
      Scalar(
        Number(
          int.to_float(
            list.fold(vals, 0, fn(acc, v) {
              acc + list.count(env.flatten(v), fn(x) { x != Empty })
            }),
          ),
        ),
      )
    "COUNTBLANK" ->
      Scalar(
        Number(
          int.to_float(
            list.fold(vals, 0, fn(acc, v) {
              acc
              + list.count(env.flatten(v), fn(x) { x == Empty || x == Text("") })
            }),
          ),
        ),
      )
    "ABS" -> lifted(vals, 1, 1, number1(fn(x) { Ok(float.absolute_value(x)) }))
    "SIGN" ->
      lifted(
        vals,
        1,
        1,
        number1(fn(x) {
          Ok(case x >. 0.0, x <. 0.0 {
            True, _ -> 1.0
            _, True -> -1.0
            _, _ -> 0.0
          })
        }),
      )
    "INT" -> lifted(vals, 1, 1, number1(fn(x) { Ok(float.floor(x)) }))
    "ROUND" -> lifted(vals, 1, 2, rounding(num.HalfUp))
    "ROUNDUP" -> lifted(vals, 1, 2, rounding(num.Up))
    "ROUNDDOWN" | "TRUNC" -> lifted(vals, 1, 2, rounding(num.Down))
    "MROUND" ->
      lifted(vals, 2, 2, fn(a) {
        use x <- num.number(arg(a, 0))
        use m <- num.number(arg(a, 1))
        case m == 0.0, x *. m <. 0.0 {
          True, _ -> Number(0.0)
          _, True -> Err(value.NumErr)
          _, _ -> {
            let q = num.round(x /. m, 0, num.HalfUp)
            num.result(num.mul(q, m))
          }
        }
      })
    "CEILING" | "CEILING.MATH" -> lifted(vals, 1, 2, step(float.ceiling))
    "FLOOR" | "FLOOR.MATH" -> lifted(vals, 1, 2, step(float.floor))
    "MOD" ->
      lifted(vals, 2, 2, fn(a) {
        use n <- num.number(arg(a, 0))
        use d <- num.number(arg(a, 1))
        case d == 0.0 {
          True -> Err(value.Div0)
          False -> Number(n -. d *. float.floor(n /. d))
        }
      })
    "QUOTIENT" ->
      lifted(vals, 2, 2, fn(a) {
        use n <- num.number(arg(a, 0))
        use d <- num.number(arg(a, 1))
        case num.div(n, d) {
          Ok(q) -> Number(int.to_float(float.truncate(q)))
          Error(k) -> Err(k)
        }
      })
    "POWER" ->
      lifted(vals, 2, 2, fn(a) {
        use b <- num.number(arg(a, 0))
        use e <- num.number(arg(a, 1))
        num.result(num.pow(b, e))
      })
    "SQRT" -> lifted(vals, 1, 1, number1(num.sqrt))
    "EXP" -> lifted(vals, 1, 1, number1(num.exp))
    "LN" -> lifted(vals, 1, 1, number1(num.ln))
    "LOG10" -> lifted(vals, 1, 1, number1(fn(x) { log(x, 10.0) }))
    "LOG" ->
      lifted(vals, 1, 2, fn(a) {
        use x <- num.number(arg(a, 0))
        use base <- num.number(opt(a, 1, Number(10.0)))
        num.result(log(x, base))
      })
    "PI" -> arity(vals, 0, 0, fn() { Scalar(Number(3.141592653589793)) })
    "FACT" ->
      lifted(vals, 1, 1, fn(a) {
        use n <- num.integer(arg(a, 0))
        case n < 0 || n > 170 {
          True -> Err(value.NumErr)
          False ->
            Number(
              int.range(1, n + 1, 1.0, fn(acc, i) { acc *. int.to_float(i) }),
            )
        }
      })
    "SUMPRODUCT" -> sumproduct(vals)
    "SEQUENCE" -> sequence(vals)
    "TRANSPOSE" ->
      arity(vals, 1, 1, fn() {
        grid_or_scalar(transpose(env.rows(first_val(vals))))
      })

    // -- logic --------------------------------------------------------------
    "TRUE" -> arity(vals, 0, 0, fn() { Scalar(Boolean(True)) })
    "FALSE" -> arity(vals, 0, 0, fn() { Scalar(Boolean(False)) })
    "NOT" ->
      lifted(vals, 1, 1, fn(a) {
        use b <- num.boolean(arg(a, 0))
        Boolean(!b)
      })
    "AND" -> logical(vals, fn(bs) { list.all(bs, fn(b) { b }) })
    "OR" -> logical(vals, fn(bs) { list.any(bs, fn(b) { b }) })
    "XOR" -> logical(vals, fn(bs) { list.count(bs, fn(b) { b }) % 2 == 1 })

    // -- information --------------------------------------------------------
    "ISNUMBER" ->
      is(vals, fn(x) {
        case x {
          Number(_) -> True
          _ -> False
        }
      })
    "ISTEXT" ->
      is(vals, fn(x) {
        case x {
          Text(_) -> True
          _ -> False
        }
      })
    "ISNONTEXT" ->
      is(vals, fn(x) {
        case x {
          Text(_) -> False
          _ -> True
        }
      })
    "ISLOGICAL" ->
      is(vals, fn(x) {
        case x {
          Boolean(_) -> True
          _ -> False
        }
      })
    "ISBLANK" -> is(vals, fn(x) { x == Empty })
    "ISERROR" -> is(vals, value.is_error)
    "ISERR" -> is(vals, fn(x) { value.is_error(x) && x != Err(value.NA) })
    "ISNA" -> is(vals, fn(x) { x == Err(value.NA) })
    "ISEVEN" ->
      lifted(vals, 1, 1, fn(a) {
        use n <- num.integer(arg(a, 0))
        Boolean(int.is_even(n))
      })
    "ISODD" ->
      lifted(vals, 1, 1, fn(a) {
        use n <- num.integer(arg(a, 0))
        Boolean(int.is_odd(n))
      })
    "NA" -> arity(vals, 0, 0, fn() { fail(value.NA) })
    "ROWS" ->
      arity(vals, 1, 1, fn() {
        Scalar(Number(int.to_float(env.dims(first_val(vals)).0)))
      })
    "COLUMNS" ->
      arity(vals, 1, 1, fn() {
        Scalar(Number(int.to_float(env.dims(first_val(vals)).1)))
      })

    // -- text ---------------------------------------------------------------
    "LEN" ->
      lifted(vals, 1, 1, fn(a) {
        use s <- num.text(arg(a, 0))
        Number(int.to_float(string.length(s)))
      })
    "LEFT" ->
      lifted(vals, 1, 2, fn(a) {
        use s <- num.text(arg(a, 0))
        use n <- num.integer(opt(a, 1, Number(1.0)))
        case n < 0 {
          True -> Err(value.ValueErr)
          False -> Text(string.slice(s, 0, n))
        }
      })
    "RIGHT" ->
      lifted(vals, 1, 2, fn(a) {
        use s <- num.text(arg(a, 0))
        use n <- num.integer(opt(a, 1, Number(1.0)))
        case n < 0 {
          True -> Err(value.ValueErr)
          False -> {
            let len = string.length(s)
            Text(string.drop_start(s, int.max(0, len - n)))
          }
        }
      })
    "MID" ->
      lifted(vals, 3, 3, fn(a) {
        use s <- num.text(arg(a, 0))
        use start <- num.integer(arg(a, 1))
        use n <- num.integer(arg(a, 2))
        case start < 1 || n < 0 {
          True -> Err(value.ValueErr)
          False -> Text(string.slice(s, start - 1, n))
        }
      })
    "UPPER" -> text1(vals, string.uppercase)
    "LOWER" -> text1(vals, string.lowercase)
    "PROPER" -> text1(vals, proper)
    "TRIM" -> text1(vals, trim)
    "CLEAN" ->
      text1(vals, fn(s) {
        string.replace(string.replace(s, "\n", ""), "\r", "")
      })
    "CONCATENATE" ->
      lifted(vals, 1, 255, fn(a) {
        case list.try_map(a, value.to_text) {
          Ok(parts) -> Text(string.concat(parts))
          Error(k) -> Err(k)
        }
      })
    "CONCAT" ->
      case list.try_map(list.flat_map(vals, env.flatten), value.to_text) {
        Ok(parts) -> Scalar(Text(string.concat(parts)))
        Error(k) -> fail(k)
      }
    "TEXTJOIN" -> textjoin(vals)
    "SUBSTITUTE" ->
      lifted(vals, 3, 4, fn(a) {
        use s <- num.text(arg(a, 0))
        use old <- num.text(arg(a, 1))
        use new <- num.text(arg(a, 2))
        case env.nth(a, 3) {
          Ok(n) -> {
            use n <- num.integer(n)
            case n < 1 {
              True -> Err(value.ValueErr)
              False -> Text(substitute_nth(s, old, new, n))
            }
          }
          Error(_) ->
            case old {
              "" -> Text(s)
              _ -> Text(string.replace(s, old, new))
            }
        }
      })
    "REPLACE" ->
      lifted(vals, 4, 4, fn(a) {
        use s <- num.text(arg(a, 0))
        use start <- num.integer(arg(a, 1))
        use n <- num.integer(arg(a, 2))
        use new <- num.text(arg(a, 3))
        case start < 1 || n < 0 {
          True -> Err(value.ValueErr)
          False ->
            Text(
              string.slice(s, 0, start - 1)
              <> new
              <> string.drop_start(s, start - 1 + n),
            )
        }
      })
    "FIND" -> lifted(vals, 2, 3, find(fn(s) { s }))
    "SEARCH" -> lifted(vals, 2, 3, find(string.lowercase))
    "REPT" ->
      lifted(vals, 2, 2, fn(a) {
        use s <- num.text(arg(a, 0))
        use n <- num.integer(arg(a, 1))
        case n < 0 || n * string.length(s) > 32_767 {
          True -> Err(value.ValueErr)
          False -> Text(string.repeat(s, n))
        }
      })
    "EXACT" ->
      lifted(vals, 2, 2, fn(a) {
        use x <- num.text(arg(a, 0))
        use y <- num.text(arg(a, 1))
        Boolean(x == y)
      })
    "VALUE" ->
      lifted(vals, 1, 1, fn(a) {
        case arg(a, 0) {
          Number(x) -> Number(x)
          Text(s) ->
            case value.parse_number(s) {
              Ok(x) -> Number(x)
              Error(_) -> Err(value.ValueErr)
            }
          Empty -> Number(0.0)
          Err(k) -> Err(k)
          Boolean(_) -> Err(value.ValueErr)
        }
      })
    "TEXT" ->
      lifted(vals, 2, 2, fn(a) {
        use code <- num.text(arg(a, 1))
        case arg(a, 0) {
          Text(s) ->
            case value.parse_number(s) {
              Ok(x) -> format_text(x, code)
              Error(_) -> Text(s)
            }
          v -> {
            use x <- num.number(v)
            format_text(x, code)
          }
        }
      })
    "FIXED" ->
      lifted(vals, 1, 3, fn(a) {
        use x <- num.number(arg(a, 0))
        use d <- num.integer(opt(a, 1, Number(2.0)))
        use no_commas <- num.boolean(opt(a, 2, Boolean(False)))
        let x = num.round(x, d, num.HalfUp)
        let body = format.fixed(x, int.max(d, 0), int.max(d, 0), 1, !no_commas)
        case x <. 0.0 {
          True -> Text("-" <> body)
          False -> Text(body)
        }
      })
    "CHAR" ->
      lifted(vals, 1, 1, fn(a) {
        use n <- num.integer(arg(a, 0))
        case n >= 1 && n <= 255, string.utf_codepoint(n) {
          True, Ok(cp) -> Text(string.from_utf_codepoints([cp]))
          _, _ -> Err(value.ValueErr)
        }
      })
    "CODE" ->
      lifted(vals, 1, 1, fn(a) {
        use s <- num.text(arg(a, 0))
        case string.to_utf_codepoints(s) {
          [cp, ..] -> Number(int.to_float(string.utf_codepoint_to_int(cp)))
          [] -> Err(value.ValueErr)
        }
      })

    // -- dates --------------------------------------------------------------
    "DATE" ->
      lifted(vals, 3, 3, fn(a) {
        use y <- num.integer(arg(a, 0))
        use m <- num.integer(arg(a, 1))
        use d <- num.integer(arg(a, 2))
        case dates.serial(y, m, d) {
          Ok(n) -> Number(int.to_float(n))
          Error(_) -> Err(value.NumErr)
        }
      })
    "YEAR" -> date_part(vals, fn(ymd) { ymd.0 })
    "MONTH" -> date_part(vals, fn(ymd) { ymd.1 })
    "DAY" -> date_part(vals, fn(ymd) { ymd.2 })
    "WEEKDAY" ->
      lifted(vals, 1, 2, fn(a) {
        use n <- serial_arg(arg(a, 0))
        use kind <- num.integer(opt(a, 1, Number(1.0)))
        let sunday_first = dates.weekday(n)
        case kind {
          1 -> Number(int.to_float(sunday_first))
          2 -> Number(int.to_float({ sunday_first + 5 } % 7 + 1))
          3 -> Number(int.to_float({ sunday_first + 5 } % 7))
          _ -> Err(value.NumErr)
        }
      })
    "EDATE" -> lifted(vals, 2, 2, shift_months(False))
    "EOMONTH" -> lifted(vals, 2, 2, shift_months(True))
    "DAYS" ->
      lifted(vals, 2, 2, fn(a) {
        use end <- serial_arg(arg(a, 0))
        use start <- serial_arg(arg(a, 1))
        Number(int.to_float(end - start))
      })
    "DATEDIF" -> lifted(vals, 3, 3, datedif)
    "DATEVALUE" ->
      lifted(vals, 1, 1, fn(a) {
        use s <- num.text(arg(a, 0))
        case parse_iso_date(s) {
          Ok(n) -> Number(int.to_float(n))
          Error(_) -> Err(value.ValueErr)
        }
      })

    // -- lookup -------------------------------------------------------------
    "VLOOKUP" -> vlookup(vals, False)
    "HLOOKUP" -> vlookup(vals, True)
    "XLOOKUP" -> xlookup(vals)
    "MATCH" -> match_(vals)
    "XMATCH" -> xmatch(vals)
    "INDEX" -> index(vals)

    // -- conditional aggregates --------------------------------------------
    "SUMIF" -> sumif(vals, sum_value)
    "AVERAGEIF" -> sumif(vals, average)
    "COUNTIF" -> countif(vals)
    "SUMIFS" -> ifs_aggregate(vals, sum_value)
    "AVERAGEIFS" -> ifs_aggregate(vals, average)
    "MAXIFS" ->
      ifs_aggregate(vals, fn(xs) {
        Number(list.fold(xs, first_or(xs), float.max))
      })
    "MINIFS" ->
      ifs_aggregate(vals, fn(xs) {
        Number(list.fold(xs, first_or(xs), float.min))
      })
    "COUNTIFS" -> countifs(vals)

    // -- statistics ---------------------------------------------------------
    "MEDIAN" -> with_numbers(vals, fn(xs) { percentile_of(xs, 0.5) })
    "MODE" | "MODE.SNGL" -> with_numbers(vals, mode)
    "STDEV" | "STDEV.S" -> with_numbers(vals, fn(xs) { stdev(xs, True) })
    "STDEVP" | "STDEV.P" -> with_numbers(vals, fn(xs) { stdev(xs, False) })
    "VAR" | "VAR.S" -> with_numbers(vals, fn(xs) { variance(xs, True) })
    "VARP" | "VAR.P" -> with_numbers(vals, fn(xs) { variance(xs, False) })
    "LARGE" -> kth(vals, True)
    "SMALL" -> kth(vals, False)
    "RANK" | "RANK.EQ" -> rank(vals)
    "PERCENTILE" | "PERCENTILE.INC" -> percentile(vals, 1.0)
    "QUARTILE" | "QUARTILE.INC" -> percentile(vals, 4.0)
    "CORREL" -> correl(vals)
    "AVERAGEA" ->
      case
        list.try_fold(vals, [], fn(acc, v) {
          list.try_fold(env.flatten(v), acc, fn(acc, x) {
            case x {
              Empty -> Ok(acc)
              Err(k) -> Error(k)
              Number(n) -> Ok([n, ..acc])
              Boolean(True) -> Ok([1.0, ..acc])
              _ -> Ok([0.0, ..acc])
            }
          })
        })
      {
        Ok(xs) -> Scalar(average(xs))
        Error(k) -> fail(k)
      }

    // -- finance ------------------------------------------------------------
    "PMT" -> lifted(vals, 3, 5, finance(pmt))
    "PV" -> lifted(vals, 3, 5, finance(pv))
    "FV" -> lifted(vals, 3, 5, finance(fv))
    "NPER" -> lifted(vals, 3, 5, finance(nper))
    "NPV" ->
      case vals {
        [rate, ..flows] if flows != [] ->
          case value.to_number(env.scalar(rate)), numbers(flows) {
            Ok(r), Ok(xs) -> Scalar(num.result(npv(r, xs, 1)))
            Error(k), _ | _, Error(k) -> fail(k)
          }
        _ -> fail(value.ValueErr)
      }
    "IRR" ->
      case vals {
        [flows] -> irr(flows, 0.1)
        [flows, guess] ->
          case value.to_number(env.scalar(guess)) {
            Ok(g) -> irr(flows, g)
            Error(k) -> fail(k)
          }
        _ -> fail(value.ValueErr)
      }

    // -- dynamic arrays -----------------------------------------------------
    "SORT" -> sort(vals)
    "UNIQUE" -> unique(vals)
    "FILTER" -> filter(vals)

    _ -> fail(value.NameErr)
  }
}

fn first_val(vals: List(Val)) -> Val {
  case vals {
    [v, ..] -> v
    [] -> Scalar(Empty)
  }
}

fn first_or(xs: List(Float)) -> Float {
  case xs {
    [x, ..] -> x
    [] -> 0.0
  }
}

fn average(xs: List(Float)) -> Value {
  case xs {
    [] -> Err(value.Div0)
    _ ->
      case num.sum(xs) {
        Ok(s) -> num.result(num.div(s, int.to_float(list.length(xs))))
        Error(k) -> Err(k)
      }
  }
}

fn count(vals: List(Val)) -> Int {
  list.fold(vals, 0, fn(acc, v) {
    case v {
      Scalar(Number(_)) | Scalar(Boolean(_)) -> acc + 1
      Scalar(Text(s)) ->
        case value.parse_number(s) {
          Ok(_) -> acc + 1
          Error(_) -> acc
        }
      Scalar(_) -> acc
      Grid(_) ->
        acc
        + list.count(env.flatten(v), fn(x) {
          case x {
            Number(_) -> True
            _ -> False
          }
        })
    }
  })
}

fn log(x: Float, base: Float) -> Result(Float, ErrorKind) {
  case x <=. 0.0 || base <=. 0.0 {
    True -> Error(value.NumErr)
    False -> {
      use a <- result.try(num.ln(x))
      use b <- result.try(num.ln(base))
      num.div(a, b)
    }
  }
}

fn rounding(mode: num.Rounding) -> fn(List(Value)) -> Value {
  fn(a) {
    use x <- num.number(arg(a, 0))
    use places <- num.integer(opt(a, 1, Number(0.0)))
    Number(num.round(x, places, mode))
  }
}

fn step(f: fn(Float) -> Float) -> fn(List(Value)) -> Value {
  fn(a) {
    use x <- num.number(arg(a, 0))
    use sig <- num.number(opt(a, 1, Number(1.0)))
    case sig == 0.0, x >. 0.0 && sig <. 0.0 {
      True, _ -> Number(0.0)
      _, True -> Err(value.NumErr)
      _, _ -> {
        let q = x /. sig
        let q = num.round(q, 12, num.HalfUp)
        num.result(num.mul(f(q), sig))
      }
    }
  }
}

fn logical(vals: List(Val), combine: fn(List(Bool)) -> Bool) -> Val {
  let collected =
    list.try_fold(vals, [], fn(acc, v) {
      case v {
        Scalar(x) ->
          case value.to_bool(x) {
            Ok(b) -> Ok([b, ..acc])
            Error(k) -> Error(k)
          }
        Grid(_) ->
          list.try_fold(env.flatten(v), acc, fn(acc, x) {
            case x {
              Boolean(b) -> Ok([b, ..acc])
              Number(n) -> Ok([n != 0.0, ..acc])
              Err(k) -> Error(k)
              _ -> Ok(acc)
            }
          })
      }
    })
  case collected {
    Ok([]) -> fail(value.ValueErr)
    Ok(bs) -> Scalar(Boolean(combine(bs)))
    Error(k) -> fail(k)
  }
}

fn is(vals: List(Val), check: fn(Value) -> Bool) -> Val {
  lifted(vals, 1, 1, fn(a) { boolean(check(arg(a, 0))) })
}

fn text1(vals: List(Val), f: fn(String) -> String) -> Val {
  lifted(vals, 1, 1, fn(a) {
    use s <- num.text(arg(a, 0))
    Text(f(s))
  })
}

fn proper(s: String) -> String {
  let #(out, _) =
    list.fold(string.to_graphemes(s), #("", False), fn(acc, c) {
      let #(out, in_word) = acc
      let is_letter = string.lowercase(c) != string.uppercase(c)
      let c = case is_letter, in_word {
        True, False -> string.uppercase(c)
        True, True -> string.lowercase(c)
        False, _ -> c
      }
      #(out <> c, is_letter)
    })
  out
}

fn trim(s: String) -> String {
  s
  |> string.split(" ")
  |> list.filter(fn(w) { w != "" })
  |> string.join(" ")
}

fn substitute_nth(s: String, old: String, new: String, n: Int) -> String {
  case old {
    "" -> s
    _ -> {
      let pieces = string.split(s, old)
      case list.length(pieces) > n {
        False -> s
        True -> {
          let #(before, after) = list.split(pieces, n)
          string.join(before, old) <> new <> string.join(after, old)
        }
      }
    }
  }
}

fn find(normalise: fn(String) -> String) -> fn(List(Value)) -> Value {
  fn(a) {
    use needle <- num.text(arg(a, 0))
    use hay <- num.text(arg(a, 1))
    use start <- num.integer(opt(a, 2, Number(1.0)))
    let len = string.length(hay)
    case start < 1 || start > len + 1 {
      True -> Err(value.ValueErr)
      False -> {
        let rest = normalise(string.drop_start(hay, start - 1))
        case needle {
          "" -> Number(int.to_float(start))
          _ ->
            case string.split_once(rest, normalise(needle)) {
              Ok(#(before, _)) ->
                Number(int.to_float(start + string.length(before)))
              Error(_) -> Err(value.ValueErr)
            }
        }
      }
    }
  }
}

fn textjoin(vals: List(Val)) -> Val {
  case vals {
    [delim, skip, ..items] if items != [] -> {
      let d = value.to_text(env.scalar(delim))
      let s = value.to_bool(env.scalar(skip))
      case d, s {
        Ok(d), Ok(skip_empty) ->
          case list.try_map(list.flat_map(items, env.flatten), value.to_text) {
            Ok(parts) -> {
              let parts = case skip_empty {
                True -> list.filter(parts, fn(p) { p != "" })
                False -> parts
              }
              Scalar(Text(string.join(parts, d)))
            }
            Error(k) -> fail(k)
          }
        Error(k), _ | _, Error(k) -> fail(k)
      }
    }
    _ -> fail(value.ValueErr)
  }
}

fn format_text(x: Float, code: String) -> Value {
  case format.text(x, code) {
    Ok(s) -> Text(s)
    Error(_) -> Err(value.ValueErr)
  }
}

// -- dates --------------------------------------------------------------------

fn serial_arg(v: Value, k: fn(Int) -> Value) -> Value {
  use x <- num.number(v)
  case x <. 0.0 || x >. 2_958_465.0 {
    True -> Err(value.NumErr)
    False -> k(float.truncate(x))
  }
}

fn date_part(vals: List(Val), pick: fn(#(Int, Int, Int)) -> Int) -> Val {
  lifted(vals, 1, 1, fn(a) {
    use n <- serial_arg(arg(a, 0))
    Number(int.to_float(pick(dates.ymd(n))))
  })
}

fn shift_months(end_of_month: Bool) -> fn(List(Value)) -> Value {
  fn(a) {
    use n <- serial_arg(arg(a, 0))
    use months <- num.integer(arg(a, 1))
    let #(y, m, d) = dates.ymd(n)
    let total = y * 12 + m - 1 + months
    let y2 = total / 12
    let m2 = total % 12 + 1
    let last = dates.days_in_month(y2, m2)
    let d2 = case end_of_month {
      True -> last
      False -> int.min(d, last)
    }
    case total < 0, dates.serial(y2, m2, d2) {
      False, Ok(s) -> Number(int.to_float(s))
      _, _ -> Err(value.NumErr)
    }
  }
}

fn datedif(a: List(Value)) -> Value {
  use start <- serial_arg(arg(a, 0))
  use end <- serial_arg(arg(a, 1))
  use unit <- num.text(arg(a, 2))
  case start > end {
    True -> Err(value.NumErr)
    False -> {
      let #(y1, m1, d1) = dates.ymd(start)
      let #(y2, m2, d2) = dates.ymd(end)
      let months =
        { y2 - y1 }
        * 12
        + m2
        - m1
        - case d2 < d1 {
          True -> 1
          False -> 0
        }
      case string.uppercase(unit) {
        "D" -> Number(int.to_float(end - start))
        "M" -> Number(int.to_float(months))
        "Y" -> Number(int.to_float(months / 12))
        "YM" -> Number(int.to_float(months % 12))
        "MD" ->
          case d2 >= d1 {
            True -> Number(int.to_float(d2 - d1))
            False -> {
              let #(py, pm) = case m2 == 1 {
                True -> #(y2 - 1, 12)
                False -> #(y2, m2 - 1)
              }
              Number(int.to_float(dates.days_in_month(py, pm) - d1 + d2))
            }
          }
        _ -> Err(value.NumErr)
      }
    }
  }
}

/// "2024-01-31" or "2024/1/31".
fn parse_iso_date(s: String) -> Result(Int, Nil) {
  let parts = case string.contains(s, "-") {
    True -> string.split(string.trim(s), "-")
    False -> string.split(string.trim(s), "/")
  }
  case list.try_map(parts, int.parse) {
    Ok([y, m, d]) if y >= 1900 && m >= 1 && m <= 12 && d >= 1 ->
      case d <= dates.days_in_month(y, m) {
        True -> dates.serial(y, m, d)
        False -> Error(Nil)
      }
    _ -> Error(Nil)
  }
}

// -- lookup -------------------------------------------------------------------

/// Exact-match test used by the lookup functions. Text compares without
/// case and honours wildcards when asked; blank cells never match.
fn lookup_equal(needle: Value, cell: Value, wildcards: Bool) -> Bool {
  case needle, cell {
    _, Empty -> False
    Text(p), Text(s) if wildcards -> criteria.wildcard(p, s)
    _, _ -> same(needle, cell)
  }
}

fn comparable(a: Value, b: Value) -> Bool {
  case a, b {
    Number(_), Number(_) | Text(_), Text(_) | Boolean(_), Boolean(_) -> True
    _, _ -> False
  }
}

type Approx {
  Exact
  NextSmaller
  NextLarger
}

/// Position (0-based) of `needle` in `items`.
fn position(
  needle: Value,
  items: List(Value),
  mode: Approx,
  wildcards: Bool,
  reverse: Bool,
) -> Result(Int, Nil) {
  let indexed = list.index_map(items, fn(x, i) { #(x, i) })
  let ordered = case reverse {
    True -> list.reverse(indexed)
    False -> indexed
  }
  case list.find(ordered, fn(p) { lookup_equal(needle, p.0, wildcards) }) {
    Ok(#(_, i)) -> Ok(i)
    Error(_) ->
      case mode {
        Exact -> Error(Nil)
        NextSmaller -> best(indexed, needle, order.Lt)
        NextLarger -> best(indexed, needle, order.Gt)
      }
  }
}

/// The closest item on the given side of `needle` (Lt: largest smaller
/// value; Gt: smallest larger value). Ties go to the last one, as Excel's
/// approximate match does on sorted data.
fn best(
  indexed: List(#(Value, Int)),
  needle: Value,
  side: order.Order,
) -> Result(Int, Nil) {
  list.fold(indexed, Error(Nil), fn(acc, p) {
    let #(x, i) = p
    case comparable(x, needle) && value.compare(x, needle) == side {
      False -> acc
      True ->
        case acc {
          Error(_) -> Ok(#(x, i))
          Ok(#(y, _)) ->
            case value.compare(x, y) {
              order.Eq -> Ok(#(x, i))
              o if o == side -> acc
              _ -> Ok(#(x, i))
            }
        }
    }
  })
  |> result.map(fn(p) { p.1 })
}

fn vlookup(vals: List(Val), horizontal: Bool) -> Val {
  use <- arity(vals, 3, 4)
  let assert [needle, table, col, ..rest] = vals
  let needle = env.scalar(needle)
  let approx = case rest {
    [a] -> value.to_bool(env.scalar(a))
    _ -> Ok(True)
  }
  let rows = case horizontal {
    True -> transpose(env.rows(table))
    False -> env.rows(table)
  }
  case needle, scalar_int(col), approx {
    Err(k), _, _ -> fail(k)
    _, Error(k), _ | _, _, Error(k) -> fail(k)
    _, Ok(c), Ok(approx) -> {
      let width = case rows {
        [r, ..] -> list.length(r)
        [] -> 0
      }
      case c < 1, c > width {
        True, _ -> fail(value.ValueErr)
        _, True -> fail(value.RefErr)
        _, _ -> {
          let keys =
            list.map(rows, fn(r) { list.first(r) |> result.unwrap(Empty) })
          let mode = case approx {
            True -> NextSmaller
            False -> Exact
          }
          case position(needle, keys, mode, !approx, False) {
            Ok(i) -> {
              let assert Ok(row) = env.nth(rows, i)
              Scalar(env.nth(row, c - 1) |> result.unwrap(Empty))
            }
            Error(_) -> fail(value.NA)
          }
        }
      }
    }
  }
}

fn xlookup(vals: List(Val)) -> Val {
  use <- arity(vals, 3, 6)
  let assert [needle, keys_val, results, ..rest] = vals
  let needle = env.scalar(needle)
  let if_missing = case rest {
    [m, ..] ->
      case m {
        Scalar(Empty) -> Error(Nil)
        _ -> Ok(m)
      }
    [] -> Error(Nil)
  }
  let match_mode = case env.nth(rest, 1) {
    Ok(v) -> scalar_int(v)
    Error(_) -> Ok(0)
  }
  let search_mode = case env.nth(rest, 2) {
    Ok(v) -> scalar_int(v)
    Error(_) -> Ok(1)
  }
  let #(kr, kc) = env.dims(keys_val)
  let #(rr, rc) = env.dims(results)
  case needle, vector(keys_val), match_mode, search_mode {
    Err(k), _, _, _ -> fail(k)
    _, Error(k), _, _ | _, _, Error(k), _ | _, _, _, Error(k) -> fail(k)
    _, Ok(keys), Ok(mm), Ok(sm) -> {
      let mode = case mm {
        -1 -> Ok(NextSmaller)
        1 -> Ok(NextLarger)
        0 | 2 -> Ok(Exact)
        _ -> Error(Nil)
      }
      let vertical = kc == 1 && kr > 1 || kr == 1 && kc == 1 && rr > 1
      let fits = case vertical {
        True -> rr == kr
        False -> rc == kc
      }
      case mode, fits, sm == 1 || sm == -1 {
        Ok(mode), True, True ->
          case position(needle, keys, mode, mm == 2, sm == -1) {
            Ok(i) ->
              case vertical {
                True -> pick_row(env.rows(results), i)
                False -> pick_row(transpose(env.rows(results)), i) |> as_column
              }
            Error(_) ->
              case if_missing {
                Ok(v) -> v
                Error(_) -> fail(value.NA)
              }
          }
        _, _, _ -> fail(value.ValueErr)
      }
    }
  }
}

fn pick_row(rows: List(List(Value)), i: Int) -> Val {
  case env.nth(rows, i) {
    Ok([x]) -> Scalar(x)
    Ok(row) -> Grid([row])
    Error(_) -> fail(value.NA)
  }
}

fn as_column(v: Val) -> Val {
  case v {
    Grid([row]) -> Grid(list.map(row, fn(x) { [x] }))
    _ -> v
  }
}

fn match_(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 3)
  let assert [needle, items, ..rest] = vals
  let kind = case rest {
    [k] -> scalar_int(k)
    _ -> Ok(1)
  }
  case env.scalar(needle), vector(items), kind {
    Err(k), _, _ -> fail(k)
    _, Error(k), _ | _, _, Error(k) -> fail(k)
    n, Ok(xs), Ok(kind) -> {
      let mode = case kind {
        0 -> Exact
        k if k > 0 -> NextSmaller
        _ -> NextLarger
      }
      case position(n, xs, mode, kind == 0, False) {
        Ok(i) -> Scalar(Number(int.to_float(i + 1)))
        Error(_) -> fail(value.NA)
      }
    }
  }
}

fn xmatch(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 4)
  let assert [needle, items, ..rest] = vals
  let mm = case rest {
    [m, ..] -> scalar_int(m)
    [] -> Ok(0)
  }
  let sm = case env.nth(rest, 1) {
    Ok(s) -> scalar_int(s)
    Error(_) -> Ok(1)
  }
  case env.scalar(needle), vector(items), mm, sm {
    Err(k), _, _, _ -> fail(k)
    _, Error(k), _, _ | _, _, Error(k), _ | _, _, _, Error(k) -> fail(k)
    n, Ok(xs), Ok(mm), Ok(sm) -> {
      let mode = case mm {
        -1 -> NextSmaller
        1 -> NextLarger
        _ -> Exact
      }
      case position(n, xs, mode, mm == 2, sm == -1) {
        Ok(i) -> Scalar(Number(int.to_float(i + 1)))
        Error(_) -> fail(value.NA)
      }
    }
  }
}

fn index(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 3)
  let assert [array, r, ..rest] = vals
  let rows = env.rows(array)
  let #(height, width) = env.dims(array)
  let c = case rest {
    [c] -> scalar_int(c)
    _ -> Ok(-1)
  }
  case scalar_int(r), c {
    Error(k), _ | _, Error(k) -> fail(k)
    Ok(r), Ok(c) -> {
      // INDEX(row_vector, n) picks the nth column
      let #(r, c) = case c == -1, height == 1 && width > 1 {
        True, True -> #(1, r)
        True, False -> #(r, 1)
        False, _ -> #(r, c)
      }
      case r < 0 || c < 0 || r > height || c > width {
        True -> fail(value.RefErr)
        False ->
          case r, c {
            0, 0 -> Grid(rows)
            0, _ -> Grid(list.map(rows, fn(row) { [env.at([row], 0, c - 1)] }))
            _, 0 -> pick_row(rows, r - 1)
            _, _ -> Scalar(env.at(rows, r - 1, c - 1))
          }
      }
    }
  }
}

// -- conditional aggregates -----------------------------------------------------

fn sumif(vals: List(Val), aggregate: fn(List(Float)) -> Value) -> Val {
  use <- arity(vals, 2, 3)
  let assert [range, crit, ..rest] = vals
  let target = case rest {
    [t] -> t
    _ -> range
  }
  conditional(target, [#(range, crit)], aggregate)
}

fn ifs_aggregate(vals: List(Val), aggregate: fn(List(Float)) -> Value) -> Val {
  case vals {
    [target, ..pairs] ->
      case list.length(pairs) >= 2 && list.length(pairs) % 2 == 0 {
        False -> fail(value.ValueErr)
        True -> conditional(target, pairs_of(pairs), aggregate)
      }
    [] -> fail(value.ValueErr)
  }
}

fn pairs_of(xs: List(a)) -> List(#(a, a)) {
  case xs {
    [a, b, ..rest] -> [#(a, b), ..pairs_of(rest)]
    _ -> []
  }
}

/// Indexes (into the flattened ranges) of cells meeting every criterion.
fn selected(
  pairs: List(#(Val, Val)),
  size: #(Int, Int),
) -> Result(List(Bool), ErrorKind) {
  list.try_fold(pairs, list.repeat(True, size.0 * size.1), fn(acc, pair) {
    let #(range, crit) = pair
    case env.dims(range) == size {
      False -> Error(value.ValueErr)
      True -> {
        let c = env.scalar(crit)
        case c {
          Err(k) -> Error(k)
          _ -> {
            let c = criteria.parse(c)
            Ok(
              list.map2(acc, env.flatten(range), fn(keep, cell) {
                keep && criteria.matches(c, cell)
              }),
            )
          }
        }
      }
    }
  })
}

fn conditional(
  target: Val,
  pairs: List(#(Val, Val)),
  aggregate: fn(List(Float)) -> Value,
) -> Val {
  let size = env.dims(target)
  case selected(pairs, size) {
    Error(k) -> fail(k)
    Ok(keep) -> {
      let picked =
        list.map2(keep, env.flatten(target), fn(k, x) { #(k, x) })
        |> list.filter(fn(p) { p.0 })
        |> list.map(fn(p) { p.1 })
      case first_error(picked) {
        Error(k) -> fail(k)
        Ok(_) ->
          Scalar(
            aggregate(
              list.filter_map(picked, fn(x) {
                case x {
                  Number(n) -> Ok(n)
                  _ -> Error(Nil)
                }
              }),
            ),
          )
      }
    }
  }
}

fn countif(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 2)
  let assert [range, crit] = vals
  countifs([range, crit])
}

fn countifs(vals: List(Val)) -> Val {
  case vals {
    [first_range, ..] if vals != [] ->
      case list.length(vals) % 2 == 0 {
        False -> fail(value.ValueErr)
        True ->
          case selected(pairs_of(vals), env.dims(first_range)) {
            Ok(keep) ->
              Scalar(Number(int.to_float(list.count(keep, fn(k) { k }))))
            Error(k) -> fail(k)
          }
      }
    _ -> fail(value.ValueErr)
  }
}

// -- statistics ---------------------------------------------------------------

fn sorted(xs: List(Float)) -> List(Float) {
  list.sort(xs, float.compare)
}

fn percentile_of(xs: List(Float), k: Float) -> Value {
  case sorted(xs) {
    [] -> Err(value.NumErr)
    s -> {
      let n = list.length(s)
      let pos = k *. int.to_float(n - 1)
      let lo = float.truncate(pos)
      let frac = pos -. int.to_float(lo)
      let a = env.nth(s, lo) |> result.unwrap(0.0)
      let b = env.nth(s, int.min(lo + 1, n - 1)) |> result.unwrap(a)
      Number(a +. frac *. { b -. a })
    }
  }
}

fn percentile(vals: List(Val), scale: Float) -> Val {
  use <- arity(vals, 2, 2)
  let assert [data, k] = vals
  case numbers([data]), value.to_number(env.scalar(k)) {
    Error(e), _ | _, Error(e) -> fail(e)
    Ok(xs), Ok(k) -> {
      let k = case scale == 1.0 {
        True -> k
        False -> int.to_float(float.truncate(k)) /. scale
      }
      case k <. 0.0 || k >. 1.0 {
        True -> fail(value.NumErr)
        False -> Scalar(percentile_of(xs, k))
      }
    }
  }
}

fn mode(xs: List(Float)) -> Value {
  let counts =
    list.fold(xs, dict.new(), fn(d, x) {
      dict.upsert(d, x, fn(c) {
        case c {
          Some(n) -> n + 1
          _ -> 1
        }
      })
    })
  let #(best, n) =
    list.fold(xs, #(0.0, 1), fn(acc, x) {
      let c = dict.get(counts, x) |> result.unwrap(0)
      case c > acc.1 {
        True -> #(x, c)
        False -> acc
      }
    })
  case n > 1 {
    True -> Number(best)
    False -> Err(value.NA)
  }
}

fn variance(xs: List(Float), sample: Bool) -> Value {
  let n = list.length(xs)
  let d = case sample {
    True -> n - 1
    False -> n
  }
  case d <= 0 {
    True -> Err(value.Div0)
    False -> {
      let mean = float.sum(xs) /. int.to_float(n)
      let ss =
        list.fold(xs, 0.0, fn(acc, x) { acc +. { x -. mean } *. { x -. mean } })
      Number(ss /. int.to_float(d))
    }
  }
}

fn stdev(xs: List(Float), sample: Bool) -> Value {
  case variance(xs, sample) {
    Number(v) -> num.result(num.sqrt(v))
    other -> other
  }
}

fn kth(vals: List(Val), largest: Bool) -> Val {
  use <- arity(vals, 2, 2)
  let assert [data, k] = vals
  case numbers([data]), scalar_int(k) {
    Error(e), _ | _, Error(e) -> fail(e)
    Ok(xs), Ok(k) -> {
      let s = case largest {
        True -> list.reverse(sorted(xs))
        False -> sorted(xs)
      }
      case env.nth(s, k - 1) {
        Ok(x) if k >= 1 -> Scalar(Number(x))
        _ -> fail(value.NumErr)
      }
    }
  }
}

fn rank(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 3)
  let assert [x, data, ..rest] = vals
  let ascending = case rest {
    [o] -> result.map(value.to_number(env.scalar(o)), fn(o) { o != 0.0 })
    _ -> Ok(False)
  }
  case value.to_number(env.scalar(x)), numbers([data]), ascending {
    Error(e), _, _ | _, Error(e), _ | _, _, Error(e) -> fail(e)
    Ok(x), Ok(xs), Ok(asc) ->
      case list.any(xs, fn(y) { y == x }) {
        False -> fail(value.NA)
        True -> {
          let ahead =
            list.count(xs, fn(y) {
              case asc {
                True -> y <. x
                False -> y >. x
              }
            })
          Scalar(Number(int.to_float(ahead + 1)))
        }
      }
  }
}

fn correl(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 2)
  let assert [a, b] = vals
  let xs = env.flatten(a)
  let ys = env.flatten(b)
  case list.length(xs) == list.length(ys), first_error(list.append(xs, ys)) {
    False, _ -> fail(value.NA)
    _, Error(k) -> fail(k)
    True, Ok(_) -> {
      let pairs =
        list.map2(xs, ys, fn(x, y) { #(x, y) })
        |> list.filter_map(fn(p) {
          case p {
            #(Number(x), Number(y)) -> Ok(#(x, y))
            _ -> Error(Nil)
          }
        })
      let n = int.to_float(list.length(pairs))
      let mx =
        list.fold(pairs, 0.0, fn(acc, p) { acc +. p.0 }) /. float.max(n, 1.0)
      let my =
        list.fold(pairs, 0.0, fn(acc, p) { acc +. p.1 }) /. float.max(n, 1.0)
      let #(sxy, sxx, syy) =
        list.fold(pairs, #(0.0, 0.0, 0.0), fn(acc, p) {
          let dx = p.0 -. mx
          let dy = p.1 -. my
          #(acc.0 +. dx *. dy, acc.1 +. dx *. dx, acc.2 +. dy *. dy)
        })
      case n <. 2.0 || sxx == 0.0 || syy == 0.0 {
        True -> fail(value.Div0)
        False ->
          case num.sqrt(sxx *. syy) {
            Ok(d) -> Scalar(Number(sxy /. d))
            Error(k) -> fail(k)
          }
      }
    }
  }
}

// -- finance ------------------------------------------------------------------

fn finance(
  f: fn(Float, Float, Float, Float, Float) -> Result(Float, ErrorKind),
) -> fn(List(Value)) -> Value {
  fn(a) {
    use x1 <- num.number(arg(a, 0))
    use x2 <- num.number(arg(a, 1))
    use x3 <- num.number(arg(a, 2))
    use x4 <- num.number(opt(a, 3, Number(0.0)))
    use t <- num.number(opt(a, 4, Number(0.0)))
    let t = case t != 0.0 {
      True -> 1.0
      False -> 0.0
    }
    num.result(f(x1, x2, x3, x4, t))
  }
}

/// (1 + rate) ^ n, checked.
fn growth(rate: Float, n: Float) -> Result(Float, ErrorKind) {
  num.pow(1.0 +. rate, n)
}

fn pmt(rate, nper, pv, fv, t) -> Result(Float, ErrorKind) {
  case rate == 0.0 {
    True -> num.div(float.negate(pv +. fv), nper)
    False -> {
      use g <- result.try(growth(rate, nper))
      use top <- result.try(num.mul(rate, fv +. pv *. g))
      use bottom <- result.try(num.mul(1.0 +. rate *. t, g -. 1.0))
      num.div(float.negate(top), bottom)
    }
  }
}

fn pv(rate, nper, payment, fv, t) -> Result(Float, ErrorKind) {
  case rate == 0.0 {
    True -> Ok(float.negate(fv +. payment *. nper))
    False -> {
      use g <- result.try(growth(rate, nper))
      use annuity <- result.try(num.div(
        payment *. { 1.0 +. rate *. t } *. { g -. 1.0 },
        rate,
      ))
      num.div(float.negate(fv +. annuity), g)
    }
  }
}

fn fv(rate, nper, payment, pv, t) -> Result(Float, ErrorKind) {
  case rate == 0.0 {
    True -> Ok(float.negate(pv +. payment *. nper))
    False -> {
      use g <- result.try(growth(rate, nper))
      use annuity <- result.try(num.div(
        payment *. { 1.0 +. rate *. t } *. { g -. 1.0 },
        rate,
      ))
      use grown <- result.try(num.mul(pv, g))
      Ok(float.negate(grown +. annuity))
    }
  }
}

fn nper(rate, payment, pv, fv, t) -> Result(Float, ErrorKind) {
  case rate == 0.0 {
    True -> num.div(float.negate(pv +. fv), payment)
    False -> {
      let p = payment *. { 1.0 +. rate *. t }
      use ratio <- result.try(num.div(p -. fv *. rate, p +. pv *. rate))
      use top <- result.try(case ratio <=. 0.0 {
        True -> Error(value.NumErr)
        False -> num.ln(ratio)
      })
      use bottom <- result.try(num.ln(1.0 +. rate))
      num.div(top, bottom)
    }
  }
}

/// Sum of flows[i] / (1 + rate)^(i + first).
fn npv(
  rate: Float,
  flows: List(Float),
  first: Int,
) -> Result(Float, ErrorKind) {
  case rate == -1.0 {
    True -> Error(value.Div0)
    False ->
      list.index_fold(flows, Ok(0.0), fn(acc, x, i) {
        use total <- result.try(acc)
        use g <- result.try(growth(rate, int.to_float(i + first)))
        use term <- result.try(num.div(x, g))
        num.add(total, term)
      })
  }
}

/// d/drate of npv with first period 0.
fn npv_slope(rate: Float, flows: List(Float)) -> Result(Float, ErrorKind) {
  list.index_fold(flows, Ok(0.0), fn(acc, x, i) {
    use total <- result.try(acc)
    use g <- result.try(growth(rate, int.to_float(i + 1)))
    use term <- result.try(num.div(int.to_float(-i) *. x, g))
    num.add(total, term)
  })
}

fn irr(flows: Val, guess: Float) -> Val {
  case numbers([flows]) {
    Error(k) -> fail(k)
    Ok(xs) ->
      case
        list.any(xs, fn(x) { x >. 0.0 }) && list.any(xs, fn(x) { x <. 0.0 })
      {
        False -> fail(value.NumErr)
        True ->
          case newton(xs, guess, 0) {
            Ok(r) -> Scalar(Number(r))
            Error(_) ->
              case bisect(xs, -0.9999, 100.0, 0) {
                Ok(r) -> Scalar(Number(r))
                Error(_) -> fail(value.NumErr)
              }
          }
      }
  }
}

fn newton(xs: List(Float), r: Float, i: Int) -> Result(Float, Nil) {
  case i > 100 || r <=. -1.0 {
    True -> Error(Nil)
    False ->
      case npv(r, xs, 0), npv_slope(r, xs) {
        Ok(f), Ok(d) if d != 0.0 -> {
          let next = r -. f /. d
          case float.absolute_value(next -. r) <. 1.0e-12 {
            True -> Ok(next)
            False -> newton(xs, next, i + 1)
          }
        }
        _, _ -> Error(Nil)
      }
  }
}

fn bisect(xs: List(Float), lo: Float, hi: Float, i: Int) -> Result(Float, Nil) {
  let mid = { lo +. hi } /. 2.0
  case npv(lo, xs, 0), npv(mid, xs, 0) {
    Ok(flo), Ok(fmid) ->
      case i > 200 || float.absolute_value(hi -. lo) <. 1.0e-13 {
        True -> Ok(mid)
        False ->
          case flo *. fmid <=. 0.0 {
            True -> bisect(xs, lo, mid, i + 1)
            False ->
              case npv(hi, xs, 0) {
                Ok(fhi) if fmid *. fhi <=. 0.0 -> bisect(xs, mid, hi, i + 1)
                _ -> Error(Nil)
              }
          }
      }
    _, _ -> Error(Nil)
  }
}

// -- arrays -------------------------------------------------------------------

fn sumproduct(vals: List(Val)) -> Val {
  case vals {
    [] -> fail(value.ValueErr)
    [first_arg, ..] -> {
      let size = env.dims(first_arg)
      case list.all(vals, fn(v) { env.dims(v) == size }) {
        False -> fail(value.ValueErr)
        True -> {
          let columns = list.map(vals, env.flatten)
          case first_error(list.flatten(columns)) {
            Error(k) -> fail(k)
            Ok(_) -> {
              let products =
                list.transpose(columns)
                |> list.map(fn(cells) {
                  list.fold(cells, Ok(1.0), fn(acc, x) {
                    use p <- result.try(acc)
                    case x {
                      Number(n) -> num.mul(p, n)
                      _ -> Ok(0.0)
                    }
                  })
                })
              case result.all(products) {
                Ok(ps) -> Scalar(sum_value(ps))
                Error(k) -> fail(k)
              }
            }
          }
        }
      }
    }
  }
}

fn sequence(vals: List(Val)) -> Val {
  use <- arity(vals, 1, 4)
  let get = fn(i, default) {
    case env.nth(vals, i) {
      Ok(Scalar(Empty)) -> Ok(default)
      Ok(v) -> value.to_number(env.scalar(v))
      Error(_) -> Ok(default)
    }
  }
  case get(0, 1.0), get(1, 1.0), get(2, 1.0), get(3, 1.0) {
    Ok(r), Ok(c), Ok(start), Ok(by) -> {
      let r = float.truncate(r)
      let c = float.truncate(c)
      case r < 1 || c < 1 || r * c > 100_000 {
        True -> fail(value.ValueErr)
        False ->
          Grid(
            int.range(0, r, [], fn(acc, i) {
              [
                int.range(0, c, [], fn(acc, j) {
                  [Number(start +. by *. int.to_float(i * c + j)), ..acc]
                })
                  |> list.reverse,
                ..acc
              ]
            })
            |> list.reverse,
          )
      }
    }
    Error(k), _, _, _
    | _, Error(k), _, _
    | _, _, Error(k), _
    | _, _, _, Error(k)
    -> fail(k)
  }
}

fn sort(vals: List(Val)) -> Val {
  use <- arity(vals, 1, 4)
  let assert [data, ..rest] = vals
  let get = fn(i, default) {
    case env.nth(rest, i) {
      Ok(Scalar(Empty)) -> Ok(default)
      Ok(v) -> scalar_int(v)
      Error(_) -> Ok(default)
    }
  }
  case get(0, 1), get(1, 1), get(2, 0) {
    Ok(key), Ok(direction), Ok(by_col) -> {
      let rows = case by_col != 0 {
        True -> transpose(env.rows(data))
        False -> env.rows(data)
      }
      let width = case rows {
        [r, ..] -> list.length(r)
        [] -> 0
      }
      case key < 1 || key > width || { direction != 1 && direction != -1 } {
        True -> fail(value.ValueErr)
        False -> {
          let sorted =
            list.sort(rows, fn(a, b) {
              let x = env.nth(a, key - 1) |> result.unwrap(Empty)
              let y = env.nth(b, key - 1) |> result.unwrap(Empty)
              case direction {
                1 -> value.compare(x, y)
                _ -> value.compare(y, x)
              }
            })
          case by_col != 0 {
            True -> Grid(transpose(sorted))
            False -> Grid(sorted)
          }
        }
      }
    }
    Error(k), _, _ | _, Error(k), _ | _, _, Error(k) -> fail(k)
  }
}

fn same_row(a: List(Value), b: List(Value)) -> Bool {
  list.length(a) == list.length(b)
  && list.all(list.map2(a, b, same), fn(x) { x })
}

fn unique(vals: List(Val)) -> Val {
  use <- arity(vals, 1, 3)
  let assert [data, ..rest] = vals
  let flag = fn(i) {
    case env.nth(rest, i) {
      Ok(v) -> value.to_bool(env.scalar(v))
      Error(_) -> Ok(False)
    }
  }
  case flag(0), flag(1) {
    Ok(by_col), Ok(exactly_once) -> {
      let rows = case by_col {
        True -> transpose(env.rows(data))
        False -> env.rows(data)
      }
      let kept =
        list.fold(rows, [], fn(acc, row) {
          case list.any(acc, fn(seen) { same_row(seen, row) }) {
            True -> acc
            False -> [row, ..acc]
          }
        })
        |> list.reverse
      let kept = case exactly_once {
        True ->
          list.filter(kept, fn(row) {
            list.count(rows, fn(other) { same_row(row, other) }) == 1
          })
        False -> kept
      }
      case kept, by_col {
        [], _ -> fail(value.Calc)
        _, True -> Grid(transpose(kept))
        _, False -> Grid(kept)
      }
    }
    Error(k), _ | _, Error(k) -> fail(k)
  }
}

fn filter(vals: List(Val)) -> Val {
  use <- arity(vals, 2, 3)
  let assert [data, include, ..rest] = vals
  let #(h, w) = env.dims(data)
  let #(ih, iw) = env.dims(include)
  let by_row = iw == 1 && ih == h
  let by_col = ih == 1 && iw == w && !by_row
  case by_row || by_col {
    False -> fail(value.ValueErr)
    True ->
      case list.try_map(env.flatten(include), value.to_bool) {
        Error(k) -> fail(k)
        Ok(flags) -> {
          let rows = case by_row {
            True -> env.rows(data)
            False -> transpose(env.rows(data))
          }
          let kept =
            list.map2(rows, flags, fn(row, keep) { #(row, keep) })
            |> list.filter(fn(p) { p.1 })
            |> list.map(fn(p) { p.0 })
          case kept, rest {
            [], [if_empty] -> if_empty
            [], _ -> fail(value.Calc)
            _, _ ->
              case by_row {
                True -> Grid(kept)
                False -> Grid(transpose(kept))
              }
          }
        }
      }
  }
}

// ---------------------------------------------------------------------------
// The catalogue, for the README, the CLI and the web demo's help panel
// ---------------------------------------------------------------------------

pub fn catalogue() -> List(#(String, String, String)) {
  [
    #("Math", "SUM", "SUM(number1, [number2], ...)"),
    #("Math", "SUMPRODUCT", "SUMPRODUCT(array1, [array2], ...)"),
    #("Math", "SUMSQ", "SUMSQ(number1, ...)"),
    #("Math", "PRODUCT", "PRODUCT(number1, ...)"),
    #("Math", "ABS", "ABS(number)"),
    #("Math", "SIGN", "SIGN(number)"),
    #("Math", "INT", "INT(number)"),
    #("Math", "ROUND", "ROUND(number, digits)"),
    #("Math", "ROUNDUP", "ROUNDUP(number, digits)"),
    #("Math", "ROUNDDOWN", "ROUNDDOWN(number, digits)"),
    #("Math", "TRUNC", "TRUNC(number, [digits])"),
    #("Math", "MROUND", "MROUND(number, multiple)"),
    #("Math", "CEILING", "CEILING(number, [significance])"),
    #("Math", "FLOOR", "FLOOR(number, [significance])"),
    #("Math", "MOD", "MOD(number, divisor)"),
    #("Math", "QUOTIENT", "QUOTIENT(numerator, denominator)"),
    #("Math", "POWER", "POWER(number, power)"),
    #("Math", "SQRT", "SQRT(number)"),
    #("Math", "EXP", "EXP(number)"),
    #("Math", "LN", "LN(number)"),
    #("Math", "LOG", "LOG(number, [base])"),
    #("Math", "LOG10", "LOG10(number)"),
    #("Math", "PI", "PI()"),
    #("Math", "FACT", "FACT(number)"),
    #("Logic", "IF", "IF(test, [then], [else])"),
    #("Logic", "IFS", "IFS(test1, value1, [test2, value2], ...)"),
    #("Logic", "IFERROR", "IFERROR(value, value_if_error)"),
    #("Logic", "IFNA", "IFNA(value, value_if_na)"),
    #("Logic", "SWITCH", "SWITCH(expr, value1, result1, ..., [default])"),
    #("Logic", "CHOOSE", "CHOOSE(index, value1, value2, ...)"),
    #("Logic", "LET", "LET(name1, value1, ..., calculation)"),
    #("Logic", "AND", "AND(logical1, ...)"),
    #("Logic", "OR", "OR(logical1, ...)"),
    #("Logic", "XOR", "XOR(logical1, ...)"),
    #("Logic", "NOT", "NOT(logical)"),
    #("Logic", "TRUE", "TRUE()"),
    #("Logic", "FALSE", "FALSE()"),
    #("Lookup", "VLOOKUP", "VLOOKUP(value, table, column, [approximate])"),
    #("Lookup", "HLOOKUP", "HLOOKUP(value, table, row, [approximate])"),
    #(
      "Lookup",
      "XLOOKUP",
      "XLOOKUP(value, lookup, return, [if_missing], [match_mode], [search_mode])",
    ),
    #("Lookup", "MATCH", "MATCH(value, array, [type])"),
    #("Lookup", "XMATCH", "XMATCH(value, array, [match_mode], [search_mode])"),
    #("Lookup", "INDEX", "INDEX(array, row, [column])"),
    #("Lookup", "ROWS", "ROWS(array)"),
    #("Lookup", "COLUMNS", "COLUMNS(array)"),
    #("Conditional", "SUMIF", "SUMIF(range, criteria, [sum_range])"),
    #("Conditional", "SUMIFS", "SUMIFS(sum_range, range1, criteria1, ...)"),
    #("Conditional", "COUNTIF", "COUNTIF(range, criteria)"),
    #("Conditional", "COUNTIFS", "COUNTIFS(range1, criteria1, ...)"),
    #("Conditional", "AVERAGEIF", "AVERAGEIF(range, criteria, [average_range])"),
    #(
      "Conditional",
      "AVERAGEIFS",
      "AVERAGEIFS(average_range, range1, criteria1, ...)",
    ),
    #("Conditional", "MAXIFS", "MAXIFS(max_range, range1, criteria1, ...)"),
    #("Conditional", "MINIFS", "MINIFS(min_range, range1, criteria1, ...)"),
    #("Statistics", "AVERAGE", "AVERAGE(number1, ...)"),
    #("Statistics", "AVERAGEA", "AVERAGEA(value1, ...)"),
    #("Statistics", "COUNT", "COUNT(value1, ...)"),
    #("Statistics", "COUNTA", "COUNTA(value1, ...)"),
    #("Statistics", "COUNTBLANK", "COUNTBLANK(range)"),
    #("Statistics", "MIN", "MIN(number1, ...)"),
    #("Statistics", "MAX", "MAX(number1, ...)"),
    #("Statistics", "MEDIAN", "MEDIAN(number1, ...)"),
    #("Statistics", "MODE.SNGL", "MODE.SNGL(number1, ...)"),
    #("Statistics", "STDEV.S", "STDEV.S(number1, ...)"),
    #("Statistics", "STDEV.P", "STDEV.P(number1, ...)"),
    #("Statistics", "VAR.S", "VAR.S(number1, ...)"),
    #("Statistics", "VAR.P", "VAR.P(number1, ...)"),
    #("Statistics", "LARGE", "LARGE(array, k)"),
    #("Statistics", "SMALL", "SMALL(array, k)"),
    #("Statistics", "RANK.EQ", "RANK.EQ(number, ref, [ascending])"),
    #("Statistics", "PERCENTILE.INC", "PERCENTILE.INC(array, k)"),
    #("Statistics", "QUARTILE.INC", "QUARTILE.INC(array, quart)"),
    #("Statistics", "CORREL", "CORREL(array1, array2)"),
    #("Text", "LEN", "LEN(text)"),
    #("Text", "LEFT", "LEFT(text, [count])"),
    #("Text", "RIGHT", "RIGHT(text, [count])"),
    #("Text", "MID", "MID(text, start, count)"),
    #("Text", "UPPER", "UPPER(text)"),
    #("Text", "LOWER", "LOWER(text)"),
    #("Text", "PROPER", "PROPER(text)"),
    #("Text", "TRIM", "TRIM(text)"),
    #("Text", "CLEAN", "CLEAN(text)"),
    #("Text", "CONCAT", "CONCAT(text1, ...)"),
    #("Text", "CONCATENATE", "CONCATENATE(text1, ...)"),
    #("Text", "TEXTJOIN", "TEXTJOIN(delimiter, ignore_empty, text1, ...)"),
    #("Text", "SUBSTITUTE", "SUBSTITUTE(text, old, new, [instance])"),
    #("Text", "REPLACE", "REPLACE(text, start, count, new)"),
    #("Text", "FIND", "FIND(find, within, [start])"),
    #("Text", "SEARCH", "SEARCH(find, within, [start])"),
    #("Text", "REPT", "REPT(text, times)"),
    #("Text", "EXACT", "EXACT(text1, text2)"),
    #("Text", "VALUE", "VALUE(text)"),
    #("Text", "TEXT", "TEXT(value, format)"),
    #("Text", "FIXED", "FIXED(number, [decimals], [no_commas])"),
    #("Text", "CHAR", "CHAR(number)"),
    #("Text", "CODE", "CODE(text)"),
    #("Date", "DATE", "DATE(year, month, day)"),
    #("Date", "DATEVALUE", "DATEVALUE(\"yyyy-mm-dd\")"),
    #("Date", "YEAR", "YEAR(date)"),
    #("Date", "MONTH", "MONTH(date)"),
    #("Date", "DAY", "DAY(date)"),
    #("Date", "WEEKDAY", "WEEKDAY(date, [type])"),
    #("Date", "EDATE", "EDATE(date, months)"),
    #("Date", "EOMONTH", "EOMONTH(date, months)"),
    #("Date", "DAYS", "DAYS(end, start)"),
    #("Date", "DATEDIF", "DATEDIF(start, end, unit)"),
    #("Finance", "PMT", "PMT(rate, nper, pv, [fv], [type])"),
    #("Finance", "PV", "PV(rate, nper, pmt, [fv], [type])"),
    #("Finance", "FV", "FV(rate, nper, pmt, [pv], [type])"),
    #("Finance", "NPER", "NPER(rate, pmt, pv, [fv], [type])"),
    #("Finance", "NPV", "NPV(rate, value1, ...)"),
    #("Finance", "IRR", "IRR(values, [guess])"),
    #("Information", "ISNUMBER", "ISNUMBER(value)"),
    #("Information", "ISTEXT", "ISTEXT(value)"),
    #("Information", "ISNONTEXT", "ISNONTEXT(value)"),
    #("Information", "ISLOGICAL", "ISLOGICAL(value)"),
    #("Information", "ISBLANK", "ISBLANK(value)"),
    #("Information", "ISERROR", "ISERROR(value)"),
    #("Information", "ISERR", "ISERR(value)"),
    #("Information", "ISNA", "ISNA(value)"),
    #("Information", "ISEVEN", "ISEVEN(number)"),
    #("Information", "ISODD", "ISODD(number)"),
    #("Information", "NA", "NA()"),
    #(
      "Dynamic arrays",
      "SEQUENCE",
      "SEQUENCE(rows, [columns], [start], [step])",
    ),
    #("Dynamic arrays", "SORT", "SORT(array, [index], [order], [by_column])"),
    #("Dynamic arrays", "UNIQUE", "UNIQUE(array, [by_column], [exactly_once])"),
    #("Dynamic arrays", "FILTER", "FILTER(array, include, [if_empty])"),
    #("Dynamic arrays", "TRANSPOSE", "TRANSPOSE(array)"),
  ]
}
