//// A workbook: sheets of cells, the dependency graph between them, and
//// incremental recalculation.
////
//// When a cell changes, only the formulas that can see it are evaluated
//// again, in dependency order. Cells that take part in a circular
//// reference get #CYCLE! and everything downstream of them still computes.
//// Formulas that return arrays spill into the cells below and to the right,
//// like Excel 365's dynamic arrays, or show #SPILL! when something is in
//// the way.

import gleam/dict.{type Dict}
import gleam/int
import gleam/list
import gleam/option.{None, Some}
import gleam/order
import gleam/result
import gleam/set.{type Set}
import gleam/string
import sutra/ast.{type Expr, type Range}
import sutra/env.{Grid, Scalar}
import sutra/eval
import sutra/parser
import sutra/value.{type Value, Empty, Err}

/// A cell address. `sheet` is the sheet's canonical (lower-case) name.
pub type Key {
  Key(sheet: String, col: Int, row: Int)
}

pub type Content {
  Blank
  Constant(input: String, value: Value)
  Formula(input: String, expr: Expr)
  Broken(input: String, error: parser.ParseError)
}

/// Something a formula reads.
pub type Dep {
  OnCell(Key)
  OnArea(sheet: String, range: Range)
}

pub opaque type Workbook {
  Workbook(
    sheets: List(String),
    canonical: Dict(String, String),
    contents: Dict(Key, Content),
    values: Dict(Key, Value),
    reads: Dict(Key, List(Dep)),
    cell_readers: Dict(Key, Set(Key)),
    area_readers: List(#(Key, String, Range)),
    spills: Dict(Key, Range),
    spill_owner: Dict(Key, Key),
    blocked: Set(Key),
    /// Arrays found to spill into cells they themselves depend on.
    spill_cycles: Set(Key),
    /// Set when two arrays competed for the same cells during a pass.
    rivalry: Bool,
    /// Formulas in a circular reference among the references themselves.
    in_cycle: Set(Key),
    extents: Dict(String, #(Int, Int)),
  )
}

/// What a change did: the formulas that were evaluated, every cell whose
/// value changed (spilled cells included), the cells in cycles, and whether
/// the workbook had to be recomputed from scratch because a dynamic array
/// changed shape or competed for cells.
pub type Recalc {
  Recalc(
    evaluated: List(Key),
    changed: List(Key),
    cycles: List(Key),
    rebuilt: Bool,
  )
}

/// Ranges with more cells than this are indexed as areas instead of being
/// expanded cell by cell into the reverse index.
const expand_limit = 2048

const max_rounds = 8

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

pub fn new(sheets: List(String)) -> Workbook {
  let sheets = case sheets {
    [] -> ["Sheet1"]
    _ -> sheets
  }
  Workbook(
    sheets: sheets,
    canonical: dict.from_list(list.map(sheets, fn(s) { #(canon(s), s) })),
    contents: dict.new(),
    values: dict.new(),
    reads: dict.new(),
    cell_readers: dict.new(),
    area_readers: [],
    spills: dict.new(),
    spill_owner: dict.new(),
    blocked: set.new(),
    spill_cycles: set.new(),
    rivalry: False,
    in_cycle: set.new(),
    extents: dict.new(),
  )
}

fn canon(sheet: String) -> String {
  string.lowercase(sheet)
}

/// Load many cells at once and compute everything. Cells are
/// #(sheet, column, row, input) with zero-based column and row.
pub fn from_cells(
  sheets: List(String),
  cells: List(#(String, Int, Int, String)),
) -> #(Workbook, Recalc) {
  let book =
    list.fold(cells, new(sheets), fn(book, cell) {
      let #(sheet, col, row, input) = cell
      case dict.get(book.canonical, canon(sheet)) {
        Ok(_) -> place(book, Key(canon(sheet), col, row), input)
        Error(_) -> book
      }
    })
  compute_all(book)
}

fn compute_all(book: Workbook) -> #(Workbook, Recalc) {
  settle(
    book,
    set.from_list(dict.keys(book.contents)),
    dict.new(),
    Recalc([], [], [], False),
    0,
    0,
  )
}

/// Recompute a workbook from its inputs alone, exactly as `from_cells`
/// would build it.
fn rebuild(book: Workbook, before: Dict(Key, Value)) -> #(Workbook, Recalc) {
  let cells =
    dict.to_list(book.contents)
    |> list.map(fn(p) {
      let #(key, content) = p
      let text = case content {
        Blank -> ""
        Constant(i, _) | Formula(i, _) | Broken(i, _) -> i
      }
      #(sheet_name(book, key.sheet), key.col, key.row, text)
    })
  let #(fresh, report) = from_cells(book.sheets, cells)
  let changed =
    list.append(dict.keys(before), dict.keys(fresh.values))
    |> list.unique
    |> list.filter(fn(k) { dict.get(before, k) != dict.get(fresh.values, k) })
  #(fresh, Recalc(..report, changed: changed, rebuilt: True))
}

/// Set one cell to what a person typed: a constant, or a formula starting
/// with "=". The empty string clears the cell.
pub fn set(
  book: Workbook,
  sheet: String,
  col: Int,
  row: Int,
  input: String,
) -> Result(#(Workbook, Recalc), Nil) {
  case dict.get(book.canonical, canon(sheet)) {
    Error(_) -> Error(Nil)
    Ok(_) -> {
      let key = Key(canon(sheet), col, row)
      let before = book.values
      let was_anchor = dict.get(book.spills, key)
      let book = place(book, key, input)
      // a cell that stops being a formula takes its spilled values with it
      let #(book, cleared) = case was_anchor, dict.get(book.contents, key) {
        Ok(_), Ok(Formula(..)) -> #(book, [])
        Ok(_), _ -> clear_spill(book, key)
        Error(_), _ -> #(book, [])
      }
      let owner = case dict.get(book.spill_owner, key) {
        Ok(anchor) -> [anchor]
        Error(_) -> []
      }
      let seeds = set.from_list(list.flatten([[key], cleared, owner]))
      Ok(recalc(book, seeds, before))
    }
  }
}

/// Like `set`, with an A1 address such as "B7".
pub fn set_a1(
  book: Workbook,
  sheet: String,
  address: String,
  input: String,
) -> Result(#(Workbook, Recalc), Nil) {
  use #(col, row) <- result.try(ast.parse_cell(address))
  set(book, sheet, col, row, input)
}

pub fn classify(input: String) -> Content {
  case input {
    "" -> Blank
    "=" <> _ ->
      case parser.parse(input) {
        Ok(expr) -> Formula(input, expr)
        Error(e) -> Broken(input, e)
      }
    _ -> Constant(input, value.from_input(input))
  }
}

/// Store new content for a cell and update the reverse index. Does not
/// recalculate.
fn place(book: Workbook, key: Key, input: String) -> Workbook {
  let book = unregister(book, key)
  let content = classify(input)
  let book = case content {
    Blank ->
      Workbook(
        ..book,
        contents: dict.delete(book.contents, key),
        values: case dict.has_key(book.spill_owner, key) {
          True -> book.values
          False -> dict.delete(book.values, key)
        },
      )
    Constant(_, v) ->
      Workbook(
        ..book,
        contents: dict.insert(book.contents, key, content),
        values: dict.insert(book.values, key, v),
      )
    Broken(..) ->
      Workbook(
        ..book,
        contents: dict.insert(book.contents, key, content),
        values: dict.insert(book.values, key, Err(value.ParseError)),
      )
    Formula(_, expr) ->
      register(
        Workbook(..book, contents: dict.insert(book.contents, key, content)),
        key,
        expr,
      )
  }
  case content {
    Blank -> book
    _ -> grow(book, key.sheet, key.row, key.col)
  }
}

fn grow(book: Workbook, sheet: String, row: Int, col: Int) -> Workbook {
  let #(rows, cols) = dict.get(book.extents, sheet) |> result.unwrap(#(0, 0))
  Workbook(
    ..book,
    extents: dict.insert(book.extents, sheet, #(
      int.max(rows, row + 1),
      int.max(cols, col + 1),
    )),
  )
}

/// The cells and ranges a formula reads, resolved to canonical sheets.
/// References to sheets that do not exist read nothing (they are #REF!).
fn deps_of(book: Workbook, key: Key, expr: Expr) -> List(Dep) {
  ast.references(expr)
  |> list.filter_map(fn(r) {
    case r {
      ast.Ref(sheet, col, row) ->
        sheet_key(book, key, sheet)
        |> result.map(fn(s) { OnCell(Key(s, col, row)) })
      ast.Area(sheet, range) ->
        sheet_key(book, key, sheet) |> result.map(fn(s) { OnArea(s, range) })
      _ -> Error(Nil)
    }
  })
}

fn sheet_key(
  book: Workbook,
  key: Key,
  sheet: option.Option(String),
) -> Result(String, Nil) {
  case sheet {
    None -> Ok(key.sheet)
    Some(name) ->
      case dict.has_key(book.canonical, canon(name)) {
        True -> Ok(canon(name))
        False -> Error(Nil)
      }
  }
}

fn register(book: Workbook, key: Key, expr: Expr) -> Workbook {
  let deps = deps_of(book, key, expr)
  let book = Workbook(..book, reads: dict.insert(book.reads, key, deps))
  list.fold(deps, book, fn(book, dep) {
    case dep {
      OnCell(cell) -> add_reader(book, cell, key)
      OnArea(sheet, range) ->
        case ast.range_size(range) > expand_limit {
          True ->
            Workbook(..book, area_readers: [
              #(key, sheet, range),
              ..book.area_readers
            ])
          False ->
            list.fold(cells_in(sheet, range), book, fn(book, cell) {
              add_reader(book, cell, key)
            })
        }
    }
  })
}

fn add_reader(book: Workbook, cell: Key, reader: Key) -> Workbook {
  Workbook(
    ..book,
    cell_readers: dict.upsert(book.cell_readers, cell, fn(existing) {
      case existing {
        Some(s) -> set.insert(s, reader)
        None -> set.from_list([reader])
      }
    }),
  )
}

fn unregister(book: Workbook, key: Key) -> Workbook {
  case dict.get(book.reads, key) {
    Error(_) -> book
    Ok(deps) -> {
      let book = Workbook(..book, reads: dict.delete(book.reads, key))
      list.fold(deps, book, fn(book, dep) {
        case dep {
          OnCell(cell) -> remove_reader(book, cell, key)
          OnArea(sheet, range) ->
            case ast.range_size(range) > expand_limit {
              True ->
                Workbook(
                  ..book,
                  area_readers: list.filter(book.area_readers, fn(a) {
                    a.0 != key
                  }),
                )
              False ->
                list.fold(cells_in(sheet, range), book, fn(book, cell) {
                  remove_reader(book, cell, key)
                })
            }
        }
      })
    }
  }
}

fn remove_reader(book: Workbook, cell: Key, reader: Key) -> Workbook {
  case dict.get(book.cell_readers, cell) {
    Error(_) -> book
    Ok(s) -> {
      let s = set.delete(s, reader)
      Workbook(..book, cell_readers: case set.is_empty(s) {
        True -> dict.delete(book.cell_readers, cell)
        False -> dict.insert(book.cell_readers, cell, s)
      })
    }
  }
}

fn cells_in(sheet: String, range: Range) -> List(Key) {
  int.range(range.top, range.bottom + 1, [], fn(acc, r) {
    int.range(range.left, range.right + 1, acc, fn(acc, c) {
      [Key(sheet, c, r), ..acc]
    })
  })
}

// ---------------------------------------------------------------------------
// Recalculation
// ---------------------------------------------------------------------------

/// Formulas that read `cell` directly or through a range.
fn readers(book: Workbook, cell: Key) -> List(Key) {
  let direct = case dict.get(book.cell_readers, cell) {
    Ok(s) -> set.to_list(s)
    Error(_) -> []
  }
  list.fold(book.area_readers, direct, fn(acc, a) {
    let #(reader, sheet, range) = a
    case sheet == cell.sheet && ast.range_contains(range, cell.col, cell.row) {
      True -> [reader, ..acc]
      False -> acc
    }
  })
}

/// Cells whose value can change when `cell` changes: its readers, and the
/// cells it spills into.
fn downstream(book: Workbook, cell: Key) -> List(Key) {
  let spilled = case dict.get(book.spills, cell) {
    Ok(range) -> list.filter(cells_in(cell.sheet, range), fn(k) { k != cell })
    Error(_) -> []
  }
  list.append(readers(book, cell), spilled)
}

fn closure(book: Workbook, frontier: List(Key), seen: Set(Key)) -> Set(Key) {
  case frontier {
    [] -> seen
    [cell, ..rest] ->
      case set.contains(seen, cell) {
        True -> closure(book, rest, seen)
        False ->
          closure(
            book,
            list.append(downstream(book, cell), rest),
            set.insert(seen, cell),
          )
      }
  }
}

fn is_formula(book: Workbook, key: Key) -> Bool {
  case dict.get(book.contents, key) {
    Ok(Formula(..)) -> True
    _ -> False
  }
}

/// `before` holds the values from before the edit, so the report can say
/// which cells really changed.
/// Recalculate what an edit can affect. If an array changes shape, the
/// cells it reaches were not known when the order was worked out, so the
/// workbook is recomputed from its inputs instead: an edit's result never
/// depends on the history of edits before it.
///
/// `before` holds the values from before the edit, so the report can say
/// which cells really changed.
fn recalc(
  book: Workbook,
  seeds: Set(Key),
  before: Dict(Key, Value),
) -> #(Workbook, Recalc) {
  // arrays caught in a spill loop last time are looked at afresh, as are
  // arrays that were blocked: the edit may have given them room
  let seeds =
    seeds
    |> set.union(book.spill_cycles)
    |> set.union(book.blocked)
  let had_loops = !set.is_empty(book.spill_cycles)
  let book = Workbook(..book, spill_cycles: set.new(), rivalry: False)
  let p = pass(book, seeds, before)
  case p.reshaped, had_loops || p.stuck || p.book.rivalry {
    [], False -> #(p.book, finish(p.report))
    _, _ -> rebuild(p.book, before)
  }
}

/// Evaluate until no array changes shape any more. Then look for arrays
/// that read their own spilled output; those are circular references, are
/// marked #CYCLE! and the workbook settles again around them.
fn settle(
  book: Workbook,
  seeds: Set(Key),
  before: Dict(Key, Value),
  acc: Recalc,
  round: Int,
  breaks: Int,
) -> #(Workbook, Recalc) {
  let p = pass(book, seeds, before)
  let book = p.book
  let acc =
    Recalc(
      ..acc,
      evaluated: list.append(acc.evaluated, p.report.evaluated),
      changed: list.append(acc.changed, p.report.changed),
      cycles: list.append(acc.cycles, p.report.cycles),
    )
  let again = fn(book: Workbook, cells: List(Key), acc, round, breaks) {
    // arrays that were blocked may have room now
    let seeds = set.from_list(list.append(cells, set.to_list(book.blocked)))
    settle(book, seeds, book.values, acc, round, breaks)
  }
  case p.reshaped, round < max_rounds {
    [], _ -> {
      let #(book, found, moved) =
        spill_loops(book, set.from_list(dict.keys(book.reads)))
      case found, round < max_rounds {
        [], _ | _, False -> #(book, finish(acc))
        _, True ->
          again(
            book,
            moved,
            Recalc(..acc, cycles: list.append(acc.cycles, found)),
            round + 1,
            breaks,
          )
      }
    }
    [_, ..], True -> again(book, p.reshaped, acc, round + 1, breaks)
    // Still changing shape after many rounds: the arrays doing it feed on
    // their own output and never settle (one that grows when it reads
    // nothing and shrinks when it reads itself). They are circular too.
    [_, ..], False ->
      case breaks < 3 {
        False -> #(book, finish(acc))
        True -> {
          let #(book, moved) = mark_spill_cycles(book, p.movers)
          again(
            book,
            list.append(p.movers, moved),
            Recalc(..acc, cycles: list.append(acc.cycles, p.movers)),
            0,
            breaks + 1,
          )
        }
      }
  }
}

fn finish(r: Recalc) -> Recalc {
  Recalc(
    ..r,
    evaluated: list.unique(r.evaluated),
    changed: list.unique(r.changed),
    cycles: list.unique(r.cycles),
  )
}

/// One pass: evaluate every formula downstream of `seeds` in dependency
/// order. Returns the cells whose spill region changed shape, which need
/// another pass because their readers were not known in advance.
fn pass(book: Workbook, seeds: Set(Key), before: Dict(Key, Value)) -> Pass {
  let touched = closure(book, set.to_list(seeds), set.new())
  let formulas = set.filter(touched, fn(k) { is_formula(book, k) })
  let full = predecessors(book, formulas, True)
  let #(order, leftover) = topo(formulas, full)
  // What is left over is in a cycle, downstream of one, or caught in a loop
  // that only exists through spilled cells. Only loops in the references
  // themselves are circular references.
  let static = predecessors(book, leftover, False)
  let cyclic =
    set.filter(leftover, fn(k) { reaches_itself(k, static, leftover) })
  let #(rest, stuck) = topo(set.difference(leftover, cyclic), full)
  // a loop through spilled cells may be stale (the array is about to change
  // shape): evaluate it in reference order and let the next round settle it
  let #(rest2, _) = topo(stuck, static)
  let book =
    Workbook(
      ..book,
      in_cycle: set.union(set.difference(book.in_cycle, formulas), cyclic),
    )
  let book =
    set.fold(cyclic, book, fn(book, k) {
      let #(book, _) = clear_spill(book, k)
      Workbook(..book, values: dict.insert(book.values, k, Err(value.Cycle)))
    })
  let evaluated = list.flatten([order, rest, rest2])
  let #(book, reshaped, movers) =
    list.fold(evaluated, #(book, [], []), fn(acc, k) {
      let #(book, reshaped, movers) = acc
      let #(book, moved) = evaluate_cell(book, k)
      case moved {
        [] -> #(book, reshaped, movers)
        _ -> #(book, list.append(moved, reshaped), [k, ..movers])
      }
    })
  let changed =
    set.to_list(touched)
    |> list.append(reshaped)
    |> list.append(set.to_list(seeds))
    |> list.unique
    |> list.filter(fn(k) { dict.get(before, k) != dict.get(book.values, k) })
  Pass(
    book: book,
    report: Recalc(
      evaluated: list.append(evaluated, set.to_list(cyclic)),
      changed: changed,
      cycles: set.to_list(cyclic),
      rebuilt: False,
    ),
    reshaped: reshaped,
    movers: movers,
    stuck: !set.is_empty(stuck),
  )
}

/// The outcome of one pass: the cells whose spill membership changed, the
/// arrays that changed shape, and whether a loop through spilled cells kept
/// part of the order from being worked out.
type Pass {
  Pass(
    book: Workbook,
    report: Recalc,
    reshaped: List(Key),
    movers: List(Key),
    stuck: Bool,
  )
}

/// Find arrays whose spilled cells feed back into themselves, mark them
/// #CYCLE! and remember them so they stay that way until something they
/// depend on changes. Returns the arrays and the cells that were cleared.
fn spill_loops(
  book: Workbook,
  evaluated: Set(Key),
) -> #(Workbook, List(Key), List(Key)) {
  // a loop through a circular reference is already reported as one
  let evaluated = set.difference(evaluated, book.in_cycle)
  let after = predecessors(book, evaluated, True)
  let #(_, left) = topo(evaluated, after)
  let anchors =
    set.filter(left, fn(k) {
      dict.has_key(book.spills, k) && reaches_itself(k, after, left)
    })
    |> set.to_list
  let #(book, moved) = mark_spill_cycles(book, anchors)
  #(book, anchors, list.append(anchors, moved))
}

/// Mark arrays as circular: #CYCLE!, no spill, and remembered so they stay
/// that way for the rest of this calculation. Returns the cleared cells.
fn mark_spill_cycles(
  book: Workbook,
  anchors: List(Key),
) -> #(Workbook, List(Key)) {
  list.fold(anchors, #(book, []), fn(acc, k) {
    let #(book, moved) = acc
    let #(book, cleared) = clear_spill(book, k)
    #(
      Workbook(
        ..book,
        values: dict.insert(book.values, k, Err(value.Cycle)),
        spill_cycles: set.insert(book.spill_cycles, k),
      ),
      list.append(cleared, moved),
    )
  })
}

/// For each formula in the set, the formulas in the set it must wait for.
/// With `through_spills`, reading a spilled cell means waiting for the
/// formula that spills there.
fn predecessors(
  book: Workbook,
  formulas: Set(Key),
  through_spills: Bool,
) -> Dict(Key, Set(Key)) {
  // cells whose value is produced by a formula in the set
  let produced = case through_spills {
    False -> set.to_list(formulas)
    True ->
      dict.fold(book.spill_owner, set.to_list(formulas), fn(acc, cell, owner) {
        case set.contains(formulas, owner) {
          True -> [cell, ..acc]
          False -> acc
        }
      })
  }
  let producer = fn(cell: Key) -> Result(Key, Nil) {
    case set.contains(formulas, cell) {
      True -> Ok(cell)
      False if through_spills ->
        case dict.get(book.spill_owner, cell) {
          Ok(owner) ->
            case set.contains(formulas, owner) {
              True -> Ok(owner)
              False -> Error(Nil)
            }
          Error(_) -> Error(Nil)
        }
      False -> Error(Nil)
    }
  }
  let produced_count = list.length(produced)
  set.fold(formulas, dict.new(), fn(acc, f) {
    let deps = dict.get(book.reads, f) |> result.unwrap([])
    let ps =
      list.fold(deps, set.new(), fn(ps, dep) {
        case dep {
          OnCell(cell) ->
            case producer(cell) {
              Ok(p) -> set.insert(ps, p)
              Error(_) -> ps
            }
          OnArea(sheet, range) ->
            case ast.range_size(range) <= produced_count {
              True ->
                list.fold(cells_in(sheet, range), ps, fn(ps, cell) {
                  case producer(cell) {
                    Ok(p) -> set.insert(ps, p)
                    Error(_) -> ps
                  }
                })
              False ->
                list.fold(produced, ps, fn(ps, cell) {
                  case
                    cell.sheet == sheet
                    && ast.range_contains(range, cell.col, cell.row)
                  {
                    True ->
                      case producer(cell) {
                        Ok(p) -> set.insert(ps, p)
                        Error(_) -> ps
                      }
                    False -> ps
                  }
                })
            }
        }
      })
    dict.insert(acc, f, ps)
  })
}

/// Kahn's algorithm. Returns the order and the nodes it could not place.
fn topo(nodes: Set(Key), preds: Dict(Key, Set(Key))) -> #(List(Key), Set(Key)) {
  let preds_of = fn(k) {
    dict.get(preds, k)
    |> result.unwrap(set.new())
    |> set.filter(fn(p) { set.contains(nodes, p) })
  }
  let indegree =
    set.fold(nodes, dict.new(), fn(acc, k) {
      dict.insert(acc, k, set.size(preds_of(k)))
    })
  let succs =
    set.fold(nodes, dict.new(), fn(acc, k) {
      set.fold(preds_of(k), acc, fn(acc, p) {
        dict.upsert(acc, p, fn(existing) {
          case existing {
            Some(l) -> [k, ..l]
            None -> [k]
          }
        })
      })
    })
  let ready =
    dict.fold(indegree, [], fn(acc, k, d) {
      case d == 0 {
        True -> [k, ..acc]
        False -> acc
      }
    })
    |> list.sort(compare_keys)
  let #(order, _) = kahn(ready, indegree, succs, [])
  let placed = set.from_list(order)
  #(order, set.filter(nodes, fn(k) { !set.contains(placed, k) }))
}

fn kahn(
  ready: List(Key),
  indegree: Dict(Key, Int),
  succs: Dict(Key, List(Key)),
  out: List(Key),
) -> #(List(Key), Dict(Key, Int)) {
  case ready {
    [] -> #(list.reverse(out), indegree)
    [k, ..rest] -> {
      let #(ready, indegree) =
        list.fold(
          dict.get(succs, k) |> result.unwrap([]),
          #(rest, indegree),
          fn(acc, s) {
            let #(ready, indegree) = acc
            let d = { dict.get(indegree, s) |> result.unwrap(1) } - 1
            let indegree = dict.insert(indegree, s, d)
            case d == 0 {
              True -> #([s, ..ready], indegree)
              False -> #(ready, indegree)
            }
          },
        )
      kahn(ready, indegree, succs, [k, ..out])
    }
  }
}

/// Order cells by sheet, then row, then column, for deterministic output.
pub fn compare_keys(a: Key, b: Key) {
  case string.compare(a.sheet, b.sheet) {
    order.Eq ->
      case int.compare(a.row, b.row) {
        order.Eq -> int.compare(a.col, b.col)
        o -> o
      }
    o -> o
  }
}

/// Whether `start` can reach itself through predecessors inside `within`.
fn reaches_itself(
  start: Key,
  preds: Dict(Key, Set(Key)),
  within: Set(Key),
) -> Bool {
  search(
    start,
    preds,
    within,
    set.to_list(preds_in(start, preds, within)),
    set.new(),
  )
}

fn preds_in(k: Key, preds: Dict(Key, Set(Key)), within: Set(Key)) -> Set(Key) {
  dict.get(preds, k)
  |> result.unwrap(set.new())
  |> set.filter(fn(p) { set.contains(within, p) })
}

fn search(
  target: Key,
  preds: Dict(Key, Set(Key)),
  within: Set(Key),
  frontier: List(Key),
  seen: Set(Key),
) -> Bool {
  case frontier {
    [] -> False
    [k, ..rest] ->
      case k == target {
        True -> True
        False ->
          case set.contains(seen, k) {
            True -> search(target, preds, within, rest, seen)
            False ->
              search(
                target,
                preds,
                within,
                list.append(set.to_list(preds_in(k, preds, within)), rest),
                set.insert(seen, k),
              )
          }
      }
  }
}

fn environment(book: Workbook, sheet: String) -> env.Env {
  env.Env(
    sheet: sheet,
    get: fn(s, c, r) {
      dict.get(book.values, Key(s, c, r)) |> result.unwrap(Empty)
    },
    resolve_sheet: fn(name) {
      case dict.has_key(book.canonical, canon(name)) {
        True -> Ok(canon(name))
        False -> Error(Nil)
      }
    },
    extent: fn(s) { dict.get(book.extents, s) |> result.unwrap(#(0, 0)) },
    locals: dict.new(),
    eval: eval.evaluate,
  )
}

/// Evaluate one formula cell and store its value, spilling arrays.
/// Returns the cells whose spill membership changed.
fn evaluate_cell(book: Workbook, key: Key) -> #(Workbook, List(Key)) {
  case dict.get(book.contents, key) {
    Ok(Formula(_, expr)) -> {
      let result =
        eval.cell_result(eval.evaluate(expr, environment(book, key.sheet)))
      let old_region = dict.get(book.spills, key)
      case result {
        Scalar(v) -> {
          let #(book, cleared) = clear_spill(book, key)
          let book =
            Workbook(
              ..book,
              values: dict.insert(book.values, key, v),
              blocked: set.delete(book.blocked, key),
            )
          #(book, cleared)
        }
        Grid(rows) ->
          case set.contains(book.spill_cycles, key) {
            False -> spill(book, key, rows, old_region)
            True -> {
              let #(book, cleared) = clear_spill(book, key)
              #(
                Workbook(
                  ..book,
                  values: dict.insert(book.values, key, Err(value.Cycle)),
                ),
                cleared,
              )
            }
          }
      }
    }
    _ -> #(book, [])
  }
}

fn spill(
  book: Workbook,
  key: Key,
  rows: List(List(Value)),
  old_region: Result(Range, Nil),
) -> #(Workbook, List(Key)) {
  let height = list.length(rows)
  let width = case rows {
    [r, ..] -> list.length(r)
    [] -> 0
  }
  let region =
    ast.Range(key.row, key.col, key.row + height - 1, key.col + width - 1)
  let fits = region.bottom < ast.max_rows && region.right < ast.max_cols
  let cells = case fits {
    True -> cells_in(key.sheet, region)
    False -> []
  }
  let has_content =
    list.any(cells, fn(cell) {
      cell != key && dict.has_key(book.contents, cell)
    })
  // Two arrays that want the same cells: the winner must not depend on the
  // order formulas happened to be evaluated in.
  let rivals =
    list.filter_map(cells, fn(cell) {
      case dict.get(book.spill_owner, cell) {
        Ok(owner) if owner != key -> Ok(owner)
        _ -> Error(Nil)
      }
    })
    |> list.unique
  // An array never evicts one whose output it reads (that would pull the
  // rug from under itself); otherwise the earlier formula wins.
  let outranked =
    list.any(rivals, fn(r) {
      depends_on(book, key, r)
      || { compare_keys(r, key) == order.Lt && !depends_on(book, r, key) }
    })
  let book = case rivals {
    [] -> book
    _ -> Workbook(..book, rivalry: True)
  }
  case !fits || has_content || outranked {
    True -> {
      let #(book, cleared) = clear_spill(book, key)
      #(
        Workbook(
          ..book,
          values: dict.insert(book.values, key, Err(value.Spill)),
          blocked: set.insert(book.blocked, key),
        ),
        cleared,
      )
    }
    False -> {
      // later formulas that held some of these cells lose them
      let #(book, evicted) =
        list.fold(rivals, #(book, []), fn(acc, rival) {
          let #(book, moved) = acc
          let #(book, cleared) = clear_spill(book, rival)
          #(
            Workbook(
              ..book,
              values: dict.insert(book.values, rival, Err(value.Spill)),
              blocked: set.insert(book.blocked, rival),
            ),
            list.flatten([[rival], cleared, moved]),
          )
        })
      let same_shape = old_region == Ok(region)
      let #(book, cleared) = case same_shape {
        True -> #(book, [])
        False -> clear_spill(book, key)
      }
      let cleared = list.append(evicted, cleared)
      let book =
        list.index_fold(rows, book, fn(book, row, i) {
          list.index_fold(row, book, fn(book, v, j) {
            let cell = Key(key.sheet, key.col + j, key.row + i)
            let v = case v {
              Empty -> value.Number(0.0)
              _ -> v
            }
            let book =
              Workbook(..book, values: dict.insert(book.values, cell, v))
            case cell == key {
              True -> book
              False ->
                Workbook(
                  ..book,
                  spill_owner: dict.insert(book.spill_owner, cell, key),
                )
            }
          })
        })
      let book =
        Workbook(
          ..book,
          spills: dict.insert(book.spills, key, region),
          blocked: set.delete(book.blocked, key),
        )
        |> grow(key.sheet, region.bottom, region.right)
      let moved = case same_shape {
        True -> evicted
        False -> list.append(cleared, list.filter(cells, fn(c) { c != key }))
      }
      #(book, moved)
    }
  }
}

/// Whether formula `x` reads, directly or through other formulas and
/// spilled cells, the value of formula `y` or any cell `y` spills into.
fn depends_on(book: Workbook, x: Key, y: Key) -> Bool {
  let region = case dict.get(book.spills, y) {
    Ok(r) -> r
    Error(_) -> ast.Range(y.row, y.col, y.row, y.col)
  }
  let hits = fn(dep: Dep) {
    case dep {
      OnCell(c) ->
        c.sheet == y.sheet && ast.range_contains(region, c.col, c.row)
      OnArea(sheet, r) ->
        sheet == y.sheet
        && r.top <= region.bottom
        && region.top <= r.bottom
        && r.left <= region.right
        && region.left <= r.right
    }
  }
  reads_into(book, [x], set.new(), hits)
}

fn reads_into(
  book: Workbook,
  frontier: List(Key),
  seen: Set(Key),
  hits: fn(Dep) -> Bool,
) -> Bool {
  case frontier {
    [] -> False
    [f, ..rest] ->
      case set.contains(seen, f) {
        True -> reads_into(book, rest, seen, hits)
        False -> {
          let deps = dict.get(book.reads, f) |> result.unwrap([])
          case list.any(deps, hits) {
            True -> True
            False -> {
              let next = list.flat_map(deps, fn(dep) { producers(book, dep) })
              reads_into(
                book,
                list.append(next, rest),
                set.insert(seen, f),
                hits,
              )
            }
          }
        }
      }
  }
}

/// The formulas whose values a dependency can see: formula cells inside
/// it, and the arrays that spill into it.
fn producers(book: Workbook, dep: Dep) -> List(Key) {
  case dep {
    OnCell(c) ->
      case dict.has_key(book.reads, c), dict.get(book.spill_owner, c) {
        True, _ -> [c]
        False, Ok(owner) -> [owner]
        False, Error(_) -> []
      }
    OnArea(sheet, range) -> {
      let inside = fn(k: Key) {
        k.sheet == sheet && ast.range_contains(range, k.col, k.row)
      }
      let formulas = list.filter(dict.keys(book.reads), inside)
      dict.fold(book.spill_owner, formulas, fn(acc, cell, owner) {
        case inside(cell) {
          True -> [owner, ..acc]
          False -> acc
        }
      })
    }
  }
}

/// Remove a formula's spilled values. Returns the cells that were cleared.
fn clear_spill(book: Workbook, key: Key) -> #(Workbook, List(Key)) {
  case dict.get(book.spills, key) {
    Error(_) -> #(book, [])
    Ok(region) -> {
      let cells =
        cells_in(key.sheet, region)
        |> list.filter(fn(c) {
          c != key && dict.get(book.spill_owner, c) == Ok(key)
        })
      let book =
        list.fold(cells, book, fn(book, c) {
          Workbook(
            ..book,
            spill_owner: dict.delete(book.spill_owner, c),
            values: case dict.has_key(book.contents, c) {
              True -> book.values
              False -> dict.delete(book.values, c)
            },
          )
        })
      #(Workbook(..book, spills: dict.delete(book.spills, key)), cells)
    }
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

pub fn sheets(book: Workbook) -> List(String) {
  book.sheets
}

/// The display name of a canonical sheet name.
pub fn sheet_name(book: Workbook, sheet: String) -> String {
  dict.get(book.canonical, canon(sheet)) |> result.unwrap(sheet)
}

pub fn value(book: Workbook, sheet: String, col: Int, row: Int) -> Value {
  dict.get(book.values, Key(canon(sheet), col, row)) |> result.unwrap(Empty)
}

pub fn content(book: Workbook, sheet: String, col: Int, row: Int) -> Content {
  dict.get(book.contents, Key(canon(sheet), col, row)) |> result.unwrap(Blank)
}

/// What was typed into a cell ("" for blank and spilled cells).
pub fn input(book: Workbook, sheet: String, col: Int, row: Int) -> String {
  case content(book, sheet, col, row) {
    Blank -> ""
    Constant(i, _) | Formula(i, _) | Broken(i, _) -> i
  }
}

/// The formula a spilled cell's value comes from.
pub fn spilled_from(book: Workbook, key: Key) -> Result(Key, Nil) {
  dict.get(book.spill_owner, key)
}

/// The region a formula spills into, if it spills.
pub fn spill_region(book: Workbook, key: Key) -> Result(Range, Nil) {
  dict.get(book.spills, key)
}

/// #(rows, columns) in use on a sheet.
pub fn extent(book: Workbook, sheet: String) -> #(Int, Int) {
  dict.get(book.extents, canon(sheet)) |> result.unwrap(#(0, 0))
}

/// Every cell with content or a value, in sheet, row, column order.
pub fn cells(book: Workbook) -> List(Key) {
  dict.keys(book.values)
  |> list.append(dict.keys(book.contents))
  |> list.unique
  |> list.sort(compare_keys)
}

pub fn formulas(book: Workbook) -> List(Key) {
  dict.keys(book.reads) |> list.sort(compare_keys)
}

/// What a formula reads, as written.
pub fn precedents(book: Workbook, key: Key) -> List(Dep) {
  dict.get(book.reads, key) |> result.unwrap([])
}

/// The formulas that read a cell directly or through a range.
pub fn dependents(book: Workbook, key: Key) -> List(Key) {
  readers(book, key) |> list.unique |> list.sort(compare_keys)
}

/// Every value, for comparing two workbooks in tests.
pub fn snapshot(book: Workbook) -> List(#(Key, Value)) {
  dict.to_list(book.values)
  |> list.filter(fn(p) { p.1 != Empty })
  |> list.sort(fn(a, b) { compare_keys(a.0, b.0) })
}

pub fn key_name(book: Workbook, key: Key) -> String {
  sheet_name(book, key.sheet) <> "!" <> ast.cell_name(key.col, key.row)
}
