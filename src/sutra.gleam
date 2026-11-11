//// sutra — an Excel formula engine for Gleam, on the BEAM and in JavaScript.
////
//// For one formula, use `evaluate`. For cells that refer to each other, use
//// `sutra/workbook`: it keeps the dependency graph and recalculates only
//// what an edit affects. This module is also the command line entry point.

import argv
import gleam/io
import simplifile
import sutra/cli
import sutra/env
import sutra/eval
import sutra/parser
import sutra/value.{type Value}

/// Evaluate a formula on its own, with no cells around it. The result is a
/// grid of rows: 1x1 for an ordinary value, bigger for an array formula.
///
///     evaluate("=ROUND(PMT(7.5%/12, 240, 250000), 2)")
///     // -> Ok([[Number(-2013.98)]])
///
pub fn evaluate(
  formula: String,
) -> Result(List(List(Value)), parser.ParseError) {
  case parser.parse(formula) {
    Ok(expr) -> Ok(env.rows(eval.standalone(expr)))
    Error(e) -> Error(e)
  }
}

pub fn main() -> Nil {
  let output =
    cli.run(argv.load().arguments, fn(path) {
      case simplifile.read(path) {
        Ok(text) -> Ok(text)
        Error(e) -> Error(path <> ": " <> simplifile.describe_error(e))
      }
    })
  case output.stdout {
    "" -> Nil
    text -> io.print(text)
  }
  case output.stderr {
    "" -> Nil
    text -> io.print_error(text)
  }
  halt(output.code)
}

@external(erlang, "sutra_ffi", "halt")
@external(javascript, "./sutra_ffi.mjs", "halt")
fn halt(code: Int) -> Nil
