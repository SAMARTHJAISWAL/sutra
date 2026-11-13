import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $option from "../../gleam_stdlib/gleam/option.mjs";
import { None, Some } from "../../gleam_stdlib/gleam/option.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
} from "../gleam.mjs";
import * as $value from "../sutra/value.mjs";

export class Range extends $CustomType {
  constructor(top, left, bottom, right) {
    super();
    this.top = top;
    this.left = left;
    this.bottom = bottom;
    this.right = right;
  }
}
export const Range$Range = (top, left, bottom, right) =>
  new Range(top, left, bottom, right);
export const Range$isRange = (value) => value instanceof Range;
export const Range$Range$top = (value) => value.top;
export const Range$Range$0 = (value) => value.top;
export const Range$Range$left = (value) => value.left;
export const Range$Range$1 = (value) => value.left;
export const Range$Range$bottom = (value) => value.bottom;
export const Range$Range$2 = (value) => value.bottom;
export const Range$Range$right = (value) => value.right;
export const Range$Range$3 = (value) => value.right;

export class Add extends $CustomType {}
export const BinOp$Add$const = new Add();
export const BinOp$Add = () => BinOp$Add$const;
export const BinOp$isAdd = (value) => value instanceof Add;

export class Sub extends $CustomType {}
export const BinOp$Sub$const = new Sub();
export const BinOp$Sub = () => BinOp$Sub$const;
export const BinOp$isSub = (value) => value instanceof Sub;

export class Mul extends $CustomType {}
export const BinOp$Mul$const = new Mul();
export const BinOp$Mul = () => BinOp$Mul$const;
export const BinOp$isMul = (value) => value instanceof Mul;

export class Div extends $CustomType {}
export const BinOp$Div$const = new Div();
export const BinOp$Div = () => BinOp$Div$const;
export const BinOp$isDiv = (value) => value instanceof Div;

export class Pow extends $CustomType {}
export const BinOp$Pow$const = new Pow();
export const BinOp$Pow = () => BinOp$Pow$const;
export const BinOp$isPow = (value) => value instanceof Pow;

export class Concat extends $CustomType {}
export const BinOp$Concat$const = new Concat();
export const BinOp$Concat = () => BinOp$Concat$const;
export const BinOp$isConcat = (value) => value instanceof Concat;

export class Eq extends $CustomType {}
export const BinOp$Eq$const = new Eq();
export const BinOp$Eq = () => BinOp$Eq$const;
export const BinOp$isEq = (value) => value instanceof Eq;

export class Ne extends $CustomType {}
export const BinOp$Ne$const = new Ne();
export const BinOp$Ne = () => BinOp$Ne$const;
export const BinOp$isNe = (value) => value instanceof Ne;

export class Lt extends $CustomType {}
export const BinOp$Lt$const = new Lt();
export const BinOp$Lt = () => BinOp$Lt$const;
export const BinOp$isLt = (value) => value instanceof Lt;

export class Le extends $CustomType {}
export const BinOp$Le$const = new Le();
export const BinOp$Le = () => BinOp$Le$const;
export const BinOp$isLe = (value) => value instanceof Le;

export class Gt extends $CustomType {}
export const BinOp$Gt$const = new Gt();
export const BinOp$Gt = () => BinOp$Gt$const;
export const BinOp$isGt = (value) => value instanceof Gt;

export class Ge extends $CustomType {}
export const BinOp$Ge$const = new Ge();
export const BinOp$Ge = () => BinOp$Ge$const;
export const BinOp$isGe = (value) => value instanceof Ge;

export class Num extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Num = ($0) => new Num($0);
export const Expr$isNum = (value) => value instanceof Num;
export const Expr$Num$0 = (value) => value[0];

export class Str extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Str = ($0) => new Str($0);
export const Expr$isStr = (value) => value instanceof Str;
export const Expr$Str$0 = (value) => value[0];

export class Bool extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Bool = ($0) => new Bool($0);
export const Expr$isBool = (value) => value instanceof Bool;
export const Expr$Bool$0 = (value) => value[0];

export class ErrorLit extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$ErrorLit = ($0) => new ErrorLit($0);
export const Expr$isErrorLit = (value) => value instanceof ErrorLit;
export const Expr$ErrorLit$0 = (value) => value[0];

/**
 * A single cell. `sheet` is None for the formula's own sheet.
 */
export class Ref extends $CustomType {
  constructor(sheet, col, row) {
    super();
    this.sheet = sheet;
    this.col = col;
    this.row = row;
  }
}
export const Expr$Ref = (sheet, col, row) => new Ref(sheet, col, row);
export const Expr$isRef = (value) => value instanceof Ref;
export const Expr$Ref$sheet = (value) => value.sheet;
export const Expr$Ref$0 = (value) => value.sheet;
export const Expr$Ref$col = (value) => value.col;
export const Expr$Ref$1 = (value) => value.col;
export const Expr$Ref$row = (value) => value.row;
export const Expr$Ref$2 = (value) => value.row;

export class Area extends $CustomType {
  constructor(sheet, range) {
    super();
    this.sheet = sheet;
    this.range = range;
  }
}
export const Expr$Area = (sheet, range) => new Area(sheet, range);
export const Expr$isArea = (value) => value instanceof Area;
export const Expr$Area$sheet = (value) => value.sheet;
export const Expr$Area$0 = (value) => value.sheet;
export const Expr$Area$range = (value) => value.range;
export const Expr$Area$1 = (value) => value.range;

/**
 * A LET variable, or an unknown name (#NAME?).
 */
export class Name extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Name = ($0) => new Name($0);
export const Expr$isName = (value) => value instanceof Name;
export const Expr$Name$0 = (value) => value[0];

export class Call extends $CustomType {
  constructor(name, args) {
    super();
    this.name = name;
    this.args = args;
  }
}
export const Expr$Call = (name, args) => new Call(name, args);
export const Expr$isCall = (value) => value instanceof Call;
export const Expr$Call$name = (value) => value.name;
export const Expr$Call$0 = (value) => value.name;
export const Expr$Call$args = (value) => value.args;
export const Expr$Call$1 = (value) => value.args;

export class Neg extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Neg = ($0) => new Neg($0);
export const Expr$isNeg = (value) => value instanceof Neg;
export const Expr$Neg$0 = (value) => value[0];

export class Percent extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$Percent = ($0) => new Percent($0);
export const Expr$isPercent = (value) => value instanceof Percent;
export const Expr$Percent$0 = (value) => value[0];

export class Binary extends $CustomType {
  constructor(op, left, right) {
    super();
    this.op = op;
    this.left = left;
    this.right = right;
  }
}
export const Expr$Binary = (op, left, right) => new Binary(op, left, right);
export const Expr$isBinary = (value) => value instanceof Binary;
export const Expr$Binary$op = (value) => value.op;
export const Expr$Binary$0 = (value) => value.op;
export const Expr$Binary$left = (value) => value.left;
export const Expr$Binary$1 = (value) => value.left;
export const Expr$Binary$right = (value) => value.right;
export const Expr$Binary$2 = (value) => value.right;

/**
 * An array constant such as {1,2;3,4}: rows of columns.
 */
export class ArrayLit extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Expr$ArrayLit = ($0) => new ArrayLit($0);
export const Expr$isArrayLit = (value) => value instanceof ArrayLit;
export const Expr$ArrayLit$0 = (value) => value[0];

/**
 * An argument left out, as in IF(A1,,0).
 */
export class Missing extends $CustomType {}
export const Expr$Missing$const = new Missing();
export const Expr$Missing = () => Expr$Missing$const;
export const Expr$isMissing = (value) => value instanceof Missing;

/**
 * Excel's grid limits: columns A..XFD, rows 1..1048576.
 */
export const max_cols = 16_384;

export const max_rows = 1_048_576;

function letter(i) {
  return $string.slice("ABCDEFGHIJKLMNOPQRSTUVWXYZ", i, 1);
}

/**
 * 0 -> "A", 25 -> "Z", 26 -> "AA".
 */
export function column_name(col) {
  let $ = col < 26;
  if ($) {
    return letter(col);
  } else {
    return column_name((globalThis.Math.trunc(col / 26)) - 1) + letter(col % 26);
  }
}

function result_then(r, f) {
  if (r instanceof Ok) {
    let x = r[0];
    return f(x);
  } else {
    return new Error(undefined);
  }
}

function letter_index(c) {
  let $ = $string.to_utf_codepoints(c);
  if ($ instanceof $Empty) {
    return new Error(undefined);
  } else if ($.tail instanceof $Empty) {
    let cp = $.head;
    let code = $string.utf_codepoint_to_int(cp);
    let $1 = (code >= 65) && (code <= 90);
    if ($1) {
      return new Ok(code - 65);
    } else {
      return new Error(undefined);
    }
  } else {
    return new Error(undefined);
  }
}

/**
 * "A" -> 0, "xfd" -> 16383. Errors on anything that is not 1-3 letters
 * naming a column inside the grid.
 */
export function parse_column(text) {
  let letters = $string.to_graphemes($string.uppercase(text));
  if (letters instanceof $Empty) {
    return new Error(undefined);
  } else if (!(letters instanceof $Empty)) {
    let n = $list.length(letters);
    let $ = n > 3;
    if ($) {
      return new Error(undefined);
    } else {
      let _pipe = $list.try_fold(
        letters,
        0,
        (acc, c) => {
          let $1 = letter_index(c);
          if ($1 instanceof Ok) {
            let i = $1[0];
            return new Ok((acc * 26 + i) + 1);
          } else {
            return new Error(undefined);
          }
        },
      );
      return result_then(
        _pipe,
        (n) => {
          let $1 = n <= max_cols;
          if ($1) {
            return new Ok(n - 1);
          } else {
            return new Error(undefined);
          }
        },
      );
    }
  } else {
    return new Error(undefined);
  }
}

/**
 * "B12" or "$B$12" -> #(col, row), zero-based.
 */
export function parse_cell(text) {
  let chars = $string.to_graphemes($string.replace(text, "$", ""));
  let $ = $list.split_while(chars, (c) => { return !$value.is_digit(c); });
  let letters = $[0];
  let digits = $[1];
  if (letters instanceof $Empty) {
    return new Error(undefined);
  } else if (digits instanceof $Empty) {
    return new Error(undefined);
  } else {
    let first = digits.head;
    if (first !== "0") {
      let $1 = $list.all(digits, $value.is_digit);
      if ($1) {
        let $2 = parse_column($string.concat(letters));
        let $3 = $int.parse($string.concat(digits));
        if ($2 instanceof Ok && $3 instanceof Ok) {
          let row = $3[0];
          if ((row >= 1) && (row <= 1_048_576)) {
            let col = $2[0];
            return new Ok([col, row - 1]);
          } else {
            return new Error(undefined);
          }
        } else {
          return new Error(undefined);
        }
      } else {
        return new Error(undefined);
      }
    } else {
      return new Error(undefined);
    }
  }
}

export function cell_name(col, row) {
  return column_name(col) + $int.to_string(row + 1);
}

export function range_name(range) {
  let top = range.top;
  let left = range.left;
  let bottom = range.bottom;
  let right = range.right;
  let $ = (top === 0) && (bottom === (max_rows - 1));
  let $1 = (left === 0) && (right === (max_cols - 1));
  if ($) {
    return (column_name(left) + ":") + column_name(right);
  } else if ($1) {
    return ($int.to_string(top + 1) + ":") + $int.to_string(bottom + 1);
  } else {
    return (cell_name(left, top) + ":") + cell_name(right, bottom);
  }
}

/**
 * Build a range from two corners given in any order.
 */
export function range_of(c1, r1, c2, r2) {
  return new Range(
    $int.min(r1, r2),
    $int.min(c1, c2),
    $int.max(r1, r2),
    $int.max(c1, c2),
  );
}

export function range_contains(range, col, row) {
  return (((row >= range.top) && (row <= range.bottom)) && (col >= range.left)) && (col <= range.right);
}

export function range_size(range) {
  return ((range.bottom - range.top) + 1) * ((range.right - range.left) + 1);
}

export function op_text(op) {
  if (op instanceof Add) {
    return "+";
  } else if (op instanceof Sub) {
    return "-";
  } else if (op instanceof Mul) {
    return "*";
  } else if (op instanceof Div) {
    return "/";
  } else if (op instanceof Pow) {
    return "^";
  } else if (op instanceof Concat) {
    return "&";
  } else if (op instanceof Eq) {
    return "=";
  } else if (op instanceof Ne) {
    return "<>";
  } else if (op instanceof Lt) {
    return "<";
  } else if (op instanceof Le) {
    return "<=";
  } else if (op instanceof Gt) {
    return ">";
  } else {
    return ">=";
  }
}

function is_ok(r) {
  if (r instanceof Ok) {
    return true;
  } else {
    return false;
  }
}

function is_plain_name(name) {
  return ((name !== "") && $list.all(
    $string.to_graphemes(name),
    (c) => {
      return ($value.is_digit(c) || (c === "_")) || (() => {
        let _pipe = letter_index($string.uppercase(c));
        return is_ok(_pipe);
      })();
    },
  )) && !$value.is_digit($string.slice(name, 0, 1));
}

function sheet_prefix(sheet) {
  if (sheet instanceof Some) {
    let name = sheet[0];
    let $ = is_plain_name(name);
    if ($) {
      return name + "!";
    } else {
      return ("'" + $string.replace(name, "'", "''")) + "'!";
    }
  } else {
    return "";
  }
}

function print_operand(expr) {
  if (expr instanceof Binary) {
    return ("(" + print(expr)) + ")";
  } else {
    return print(expr);
  }
}

export function print(expr) {
  if (expr instanceof Num) {
    let x = expr[0];
    return $value.format_number(x, 15);
  } else if (expr instanceof Str) {
    let s = expr[0];
    return ("\"" + $string.replace(s, "\"", "\"\"")) + "\"";
  } else if (expr instanceof Bool) {
    if (expr[0]) {
      return "TRUE";
    } else {
      return "FALSE";
    }
  } else if (expr instanceof ErrorLit) {
    let kind = expr[0];
    return $value.error_to_string(kind);
  } else if (expr instanceof Ref) {
    let sheet = expr.sheet;
    let col = expr.col;
    let row = expr.row;
    return sheet_prefix(sheet) + cell_name(col, row);
  } else if (expr instanceof Area) {
    let sheet = expr.sheet;
    let range = expr.range;
    return sheet_prefix(sheet) + range_name(range);
  } else if (expr instanceof Name) {
    let name = expr[0];
    return name;
  } else if (expr instanceof Call) {
    let name = expr.name;
    let args = expr.args;
    return ((name + "(") + $string.join($list.map(args, print), ",")) + ")";
  } else if (expr instanceof Neg) {
    let e = expr[0];
    return "-" + print_operand(e);
  } else if (expr instanceof Percent) {
    let e = expr[0];
    return print_operand(e) + "%";
  } else if (expr instanceof Binary) {
    let op = expr.op;
    let l = expr.left;
    let r = expr.right;
    return (print_operand(l) + op_text(op)) + print_operand(r);
  } else if (expr instanceof ArrayLit) {
    let rows = expr[0];
    return ("{" + $string.join(
      $list.map(
        rows,
        (row) => { return $string.join($list.map(row, print), ","); },
      ),
      ";",
    )) + "}";
  } else {
    return "";
  }
}

export function to_formula(expr) {
  return "=" + print(expr);
}

function collect(loop$expr, loop$acc) {
  while (true) {
    let expr = loop$expr;
    let acc = loop$acc;
    if (expr instanceof Ref) {
      return listPrepend(expr, acc);
    } else if (expr instanceof Area) {
      return listPrepend(expr, acc);
    } else if (expr instanceof Call) {
      let args = expr.args;
      return $list.fold(args, acc, (acc, a) => { return collect(a, acc); });
    } else if (expr instanceof Neg) {
      let e = expr[0];
      loop$expr = e;
      loop$acc = acc;
    } else if (expr instanceof Percent) {
      let e = expr[0];
      loop$expr = e;
      loop$acc = acc;
    } else if (expr instanceof Binary) {
      let l = expr.left;
      let r = expr.right;
      loop$expr = r;
      loop$acc = collect(l, acc);
    } else if (expr instanceof ArrayLit) {
      let rows = expr[0];
      return $list.fold(
        rows,
        acc,
        (acc, row) => {
          return $list.fold(row, acc, (acc, e) => { return collect(e, acc); });
        },
      );
    } else {
      return acc;
    }
  }
}

/**
 * Every cell and range a formula reads, in the order they appear.
 */
export function references(expr) {
  let _pipe = collect(expr, $List$Empty$const);
  return $list.reverse(_pipe);
}
