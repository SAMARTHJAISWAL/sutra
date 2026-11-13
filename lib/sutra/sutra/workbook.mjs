import * as $dict from "../../gleam_stdlib/gleam/dict.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $option from "../../gleam_stdlib/gleam/option.mjs";
import { None, Some } from "../../gleam_stdlib/gleam/option.mjs";
import * as $order from "../../gleam_stdlib/gleam/order.mjs";
import * as $result from "../../gleam_stdlib/gleam/result.mjs";
import * as $set from "../../gleam_stdlib/gleam/set.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
  isEqual,
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $env from "../sutra/env.mjs";
import { Grid, Scalar } from "../sutra/env.mjs";
import * as $eval from "../sutra/eval.mjs";
import * as $parser from "../sutra/parser.mjs";
import * as $value from "../sutra/value.mjs";
import { Empty, Err, Value$Empty$const } from "../sutra/value.mjs";

export class Key extends $CustomType {
  constructor(sheet, col, row) {
    super();
    this.sheet = sheet;
    this.col = col;
    this.row = row;
  }
}
export const Key$Key = (sheet, col, row) => new Key(sheet, col, row);
export const Key$isKey = (value) => value instanceof Key;
export const Key$Key$sheet = (value) => value.sheet;
export const Key$Key$0 = (value) => value.sheet;
export const Key$Key$col = (value) => value.col;
export const Key$Key$1 = (value) => value.col;
export const Key$Key$row = (value) => value.row;
export const Key$Key$2 = (value) => value.row;

export class Blank extends $CustomType {}
export const Content$Blank$const = new Blank();
export const Content$Blank = () => Content$Blank$const;
export const Content$isBlank = (value) => value instanceof Blank;

export class Constant extends $CustomType {
  constructor(input, value) {
    super();
    this.input = input;
    this.value = value;
  }
}
export const Content$Constant = (input, value) => new Constant(input, value);
export const Content$isConstant = (value) => value instanceof Constant;
export const Content$Constant$input = (value) => value.input;
export const Content$Constant$0 = (value) => value.input;
export const Content$Constant$value = (value) => value.value;
export const Content$Constant$1 = (value) => value.value;

export class Formula extends $CustomType {
  constructor(input, expr) {
    super();
    this.input = input;
    this.expr = expr;
  }
}
export const Content$Formula = (input, expr) => new Formula(input, expr);
export const Content$isFormula = (value) => value instanceof Formula;
export const Content$Formula$input = (value) => value.input;
export const Content$Formula$0 = (value) => value.input;
export const Content$Formula$expr = (value) => value.expr;
export const Content$Formula$1 = (value) => value.expr;

export class Broken extends $CustomType {
  constructor(input, error) {
    super();
    this.input = input;
    this.error = error;
  }
}
export const Content$Broken = (input, error) => new Broken(input, error);
export const Content$isBroken = (value) => value instanceof Broken;
export const Content$Broken$input = (value) => value.input;
export const Content$Broken$0 = (value) => value.input;
export const Content$Broken$error = (value) => value.error;
export const Content$Broken$1 = (value) => value.error;

export class OnCell extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Dep$OnCell = ($0) => new OnCell($0);
export const Dep$isOnCell = (value) => value instanceof OnCell;
export const Dep$OnCell$0 = (value) => value[0];

export class OnArea extends $CustomType {
  constructor(sheet, range) {
    super();
    this.sheet = sheet;
    this.range = range;
  }
}
export const Dep$OnArea = (sheet, range) => new OnArea(sheet, range);
export const Dep$isOnArea = (value) => value instanceof OnArea;
export const Dep$OnArea$sheet = (value) => value.sheet;
export const Dep$OnArea$0 = (value) => value.sheet;
export const Dep$OnArea$range = (value) => value.range;
export const Dep$OnArea$1 = (value) => value.range;

class Workbook extends $CustomType {
  constructor(sheets, canonical, contents, values, reads, cell_readers, area_readers, spills, spill_owner, blocked, spill_cycles, rivalry, in_cycle, extents) {
    super();
    this.sheets = sheets;
    this.canonical = canonical;
    this.contents = contents;
    this.values = values;
    this.reads = reads;
    this.cell_readers = cell_readers;
    this.area_readers = area_readers;
    this.spills = spills;
    this.spill_owner = spill_owner;
    this.blocked = blocked;
    this.spill_cycles = spill_cycles;
    this.rivalry = rivalry;
    this.in_cycle = in_cycle;
    this.extents = extents;
  }
}

export class Recalc extends $CustomType {
  constructor(evaluated, changed, cycles, rebuilt) {
    super();
    this.evaluated = evaluated;
    this.changed = changed;
    this.cycles = cycles;
    this.rebuilt = rebuilt;
  }
}
export const Recalc$Recalc = (evaluated, changed, cycles, rebuilt) =>
  new Recalc(evaluated, changed, cycles, rebuilt);
export const Recalc$isRecalc = (value) => value instanceof Recalc;
export const Recalc$Recalc$evaluated = (value) => value.evaluated;
export const Recalc$Recalc$0 = (value) => value.evaluated;
export const Recalc$Recalc$changed = (value) => value.changed;
export const Recalc$Recalc$1 = (value) => value.changed;
export const Recalc$Recalc$cycles = (value) => value.cycles;
export const Recalc$Recalc$2 = (value) => value.cycles;
export const Recalc$Recalc$rebuilt = (value) => value.rebuilt;
export const Recalc$Recalc$3 = (value) => value.rebuilt;

class Pass extends $CustomType {
  constructor(book, report, reshaped, movers, stuck) {
    super();
    this.book = book;
    this.report = report;
    this.reshaped = reshaped;
    this.movers = movers;
    this.stuck = stuck;
  }
}

const max_rounds = 8;

/**
 * Ranges with more cells than this are indexed as areas instead of being
 * expanded cell by cell into the reverse index.
 * 
 * @ignore
 */
const expand_limit = 2048;

function canon(sheet) {
  return $string.lowercase(sheet);
}

export function value(book, sheet, col, row) {
  let _pipe = $dict.get(book.values, new Key(canon(sheet), col, row));
  return $result.unwrap(_pipe, Value$Empty$const);
}

function cells_in(sheet, range) {
  return $int.range(
    range.top,
    range.bottom + 1,
    $List$Empty$const,
    (acc, r) => {
      return $int.range(
        range.left,
        range.right + 1,
        acc,
        (acc, c) => { return listPrepend(new Key(sheet, c, r), acc); },
      );
    },
  );
}

/**
 * Remove a formula's spilled values. Returns the cells that were cleared.
 * 
 * @ignore
 */
function clear_spill(book, key) {
  let $ = $dict.get(book.spills, key);
  if ($ instanceof Ok) {
    let region = $[0];
    let _block;
    let _pipe = cells_in(key.sheet, region);
    _block = $list.filter(
      _pipe,
      (c) => {
        return (!isEqual(c, key)) && (isEqual(
          $dict.get(book.spill_owner, c),
          new Ok(key)
        ));
      },
    );
    let cells$1 = _block;
    let book$1 = $list.fold(
      cells$1,
      book,
      (book, c) => {
        return new Workbook(
          book.sheets,
          book.canonical,
          book.contents,
          (() => {
            let $1 = $dict.has_key(book.contents, c);
            if ($1) {
              return book.values;
            } else {
              return $dict.delete$(book.values, c);
            }
          })(),
          book.reads,
          book.cell_readers,
          book.area_readers,
          book.spills,
          $dict.delete$(book.spill_owner, c),
          book.blocked,
          book.spill_cycles,
          book.rivalry,
          book.in_cycle,
          book.extents,
        );
      },
    );
    return [
      new Workbook(
        book$1.sheets,
        book$1.canonical,
        book$1.contents,
        book$1.values,
        book$1.reads,
        book$1.cell_readers,
        book$1.area_readers,
        $dict.delete$(book$1.spills, key),
        book$1.spill_owner,
        book$1.blocked,
        book$1.spill_cycles,
        book$1.rivalry,
        book$1.in_cycle,
        book$1.extents,
      ),
      cells$1,
    ];
  } else {
    return [book, $List$Empty$const];
  }
}

function finish(r) {
  return new Recalc(
    $list.unique(r.evaluated),
    $list.unique(r.changed),
    $list.unique(r.cycles),
    r.rebuilt,
  );
}

function kahn(loop$ready, loop$indegree, loop$succs, loop$out) {
  while (true) {
    let ready = loop$ready;
    let indegree = loop$indegree;
    let succs = loop$succs;
    let out = loop$out;
    if (ready instanceof $Empty) {
      return [$list.reverse(out), indegree];
    } else {
      let k = ready.head;
      let rest = ready.tail;
      let $ = $list.fold(
        (() => {
          let _pipe = $dict.get(succs, k);
          return $result.unwrap(_pipe, $List$Empty$const);
        })(),
        [rest, indegree],
        (acc, s) => {
          let ready$1 = acc[0];
          let indegree$1 = acc[1];
          let d = (() => {
            let _pipe = $dict.get(indegree$1, s);
            return $result.unwrap(_pipe, 1);
          })() - 1;
          let indegree$2 = $dict.insert(indegree$1, s, d);
          let $1 = d === 0;
          if ($1) {
            return [listPrepend(s, ready$1), indegree$2];
          } else {
            return [ready$1, indegree$2];
          }
        },
      );
      let ready$1 = $[0];
      let indegree$1 = $[1];
      loop$ready = ready$1;
      loop$indegree = indegree$1;
      loop$succs = succs;
      loop$out = listPrepend(k, out);
    }
  }
}

/**
 * Order cells by sheet, then row, then column, for deterministic output.
 */
export function compare_keys(a, b) {
  let $ = $string.compare(a.sheet, b.sheet);
  if ($ instanceof $order.Eq) {
    let $1 = $int.compare(a.row, b.row);
    if ($1 instanceof $order.Eq) {
      return $int.compare(a.col, b.col);
    } else {
      return $1;
    }
  } else {
    return $;
  }
}

function grow(book, sheet, row, col) {
  let _block;
  let _pipe = $dict.get(book.extents, sheet);
  _block = $result.unwrap(_pipe, [0, 0]);
  let $ = _block;
  let rows = $[0];
  let cols = $[1];
  return new Workbook(
    book.sheets,
    book.canonical,
    book.contents,
    book.values,
    book.reads,
    book.cell_readers,
    book.area_readers,
    book.spills,
    book.spill_owner,
    book.blocked,
    book.spill_cycles,
    book.rivalry,
    book.in_cycle,
    $dict.insert(
      book.extents,
      sheet,
      [$int.max(rows, row + 1), $int.max(cols, col + 1)],
    ),
  );
}

/**
 * The formulas whose values a dependency can see: formula cells inside
 * it, and the arrays that spill into it.
 * 
 * @ignore
 */
function producers(book, dep) {
  if (dep instanceof OnCell) {
    let c = dep[0];
    let $ = $dict.has_key(book.reads, c);
    let $1 = $dict.get(book.spill_owner, c);
    if ($) {
      return listPrepend(c, $List$Empty$const);
    } else if ($1 instanceof Ok) {
      let owner = $1[0];
      return listPrepend(owner, $List$Empty$const);
    } else {
      return $List$Empty$const;
    }
  } else {
    let sheet = dep.sheet;
    let range = dep.range;
    let inside = (k) => {
      return (k.sheet === sheet) && $ast.range_contains(range, k.col, k.row);
    };
    let formulas$1 = $list.filter($dict.keys(book.reads), inside);
    return $dict.fold(
      book.spill_owner,
      formulas$1,
      (acc, cell, owner) => {
        let $ = inside(cell);
        if ($) {
          return listPrepend(owner, acc);
        } else {
          return acc;
        }
      },
    );
  }
}

function environment(book, sheet) {
  return new $env.Env(
    sheet,
    (s, c, r) => {
      let _pipe = $dict.get(book.values, new Key(s, c, r));
      return $result.unwrap(_pipe, Value$Empty$const);
    },
    (name) => {
      let $ = $dict.has_key(book.canonical, canon(name));
      if ($) {
        return new Ok(canon(name));
      } else {
        return new Error(undefined);
      }
    },
    (s) => {
      let _pipe = $dict.get(book.extents, s);
      return $result.unwrap(_pipe, [0, 0]);
    },
    $dict.new$(),
    $eval.evaluate,
  );
}

function is_formula(book, key) {
  let $ = $dict.get(book.contents, key);
  if ($ instanceof Ok && $[0] instanceof Formula) {
    return true;
  } else {
    return false;
  }
}

function sheet_key(book, key, sheet) {
  if (sheet instanceof Some) {
    let name = sheet[0];
    let $ = $dict.has_key(book.canonical, canon(name));
    if ($) {
      return new Ok(canon(name));
    } else {
      return new Error(undefined);
    }
  } else {
    return new Ok(key.sheet);
  }
}

/**
 * The cells and ranges a formula reads, resolved to canonical sheets.
 * References to sheets that do not exist read nothing (they are #REF!).
 * 
 * @ignore
 */
function deps_of(book, key, expr) {
  let _pipe = $ast.references(expr);
  return $list.filter_map(
    _pipe,
    (r) => {
      if (r instanceof $ast.Ref) {
        let sheet = r.sheet;
        let col = r.col;
        let row = r.row;
        let _pipe$1 = sheet_key(book, key, sheet);
        return $result.map(
          _pipe$1,
          (s) => { return new OnCell(new Key(s, col, row)); },
        );
      } else if (r instanceof $ast.Area) {
        let sheet = r.sheet;
        let range = r.range;
        let _pipe$1 = sheet_key(book, key, sheet);
        return $result.map(_pipe$1, (s) => { return new OnArea(s, range); });
      } else {
        return new Error(undefined);
      }
    },
  );
}

export function classify(input) {
  if (input === "") {
    return Content$Blank$const;
  } else if (input.charCodeAt(0) === 61) {
    let $ = $parser.parse(input);
    if ($ instanceof Ok) {
      let expr = $[0];
      return new Formula(input, expr);
    } else {
      let e = $[0];
      return new Broken(input, e);
    }
  } else {
    return new Constant(input, $value.from_input(input));
  }
}

/**
 * The display name of a canonical sheet name.
 */
export function sheet_name(book, sheet) {
  let _pipe = $dict.get(book.canonical, canon(sheet));
  return $result.unwrap(_pipe, sheet);
}

/**
 * Mark arrays as circular: #CYCLE!, no spill, and remembered so they stay
 * that way for the rest of this calculation. Returns the cleared cells.
 * 
 * @ignore
 */
function mark_spill_cycles(book, anchors) {
  return $list.fold(
    anchors,
    [book, $List$Empty$const],
    (acc, k) => {
      let book$1 = acc[0];
      let moved = acc[1];
      let $ = clear_spill(book$1, k);
      let book$2 = $[0];
      let cleared = $[1];
      return [
        new Workbook(
          book$2.sheets,
          book$2.canonical,
          book$2.contents,
          $dict.insert(book$2.values, k, new Err($value.ErrorKind$Cycle$const)),
          book$2.reads,
          book$2.cell_readers,
          book$2.area_readers,
          book$2.spills,
          book$2.spill_owner,
          book$2.blocked,
          $set.insert(book$2.spill_cycles, k),
          book$2.rivalry,
          book$2.in_cycle,
          book$2.extents,
        ),
        $list.append(cleared, moved),
      ];
    },
  );
}

function preds_in(k, preds, within) {
  let _pipe = $dict.get(preds, k);
  let _pipe$1 = $result.unwrap(_pipe, $set.new$());
  return $set.filter(_pipe$1, (p) => { return $set.contains(within, p); });
}

function search(loop$target, loop$preds, loop$within, loop$frontier, loop$seen) {
  while (true) {
    let target = loop$target;
    let preds = loop$preds;
    let within = loop$within;
    let frontier = loop$frontier;
    let seen = loop$seen;
    if (frontier instanceof $Empty) {
      return false;
    } else {
      let k = frontier.head;
      let rest = frontier.tail;
      let $ = isEqual(k, target);
      if ($) {
        return $;
      } else {
        let $1 = $set.contains(seen, k);
        if ($1) {
          loop$target = target;
          loop$preds = preds;
          loop$within = within;
          loop$frontier = rest;
          loop$seen = seen;
        } else {
          loop$target = target;
          loop$preds = preds;
          loop$within = within;
          loop$frontier = $list.append(
            $set.to_list(preds_in(k, preds, within)),
            rest,
          );
          loop$seen = $set.insert(seen, k);
        }
      }
    }
  }
}

/**
 * Whether `start` can reach itself through predecessors inside `within`.
 * 
 * @ignore
 */
function reaches_itself(start, preds, within) {
  return search(
    start,
    preds,
    within,
    $set.to_list(preds_in(start, preds, within)),
    $set.new$(),
  );
}

/**
 * Kahn's algorithm. Returns the order and the nodes it could not place.
 * 
 * @ignore
 */
function topo(nodes, preds) {
  let preds_of = (k) => {
    let _pipe = $dict.get(preds, k);
    let _pipe$1 = $result.unwrap(_pipe, $set.new$());
    return $set.filter(_pipe$1, (p) => { return $set.contains(nodes, p); });
  };
  let indegree = $set.fold(
    nodes,
    $dict.new$(),
    (acc, k) => { return $dict.insert(acc, k, $set.size(preds_of(k))); },
  );
  let succs = $set.fold(
    nodes,
    $dict.new$(),
    (acc, k) => {
      return $set.fold(
        preds_of(k),
        acc,
        (acc, p) => {
          return $dict.upsert(
            acc,
            p,
            (existing) => {
              if (existing instanceof Some) {
                let l = existing[0];
                return listPrepend(k, l);
              } else {
                return listPrepend(k, $List$Empty$const);
              }
            },
          );
        },
      );
    },
  );
  let _block;
  let _pipe = $dict.fold(
    indegree,
    $List$Empty$const,
    (acc, k, d) => {
      let $ = d === 0;
      if ($) {
        return listPrepend(k, acc);
      } else {
        return acc;
      }
    },
  );
  _block = $list.sort(_pipe, compare_keys);
  let ready = _block;
  let $ = kahn(ready, indegree, succs, $List$Empty$const);
  let order = $[0];
  let placed = $set.from_list(order);
  return [
    order,
    $set.filter(nodes, (k) => { return !$set.contains(placed, k); }),
  ];
}

/**
 * For each formula in the set, the formulas in the set it must wait for.
 * With `through_spills`, reading a spilled cell means waiting for the
 * formula that spills there.
 * 
 * @ignore
 */
function predecessors(book, formulas, through_spills) {
  let _block;
  if (through_spills) {
    _block = $dict.fold(
      book.spill_owner,
      $set.to_list(formulas),
      (acc, cell, owner) => {
        let $ = $set.contains(formulas, owner);
        if ($) {
          return listPrepend(cell, acc);
        } else {
          return acc;
        }
      },
    );
  } else {
    _block = $set.to_list(formulas);
  }
  let produced = _block;
  let producer = (cell) => {
    let $ = $set.contains(formulas, cell);
    if ($) {
      return new Ok(cell);
    } else if (through_spills) {
      let $1 = $dict.get(book.spill_owner, cell);
      if ($1 instanceof Ok) {
        let owner = $1[0];
        let $2 = $set.contains(formulas, owner);
        if ($2) {
          return new Ok(owner);
        } else {
          return new Error(undefined);
        }
      } else {
        return new Error(undefined);
      }
    } else {
      return new Error(undefined);
    }
  };
  let produced_count = $list.length(produced);
  return $set.fold(
    formulas,
    $dict.new$(),
    (acc, f) => {
      let _block$1;
      let _pipe = $dict.get(book.reads, f);
      _block$1 = $result.unwrap(_pipe, $List$Empty$const);
      let deps = _block$1;
      let ps = $list.fold(
        deps,
        $set.new$(),
        (ps, dep) => {
          if (dep instanceof OnCell) {
            let cell = dep[0];
            let $ = producer(cell);
            if ($ instanceof Ok) {
              let p = $[0];
              return $set.insert(ps, p);
            } else {
              return ps;
            }
          } else {
            let sheet = dep.sheet;
            let range = dep.range;
            let $ = $ast.range_size(range) <= produced_count;
            if ($) {
              return $list.fold(
                cells_in(sheet, range),
                ps,
                (ps, cell) => {
                  let $1 = producer(cell);
                  if ($1 instanceof Ok) {
                    let p = $1[0];
                    return $set.insert(ps, p);
                  } else {
                    return ps;
                  }
                },
              );
            } else {
              return $list.fold(
                produced,
                ps,
                (ps, cell) => {
                  let $1 = (cell.sheet === sheet) && $ast.range_contains(
                    range,
                    cell.col,
                    cell.row,
                  );
                  if ($1) {
                    let $2 = producer(cell);
                    if ($2 instanceof Ok) {
                      let p = $2[0];
                      return $set.insert(ps, p);
                    } else {
                      return ps;
                    }
                  } else {
                    return ps;
                  }
                },
              );
            }
          }
        },
      );
      return $dict.insert(acc, f, ps);
    },
  );
}

/**
 * Find arrays whose spilled cells feed back into themselves, mark them
 * #CYCLE! and remember them so they stay that way until something they
 * depend on changes. Returns the arrays and the cells that were cleared.
 * 
 * @ignore
 */
function spill_loops(book, evaluated) {
  let evaluated$1 = $set.difference(evaluated, book.in_cycle);
  let after = predecessors(book, evaluated$1, true);
  let $ = topo(evaluated$1, after);
  let left = $[1];
  let _block;
  let _pipe = $set.filter(
    left,
    (k) => {
      return $dict.has_key(book.spills, k) && reaches_itself(k, after, left);
    },
  );
  _block = $set.to_list(_pipe);
  let anchors = _block;
  let $1 = mark_spill_cycles(book, anchors);
  let book$1 = $1[0];
  let moved = $1[1];
  return [book$1, anchors, $list.append(anchors, moved)];
}

function reads_into(loop$book, loop$frontier, loop$seen, loop$hits) {
  while (true) {
    let book = loop$book;
    let frontier = loop$frontier;
    let seen = loop$seen;
    let hits = loop$hits;
    if (frontier instanceof $Empty) {
      return false;
    } else {
      let f = frontier.head;
      let rest = frontier.tail;
      let $ = $set.contains(seen, f);
      if ($) {
        loop$book = book;
        loop$frontier = rest;
        loop$seen = seen;
        loop$hits = hits;
      } else {
        let _block;
        let _pipe = $dict.get(book.reads, f);
        _block = $result.unwrap(_pipe, $List$Empty$const);
        let deps = _block;
        let $1 = $list.any(deps, hits);
        if ($1) {
          return $1;
        } else {
          let next = $list.flat_map(
            deps,
            (dep) => { return producers(book, dep); },
          );
          loop$book = book;
          loop$frontier = $list.append(next, rest);
          loop$seen = $set.insert(seen, f);
          loop$hits = hits;
        }
      }
    }
  }
}

/**
 * Whether formula `x` reads, directly or through other formulas and
 * spilled cells, the value of formula `y` or any cell `y` spills into.
 * 
 * @ignore
 */
function depends_on(book, x, y) {
  let _block;
  let $ = $dict.get(book.spills, y);
  if ($ instanceof Ok) {
    let r = $[0];
    _block = r;
  } else {
    _block = new $ast.Range(y.row, y.col, y.row, y.col);
  }
  let region = _block;
  let hits = (dep) => {
    if (dep instanceof OnCell) {
      let c = dep[0];
      return (c.sheet === y.sheet) && $ast.range_contains(region, c.col, c.row);
    } else {
      let sheet = dep.sheet;
      let r = dep.range;
      return ((((sheet === y.sheet) && (r.top <= region.bottom)) && (region.top <= r.bottom)) && (r.left <= region.right)) && (region.left <= r.right);
    }
  };
  return reads_into(book, listPrepend(x, $List$Empty$const), $set.new$(), hits);
}

function spill(book, key, rows, old_region) {
  let height = $list.length(rows);
  let _block;
  if (rows instanceof $Empty) {
    _block = 0;
  } else {
    let r = rows.head;
    _block = $list.length(r);
  }
  let width = _block;
  let region = new $ast.Range(
    key.row,
    key.col,
    (key.row + height) - 1,
    (key.col + width) - 1,
  );
  let fits = (region.bottom < $ast.max_rows) && (region.right < $ast.max_cols);
  let _block$1;
  if (fits) {
    _block$1 = cells_in(key.sheet, region);
  } else {
    _block$1 = $List$Empty$const;
  }
  let cells$1 = _block$1;
  let has_content = $list.any(
    cells$1,
    (cell) => {
      return (!isEqual(cell, key)) && $dict.has_key(book.contents, cell);
    },
  );
  let _block$2;
  let _pipe = $list.filter_map(
    cells$1,
    (cell) => {
      let $ = $dict.get(book.spill_owner, cell);
      if ($ instanceof Ok) {
        let owner = $[0];
        if (!isEqual(owner, key)) {
          return $;
        } else {
          return new Error(undefined);
        }
      } else {
        return new Error(undefined);
      }
    },
  );
  _block$2 = $list.unique(_pipe);
  let rivals = _block$2;
  let outranked = $list.any(
    rivals,
    (r) => {
      return depends_on(book, key, r) || ((compare_keys(r, key) instanceof $order.Lt) && !depends_on(
        book,
        r,
        key,
      ));
    },
  );
  let _block$3;
  if (rivals instanceof $Empty) {
    _block$3 = book;
  } else {
    _block$3 = new Workbook(
      book.sheets,
      book.canonical,
      book.contents,
      book.values,
      book.reads,
      book.cell_readers,
      book.area_readers,
      book.spills,
      book.spill_owner,
      book.blocked,
      book.spill_cycles,
      true,
      book.in_cycle,
      book.extents,
    );
  }
  let book$1 = _block$3;
  let $ = (!fits || has_content) || outranked;
  if ($) {
    let $1 = clear_spill(book$1, key);
    let book$2 = $1[0];
    let cleared = $1[1];
    return [
      new Workbook(
        book$2.sheets,
        book$2.canonical,
        book$2.contents,
        $dict.insert(book$2.values, key, new Err($value.ErrorKind$Spill$const)),
        book$2.reads,
        book$2.cell_readers,
        book$2.area_readers,
        book$2.spills,
        book$2.spill_owner,
        $set.insert(book$2.blocked, key),
        book$2.spill_cycles,
        book$2.rivalry,
        book$2.in_cycle,
        book$2.extents,
      ),
      cleared,
    ];
  } else {
    let $1 = $list.fold(
      rivals,
      [book$1, $List$Empty$const],
      (acc, rival) => {
        let book$2 = acc[0];
        let moved = acc[1];
        let $2 = clear_spill(book$2, rival);
        let book$3 = $2[0];
        let cleared = $2[1];
        return [
          new Workbook(
            book$3.sheets,
            book$3.canonical,
            book$3.contents,
            $dict.insert(
              book$3.values,
              rival,
              new Err($value.ErrorKind$Spill$const),
            ),
            book$3.reads,
            book$3.cell_readers,
            book$3.area_readers,
            book$3.spills,
            book$3.spill_owner,
            $set.insert(book$3.blocked, rival),
            book$3.spill_cycles,
            book$3.rivalry,
            book$3.in_cycle,
            book$3.extents,
          ),
          $list.flatten(
            listPrepend(
              listPrepend(rival, $List$Empty$const),
              listPrepend(cleared, listPrepend(moved, $List$Empty$const)),
            ),
          ),
        ];
      },
    );
    let book$2 = $1[0];
    let evicted = $1[1];
    let same_shape = isEqual(old_region, new Ok(region));
    let _block$4;
    if (same_shape) {
      _block$4 = [book$2, $List$Empty$const];
    } else {
      _block$4 = clear_spill(book$2, key);
    }
    let $2 = _block$4;
    let book$3 = $2[0];
    let cleared = $2[1];
    let cleared$1 = $list.append(evicted, cleared);
    let book$4 = $list.index_fold(
      rows,
      book$3,
      (book, row, i) => {
        return $list.index_fold(
          row,
          book,
          (book, v, j) => {
            let cell = new Key(key.sheet, key.col + j, key.row + i);
            let _block$5;
            if (v instanceof Empty) {
              _block$5 = new $value.Number(0.0);
            } else {
              _block$5 = v;
            }
            let v$1 = _block$5;
            let book$4 = new Workbook(
              book.sheets,
              book.canonical,
              book.contents,
              $dict.insert(book.values, cell, v$1),
              book.reads,
              book.cell_readers,
              book.area_readers,
              book.spills,
              book.spill_owner,
              book.blocked,
              book.spill_cycles,
              book.rivalry,
              book.in_cycle,
              book.extents,
            );
            let $3 = isEqual(cell, key);
            if ($3) {
              return book$4;
            } else {
              return new Workbook(
                book$4.sheets,
                book$4.canonical,
                book$4.contents,
                book$4.values,
                book$4.reads,
                book$4.cell_readers,
                book$4.area_readers,
                book$4.spills,
                $dict.insert(book$4.spill_owner, cell, key),
                book$4.blocked,
                book$4.spill_cycles,
                book$4.rivalry,
                book$4.in_cycle,
                book$4.extents,
              );
            }
          },
        );
      },
    );
    let _block$5;
    let _pipe$1 = new Workbook(
      book$4.sheets,
      book$4.canonical,
      book$4.contents,
      book$4.values,
      book$4.reads,
      book$4.cell_readers,
      book$4.area_readers,
      $dict.insert(book$4.spills, key, region),
      book$4.spill_owner,
      $set.delete$(book$4.blocked, key),
      book$4.spill_cycles,
      book$4.rivalry,
      book$4.in_cycle,
      book$4.extents,
    );
    _block$5 = grow(_pipe$1, key.sheet, region.bottom, region.right);
    let book$5 = _block$5;
    let _block$6;
    if (same_shape) {
      _block$6 = evicted;
    } else {
      _block$6 = $list.append(
        cleared$1,
        $list.filter(cells$1, (c) => { return !isEqual(c, key); }),
      );
    }
    let moved = _block$6;
    return [book$5, moved];
  }
}

/**
 * Evaluate one formula cell and store its value, spilling arrays.
 * Returns the cells whose spill membership changed.
 * 
 * @ignore
 */
function evaluate_cell(book, key) {
  let $ = $dict.get(book.contents, key);
  if ($ instanceof Ok) {
    let $1 = $[0];
    if ($1 instanceof Formula) {
      let expr = $1.expr;
      let result = $eval.cell_result(
        $eval.evaluate(expr, environment(book, key.sheet)),
      );
      let old_region = $dict.get(book.spills, key);
      if (result instanceof Scalar) {
        let v = result[0];
        let $2 = clear_spill(book, key);
        let book$1 = $2[0];
        let cleared = $2[1];
        let book$2 = new Workbook(
          book$1.sheets,
          book$1.canonical,
          book$1.contents,
          $dict.insert(book$1.values, key, v),
          book$1.reads,
          book$1.cell_readers,
          book$1.area_readers,
          book$1.spills,
          book$1.spill_owner,
          $set.delete$(book$1.blocked, key),
          book$1.spill_cycles,
          book$1.rivalry,
          book$1.in_cycle,
          book$1.extents,
        );
        return [book$2, cleared];
      } else {
        let rows = result[0];
        let $2 = $set.contains(book.spill_cycles, key);
        if ($2) {
          let $3 = clear_spill(book, key);
          let book$1 = $3[0];
          let cleared = $3[1];
          return [
            new Workbook(
              book$1.sheets,
              book$1.canonical,
              book$1.contents,
              $dict.insert(
                book$1.values,
                key,
                new Err($value.ErrorKind$Cycle$const),
              ),
              book$1.reads,
              book$1.cell_readers,
              book$1.area_readers,
              book$1.spills,
              book$1.spill_owner,
              book$1.blocked,
              book$1.spill_cycles,
              book$1.rivalry,
              book$1.in_cycle,
              book$1.extents,
            ),
            cleared,
          ];
        } else {
          return spill(book, key, rows, old_region);
        }
      }
    } else {
      return [book, $List$Empty$const];
    }
  } else {
    return [book, $List$Empty$const];
  }
}

/**
 * Formulas that read `cell` directly or through a range.
 * 
 * @ignore
 */
function readers(book, cell) {
  let _block;
  let $ = $dict.get(book.cell_readers, cell);
  if ($ instanceof Ok) {
    let s = $[0];
    _block = $set.to_list(s);
  } else {
    _block = $List$Empty$const;
  }
  let direct = _block;
  return $list.fold(
    book.area_readers,
    direct,
    (acc, a) => {
      let reader = a[0];
      let sheet = a[1];
      let range = a[2];
      let $1 = (sheet === cell.sheet) && $ast.range_contains(
        range,
        cell.col,
        cell.row,
      );
      if ($1) {
        return listPrepend(reader, acc);
      } else {
        return acc;
      }
    },
  );
}

/**
 * Cells whose value can change when `cell` changes: its readers, and the
 * cells it spills into.
 * 
 * @ignore
 */
function downstream(book, cell) {
  let _block;
  let $ = $dict.get(book.spills, cell);
  if ($ instanceof Ok) {
    let range = $[0];
    _block = $list.filter(
      cells_in(cell.sheet, range),
      (k) => { return !isEqual(k, cell); },
    );
  } else {
    _block = $List$Empty$const;
  }
  let spilled = _block;
  return $list.append(readers(book, cell), spilled);
}

function closure(loop$book, loop$frontier, loop$seen) {
  while (true) {
    let book = loop$book;
    let frontier = loop$frontier;
    let seen = loop$seen;
    if (frontier instanceof $Empty) {
      return seen;
    } else {
      let cell = frontier.head;
      let rest = frontier.tail;
      let $ = $set.contains(seen, cell);
      if ($) {
        loop$book = book;
        loop$frontier = rest;
        loop$seen = seen;
      } else {
        loop$book = book;
        loop$frontier = $list.append(downstream(book, cell), rest);
        loop$seen = $set.insert(seen, cell);
      }
    }
  }
}

/**
 * One pass: evaluate every formula downstream of `seeds` in dependency
 * order. Returns the cells whose spill region changed shape, which need
 * another pass because their readers were not known in advance.
 * 
 * @ignore
 */
function pass(book, seeds, before) {
  let touched = closure(book, $set.to_list(seeds), $set.new$());
  let formulas$1 = $set.filter(touched, (k) => { return is_formula(book, k); });
  let full = predecessors(book, formulas$1, true);
  let $ = topo(formulas$1, full);
  let order = $[0];
  let leftover = $[1];
  let static$ = predecessors(book, leftover, false);
  let cyclic = $set.filter(
    leftover,
    (k) => { return reaches_itself(k, static$, leftover); },
  );
  let $1 = topo($set.difference(leftover, cyclic), full);
  let rest = $1[0];
  let stuck = $1[1];
  let $2 = topo(stuck, static$);
  let rest2 = $2[0];
  let book$1 = new Workbook(
    book.sheets,
    book.canonical,
    book.contents,
    book.values,
    book.reads,
    book.cell_readers,
    book.area_readers,
    book.spills,
    book.spill_owner,
    book.blocked,
    book.spill_cycles,
    book.rivalry,
    $set.union($set.difference(book.in_cycle, formulas$1), cyclic),
    book.extents,
  );
  let book$2 = $set.fold(
    cyclic,
    book$1,
    (book, k) => {
      let $3 = clear_spill(book, k);
      let book$2 = $3[0];
      return new Workbook(
        book$2.sheets,
        book$2.canonical,
        book$2.contents,
        $dict.insert(book$2.values, k, new Err($value.ErrorKind$Cycle$const)),
        book$2.reads,
        book$2.cell_readers,
        book$2.area_readers,
        book$2.spills,
        book$2.spill_owner,
        book$2.blocked,
        book$2.spill_cycles,
        book$2.rivalry,
        book$2.in_cycle,
        book$2.extents,
      );
    },
  );
  let evaluated = $list.flatten(
    listPrepend(order, listPrepend(rest, listPrepend(rest2, $List$Empty$const))),
  );
  let $3 = $list.fold(
    evaluated,
    [book$2, $List$Empty$const, $List$Empty$const],
    (acc, k) => {
      let book$3 = acc[0];
      let reshaped = acc[1];
      let movers = acc[2];
      let $4 = evaluate_cell(book$3, k);
      let book$4 = $4[0];
      let moved = $4[1];
      if (moved instanceof $Empty) {
        return [book$4, reshaped, movers];
      } else {
        return [book$4, $list.append(moved, reshaped), listPrepend(k, movers)];
      }
    },
  );
  let book$3 = $3[0];
  let reshaped = $3[1];
  let movers = $3[2];
  let _block;
  let _pipe = $set.to_list(touched);
  let _pipe$1 = $list.append(_pipe, reshaped);
  let _pipe$2 = $list.append(_pipe$1, $set.to_list(seeds));
  let _pipe$3 = $list.unique(_pipe$2);
  _block = $list.filter(
    _pipe$3,
    (k) => {
      return !isEqual($dict.get(before, k), $dict.get(book$3.values, k));
    },
  );
  let changed = _block;
  return new Pass(
    book$3,
    new Recalc(
      $list.append(evaluated, $set.to_list(cyclic)),
      changed,
      $set.to_list(cyclic),
      false,
    ),
    reshaped,
    movers,
    !$set.is_empty(stuck),
  );
}

/**
 * Evaluate until no array changes shape any more. Then look for arrays
 * that read their own spilled output; those are circular references, are
 * marked #CYCLE! and the workbook settles again around them.
 * 
 * @ignore
 */
function settle(book, seeds, before, acc, round, breaks) {
  let p = pass(book, seeds, before);
  let book$1 = p.book;
  let acc$1 = new Recalc(
    $list.append(acc.evaluated, p.report.evaluated),
    $list.append(acc.changed, p.report.changed),
    $list.append(acc.cycles, p.report.cycles),
    acc.rebuilt,
  );
  let again = (book, cells, acc, round, breaks) => {
    let seeds$1 = $set.from_list(
      $list.append(cells, $set.to_list(book.blocked)),
    );
    return settle(book, seeds$1, book.values, acc, round, breaks);
  };
  let $ = p.reshaped;
  let $1 = round < max_rounds;
  if ($ instanceof $Empty) {
    let $2 = spill_loops(book$1, $set.from_list($dict.keys(book$1.reads)));
    let book$2 = $2[0];
    let found = $2[1];
    let moved = $2[2];
    let $3 = round < max_rounds;
    if (found instanceof $Empty) {
      return [book$2, finish(acc$1)];
    } else if ($3) {
      return again(
        book$2,
        moved,
        new Recalc(
          acc$1.evaluated,
          acc$1.changed,
          $list.append(acc$1.cycles, found),
          acc$1.rebuilt,
        ),
        round + 1,
        breaks,
      );
    } else {
      return [book$2, finish(acc$1)];
    }
  } else if ($1) {
    return again(book$1, p.reshaped, acc$1, round + 1, breaks);
  } else {
    let $2 = breaks < 3;
    if ($2) {
      let $3 = mark_spill_cycles(book$1, p.movers);
      let book$2 = $3[0];
      let moved = $3[1];
      return again(
        book$2,
        $list.append(p.movers, moved),
        new Recalc(
          acc$1.evaluated,
          acc$1.changed,
          $list.append(acc$1.cycles, p.movers),
          acc$1.rebuilt,
        ),
        0,
        breaks + 1,
      );
    } else {
      return [book$1, finish(acc$1)];
    }
  }
}

function compute_all(book) {
  return settle(
    book,
    $set.from_list($dict.keys(book.contents)),
    $dict.new$(),
    new Recalc($List$Empty$const, $List$Empty$const, $List$Empty$const, false),
    0,
    0,
  );
}

function add_reader(book, cell, reader) {
  return new Workbook(
    book.sheets,
    book.canonical,
    book.contents,
    book.values,
    book.reads,
    $dict.upsert(
      book.cell_readers,
      cell,
      (existing) => {
        if (existing instanceof Some) {
          let s = existing[0];
          return $set.insert(s, reader);
        } else {
          return $set.from_list(listPrepend(reader, $List$Empty$const));
        }
      },
    ),
    book.area_readers,
    book.spills,
    book.spill_owner,
    book.blocked,
    book.spill_cycles,
    book.rivalry,
    book.in_cycle,
    book.extents,
  );
}

function register(book, key, expr) {
  let deps = deps_of(book, key, expr);
  let book$1 = new Workbook(
    book.sheets,
    book.canonical,
    book.contents,
    book.values,
    $dict.insert(book.reads, key, deps),
    book.cell_readers,
    book.area_readers,
    book.spills,
    book.spill_owner,
    book.blocked,
    book.spill_cycles,
    book.rivalry,
    book.in_cycle,
    book.extents,
  );
  return $list.fold(
    deps,
    book$1,
    (book, dep) => {
      if (dep instanceof OnCell) {
        let cell = dep[0];
        return add_reader(book, cell, key);
      } else {
        let sheet = dep.sheet;
        let range = dep.range;
        let $ = $ast.range_size(range) > expand_limit;
        if ($) {
          return new Workbook(
            book.sheets,
            book.canonical,
            book.contents,
            book.values,
            book.reads,
            book.cell_readers,
            listPrepend([key, sheet, range], book.area_readers),
            book.spills,
            book.spill_owner,
            book.blocked,
            book.spill_cycles,
            book.rivalry,
            book.in_cycle,
            book.extents,
          );
        } else {
          return $list.fold(
            cells_in(sheet, range),
            book,
            (book, cell) => { return add_reader(book, cell, key); },
          );
        }
      }
    },
  );
}

function remove_reader(book, cell, reader) {
  let $ = $dict.get(book.cell_readers, cell);
  if ($ instanceof Ok) {
    let s = $[0];
    let s$1 = $set.delete$(s, reader);
    return new Workbook(
      book.sheets,
      book.canonical,
      book.contents,
      book.values,
      book.reads,
      (() => {
        let $1 = $set.is_empty(s$1);
        if ($1) {
          return $dict.delete$(book.cell_readers, cell);
        } else {
          return $dict.insert(book.cell_readers, cell, s$1);
        }
      })(),
      book.area_readers,
      book.spills,
      book.spill_owner,
      book.blocked,
      book.spill_cycles,
      book.rivalry,
      book.in_cycle,
      book.extents,
    );
  } else {
    return book;
  }
}

function unregister(book, key) {
  let $ = $dict.get(book.reads, key);
  if ($ instanceof Ok) {
    let deps = $[0];
    let book$1 = new Workbook(
      book.sheets,
      book.canonical,
      book.contents,
      book.values,
      $dict.delete$(book.reads, key),
      book.cell_readers,
      book.area_readers,
      book.spills,
      book.spill_owner,
      book.blocked,
      book.spill_cycles,
      book.rivalry,
      book.in_cycle,
      book.extents,
    );
    return $list.fold(
      deps,
      book$1,
      (book, dep) => {
        if (dep instanceof OnCell) {
          let cell = dep[0];
          return remove_reader(book, cell, key);
        } else {
          let sheet = dep.sheet;
          let range = dep.range;
          let $1 = $ast.range_size(range) > expand_limit;
          if ($1) {
            return new Workbook(
              book.sheets,
              book.canonical,
              book.contents,
              book.values,
              book.reads,
              book.cell_readers,
              $list.filter(
                book.area_readers,
                (a) => { return !isEqual(a[0], key); },
              ),
              book.spills,
              book.spill_owner,
              book.blocked,
              book.spill_cycles,
              book.rivalry,
              book.in_cycle,
              book.extents,
            );
          } else {
            return $list.fold(
              cells_in(sheet, range),
              book,
              (book, cell) => { return remove_reader(book, cell, key); },
            );
          }
        }
      },
    );
  } else {
    return book;
  }
}

/**
 * Store new content for a cell and update the reverse index. Does not
 * recalculate.
 * 
 * @ignore
 */
function place(book, key, input) {
  let book$1 = unregister(book, key);
  let content$1 = classify(input);
  let _block;
  if (content$1 instanceof Blank) {
    _block = new Workbook(
      book$1.sheets,
      book$1.canonical,
      $dict.delete$(book$1.contents, key),
      (() => {
        let $ = $dict.has_key(book$1.spill_owner, key);
        if ($) {
          return book$1.values;
        } else {
          return $dict.delete$(book$1.values, key);
        }
      })(),
      book$1.reads,
      book$1.cell_readers,
      book$1.area_readers,
      book$1.spills,
      book$1.spill_owner,
      book$1.blocked,
      book$1.spill_cycles,
      book$1.rivalry,
      book$1.in_cycle,
      book$1.extents,
    );
  } else if (content$1 instanceof Constant) {
    let v = content$1.value;
    _block = new Workbook(
      book$1.sheets,
      book$1.canonical,
      $dict.insert(book$1.contents, key, content$1),
      $dict.insert(book$1.values, key, v),
      book$1.reads,
      book$1.cell_readers,
      book$1.area_readers,
      book$1.spills,
      book$1.spill_owner,
      book$1.blocked,
      book$1.spill_cycles,
      book$1.rivalry,
      book$1.in_cycle,
      book$1.extents,
    );
  } else if (content$1 instanceof Formula) {
    let expr = content$1.expr;
    _block = register(
      new Workbook(
        book$1.sheets,
        book$1.canonical,
        $dict.insert(book$1.contents, key, content$1),
        book$1.values,
        book$1.reads,
        book$1.cell_readers,
        book$1.area_readers,
        book$1.spills,
        book$1.spill_owner,
        book$1.blocked,
        book$1.spill_cycles,
        book$1.rivalry,
        book$1.in_cycle,
        book$1.extents,
      ),
      key,
      expr,
    );
  } else {
    _block = new Workbook(
      book$1.sheets,
      book$1.canonical,
      $dict.insert(book$1.contents, key, content$1),
      $dict.insert(
        book$1.values,
        key,
        new Err($value.ErrorKind$ParseError$const),
      ),
      book$1.reads,
      book$1.cell_readers,
      book$1.area_readers,
      book$1.spills,
      book$1.spill_owner,
      book$1.blocked,
      book$1.spill_cycles,
      book$1.rivalry,
      book$1.in_cycle,
      book$1.extents,
    );
  }
  let book$2 = _block;
  if (content$1 instanceof Blank) {
    return book$2;
  } else {
    return grow(book$2, key.sheet, key.row, key.col);
  }
}

/**
 * Load many cells at once and compute everything. Cells are
 * #(sheet, column, row, input) with zero-based column and row.
 */
export function from_cells(sheets, cells) {
  let book = $list.fold(
    cells,
    new$(sheets),
    (book, cell) => {
      let sheet = cell[0];
      let col = cell[1];
      let row = cell[2];
      let input$1 = cell[3];
      let $ = $dict.get(book.canonical, canon(sheet));
      if ($ instanceof Ok) {
        return place(book, new Key(canon(sheet), col, row), input$1);
      } else {
        return book;
      }
    },
  );
  return compute_all(book);
}

/**
 * Recompute a workbook from its inputs alone, exactly as `from_cells`
 * would build it.
 * 
 * @ignore
 */
function rebuild(book, before) {
  let _block;
  let _pipe = $dict.to_list(book.contents);
  _block = $list.map(
    _pipe,
    (p) => {
      let key = p[0];
      let content$1 = p[1];
      let _block$1;
      if (content$1 instanceof Blank) {
        _block$1 = "";
      } else if (content$1 instanceof Constant) {
        let i = content$1.input;
        _block$1 = i;
      } else if (content$1 instanceof Formula) {
        let i = content$1.input;
        _block$1 = i;
      } else {
        let i = content$1.input;
        _block$1 = i;
      }
      let text = _block$1;
      return [sheet_name(book, key.sheet), key.col, key.row, text];
    },
  );
  let cells$1 = _block;
  let $ = from_cells(book.sheets, cells$1);
  let fresh = $[0];
  let report = $[1];
  let _block$1;
  let _pipe$1 = $list.append($dict.keys(before), $dict.keys(fresh.values));
  let _pipe$2 = $list.unique(_pipe$1);
  _block$1 = $list.filter(
    _pipe$2,
    (k) => { return !isEqual($dict.get(before, k), $dict.get(fresh.values, k)); },
  );
  let changed = _block$1;
  return [fresh, new Recalc(report.evaluated, changed, report.cycles, true)];
}

/**
 * `before` holds the values from before the edit, so the report can say
 * which cells really changed.
 * Recalculate what an edit can affect. If an array changes shape, the
 * cells it reaches were not known when the order was worked out, so the
 * workbook is recomputed from its inputs instead: an edit's result never
 * depends on the history of edits before it.
 *
 * `before` holds the values from before the edit, so the report can say
 * which cells really changed.
 * 
 * @ignore
 */
function recalc(book, seeds, before) {
  let _block;
  let _pipe = seeds;
  let _pipe$1 = $set.union(_pipe, book.spill_cycles);
  _block = $set.union(_pipe$1, book.blocked);
  let seeds$1 = _block;
  let had_loops = !$set.is_empty(book.spill_cycles);
  let book$1 = new Workbook(
    book.sheets,
    book.canonical,
    book.contents,
    book.values,
    book.reads,
    book.cell_readers,
    book.area_readers,
    book.spills,
    book.spill_owner,
    book.blocked,
    $set.new$(),
    false,
    book.in_cycle,
    book.extents,
  );
  let p = pass(book$1, seeds$1, before);
  let $ = p.reshaped;
  let $1 = (had_loops || p.stuck) || p.book.rivalry;
  if ($ instanceof $Empty && !$1) {
    return [p.book, finish(p.report)];
  } else {
    return rebuild(p.book, before);
  }
}

/**
 * Set one cell to what a person typed: a constant, or a formula starting
 * with "=". The empty string clears the cell.
 */
export function set(book, sheet, col, row, input) {
  let $ = $dict.get(book.canonical, canon(sheet));
  if ($ instanceof Ok) {
    let key = new Key(canon(sheet), col, row);
    let before = book.values;
    let was_anchor = $dict.get(book.spills, key);
    let book$1 = place(book, key, input);
    let _block;
    let $2 = $dict.get(book$1.contents, key);
    if (was_anchor instanceof Ok) {
      if ($2 instanceof Ok && $2[0] instanceof Formula) {
        _block = [book$1, $List$Empty$const];
      } else {
        _block = clear_spill(book$1, key);
      }
    } else {
      _block = [book$1, $List$Empty$const];
    }
    let $1 = _block;
    let book$2 = $1[0];
    let cleared = $1[1];
    let _block$1;
    let $3 = $dict.get(book$2.spill_owner, key);
    if ($3 instanceof Ok) {
      let anchor = $3[0];
      _block$1 = listPrepend(anchor, $List$Empty$const);
    } else {
      _block$1 = $List$Empty$const;
    }
    let owner = _block$1;
    let seeds = $set.from_list(
      $list.flatten(
        listPrepend(
          listPrepend(key, $List$Empty$const),
          listPrepend(cleared, listPrepend(owner, $List$Empty$const)),
        ),
      ),
    );
    return new Ok(recalc(book$2, seeds, before));
  } else {
    return new Error(undefined);
  }
}

export function new$(sheets) {
  let _block;
  if (sheets instanceof $Empty) {
    _block = listPrepend("Sheet1", $List$Empty$const);
  } else {
    _block = sheets;
  }
  let sheets$1 = _block;
  return new Workbook(
    sheets$1,
    $dict.from_list($list.map(sheets$1, (s) => { return [canon(s), s]; })),
    $dict.new$(),
    $dict.new$(),
    $dict.new$(),
    $dict.new$(),
    $List$Empty$const,
    $dict.new$(),
    $dict.new$(),
    $set.new$(),
    $set.new$(),
    false,
    $set.new$(),
    $dict.new$(),
  );
}

/**
 * Like `set`, with an A1 address such as "B7".
 */
export function set_a1(book, sheet, address, input) {
  return $result.try$(
    $ast.parse_cell(address),
    (_use0) => {
      let col = _use0[0];
      let row = _use0[1];
      return set(book, sheet, col, row, input);
    },
  );
}

export function sheets(book) {
  return book.sheets;
}

export function content(book, sheet, col, row) {
  let _pipe = $dict.get(book.contents, new Key(canon(sheet), col, row));
  return $result.unwrap(_pipe, Content$Blank$const);
}

/**
 * What was typed into a cell ("" for blank and spilled cells).
 */
export function input(book, sheet, col, row) {
  let $ = content(book, sheet, col, row);
  if ($ instanceof Blank) {
    return "";
  } else if ($ instanceof Constant) {
    let i = $.input;
    return i;
  } else if ($ instanceof Formula) {
    let i = $.input;
    return i;
  } else {
    let i = $.input;
    return i;
  }
}

/**
 * The formula a spilled cell's value comes from.
 */
export function spilled_from(book, key) {
  return $dict.get(book.spill_owner, key);
}

/**
 * The region a formula spills into, if it spills.
 */
export function spill_region(book, key) {
  return $dict.get(book.spills, key);
}

/**
 * #(rows, columns) in use on a sheet.
 */
export function extent(book, sheet) {
  let _pipe = $dict.get(book.extents, canon(sheet));
  return $result.unwrap(_pipe, [0, 0]);
}

/**
 * Every cell with content or a value, in sheet, row, column order.
 */
export function cells(book) {
  let _pipe = $dict.keys(book.values);
  let _pipe$1 = $list.append(_pipe, $dict.keys(book.contents));
  let _pipe$2 = $list.unique(_pipe$1);
  return $list.sort(_pipe$2, compare_keys);
}

export function formulas(book) {
  let _pipe = $dict.keys(book.reads);
  return $list.sort(_pipe, compare_keys);
}

/**
 * What a formula reads, as written.
 */
export function precedents(book, key) {
  let _pipe = $dict.get(book.reads, key);
  return $result.unwrap(_pipe, $List$Empty$const);
}

/**
 * The formulas that read a cell directly or through a range.
 */
export function dependents(book, key) {
  let _pipe = readers(book, key);
  let _pipe$1 = $list.unique(_pipe);
  return $list.sort(_pipe$1, compare_keys);
}

/**
 * Every value, for comparing two workbooks in tests.
 */
export function snapshot(book) {
  let _pipe = $dict.to_list(book.values);
  let _pipe$1 = $list.filter(_pipe, (p) => { return !(p[1] instanceof Empty); });
  return $list.sort(_pipe$1, (a, b) => { return compare_keys(a[0], b[0]); });
}

export function key_name(book, key) {
  return (sheet_name(book, key.sheet) + "!") + $ast.cell_name(key.col, key.row);
}
