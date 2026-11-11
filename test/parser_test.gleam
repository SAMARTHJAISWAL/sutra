import gleam/list
import gleam/option.{None, Some}
import sutra/ast.{Area, Binary, Call, Name, Neg, Num, Percent, Range, Ref, Str}
import sutra/parser
import sutra/value

fn tree(formula: String) {
  let assert Ok(expr) = parser.parse(formula)
  expr
}

fn error(formula: String) -> #(String, Int) {
  let assert Error(e) = parser.parse(formula)
  #(e.message, e.position)
}

pub fn precedence_test() {
  assert tree("=1+2*3")
    == Binary(ast.Add, Num(1.0), Binary(ast.Mul, Num(2.0), Num(3.0)))
  // Excel: negation binds tighter than ^
  assert tree("=-2^2") == Binary(ast.Pow, Neg(Num(2.0)), Num(2.0))
  // and ^ is left-associative
  assert tree("=2^3^2")
    == Binary(ast.Pow, Binary(ast.Pow, Num(2.0), Num(3.0)), Num(2.0))
  assert tree("=1&2=\"12\"")
    == Binary(ast.Eq, Binary(ast.Concat, Num(1.0), Num(2.0)), Str("12"))
  assert tree("=50%*2") == Binary(ast.Mul, Percent(Num(50.0)), Num(2.0))
  assert tree("=+5") == Num(5.0)
}

pub fn references_test() {
  assert tree("=A1") == Ref(None, 0, 0)
  assert tree("=$B$12") == Ref(None, 1, 11)
  assert tree("=xfd1048576") == Ref(None, 16_383, 1_048_575)
  assert tree("=A1:B3") == Area(None, Range(0, 0, 2, 1))
  // corners in any order
  assert tree("=B3:A1") == Area(None, Range(0, 0, 2, 1))
  assert tree("=Sales!C2") == Ref(Some("Sales"), 2, 1)
  assert tree("='Q3 Plan'!A1:A9") == Area(Some("Q3 Plan"), Range(0, 0, 8, 0))
  assert tree("='It''s'!A1") == Ref(Some("It's"), 0, 0)
  assert tree("=C:D") == Area(None, Range(0, 2, ast.max_rows - 1, 3))
  assert tree("=2:3") == Area(None, Range(1, 0, 2, ast.max_cols - 1))
}

pub fn names_and_functions_test() {
  // LOG10 looks like a cell address, but a ( makes it a function
  assert tree("=LOG10(100)") == Call("LOG10", [Num(100.0)])
  assert tree("=stdev.s(A1)") == Call("STDEV.S", [Ref(None, 0, 0)])
  assert tree("=_xlfn.XLOOKUP(1,A1:A2,B1:B2)")
    == Call("XLOOKUP", [
      Num(1.0),
      Area(None, Range(0, 0, 1, 0)),
      Area(None, Range(0, 1, 1, 1)),
    ])
  assert tree("=IF(A1,,0)")
    == Call("IF", [Ref(None, 0, 0), ast.Missing, Num(0.0)])
  assert tree("=PI()") == Call("PI", [])
  assert tree("=rate") == Name("RATE")
  // XFE is past the last column, so it is a name, not a reference
  assert tree("=XFE1") == Name("XFE1")
}

pub fn literals_test() {
  assert tree("=\"say \"\"hi\"\"\"") == Str("say \"hi\"")
  assert tree("=1.5E+3") == Num(1500.0)
  assert tree("=.5") == Num(0.5)
  assert tree("=true") == ast.Bool(True)
  assert tree("=#N/A") == ast.ErrorLit(value.NA)
  assert tree("={1,2;3,4}")
    == ast.ArrayLit([[Num(1.0), Num(2.0)], [Num(3.0), Num(4.0)]])
  assert tree("={-1,\"a\"}") == ast.ArrayLit([[Num(-1.0), Str("a")]])
}

pub fn errors_test() {
  assert error("=SUM(1,") == #("formula ends too early", 7)
  assert error("=(1+2") == #("missing )", 1)
  assert error("=1+") == #("formula ends too early", 3)
  assert error("=\"abc") == #("unterminated string", 1)
  assert error("=A1:") == #("a range needs a cell on both sides of :", 3)
  assert error("={1,2;3}") == #("array rows must be the same length", 1)
  assert error("=1 2") == #("unexpected 2", 3)
  assert error("=@A1") == #("unexpected character @", 1)
}

pub fn print_round_trip_test() {
  let formulas = [
    "=SUM(A1:B2,Sales!C3)*-2",
    "=IF(A1>=10,\"big\",\"small\")",
    "='Q3 Plan'!A1&\"x\"",
    "={1,2;3,4}",
    "=XLOOKUP(A2,targets!A2:A5,targets!B2:B5,0)",
    "=(1+2)*3^2",
  ]
  list.each(formulas, fn(f) {
    let printed = ast.to_formula(tree(f))
    assert tree(printed) == tree(f)
  })
}
