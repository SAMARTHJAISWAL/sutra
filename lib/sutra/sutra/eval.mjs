import * as $dict from "../../gleam_stdlib/gleam/dict.mjs";
import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $option from "../../gleam_stdlib/gleam/option.mjs";
import { None, Some } from "../../gleam_stdlib/gleam/option.mjs";
import * as $order from "../../gleam_stdlib/gleam/order.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  makeError,
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $env from "../sutra/env.mjs";
import { Grid, Scalar } from "../sutra/env.mjs";
import * as $functions from "../sutra/functions.mjs";
import * as $num from "../sutra/num.mjs";
import * as $value from "../sutra/value.mjs";
import { Err, Number, Text } from "../sutra/value.mjs";

const FILEPATH = "src/sutra/eval.gleam";

function arith(a, b, f) {
  return $num.number(
    a,
    (x) => {
      return $num.number(
        b,
        (y) => {
          let $ = f(x, y);
          if ($ instanceof Ok) {
            let z = $[0];
            return new Number(z);
          } else {
            let k = $[0];
            return new Err(k);
          }
        },
      );
    },
  );
}

export function binary(op, a, b) {
  if (a instanceof Err) {
    return a;
  } else if (b instanceof Err) {
    return b;
  } else {
    if (op instanceof $ast.Add) {
      return arith(a, b, $num.add);
    } else if (op instanceof $ast.Sub) {
      return arith(a, b, $num.sub);
    } else if (op instanceof $ast.Mul) {
      return arith(a, b, $num.mul);
    } else if (op instanceof $ast.Div) {
      return arith(a, b, $num.div);
    } else if (op instanceof $ast.Pow) {
      return arith(a, b, $num.pow);
    } else if (op instanceof $ast.Concat) {
      return new Text($value.to_string(a) + $value.to_string(b));
    } else if (op instanceof $ast.Eq) {
      return new $value.Boolean($value.compare(a, b) instanceof $order.Eq);
    } else if (op instanceof $ast.Ne) {
      return new $value.Boolean(!($value.compare(a, b) instanceof $order.Eq));
    } else if (op instanceof $ast.Lt) {
      return new $value.Boolean($value.compare(a, b) instanceof $order.Lt);
    } else if (op instanceof $ast.Le) {
      return new $value.Boolean(!($value.compare(a, b) instanceof $order.Gt));
    } else if (op instanceof $ast.Gt) {
      return new $value.Boolean($value.compare(a, b) instanceof $order.Gt);
    } else {
      return new $value.Boolean(!($value.compare(a, b) instanceof $order.Lt));
    }
  }
}

/**
 * The values of a range. Whole columns and rows are clipped to the sheet's
 * used area so that A:A does not materialise a million cells.
 */
export function area(ctx, sheet, range) {
  let $ = ctx.extent(sheet);
  let used_rows = $[0];
  let used_cols = $[1];
  let _block;
  let $1 = range.bottom === ($ast.max_rows - 1);
  if ($1) {
    _block = $int.max(range.top, $int.min(range.bottom, used_rows - 1));
  } else {
    _block = range.bottom;
  }
  let bottom = _block;
  let _block$1;
  let $2 = range.right === ($ast.max_cols - 1);
  if ($2) {
    _block$1 = $int.max(range.left, $int.min(range.right, used_cols - 1));
  } else {
    _block$1 = range.right;
  }
  let right = _block$1;
  let _pipe = $int.range(
    range.top,
    bottom + 1,
    $List$Empty$const,
    (acc, r) => {
      return listPrepend(
        (() => {
          let _pipe = $int.range(
            range.left,
            right + 1,
            $List$Empty$const,
            (acc, c) => { return listPrepend(ctx.get(sheet, c, r), acc); },
          );
          return $list.reverse(_pipe);
        })(),
        acc,
      );
    },
  );
  return $list.reverse(_pipe);
}

function sheet_of(ctx, sheet) {
  if (sheet instanceof Some) {
    let name = sheet[0];
    return ctx.resolve_sheet(name);
  } else {
    return new Ok(ctx.sheet);
  }
}

export function evaluate(expr, ctx) {
  if (expr instanceof $ast.Num) {
    let x = expr[0];
    return new Scalar(new Number(x));
  } else if (expr instanceof $ast.Str) {
    let s = expr[0];
    return new Scalar(new Text(s));
  } else if (expr instanceof $ast.Bool) {
    let b = expr[0];
    return new Scalar(new $value.Boolean(b));
  } else if (expr instanceof $ast.ErrorLit) {
    let k = expr[0];
    return new Scalar(new Err(k));
  } else if (expr instanceof $ast.Ref) {
    let sheet = expr.sheet;
    let col = expr.col;
    let row = expr.row;
    let $ = sheet_of(ctx, sheet);
    if ($ instanceof Ok) {
      let s = $[0];
      return new Grid(
        listPrepend(
          listPrepend(ctx.get(s, col, row), $List$Empty$const),
          $List$Empty$const,
        ),
      );
    } else {
      return new Scalar(new Err($value.ErrorKind$RefErr$const));
    }
  } else if (expr instanceof $ast.Area) {
    let sheet = expr.sheet;
    let range = expr.range;
    let $ = sheet_of(ctx, sheet);
    if ($ instanceof Ok) {
      let s = $[0];
      return new Grid(area(ctx, s, range));
    } else {
      return new Scalar(new Err($value.ErrorKind$RefErr$const));
    }
  } else if (expr instanceof $ast.Name) {
    let name = expr[0];
    let $ = $dict.get(ctx.locals, name);
    if ($ instanceof Ok) {
      let v = $[0];
      return v;
    } else {
      return new Scalar(new Err($value.ErrorKind$NameErr$const));
    }
  } else if (expr instanceof $ast.Call) {
    let name = expr.name;
    let args = expr.args;
    return $functions.call(name, args, ctx);
  } else if (expr instanceof $ast.Neg) {
    let e = expr[0];
    return $env.lift(
      listPrepend(evaluate(e, ctx), $List$Empty$const),
      (xs) => {
        let x;
        if (xs instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/eval",
            41,
            "evaluate",
            "Pattern match failed, no pattern matched the value.",
            {
              value: xs,
              start: 1264,
              end: 1283,
              pattern_start: 1275,
              pattern_end: 1278
            }
          )
        } else if (xs.tail instanceof $Empty) {
          x = xs.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/eval",
            41,
            "evaluate",
            "Pattern match failed, no pattern matched the value.",
            {
              value: xs,
              start: 1264,
              end: 1283,
              pattern_start: 1275,
              pattern_end: 1278
            }
          )
        }
        return $num.number(x, (n) => { return new Number($float.negate(n)); });
      },
    );
  } else if (expr instanceof $ast.Percent) {
    let e = expr[0];
    return $env.lift(
      listPrepend(evaluate(e, ctx), $List$Empty$const),
      (xs) => {
        let x;
        if (xs instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/eval",
            47,
            "evaluate",
            "Pattern match failed, no pattern matched the value.",
            {
              value: xs,
              start: 1430,
              end: 1449,
              pattern_start: 1441,
              pattern_end: 1444
            }
          )
        } else if (xs.tail instanceof $Empty) {
          x = xs.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/eval",
            47,
            "evaluate",
            "Pattern match failed, no pattern matched the value.",
            {
              value: xs,
              start: 1430,
              end: 1449,
              pattern_start: 1441,
              pattern_end: 1444
            }
          )
        }
        return $num.number(x, (n) => { return new Number(n / 100.0); });
      },
    );
  } else if (expr instanceof $ast.Binary) {
    let op = expr.op;
    let l = expr.left;
    let r = expr.right;
    let left = evaluate(l, ctx);
    let right = evaluate(r, ctx);
    return $env.lift(
      listPrepend(left, listPrepend(right, $List$Empty$const)),
      (xs) => {
        let a;
        let b;
        if (xs instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/eval",
            55,
            "evaluate",
            "Pattern match failed, no pattern matched the value.",
            {
              value: xs,
              start: 1663,
              end: 1685,
              pattern_start: 1674,
              pattern_end: 1680
            }
          )
        } else {
          let $ = xs.tail;
          if ($ instanceof $Empty) {
            throw makeError(
              "let_assert",
              FILEPATH,
              "sutra/eval",
              55,
              "evaluate",
              "Pattern match failed, no pattern matched the value.",
              {
                value: xs,
                start: 1663,
                end: 1685,
                pattern_start: 1674,
                pattern_end: 1680
              }
            )
          } else if ($.tail instanceof $Empty) {
            a = xs.head;
            b = $.head;
          } else {
            throw makeError(
              "let_assert",
              FILEPATH,
              "sutra/eval",
              55,
              "evaluate",
              "Pattern match failed, no pattern matched the value.",
              {
                value: xs,
                start: 1663,
                end: 1685,
                pattern_start: 1674,
                pattern_end: 1680
              }
            )
          }
        }
        return binary(op, a, b);
      },
    );
  } else if (expr instanceof $ast.ArrayLit) {
    let rows = expr[0];
    return new Grid(
      $list.map(
        rows,
        (row) => {
          return $list.map(
            row,
            (e) => { return $env.scalar(evaluate(e, ctx)); },
          );
        },
      ),
    );
  } else {
    return new Scalar($value.Value$Empty$const);
  }
}

/**
 * The value a cell shows for a formula result: a lone reference to an
 * empty cell shows 0, as in Excel.
 */
export function cell_result(v) {
  if (v instanceof Scalar) {
    if (v[0] instanceof $value.Empty) {
      return new Scalar(new Number(0.0));
    } else {
      return v;
    }
  } else {
    let $ = v[0];
    if ($ instanceof $Empty) {
      return new Scalar(new Err($value.ErrorKind$Calc$const));
    } else {
      let $1 = $.head;
      if ($1 instanceof $Empty) {
        return v;
      } else if ($.tail instanceof $Empty && $1.tail instanceof $Empty) {
        let $2 = $1.head;
        if ($2 instanceof $value.Empty) {
          return new Scalar(new Number(0.0));
        } else {
          let x = $2;
          return new Scalar(x);
        }
      } else {
        return v;
      }
    }
  }
}

/**
 * Evaluate a formula with no workbook around it: references are #REF!.
 */
export function standalone(expr) {
  let ctx = new $env.Env(
    "",
    (_, _1, _2) => { return $value.Value$Empty$const; },
    (_) => { return new Error(undefined); },
    (_) => { return [0, 0]; },
    $dict.new$(),
    evaluate,
  );
  return cell_result(evaluate(expr, ctx));
}
