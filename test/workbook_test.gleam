import gleam/list
import gleam/string
import sutra/ast
import sutra/value
import sutra/workbook.{type Workbook, Key}

fn build(cells: List(#(String, String))) -> Workbook {
  let #(book, _) =
    workbook.from_cells(
      ["Sheet1", "Data"],
      list.map(cells, fn(c) {
        let #(address, input) = c
        let #(sheet, a1) = case string.split_once(address, "!") {
          Ok(pair) -> pair
          Error(_) -> #("Sheet1", address)
        }
        let assert Ok(#(col, row)) = ast.parse_cell(a1)
        #(sheet, col, row, input)
      }),
    )
  book
}

fn get(book: Workbook, address: String) -> String {
  let #(sheet, a1) = case string.split_once(address, "!") {
    Ok(pair) -> pair
    Error(_) -> #("Sheet1", address)
  }
  let assert Ok(#(col, row)) = ast.parse_cell(a1)
  value.to_string(workbook.value(book, sheet, col, row))
}

fn set(
  book: Workbook,
  address: String,
  input: String,
) -> #(Workbook, workbook.Recalc) {
  let assert Ok(result) = workbook.set_a1(book, "Sheet1", address, input)
  result
}

/// Cell names, sorted alphabetically.
fn names(keys: List(workbook.Key)) -> List(String) {
  keys
  |> list.map(fn(k) { ast.cell_name(k.col, k.row) })
  |> list.sort(string.compare)
}

/// Cell names in the order they appear.
fn in_order(keys: List(workbook.Key)) -> List(String) {
  list.map(keys, fn(k) { ast.cell_name(k.col, k.row) })
}

pub fn chain_recalculates_in_order_test() {
  let book = build([#("A1", "2"), #("B1", "=A1*10"), #("C1", "=B1+A1")])
  assert get(book, "C1") == "22"
  let #(book, report) = set(book, "A1", "3")
  assert get(book, "B1") == "30"
  assert get(book, "C1") == "33"
  assert in_order(report.evaluated) == ["B1", "C1"]
  assert names(report.changed) == ["A1", "B1", "C1"]
}

pub fn only_affected_formulas_run_test() {
  let book =
    build([
      #("A1", "1"),
      #("A2", "2"),
      #("B1", "=A1+1"),
      #("B2", "=A2+1"),
      #("C1", "=SUM(B1:B2)"),
    ])
  let #(book, report) = set(book, "A2", "5")
  // B1 does not read A2, so it is left alone
  assert names(report.evaluated) == ["B2", "C1"]
  assert get(book, "C1") == "8"
}

pub fn unchanged_values_are_not_reported_test() {
  let book =
    build([#("A1", "1"), #("B1", "=A1>0"), #("C1", "=IF(B1,\"pos\",\"neg\")")])
  let #(_, report) = set(book, "A1", "7")
  // B1 is re-evaluated but stays TRUE, so C1 does not change either
  assert names(report.changed) == ["A1"]
}

pub fn diamond_dependencies_test() {
  let book =
    build([
      #("A1", "1"),
      #("B1", "=A1+1"),
      #("B2", "=A1*2"),
      #("C1", "=B1+B2"),
    ])
  let #(book, report) = set(book, "A1", "10")
  assert get(book, "C1") == "31"
  // C1 runs once, after both of its inputs
  assert names(report.evaluated) == ["B1", "B2", "C1"]
  assert list.last(in_order(report.evaluated)) == Ok("C1")
}

pub fn cycles_are_detected_test() {
  let book =
    build([#("A1", "=B1+1"), #("B1", "=A1+1"), #("C1", "=A1*2"), #("D1", "=D1")])
  assert get(book, "A1") == "#CYCLE!"
  assert get(book, "B1") == "#CYCLE!"
  assert get(book, "D1") == "#CYCLE!"
  // downstream of a cycle is still computed, and inherits the error
  assert get(book, "C1") == "#CYCLE!"
  // breaking the loop heals every cell
  let #(book, report) = set(book, "B1", "5")
  assert get(book, "A1") == "6"
  assert get(book, "C1") == "12"
  assert report.cycles == []
}

pub fn cycle_through_a_range_test() {
  let book = build([#("A1", "1"), #("A2", "=SUM(A1:A3)")])
  assert get(book, "A2") == "#CYCLE!"
}

pub fn multi_sheet_test() {
  let book =
    build([
      #("Data!A1", "100"),
      #("Data!A2", "250"),
      #("A1", "=SUM(Data!A1:A2)"),
      #("A2", "='Data'!A1*2"),
      #("A3", "=Nope!A1"),
    ])
  assert get(book, "A1") == "350"
  assert get(book, "A2") == "200"
  assert get(book, "A3") == "#REF!"
  let assert Ok(#(book, _)) = workbook.set_a1(book, "data", "A2", "50")
  assert get(book, "A1") == "150"
}

pub fn whole_column_reference_test() {
  let book = build([#("A1", "1"), #("A2", "2"), #("B1", "=SUM(A:A)")])
  assert get(book, "B1") == "3"
  let #(book, _) = set(book, "A500", "10")
  assert get(book, "B1") == "13"
}

pub fn spill_fills_neighbours_test() {
  let book =
    build([#("A1", "=SEQUENCE(3)"), #("B1", "=SUM(A1:A3)"), #("C1", "=A3*2")])
  assert get(book, "A2") == "2"
  assert get(book, "A3") == "3"
  assert get(book, "B1") == "6"
  assert get(book, "C1") == "6"
  assert workbook.spilled_from(book, Key("sheet1", 0, 2))
    == Ok(Key("sheet1", 0, 0))
}

pub fn spill_blocked_and_unblocked_test() {
  let book = build([#("A1", "=SEQUENCE(3)"), #("B1", "=A2")])
  // typing into the spill area blocks the array
  let #(book, report) = set(book, "A3", "x")
  assert get(book, "A1") == "#SPILL!"
  assert get(book, "A2") == ""
  assert get(book, "A3") == "x"
  assert get(book, "B1") == "0"
  assert list.contains(names(report.changed), "A1")
  // clearing the blocker lets it spill again
  let #(book, _) = set(book, "A3", "")
  assert get(book, "A1") == "1"
  assert get(book, "A3") == "3"
  assert get(book, "B1") == "2"
}

pub fn spill_resizes_test() {
  let book =
    build([
      #("A1", "3"),
      #("B1", "=SEQUENCE(A1)"),
      #("C1", "=COUNT(B1:B5)"),
      #("D1", "=B3"),
    ])
  assert get(book, "C1") == "3"
  let #(book, _) = set(book, "A1", "5")
  assert get(book, "B5") == "5"
  assert get(book, "C1") == "5"
  let #(book, _) = set(book, "A1", "2")
  // the cells the array no longer covers are empty again
  assert get(book, "B3") == ""
  assert get(book, "D1") == "0"
  assert get(book, "C1") == "2"
}

pub fn colliding_spills_resolve_by_position_test() {
  let book = build([#("A1", "=SEQUENCE(1,3)"), #("C1", "x")])
  assert get(book, "A1") == "#SPILL!"
  // two arrays that want the same cell: the earlier one wins
  let book = build([#("B1", "=SEQUENCE(3)"), #("A2", "=SEQUENCE(1,3)")])
  assert get(book, "B1") == "1"
  assert get(book, "A2") == "#SPILL!"
}

pub fn reading_a_spilled_cell_waits_for_the_array_test() {
  // D1 reads A3, which only gets a value once A1 has spilled
  let book = build([#("D1", "=A3*100"), #("A1", "=SORT({3;1;2})")])
  assert get(book, "D1") == "300"
}

pub fn replacing_an_array_formula_clears_its_spill_test() {
  let book = build([#("A1", "=SEQUENCE(3)"), #("B1", "=SUM(A1:A3)")])
  let #(book, _) = set(book, "A1", "7")
  assert get(book, "A2") == ""
  assert get(book, "B1") == "7"
}

pub fn parse_errors_test() {
  let book = build([#("A1", "=SUM(1,"), #("B1", "=A1+1")])
  assert get(book, "A1") == "#ERROR!"
  assert get(book, "B1") == "#ERROR!"
  let assert workbook.Broken(_, e) = workbook.content(book, "Sheet1", 0, 0)
  assert e.message != ""
}

pub fn literals_test() {
  let book =
    build([
      #("A1", "1,234.5"),
      #("A2", "12%"),
      #("A3", "true"),
      #("A4", "'007"),
      #("A5", "#N/A"),
      #("B1", "=A1+A2"),
      #("B2", "=ISTEXT(A4)"),
    ])
  assert get(book, "B1") == "1234.62"
  assert get(book, "A3") == "TRUE"
  assert get(book, "B2") == "TRUE"
  assert get(book, "A5") == "#N/A"
}

pub fn precedents_and_dependents_test() {
  let book = build([#("A1", "1"), #("A2", "2"), #("B1", "=SUM(A1:A2)+A1")])
  assert workbook.dependents(book, Key("sheet1", 0, 1)) == [Key("sheet1", 1, 0)]
  assert list.length(workbook.precedents(book, Key("sheet1", 1, 0))) == 2
}

pub fn plain_edits_stay_incremental_test() {
  let book = build([#("A1", "1"), #("B1", "=SEQUENCE(A1+2)"), #("C1", "=A1*2")])
  let #(_, report) = set(book, "A1", "1")
  assert report.rebuilt == False
  // a value change inside an array of the same shape is still incremental
  let book = build([#("A1", "1"), #("B1", "=SORT({3;1;2})*A1")])
  let #(book, report) = set(book, "A1", "2")
  assert report.rebuilt == False
  assert get(book, "B3") == "6"
}

pub fn reshaping_an_array_rebuilds_test() {
  let book =
    build([#("A1", "2"), #("B1", "=SEQUENCE(A1)"), #("C1", "=SUM(B1:B5)")])
  let #(book, report) = set(book, "A1", "4")
  assert report.rebuilt == True
  assert get(book, "C1") == "10"
  assert list.contains(names(report.changed), "B4")
}

pub fn array_reading_its_own_output_is_a_cycle_test() {
  // A1 spills into A2, and A1 reads A2
  let book = build([#("A1", "=SEQUENCE(2)+A2")])
  assert get(book, "A1") == "#CYCLE!"
  assert get(book, "A2") == ""
}
