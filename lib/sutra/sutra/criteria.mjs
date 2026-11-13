import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $order from "../../gleam_stdlib/gleam/order.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import { Ok, Empty as $Empty, CustomType as $CustomType, isEqual } from "../gleam.mjs";
import * as $value from "../sutra/value.mjs";
import { Boolean, Empty, Number, Text, Value$Empty$const } from "../sutra/value.mjs";

export class Equal extends $CustomType {}
export const Op$Equal$const = new Equal();
export const Op$Equal = () => Op$Equal$const;
export const Op$isEqual = (value) => value instanceof Equal;

export class NotEqual extends $CustomType {}
export const Op$NotEqual$const = new NotEqual();
export const Op$NotEqual = () => Op$NotEqual$const;
export const Op$isNotEqual = (value) => value instanceof NotEqual;

export class Less extends $CustomType {}
export const Op$Less$const = new Less();
export const Op$Less = () => Op$Less$const;
export const Op$isLess = (value) => value instanceof Less;

export class LessEq extends $CustomType {}
export const Op$LessEq$const = new LessEq();
export const Op$LessEq = () => Op$LessEq$const;
export const Op$isLessEq = (value) => value instanceof LessEq;

export class Greater extends $CustomType {}
export const Op$Greater$const = new Greater();
export const Op$Greater = () => Op$Greater$const;
export const Op$isGreater = (value) => value instanceof Greater;

export class GreaterEq extends $CustomType {}
export const Op$GreaterEq$const = new GreaterEq();
export const Op$GreaterEq = () => Op$GreaterEq$const;
export const Op$isGreaterEq = (value) => value instanceof GreaterEq;

export class Criterion extends $CustomType {
  constructor(op, operand) {
    super();
    this.op = op;
    this.operand = operand;
  }
}
export const Criterion$Criterion = (op, operand) => new Criterion(op, operand);
export const Criterion$isCriterion = (value) => value instanceof Criterion;
export const Criterion$Criterion$op = (value) => value.op;
export const Criterion$Criterion$0 = (value) => value.op;
export const Criterion$Criterion$operand = (value) => value.operand;
export const Criterion$Criterion$1 = (value) => value.operand;

export function parse(crit) {
  if (crit instanceof Text) {
    let s = crit[0];
    let _block;
    let $1 = s.charCodeAt(0);
    if (s.startsWith(">=")) {
      let rest = s.slice(2);
      _block = [Op$GreaterEq$const, rest];
    } else if (s.startsWith("<=")) {
      let rest = s.slice(2);
      _block = [Op$LessEq$const, rest];
    } else if (s.startsWith("<>")) {
      let rest = s.slice(2);
      _block = [Op$NotEqual$const, rest];
    } else if ($1 === 62) {
      let rest = s.slice(1);
      _block = [Op$Greater$const, rest];
    } else if ($1 === 60) {
      let rest = s.slice(1);
      _block = [Op$Less$const, rest];
    } else if ($1 === 61) {
      let rest = s.slice(1);
      _block = [Op$Equal$const, rest];
    } else {
      _block = [Op$Equal$const, s];
    }
    let $ = _block;
    let op = $[0];
    let rest = $[1];
    let _block$1;
    if (rest === "") {
      _block$1 = Value$Empty$const;
    } else {
      let $2 = $value.parse_number(rest);
      if ($2 instanceof Ok) {
        let x = $2[0];
        _block$1 = new Number(x);
      } else {
        let $3 = $string.uppercase(rest);
        if ($3 === "TRUE") {
          _block$1 = new Boolean(true);
        } else if ($3 === "FALSE") {
          _block$1 = new Boolean(false);
        } else {
          _block$1 = new Text(rest);
        }
      }
    }
    let operand = _block$1;
    return new Criterion(op, operand);
  } else if (crit instanceof Empty) {
    return new Criterion(Op$Equal$const, Value$Empty$const);
  } else {
    return new Criterion(Op$Equal$const, crit);
  }
}

function test_order(op, o) {
  if (o instanceof $order.Lt) {
    if (op instanceof NotEqual) {
      return true;
    } else if (op instanceof Less) {
      return true;
    } else if (op instanceof LessEq) {
      return true;
    } else {
      return false;
    }
  } else if (o instanceof $order.Eq) {
    if (op instanceof Equal) {
      return true;
    } else if (op instanceof LessEq) {
      return true;
    } else if (op instanceof GreaterEq) {
      return true;
    } else {
      return false;
    }
  } else if (op instanceof NotEqual) {
    return true;
  } else if (op instanceof Greater) {
    return true;
  } else if (op instanceof GreaterEq) {
    return true;
  } else {
    return false;
  }
}

function try_suffixes(loop$p, loop$t) {
  while (true) {
    let p = loop$p;
    let t = loop$t;
    let $ = go(p, t);
    if ($) {
      return $;
    } else {
      if (t instanceof $Empty) {
        return false;
      } else {
        let rest = t.tail;
        loop$p = p;
        loop$t = rest;
      }
    }
  }
}

function go(loop$p, loop$t) {
  while (true) {
    let p = loop$p;
    let t = loop$t;
    if (p instanceof $Empty) {
      if (t instanceof $Empty) {
        return true;
      } else {
        return false;
      }
    } else {
      let $ = p.head;
      if ($ === "*") {
        let rest = p.tail;
        if (rest instanceof $Empty) {
          return try_suffixes(rest, t);
        } else if (rest.head === "*") {
          loop$p = rest;
          loop$t = t;
        } else {
          return try_suffixes(rest, t);
        }
      } else if ($ === "~") {
        if (t instanceof $Empty) {
          return false;
        } else {
          let $1 = p.tail;
          if ($1 instanceof $Empty) {
            let c = $;
            let rest = $1;
            let x = t.head;
            let ts = t.tail;
            return (c === x) && go(rest, ts);
          } else {
            let x = t.head;
            let ts = t.tail;
            let c = $1.head;
            let rest = $1.tail;
            return (c === x) && go(rest, ts);
          }
        }
      } else if ($ === "?") {
        if (t instanceof $Empty) {
          return false;
        } else {
          let rest = p.tail;
          let ts = t.tail;
          loop$p = rest;
          loop$t = ts;
        }
      } else if (t instanceof $Empty) {
        return false;
      } else {
        let c = $;
        let rest = p.tail;
        let x = t.head;
        let ts = t.tail;
        return (c === x) && go(rest, ts);
      }
    }
  }
}

/**
 * Excel wildcards, case-insensitive: * is any run, ? is one character and
 * ~ escapes the next character.
 */
export function wildcard(pattern, text) {
  return go(
    $string.to_graphemes($string.lowercase(pattern)),
    $string.to_graphemes($string.lowercase(text)),
  );
}

function text_match(pattern, cell) {
  if (cell instanceof Text) {
    let s = cell[0];
    return wildcard(pattern, s);
  } else if (cell instanceof Empty) {
    return pattern === "";
  } else {
    return false;
  }
}

function is_blank(v) {
  return (v instanceof Empty) || (isEqual(v, new Text("")));
}

export function matches(c, cell) {
  let $ = c.operand;
  if ($ instanceof Number) {
    let x = $[0];
    if (cell instanceof Number) {
      let y = cell[0];
      return test_order(c.op, $value.compare_numbers(y, x));
    } else if (cell instanceof Text) {
      let s = cell[0];
      let $1 = c.op;
      let $2 = $value.parse_number(s);
      if ($2 instanceof Ok) {
        if ($1 instanceof Equal) {
          let y = $2[0];
          return $value.compare_numbers(y, x) instanceof $order.Eq;
        } else if ($1 instanceof NotEqual) {
          let y = $2[0];
          return !($value.compare_numbers(y, x) instanceof $order.Eq);
        } else {
          return false;
        }
      } else if ($1 instanceof NotEqual) {
        return true;
      } else {
        return false;
      }
    } else {
      return c.op instanceof NotEqual;
    }
  } else if ($ instanceof Text) {
    let pattern = $[0];
    let $1 = c.op;
    if ($1 instanceof Equal) {
      return text_match(pattern, cell);
    } else if ($1 instanceof NotEqual) {
      return !text_match(pattern, cell);
    } else {
      if (cell instanceof Text) {
        let s = cell[0];
        return test_order(
          c.op,
          $string.compare($string.lowercase(s), $string.lowercase(pattern)),
        );
      } else {
        return false;
      }
    }
  } else if ($ instanceof Boolean) {
    let b = $[0];
    if (cell instanceof Boolean) {
      let v = cell[0];
      return test_order(c.op, $value.compare(new Boolean(v), new Boolean(b)));
    } else {
      return c.op instanceof NotEqual;
    }
  } else if ($ instanceof Empty) {
    let $1 = c.op;
    if ($1 instanceof Equal) {
      return is_blank(cell);
    } else if ($1 instanceof NotEqual) {
      return !is_blank(cell);
    } else {
      return false;
    }
  } else {
    let k = $[0];
    let $1 = c.op;
    if ($1 instanceof Equal) {
      return isEqual(cell, new $value.Err(k));
    } else if ($1 instanceof NotEqual) {
      return !isEqual(cell, new $value.Err(k));
    } else {
      return false;
    }
  }
}

export function has_wildcards(pattern) {
  return $list.any(
    $string.to_graphemes(pattern),
    (c) => { return ((c === "*") || (c === "?")) || (c === "~"); },
  );
}
