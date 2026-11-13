import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  CustomType as $CustomType,
  makeError,
  divideFloat,
} from "../gleam.mjs";
import * as $value from "../sutra/value.mjs";
import { ErrorKind$Div0$const } from "../sutra/value.mjs";

const FILEPATH = "src/sutra/num.gleam";

/**
 * Half away from zero (ROUND).
 */
export class HalfUp extends $CustomType {}
export const Rounding$HalfUp$const = new HalfUp();
export const Rounding$HalfUp = () => Rounding$HalfUp$const;
export const Rounding$isHalfUp = (value) => value instanceof HalfUp;

/**
 * Away from zero (ROUNDUP).
 */
export class Up extends $CustomType {}
export const Rounding$Up$const = new Up();
export const Rounding$Up = () => Rounding$Up$const;
export const Rounding$isUp = (value) => value instanceof Up;

/**
 * Toward zero (ROUNDDOWN, TRUNC).
 */
export class Down extends $CustomType {}
export const Rounding$Down$const = new Down();
export const Rounding$Down = () => Rounding$Down$const;
export const Rounding$isDown = (value) => value instanceof Down;

/**
 * Largest magnitude we allow, just under the IEEE double maximum.
 */
export const limit = 1.0e307;

export function number(v, k) {
  let $ = $value.to_number(v);
  if ($ instanceof Ok) {
    let x = $[0];
    return k(x);
  } else {
    let e = $[0];
    return new $value.Err(e);
  }
}

export function text(v, k) {
  let $ = $value.to_text(v);
  if ($ instanceof Ok) {
    let s = $[0];
    return k(s);
  } else {
    let e = $[0];
    return new $value.Err(e);
  }
}

export function boolean(v, k) {
  let $ = $value.to_bool(v);
  if ($ instanceof Ok) {
    let b = $[0];
    return k(b);
  } else {
    let e = $[0];
    return new $value.Err(e);
  }
}

/**
 * Integer argument, truncated toward zero as Excel does.
 */
export function integer(v, k) {
  return number(
    v,
    (x) => {
      let $ = $float.absolute_value(x) > 1000000000000000.0;
      if ($) {
        return new $value.Err($value.ErrorKind$NumErr$const);
      } else {
        return k($float.truncate(x));
      }
    },
  );
}

export function result(r) {
  if (r instanceof Ok) {
    let x = r[0];
    return new $value.Number(x);
  } else {
    let e = r[0];
    return new $value.Err(e);
  }
}

function check(x) {
  let $ = $float.absolute_value(x) > limit;
  if ($) {
    return new Error($value.ErrorKind$NumErr$const);
  } else {
    return new Ok(x);
  }
}

export function add(a, b) {
  let $ = ($float.absolute_value(a) > limit) || ($float.absolute_value(b) > limit);
  if ($) {
    return new Error($value.ErrorKind$NumErr$const);
  } else {
    return check(a + b);
  }
}

export function sub(a, b) {
  return add(a, $float.negate(b));
}

export function mul(a, b) {
  let x = $float.absolute_value(a);
  let y = $float.absolute_value(b);
  let $ = ((x > 1.0) && (y > 1.0)) && (y > (divideFloat(limit, x)));
  if ($) {
    return new Error($value.ErrorKind$NumErr$const);
  } else {
    return check(a * b);
  }
}

export function div(a, b) {
  let $ = b === 0.0;
  if ($) {
    return new Error(ErrorKind$Div0$const);
  } else {
    let y = $float.absolute_value(b);
    let $1 = (y < 1.0) && ($float.absolute_value(a) > (limit * y));
    if ($1) {
      return new Error($value.ErrorKind$NumErr$const);
    } else {
      return check(divideFloat(a, b));
    }
  }
}

export function pow(base, exponent) {
  let $ = base === 0.0;
  if ($) {
    let e = exponent;
    if (e === 0.0) {
      return new Error($value.ErrorKind$NumErr$const);
    } else {
      let e$1 = exponent;
      if (e$1 < 0.0) {
        return new Error(ErrorKind$Div0$const);
      } else {
        return new Ok(0.0);
      }
    }
  } else {
    let $1 = $float.logarithm($float.absolute_value(base));
    let ln$1;
    if ($1 instanceof Ok) {
      ln$1 = $1[0];
    } else {
      throw makeError(
        "let_assert",
        FILEPATH,
        "sutra/num",
        99,
        "pow",
        "Pattern match failed, no pattern matched the value.",
        {
          value: $1,
          start: 2597,
          end: 2660,
          pattern_start: 2608,
          pattern_end: 2614
        }
      )
    }
    let $2 = (exponent * ln$1) > 706.0;
    if ($2) {
      return new Error($value.ErrorKind$NumErr$const);
    } else {
      let $3 = (exponent * ln$1) < -740.0;
      if ($3) {
        return new Ok(0.0);
      } else {
        let $4 = $float.power(base, exponent);
        if ($4 instanceof Ok) {
          let x = $4[0];
          return check(x);
        } else {
          return new Error($value.ErrorKind$NumErr$const);
        }
      }
    }
  }
}

export function exp(x) {
  let $ = x > 706.0;
  let $1 = x < -740.0;
  if ($) {
    return new Error($value.ErrorKind$NumErr$const);
  } else if ($1) {
    return new Ok(0.0);
  } else {
    return new Ok($float.exponential(x));
  }
}

export function ln(x) {
  let $ = $float.logarithm(x);
  if ($ instanceof Ok) {
    return $;
  } else {
    return new Error($value.ErrorKind$NumErr$const);
  }
}

export function sqrt(x) {
  let $ = $float.square_root(x);
  if ($ instanceof Ok) {
    return $;
  } else {
    return new Error($value.ErrorKind$NumErr$const);
  }
}

function sum_loop(loop$xs, loop$acc) {
  while (true) {
    let xs = loop$xs;
    let acc = loop$acc;
    if (xs instanceof $Empty) {
      return new Ok(acc);
    } else {
      let x = xs.head;
      let rest = xs.tail;
      let $ = add(acc, x);
      if ($ instanceof Ok) {
        let acc$1 = $[0];
        loop$xs = rest;
        loop$acc = acc$1;
      } else {
        return $;
      }
    }
  }
}

export function sum(xs) {
  return sum_loop(xs, 0.0);
}

/**
 * 0.DIGITS × 10^point as a float.
 */
export function from_digits(digits, point) {
  if (digits === "") {
    return 0.0;
  } else {
    let text$1 = (("0." + digits) + "e") + $int.to_string(point);
    let $ = $float.parse(text$1);
    if ($ instanceof Ok) {
      let x = $[0];
      return x;
    } else {
      return 0.0;
    }
  }
}

function bump_digits(digits, point) {
  let $ = $value.increment(digits);
  if ($[1]) {
    let bumped = $[0];
    return ["1" + bumped, point + 1];
  } else {
    let bumped = $[0];
    return [bumped, point];
  }
}

/**
 * Round to `places` decimal places using the number's shortest decimal
 * form, not binary arithmetic. That is why ROUND(1.005, 2) is 1.01 here,
 * as in Excel, where naive float maths gives 1.0.
 */
export function round(x, places, mode) {
  let $ = $value.decompose(x);
  let digits = $[0];
  let point = $[1];
  if (digits === "") {
    return 0.0;
  } else {
    let keep = point + places;
    let n = $string.length(digits);
    let _block;
    let $2 = keep >= n;
    if ($2) {
      _block = [digits, point];
    } else {
      let _block$1;
      let $3 = keep > 0;
      if ($3) {
        _block$1 = $string.slice(digits, 0, keep);
      } else {
        _block$1 = "";
      }
      let kept = _block$1;
      let _block$2;
      let $4 = keep > 0;
      if ($4) {
        _block$2 = $string.drop_start(digits, keep);
      } else {
        _block$2 = $string.repeat("0", - keep) + digits;
      }
      let dropped = _block$2;
      let _block$3;
      if (mode instanceof HalfUp) {
        let $5 = $int.parse($string.slice(dropped, 0, 1));
        if ($5 instanceof Ok) {
          let d = $5[0];
          _block$3 = d >= 5;
        } else {
          _block$3 = false;
        }
      } else if (mode instanceof Up) {
        _block$3 = true;
      } else {
        _block$3 = false;
      }
      let bump = _block$3;
      let _block$4;
      let $6 = keep > 0;
      if ($6) {
        _block$4 = [kept, point];
      } else {
        _block$4 = ["0", (point - keep) + 1];
      }
      let $5 = _block$4;
      let base = $5[0];
      let point$1 = $5[1];
      if (bump) {
        _block = bump_digits(base, point$1);
      } else {
        _block = [base, point$1];
      }
    }
    let $1 = _block;
    let digits$1 = $1[0];
    let point$1 = $1[1];
    let magnitude = from_digits(digits$1, point$1);
    let $3 = x < 0.0;
    if ($3) {
      return $float.negate(magnitude);
    } else {
      return magnitude;
    }
  }
}
