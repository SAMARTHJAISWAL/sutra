import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import { Ok, List$Empty$const as $List$Empty$const, prepend as listPrepend } from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $cli from "../sutra/cli.mjs";
import * as $env from "../sutra/env.mjs";
import * as $eval from "../sutra/eval.mjs";
import * as $functions from "../sutra/functions.mjs";
import * as $parser from "../sutra/parser.mjs";
import * as $value from "../sutra/value.mjs";
import * as $workbook from "../sutra/workbook.mjs";
import { Key } from "../sutra/workbook.mjs";

function keys_json(book, keys) {
  return ("[" + $string.join(
    $list.map(
      keys,
      (k) => {
        return ((((("[" + $cli.json_string($workbook.sheet_name(book, k.sheet))) + ",") + $int.to_string(
          k.col,
        )) + ",") + $int.to_string(k.row)) + "]";
      },
    ),
    ",",
  )) + "]";
}

function bool(b) {
  if (b) {
    return "true";
  } else {
    return "false";
  }
}

function report_json(book, r) {
  return ((((((((("{\"evaluated\":" + $int.to_string($list.length(r.evaluated))) + ",\"formulas\":") + $int.to_string(
    $list.length($workbook.formulas(book)),
  )) + ",\"rebuilt\":") + bool(r.rebuilt)) + ",\"changed\":") + keys_json(
    book,
    r.changed,
  )) + ",\"cycles\":") + keys_json(book, r.cycles)) + "}";
}

export function load(sheets, cells) {
  let $ = $workbook.from_cells(sheets, cells);
  let book = $[0];
  let report = $[1];
  return [book, report_json(book, report)];
}

/**
 * Set a cell. Returns the new workbook and a JSON report of what changed.
 */
export function set(book, sheet, col, row, input) {
  let $ = $workbook.set(book, sheet, col, row, input);
  if ($ instanceof Ok) {
    let book$1 = $[0][0];
    let report = $[0][1];
    return [book$1, report_json(book$1, report)];
  } else {
    return [book, "{\"error\":\"no such sheet\"}"];
  }
}

function kind(v) {
  if (v instanceof $value.Number) {
    return "number";
  } else if (v instanceof $value.Text) {
    return "text";
  } else if (v instanceof $value.Boolean) {
    return "bool";
  } else if (v instanceof $value.Empty) {
    return "empty";
  } else {
    return "error";
  }
}

/**
 * Every cell of a sheet inside `rows` x `cols`, as
 * [[col, row, shown, kind, input, spill], ...] for non-empty cells.
 * `spill` is "" , "anchor" or the A1 name of the array a value spilled from.
 */
export function view(book, sheet, rows, cols) {
  let canonical = $string.lowercase(sheet);
  let _block;
  let _pipe = $workbook.cells(book);
  let _pipe$1 = $list.filter(
    _pipe,
    (k) => {
      return ((k.sheet === canonical) && (k.row < rows)) && (k.col < cols);
    },
  );
  _block = $list.map(
    _pipe$1,
    (k) => {
      let v = $workbook.value(book, sheet, k.col, k.row);
      let _block$1;
      let $ = $workbook.spilled_from(book, k);
      let $1 = $workbook.spill_region(book, k);
      if ($ instanceof Ok) {
        let anchor = $[0];
        _block$1 = $ast.cell_name(anchor.col, anchor.row);
      } else if ($1 instanceof Ok) {
        _block$1 = "anchor";
      } else {
        _block$1 = "";
      }
      let spill = _block$1;
      return ((((((((((("[" + $int.to_string(k.col)) + ",") + $int.to_string(
        k.row,
      )) + ",") + $cli.json_string($value.display(v, 10))) + ",") + $cli.json_string(
        kind(v),
      )) + ",") + $cli.json_string($workbook.input(book, sheet, k.col, k.row))) + ",") + $cli.json_string(
        spill,
      )) + "]";
    },
  );
  let cells = _block;
  return ("[" + $string.join(cells, ",")) + "]";
}

/**
 * Details of one cell: full value, what it reads, what reads it, its
 * spill region and the explanation tree.
 */
export function inspect(book, sheet, col, row) {
  let key = new Key($string.lowercase(sheet), col, row);
  let v = $workbook.value(book, sheet, col, row);
  let _block;
  let _pipe = $workbook.precedents(book, key);
  _block = $list.map(
    _pipe,
    (dep) => {
      if (dep instanceof $workbook.OnCell) {
        let k = dep[0];
        return ((((((((("{\"sheet\":" + $cli.json_string(
          $workbook.sheet_name(book, k.sheet),
        )) + ",\"range\":[") + $int.to_string(k.col)) + ",") + $int.to_string(
          k.row,
        )) + ",") + $int.to_string(k.col)) + ",") + $int.to_string(k.row)) + "]}";
      } else {
        let s = dep.sheet;
        let r = dep.range;
        let $ = $workbook.extent(book, s);
        let used_rows = $[0];
        let used_cols = $[1];
        let bottom = $int.min(r.bottom, $int.max(used_rows - 1, r.top));
        let right = $int.min(r.right, $int.max(used_cols - 1, r.left));
        return ((((((((("{\"sheet\":" + $cli.json_string(
          $workbook.sheet_name(book, s),
        )) + ",\"range\":[") + $int.to_string(r.left)) + ",") + $int.to_string(
          r.top,
        )) + ",") + $int.to_string(right)) + ",") + $int.to_string(bottom)) + "]}";
      }
    },
  );
  let precedents = _block;
  let _block$1;
  let $ = $workbook.spill_region(book, key);
  if ($ instanceof Ok) {
    let r = $[0];
    _block$1 = ("[" + $string.join(
      $list.map(
        listPrepend(
          r.left,
          listPrepend(
            r.top,
            listPrepend(r.right, listPrepend(r.bottom, $List$Empty$const)),
          ),
        ),
        $int.to_string,
      ),
      ",",
    )) + "]";
  } else {
    _block$1 = "null";
  }
  let region = _block$1;
  return ((((((((((("{\"value\":" + $cli.json_string($value.to_string(v))) + ",\"kind\":") + $cli.json_string(
    kind(v),
  )) + ",\"precedents\":[") + $string.join(precedents, ",")) + "],\"dependents\":") + keys_json(
    book,
    $workbook.dependents(book, key),
  )) + ",\"spill\":") + region) + ",\"explain\":") + $cli.json_string(
    $cli.explain(book, key),
  )) + "}";
}

/**
 * Evaluate a formula on its own (the formula bar's preview).
 */
export function calc(formula) {
  let $ = $parser.parse(formula);
  if ($ instanceof Ok) {
    let expr = $[0];
    let $1 = $eval.standalone(expr);
    if ($1 instanceof $env.Scalar) {
      let v = $1[0];
      return ("{\"value\":" + $cli.json_string($value.to_string(v))) + "}";
    } else {
      return "{\"value\":\"(array)\"}";
    }
  } else {
    let e = $[0];
    return ((("{\"error\":" + $cli.json_string(e.message)) + ",\"position\":") + $int.to_string(
      e.position,
    )) + "}";
  }
}

/**
 * Parse problems for the formula being typed, if any.
 */
export function check_formula(formula) {
  if (formula.charCodeAt(0) === 61) {
    let $ = $parser.parse(formula);
    if ($ instanceof Ok) {
      return "null";
    } else {
      let e = $[0];
      return ((("{\"message\":" + $cli.json_string(e.message)) + ",\"position\":") + $int.to_string(
        e.position,
      )) + "}";
    }
  } else {
    return "null";
  }
}

export function catalogue() {
  return ("[" + $string.join(
    $list.map(
      $functions.catalogue(),
      (e) => {
        return ((((("[" + $cli.json_string(e[0])) + ",") + $cli.json_string(
          e[1],
        )) + ",") + $cli.json_string(e[2])) + "]";
      },
    ),
    ",",
  )) + "]";
}
