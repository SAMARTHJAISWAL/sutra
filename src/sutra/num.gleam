//// Arithmetic that never crashes and never returns Infinity or NaN.
////
//// On the BEAM a float overflow raises an exception; in JavaScript it
//// quietly becomes Infinity. Excel answers #NUM! (or #DIV/0!), so every
//// operation is checked before it runs, which keeps both targets in step.

import gleam/float
import gleam/int
import gleam/string
import sutra/value.{type ErrorKind, type Value, Div0}

/// Largest magnitude we allow, just under the IEEE double maximum.
pub const limit = 1.0e307

pub fn number(v: Value, k: fn(Float) -> Value) -> Value {
  case value.to_number(v) {
    Ok(x) -> k(x)
    Error(e) -> value.Err(e)
  }
}

pub fn text(v: Value, k: fn(String) -> Value) -> Value {
  case value.to_text(v) {
    Ok(s) -> k(s)
    Error(e) -> value.Err(e)
  }
}

pub fn boolean(v: Value, k: fn(Bool) -> Value) -> Value {
  case value.to_bool(v) {
    Ok(b) -> k(b)
    Error(e) -> value.Err(e)
  }
}

/// Integer argument, truncated toward zero as Excel does.
pub fn integer(v: Value, k: fn(Int) -> Value) -> Value {
  use x <- number(v)
  case float.absolute_value(x) >. 1.0e15 {
    True -> value.Err(value.NumErr)
    False -> k(float.truncate(x))
  }
}

pub fn result(r: Result(Float, ErrorKind)) -> Value {
  case r {
    Ok(x) -> value.Number(x)
    Error(e) -> value.Err(e)
  }
}

fn check(x: Float) -> Result(Float, ErrorKind) {
  case float.absolute_value(x) >. limit {
    True -> Error(value.NumErr)
    False -> Ok(x)
  }
}

pub fn add(a: Float, b: Float) -> Result(Float, ErrorKind) {
  case float.absolute_value(a) >. limit || float.absolute_value(b) >. limit {
    True -> Error(value.NumErr)
    False -> check(a +. b)
  }
}

pub fn sub(a: Float, b: Float) -> Result(Float, ErrorKind) {
  add(a, float.negate(b))
}

pub fn mul(a: Float, b: Float) -> Result(Float, ErrorKind) {
  let x = float.absolute_value(a)
  let y = float.absolute_value(b)
  case x >. 1.0 && y >. 1.0 && y >. limit /. x {
    True -> Error(value.NumErr)
    False -> check(a *. b)
  }
}

pub fn div(a: Float, b: Float) -> Result(Float, ErrorKind) {
  case b == 0.0 {
    True -> Error(Div0)
    False -> {
      let y = float.absolute_value(b)
      case y <. 1.0 && float.absolute_value(a) >. limit *. y {
        True -> Error(value.NumErr)
        False -> check(a /. b)
      }
    }
  }
}

pub fn pow(base: Float, exponent: Float) -> Result(Float, ErrorKind) {
  case base == 0.0, exponent {
    True, e if e == 0.0 -> Error(value.NumErr)
    True, e if e <. 0.0 -> Error(Div0)
    True, _ -> Ok(0.0)
    False, _ -> {
      // estimate the size of the result before computing it
      let assert Ok(ln) = float.logarithm(float.absolute_value(base))
      case exponent *. ln >. 706.0 {
        True -> Error(value.NumErr)
        False ->
          case exponent *. ln <. -740.0 {
            True -> Ok(0.0)
            False ->
              case float.power(base, exponent) {
                Ok(x) -> check(x)
                Error(_) -> Error(value.NumErr)
              }
          }
      }
    }
  }
}

pub fn exp(x: Float) -> Result(Float, ErrorKind) {
  case x >. 706.0, x <. -740.0 {
    True, _ -> Error(value.NumErr)
    _, True -> Ok(0.0)
    _, _ -> Ok(float.exponential(x))
  }
}

pub fn ln(x: Float) -> Result(Float, ErrorKind) {
  case float.logarithm(x) {
    Ok(y) -> Ok(y)
    Error(_) -> Error(value.NumErr)
  }
}

pub fn sqrt(x: Float) -> Result(Float, ErrorKind) {
  case float.square_root(x) {
    Ok(y) -> Ok(y)
    Error(_) -> Error(value.NumErr)
  }
}

pub fn sum(xs: List(Float)) -> Result(Float, ErrorKind) {
  sum_loop(xs, 0.0)
}

fn sum_loop(xs: List(Float), acc: Float) -> Result(Float, ErrorKind) {
  case xs {
    [] -> Ok(acc)
    [x, ..rest] ->
      case add(acc, x) {
        Ok(acc) -> sum_loop(rest, acc)
        Error(e) -> Error(e)
      }
  }
}

// ---------------------------------------------------------------------------
// Decimal rounding
// ---------------------------------------------------------------------------

pub type Rounding {
  /// Half away from zero (ROUND).
  HalfUp
  /// Away from zero (ROUNDUP).
  Up
  /// Toward zero (ROUNDDOWN, TRUNC).
  Down
}

/// Round to `places` decimal places using the number's shortest decimal
/// form, not binary arithmetic. That is why ROUND(1.005, 2) is 1.01 here,
/// as in Excel, where naive float maths gives 1.0.
pub fn round(x: Float, places: Int, mode: Rounding) -> Float {
  let #(digits, point) = value.decompose(x)
  case digits {
    "" -> 0.0
    _ -> {
      let keep = point + places
      let n = string.length(digits)
      let #(digits, point) = case keep >= n {
        True -> #(digits, point)
        False -> {
          let kept = case keep > 0 {
            True -> string.slice(digits, 0, keep)
            False -> ""
          }
          let dropped = case keep > 0 {
            True -> string.drop_start(digits, keep)
            False -> string.repeat("0", -keep) <> digits
          }
          let bump = case mode {
            Down -> False
            Up -> True
            HalfUp ->
              case int.parse(string.slice(dropped, 0, 1)) {
                Ok(d) -> d >= 5
                Error(_) -> False
              }
          }
          let #(base, point) = case keep > 0 {
            True -> #(kept, point)
            // everything is dropped: bumping makes 1 in the last kept place
            False -> #("0", point - keep + 1)
          }
          case bump {
            False -> #(base, point)
            True -> bump_digits(base, point)
          }
        }
      }
      let magnitude = from_digits(digits, point)
      case x <. 0.0 {
        True -> float.negate(magnitude)
        False -> magnitude
      }
    }
  }
}

fn bump_digits(digits: String, point: Int) -> #(String, Int) {
  case value.increment(digits) {
    #(bumped, True) -> #("1" <> bumped, point + 1)
    #(bumped, False) -> #(bumped, point)
  }
}

/// 0.DIGITS × 10^point as a float.
pub fn from_digits(digits: String, point: Int) -> Float {
  case digits {
    "" -> 0.0
    _ -> {
      let text = "0." <> digits <> "e" <> int.to_string(point)
      case float.parse(text) {
        Ok(x) -> x
        Error(_) -> 0.0
      }
    }
  }
}
