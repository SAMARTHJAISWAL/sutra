import gleam/string
import simplifile
import sutra/cli

fn run(args: List(String)) -> cli.Output {
  cli.run(args, fn(path) {
    case simplifile.read(path) {
      Ok(text) -> Ok(text)
      Error(_) -> Error(path <> ": not found")
    }
  })
}

pub fn eval_table_test() {
  let out = run(["eval", "fixtures/loan.csv"])
  assert out.code == 0
  assert string.contains(out.stdout, "Monthly payment  2013.982984")
  assert string.contains(out.stdout, "Interest share         48.3%")
}

pub fn eval_multi_sheet_csv_test() {
  let out =
    run([
      "eval", "fixtures/sales.csv", "fixtures/targets.csv",
      "fixtures/summary.csv", "--format", "csv",
    ])
  assert out.code == 0
  assert string.contains(
    out.stdout,
    "# summary\nRegion,Revenue,Units,Target,Attainment,Best rep\nEast,14725,280,14000,105%,Meera\n",
  )
  assert string.contains(out.stdout, "Total,62975,1125,65000,97%,\n")
}

pub fn eval_json_test() {
  let out = run(["eval", "fixtures/targets.csv", "-f", "json"])
  assert out.stdout
    == "{\"targets\":[[\"Region\",\"Target\"],[\"North\",15000],[\"South\",16000],[\"East\",14000],[\"West\",20000]]}\n"
}

pub fn check_reports_errors_test() {
  let out = run(["check", "fixtures/broken.csv"])
  assert out.code == 1
  assert string.contains(
    out.stdout,
    "broken!B2  #DIV/0!  =10/B5\n    division by zero",
  )
  assert string.contains(out.stdout, "broken!B4  #CYCLE!  =B4+1")
  assert string.contains(
    out.stdout,
    "broken!B7  #ERROR!  =SUM(B2\n    cannot parse: missing ) after arguments (at character 8)",
  )
  assert string.contains(out.stdout, "broken!B8  #SPILL!  =SEQUENCE(3)")
  assert string.contains(
    out.stdout,
    "broken!B10  #DIV/0!  =B2*2\n    comes from broken!B2",
  )
  assert string.ends_with(out.stdout, "7 formula errors\n")
  let clean = run(["check", "fixtures/loan.csv"])
  assert clean.code == 0
  assert clean.stdout == "No formula errors.\n"
}

pub fn explain_test() {
  let out =
    run([
      "explain",
      "fixtures/sales.csv",
      "fixtures/targets.csv",
      "fixtures/summary.csv",
      "summary!B3",
    ])
  assert out.code == 0
  assert string.starts_with(
    out.stdout,
    "summary!B3 = 16325   =SUMIFS(sales!G2:G13,sales!B2:B13,A3)\n",
  )
  assert string.contains(
    out.stdout,
    "summary!A3 = \"North\"   (spilled from summary!A2)",
  )
}

pub fn calc_test() {
  assert run(["calc", "=ROUND(PMT(7.5%/12,240,250000),2)"]).stdout
    == "-2013.98\n"
  assert run(["calc", "SEQUENCE(2,2)"]).stdout == "   A  B\n1  1  2\n2  3  4\n"
  let bad = run(["calc", "=SUM(1,"])
  assert bad.code == 1
  assert string.contains(bad.stderr, "formula ends too early")
}

pub fn usage_test() {
  assert run([]).code == 0
  assert run(["--version"]).stdout == "sutra " <> cli.version <> "\n"
  assert run(["bogus"]).code == 2
  assert run(["eval"]).code == 2
  assert run(["eval", "missing.csv"]).code == 1
  assert string.contains(
    run(["functions"]).stdout,
    "XLOOKUP(value, lookup, return",
  )
}
