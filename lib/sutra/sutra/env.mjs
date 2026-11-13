import * as $dict from "../../gleam_stdlib/gleam/dict.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $value from "../sutra/value.mjs";

export class Scalar extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Val$Scalar = ($0) => new Scalar($0);
export const Val$isScalar = (value) => value instanceof Scalar;
export const Val$Scalar$0 = (value) => value[0];

export class Grid extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Val$Grid = ($0) => new Grid($0);
export const Val$isGrid = (value) => value instanceof Grid;
export const Val$Grid$0 = (value) => value[0];

export class Env extends $CustomType {
  constructor(sheet, get, resolve_sheet, extent, locals, eval$) {
    super();
    this.sheet = sheet;
    this.get = get;
    this.resolve_sheet = resolve_sheet;
    this.extent = extent;
    this.locals = locals;
    this.eval = eval$;
  }
}
export const Env$Env = (sheet, get, resolve_sheet, extent, locals, eval$) =>
  new Env(sheet, get, resolve_sheet, extent, locals, eval$);
export const Env$isEnv = (value) => value instanceof Env;
export const Env$Env$sheet = (value) => value.sheet;
export const Env$Env$0 = (value) => value.sheet;
export const Env$Env$get = (value) => value.get;
export const Env$Env$1 = (value) => value.get;
export const Env$Env$resolve_sheet = (value) => value.resolve_sheet;
export const Env$Env$2 = (value) => value.resolve_sheet;
export const Env$Env$extent = (value) => value.extent;
export const Env$Env$3 = (value) => value.extent;
export const Env$Env$locals = (value) => value.locals;
export const Env$Env$4 = (value) => value.locals;
export const Env$Env$eval = (value) => value.eval;
export const Env$Env$5 = (value) => value.eval;

export function eval$(env, expr) {
  return env.eval(expr, env);
}

/**
 * A single value out of a Val: a 1x1 grid unwraps; a bigger grid is
 * only allowed where Excel would implicitly take one value, so it is #VALUE!.
 */
export function scalar(v) {
  if (v instanceof Scalar) {
    let x = v[0];
    return x;
  } else {
    let $ = v[0];
    if ($ instanceof $Empty) {
      return new $value.Err($value.ErrorKind$ValueErr$const);
    } else {
      let $1 = $.head;
      if ($1 instanceof $Empty) {
        return new $value.Err($value.ErrorKind$ValueErr$const);
      } else if ($.tail instanceof $Empty && $1.tail instanceof $Empty) {
        let x = $1.head;
        return x;
      } else {
        return new $value.Err($value.ErrorKind$ValueErr$const);
      }
    }
  }
}

export function rows(v) {
  if (v instanceof Scalar) {
    let x = v[0];
    return listPrepend(listPrepend(x, $List$Empty$const), $List$Empty$const);
  } else {
    let r = v[0];
    return r;
  }
}

export function dims(v) {
  if (v instanceof Scalar) {
    return [1, 1];
  } else {
    let rows$1 = v[0];
    if (rows$1 instanceof $Empty) {
      return [0, 0];
    } else {
      let first = rows$1.head;
      return [$list.length(rows$1), $list.length(first)];
    }
  }
}

export function is_multi(v) {
  let $ = dims(v);
  let r = $[0];
  let c = $[1];
  return r * c > 1;
}

export function flatten(v) {
  return $list.flatten(rows(v));
}

export function map(v, f) {
  if (v instanceof Scalar) {
    let x = v[0];
    return new Scalar(f(x));
  } else {
    let rows$1 = v[0];
    return new Grid($list.map(rows$1, (r) => { return $list.map(r, f); }));
  }
}

export function nth(items, i) {
  let $ = i < 0;
  if ($) {
    return new Error(undefined);
  } else {
    let _pipe = $list.drop(items, i);
    return $list.first(_pipe);
  }
}

/**
 * Element (row, col) of a grid broadcast to a bigger shape: a single row
 * or column repeats; anything else out of bounds is #N/A, as in Excel.
 */
export function at(rows, r, c) {
  let height = $list.length(rows);
  let _block;
  if (rows instanceof $Empty) {
    _block = 0;
  } else {
    let first = rows.head;
    _block = $list.length(first);
  }
  let width = _block;
  let _block$1;
  let $ = height === 1;
  if ($) {
    _block$1 = 0;
  } else {
    _block$1 = r;
  }
  let r$1 = _block$1;
  let _block$2;
  let $1 = width === 1;
  if ($1) {
    _block$2 = 0;
  } else {
    _block$2 = c;
  }
  let c$1 = _block$2;
  let $2 = (r$1 < height) && (c$1 < width);
  if ($2) {
    let $3 = nth(rows, r$1);
    if ($3 instanceof Ok) {
      let row = $3[0];
      let $4 = nth(row, c$1);
      if ($4 instanceof Ok) {
        let x = $4[0];
        return x;
      } else {
        return new $value.Err($value.ErrorKind$NA$const);
      }
    } else {
      return new $value.Err($value.ErrorKind$NA$const);
    }
  } else {
    return new $value.Err($value.ErrorKind$NA$const);
  }
}

/**
 * Apply `f` element-wise across several values, broadcasting singles.
 * Returns a scalar when nothing is a multi-cell grid.
 */
export function lift(args, f) {
  let $ = $list.any(args, is_multi);
  if ($) {
    let shapes = $list.map(args, dims);
    let height = $list.fold(
      shapes,
      1,
      (acc, d) => { return $int.max(acc, d[0]); },
    );
    let width = $list.fold(
      shapes,
      1,
      (acc, d) => { return $int.max(acc, d[1]); },
    );
    let grids = $list.map(args, rows);
    return new Grid(
      (() => {
        let _pipe = $int.range(
          0,
          height,
          $List$Empty$const,
          (acc, r) => {
            return listPrepend(
              (() => {
                let _pipe = $int.range(
                  0,
                  width,
                  $List$Empty$const,
                  (acc, c) => {
                    return listPrepend(
                      f($list.map(grids, (g) => { return at(g, r, c); })),
                      acc,
                    );
                  },
                );
                return $list.reverse(_pipe);
              })(),
              acc,
            );
          },
        );
        return $list.reverse(_pipe);
      })(),
    );
  } else {
    return new Scalar(f($list.map(args, scalar)));
  }
}
