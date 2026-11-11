//// The examples from the README, so they cannot go stale.

import gleam/list
import sutra
import sutra/value
import sutra/workbook

pub fn library_example_test() {
  let #(book, _) =
    workbook.from_cells(["Sheet1"], [
      #("Sheet1", 0, 0, "120"),
      #("Sheet1", 0, 1, "80"),
      #("Sheet1", 1, 0, "=SUM(A1:A2)*1.18"),
    ])
  assert value.to_string(workbook.value(book, "Sheet1", 1, 0)) == "236"

  let assert Ok(#(book, report)) = workbook.set_a1(book, "Sheet1", "A2", "100")
  assert value.to_string(workbook.value(book, "Sheet1", 1, 0)) == "259.6"
  // only B1 was evaluated again
  assert report.evaluated == [workbook.Key("sheet1", 1, 0)]
  assert list.length(report.changed) == 2
}

pub fn evaluate_example_test() {
  assert sutra.evaluate("=ROUND(PMT(7.5%/12, 240, 250000), 2)")
    == Ok([[value.Number(-2013.98)]])
  assert sutra.evaluate("=SEQUENCE(2)")
    == Ok([[value.Number(1.0)], [value.Number(2.0)]])
  let assert Error(e) = sutra.evaluate("=SUM(1,")
  assert e.message == "formula ends too early"
}
