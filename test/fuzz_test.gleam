//// Differential fuzzing of incremental recalculation.
////
//// Random workbooks get random edits — numbers, text, clears, references,
//// ranges, cycles, cross-sheet formulas and spilling arrays that collide.
//// After every edit the incrementally updated workbook must hold exactly
//// the same values as a workbook built from scratch from the same inputs.

import gleam/dict.{type Dict}
import gleam/int
import gleam/list
import sutra/ast
import sutra/value
import sutra/workbook

const scenarios = 300

const edits = 25

const width = 5

const height = 6

/// Park-Miller minimal standard generator. Products stay below 2^53, so it
/// gives the same sequence on the BEAM and in JavaScript.
type Rng {
  Rng(state: Int)
}

fn next(rng: Rng, below: Int) -> #(Int, Rng) {
  let s = rng.state * 48_271 % 2_147_483_647
  #(s % below, Rng(s))
}

fn pick(rng: Rng, items: List(String)) -> #(String, Rng) {
  let #(i, rng) = next(rng, list.length(items))
  let assert [x, ..] = list.drop(items, i)
  #(x, rng)
}

fn cell(rng: Rng) -> #(String, Rng) {
  let #(c, rng) = next(rng, width)
  let #(r, rng) = next(rng, height)
  #(ast.cell_name(c, r), rng)
}

fn area(rng: Rng) -> #(String, Rng) {
  let #(c1, rng) = next(rng, width)
  let #(r1, rng) = next(rng, height)
  let #(c2, rng) = next(rng, width)
  let #(r2, rng) = next(rng, height)
  #(ast.range_name(ast.range_of(c1, r1, c2, r2)), rng)
}

fn column_area(rng: Rng) -> #(String, Rng) {
  let #(c, rng) = next(rng, width)
  let #(r1, rng) = next(rng, height)
  let #(n, rng) = next(rng, 3)
  #(ast.range_name(ast.range_of(c, r1, c, r1 + n)), rng)
}

fn input(rng: Rng) -> #(String, Rng) {
  let #(kind, rng) = next(rng, 22)
  let #(a, rng) = cell(rng)
  let #(b, rng) = cell(rng)
  let #(rr, rng) = area(rng)
  let #(col, rng) = column_area(rng)
  let #(n, rng) = next(rng, 3)
  let n = int.to_string(n + 1)
  case kind {
    0 | 1 | 2 -> {
      let #(x, rng) = next(rng, 19)
      #(int.to_string(x - 3), rng)
    }
    3 -> pick(rng, ["a", "b", "TRUE"])
    4 | 5 -> #("", rng)
    6 -> #("=" <> a <> "+" <> b, rng)
    7 -> #("=SUM(" <> rr <> ")", rng)
    8 -> #("=IF(" <> a <> ">3," <> b <> ",1)", rng)
    9 -> #("=SEQUENCE(" <> n <> ")", rng)
    10 -> #("=SEQUENCE(1," <> n <> ")", rng)
    11 -> #("=TRANSPOSE(" <> col <> ")", rng)
    12 -> #("=COUNTIF(" <> rr <> ",\">2\")", rng)
    13 -> #("=IFERROR(" <> a <> "/" <> b <> ",0)", rng)
    14 -> #("=Other!A1+" <> a, rng)
    15 -> #("=SORT(" <> col <> ")", rng)
    16 -> #("=MAX(" <> rr <> ")*" <> a, rng)
    17 -> #("=" <> a <> "&" <> b, rng)
    18 -> #("=UNIQUE(" <> col <> ")", rng)
    19 -> #("=FILTER(" <> col <> "," <> col <> ">2,0)", rng)
    20 -> #("=INDEX(" <> rr <> ",1,1)+" <> a, rng)
    _ -> #("=" <> a, rng)
  }
}

type Cells =
  Dict(#(String, Int, Int), String)

fn location(rng: Rng) -> #(#(String, Int, Int), Rng) {
  let #(other, rng) = next(rng, 10)
  case other {
    0 -> #(#("Other", 0, 0), rng)
    _ -> {
      let #(c, rng) = next(rng, width)
      let #(r, rng) = next(rng, height)
      #(#("Sheet1", c, r), rng)
    }
  }
}

fn fresh(cells: Cells) -> workbook.Workbook {
  let #(book, _) =
    workbook.from_cells(
      ["Sheet1", "Other"],
      dict.to_list(cells)
        |> list.filter(fn(p) { p.1 != "" })
        |> list.map(fn(p) {
          let #(#(sheet, c, r), input) = p
          #(sheet, c, r, input)
        }),
    )
  book
}

fn values(book: workbook.Workbook) -> List(#(String, String)) {
  workbook.snapshot(book)
  |> list.map(fn(p) { #(workbook.key_name(book, p.0), value.to_string(p.1)) })
}

fn scenario(seed: Int) -> Nil {
  let rng = Rng(seed * 7919 + 1)
  let #(cells, rng) =
    int.range(0, 14, #(dict.new(), rng), fn(acc, _) {
      let #(cells, rng) = acc
      let #(loc, rng) = location(rng)
      let #(text, rng) = input(rng)
      #(dict.insert(cells, loc, text), rng)
    })
  let book = fresh(cells)
  let _ =
    int.range(0, edits, #(book, cells, rng), fn(acc, step) {
      let #(book, cells, rng) = acc
      let #(loc, rng) = location(rng)
      let #(text, rng) = input(rng)
      let #(sheet, c, r) = loc
      let assert Ok(#(book, _)) = workbook.set(book, sheet, c, r, text)
      let cells = dict.insert(cells, loc, text)
      let expected = values(fresh(cells))
      let got = values(book)
      assert #(seed, step, got) == #(seed, step, expected)
      #(book, cells, rng)
    })
  Nil
}

pub fn incremental_matches_full_rebuild_test() {
  int.range(1, scenarios + 1, Nil, fn(_, seed) { scenario(seed) })
}
