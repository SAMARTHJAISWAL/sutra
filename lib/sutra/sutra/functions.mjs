import * as $dict from "../../gleam_stdlib/gleam/dict.mjs";
import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $option from "../../gleam_stdlib/gleam/option.mjs";
import { Some } from "../../gleam_stdlib/gleam/option.mjs";
import * as $order from "../../gleam_stdlib/gleam/order.mjs";
import * as $result from "../../gleam_stdlib/gleam/result.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  toList,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
  makeError,
  divideFloat,
  isEqual,
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $criteria from "../sutra/criteria.mjs";
import * as $dates from "../sutra/dates.mjs";
import * as $env from "../sutra/env.mjs";
import { Grid, Scalar } from "../sutra/env.mjs";
import * as $format from "../sutra/format.mjs";
import * as $num from "../sutra/num.mjs";
import * as $value from "../sutra/value.mjs";
import { Boolean, Empty, Err, Number, Text, Value$Empty$const } from "../sutra/value.mjs";

const FILEPATH = "src/sutra/functions.gleam";

class Exact extends $CustomType {}
const Approx$Exact$const = new Exact();

class NextSmaller extends $CustomType {}
const Approx$NextSmaller$const = new NextSmaller();

class NextLarger extends $CustomType {}
const Approx$NextLarger$const = new NextLarger();

function fail(kind) {
  return new Scalar(new Err(kind));
}

function transpose(rows) {
  return $list.transpose(rows);
}

function arity(vals, min, max, k) {
  let n = $list.length(vals);
  let $ = (n >= min) && (n <= max);
  if ($) {
    return k();
  } else {
    return fail($value.ErrorKind$ValueErr$const);
  }
}

function filter(vals) {
  return arity(
    vals,
    2,
    3,
    () => {
      let data;
      let include;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          2044,
          "filter",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 56151,
            end: 56192,
            pattern_start: 56162,
            pattern_end: 56185
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            2044,
            "filter",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 56151,
              end: 56192,
              pattern_start: 56162,
              pattern_end: 56185
            }
          )
        } else {
          data = vals.head;
          include = $.head;
          rest = $.tail;
        }
      }
      let $1 = $env.dims(data);
      let h = $1[0];
      let w = $1[1];
      let $2 = $env.dims(include);
      let ih = $2[0];
      let iw = $2[1];
      let by_row = (iw === 1) && (ih === h);
      let by_col = ((ih === 1) && (iw === w)) && !by_row;
      let $3 = by_row || by_col;
      if ($3) {
        let $4 = $list.try_map($env.flatten(include), $value.to_bool);
        if ($4 instanceof Ok) {
          let flags = $4[0];
          let _block;
          if (by_row) {
            _block = $env.rows(data);
          } else {
            _block = transpose($env.rows(data));
          }
          let rows = _block;
          let _block$1;
          let _pipe = $list.map2(
            rows,
            flags,
            (row, keep) => { return [row, keep]; },
          );
          let _pipe$1 = $list.filter(_pipe, (p) => { return p[1]; });
          _block$1 = $list.map(_pipe$1, (p) => { return p[0]; });
          let kept = _block$1;
          if (kept instanceof $Empty) {
            if (rest instanceof $Empty) {
              return fail($value.ErrorKind$Calc$const);
            } else if (rest.tail instanceof $Empty) {
              let if_empty = rest.head;
              return if_empty;
            } else {
              return fail($value.ErrorKind$Calc$const);
            }
          } else {
            if (by_row) {
              return new Grid(kept);
            } else {
              return new Grid(transpose(kept));
            }
          }
        } else {
          let k = $4[0];
          return fail(k);
        }
      } else {
        return fail($value.ErrorKind$ValueErr$const);
      }
    },
  );
}

/**
 * Equal values of the same kind (1 does not equal "1").
 * 
 * @ignore
 */
function same(a, b) {
  if (a instanceof Number && b instanceof Number) {
    return $value.compare(a, b) instanceof $order.Eq;
  } else if (a instanceof Text && b instanceof Text) {
    return $value.compare(a, b) instanceof $order.Eq;
  } else if (a instanceof Boolean && b instanceof Boolean) {
    return $value.compare(a, b) instanceof $order.Eq;
  } else if (a instanceof Empty && b instanceof Empty) {
    return true;
  } else {
    return false;
  }
}

function same_row(a, b) {
  return ($list.length(a) === $list.length(b)) && $list.all(
    $list.map2(a, b, same),
    (x) => { return x; },
  );
}

function unique(vals) {
  return arity(
    vals,
    1,
    3,
    () => {
      let data;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          2004,
          "unique",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 55117,
            end: 55149,
            pattern_start: 55128,
            pattern_end: 55142
          }
        )
      } else {
        data = vals.head;
        rest = vals.tail;
      }
      let flag = (i) => {
        let $ = $env.nth(rest, i);
        if ($ instanceof Ok) {
          let v = $[0];
          return $value.to_bool($env.scalar(v));
        } else {
          return new Ok(false);
        }
      };
      let $ = flag(0);
      let $1 = flag(1);
      if ($ instanceof Ok) {
        if ($1 instanceof Ok) {
          let by_col = $[0];
          let exactly_once = $1[0];
          let _block;
          if (by_col) {
            _block = transpose($env.rows(data));
          } else {
            _block = $env.rows(data);
          }
          let rows = _block;
          let _block$1;
          let _pipe = $list.fold(
            rows,
            $List$Empty$const,
            (acc, row) => {
              let $2 = $list.any(acc, (seen) => { return same_row(seen, row); });
              if ($2) {
                return acc;
              } else {
                return listPrepend(row, acc);
              }
            },
          );
          _block$1 = $list.reverse(_pipe);
          let kept = _block$1;
          let _block$2;
          if (exactly_once) {
            _block$2 = $list.filter(
              kept,
              (row) => {
                return $list.count(
                  rows,
                  (other) => { return same_row(row, other); },
                ) === 1;
              },
            );
          } else {
            _block$2 = kept;
          }
          let kept$1 = _block$2;
          if (kept$1 instanceof $Empty) {
            return fail($value.ErrorKind$Calc$const);
          } else if (by_col) {
            return new Grid(transpose(kept$1));
          } else {
            return new Grid(kept$1);
          }
        } else {
          let k = $1[0];
          return fail(k);
        }
      } else {
        let k = $[0];
        return fail(k);
      }
    },
  );
}

function to_int(v) {
  let $ = $value.to_number(v);
  if ($ instanceof Ok) {
    let x = $[0];
    let $1 = $float.absolute_value(x) > 1000000000000000.0;
    if ($1) {
      return new Error($value.ErrorKind$NumErr$const);
    } else {
      return new Ok($float.truncate(x));
    }
  } else {
    return $;
  }
}

function scalar_int(v) {
  return to_int($env.scalar(v));
}

function sort(vals) {
  return arity(
    vals,
    1,
    4,
    () => {
      let data;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1956,
          "sort",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 53736,
            end: 53768,
            pattern_start: 53747,
            pattern_end: 53761
          }
        )
      } else {
        data = vals.head;
        rest = vals.tail;
      }
      let get = (i, default$) => {
        let $ = $env.nth(rest, i);
        if ($ instanceof Ok) {
          let $1 = $[0];
          if ($1 instanceof Scalar && $1[0] instanceof Empty) {
            return new Ok(default$);
          } else {
            let v = $1;
            return scalar_int(v);
          }
        } else {
          return new Ok(default$);
        }
      };
      let $ = get(0, 1);
      let $1 = get(1, 1);
      let $2 = get(2, 0);
      if ($ instanceof Ok) {
        if ($1 instanceof Ok) {
          if ($2 instanceof Ok) {
            let key = $[0];
            let direction = $1[0];
            let by_col = $2[0];
            let _block;
            let $3 = by_col !== 0;
            if ($3) {
              _block = transpose($env.rows(data));
            } else {
              _block = $env.rows(data);
            }
            let rows = _block;
            let _block$1;
            if (rows instanceof $Empty) {
              _block$1 = 0;
            } else {
              let r = rows.head;
              _block$1 = $list.length(r);
            }
            let width = _block$1;
            let $4 = ((key < 1) || (key > width)) || ((direction !== 1) && (direction !== -1));
            if ($4) {
              return fail($value.ErrorKind$ValueErr$const);
            } else {
              let sorted$1 = $list.sort(
                rows,
                (a, b) => {
                  let _block$2;
                  let _pipe = $env.nth(a, key - 1);
                  _block$2 = $result.unwrap(_pipe, Value$Empty$const);
                  let x = _block$2;
                  let _block$3;
                  let _pipe$1 = $env.nth(b, key - 1);
                  _block$3 = $result.unwrap(_pipe$1, Value$Empty$const);
                  let y = _block$3;
                  if (direction === 1) {
                    return $value.compare(x, y);
                  } else {
                    return $value.compare(y, x);
                  }
                },
              );
              let $5 = by_col !== 0;
              if ($5) {
                return new Grid(transpose(sorted$1));
              } else {
                return new Grid(sorted$1);
              }
            }
          } else {
            let k = $2[0];
            return fail(k);
          }
        } else {
          let k = $1[0];
          return fail(k);
        }
      } else {
        let k = $[0];
        return fail(k);
      }
    },
  );
}

/**
 * (1 + rate) ^ n, checked.
 * 
 * @ignore
 */
function growth(rate, n) {
  return $num.pow(1.0 + rate, n);
}

/**
 * Sum of flows[i] / (1 + rate)^(i + first).
 * 
 * @ignore
 */
function npv(rate, flows, first) {
  let $ = rate === -1.0;
  if ($) {
    return new Error($value.ErrorKind$Div0$const);
  } else {
    return $list.index_fold(
      flows,
      new Ok(0.0),
      (acc, x, i) => {
        return $result.try$(
          acc,
          (total) => {
            return $result.try$(
              growth(rate, $int.to_float(i + first)),
              (g) => {
                return $result.try$(
                  $num.div(x, g),
                  (term) => { return $num.add(total, term); },
                );
              },
            );
          },
        );
      },
    );
  }
}

function bisect(loop$xs, loop$lo, loop$hi, loop$i) {
  while (true) {
    let xs = loop$xs;
    let lo = loop$lo;
    let hi = loop$hi;
    let i = loop$i;
    let mid = (lo + hi) / 2.0;
    let $ = npv(lo, xs, 0);
    let $1 = npv(mid, xs, 0);
    if ($ instanceof Ok && $1 instanceof Ok) {
      let flo = $[0];
      let fmid = $1[0];
      let $2 = (i > 200) || ($float.absolute_value(hi - lo) < 1e-13);
      if ($2) {
        return new Ok(mid);
      } else {
        let $3 = (flo * fmid) <= 0.0;
        if ($3) {
          loop$xs = xs;
          loop$lo = lo;
          loop$hi = mid;
          loop$i = i + 1;
        } else {
          let $4 = npv(hi, xs, 0);
          if ($4 instanceof Ok) {
            let fhi = $4[0];
            if ((fmid * fhi) <= 0.0) {
              loop$xs = xs;
              loop$lo = mid;
              loop$hi = hi;
              loop$i = i + 1;
            } else {
              return new Error(undefined);
            }
          } else {
            return new Error(undefined);
          }
        }
      }
    } else {
      return new Error(undefined);
    }
  }
}

/**
 * d/drate of npv with first period 0.
 * 
 * @ignore
 */
function npv_slope(rate, flows) {
  return $list.index_fold(
    flows,
    new Ok(0.0),
    (acc, x, i) => {
      return $result.try$(
        acc,
        (total) => {
          return $result.try$(
            growth(rate, $int.to_float(i + 1)),
            (g) => {
              return $result.try$(
                $num.div($int.to_float(- i) * x, g),
                (term) => { return $num.add(total, term); },
              );
            },
          );
        },
      );
    },
  );
}

function newton(loop$xs, loop$r, loop$i) {
  while (true) {
    let xs = loop$xs;
    let r = loop$r;
    let i = loop$i;
    let $ = (i > 100) || (r <= -1.0);
    if ($) {
      return new Error(undefined);
    } else {
      let $1 = npv(r, xs, 0);
      let $2 = npv_slope(r, xs);
      if ($1 instanceof Ok && $2 instanceof Ok) {
        let d = $2[0];
        if (d !== 0.0) {
          let f = $1[0];
          let next = r - (divideFloat(f, d));
          let $3 = $float.absolute_value(next - r) < 1e-12;
          if ($3) {
            return new Ok(next);
          } else {
            loop$xs = xs;
            loop$r = next;
            loop$i = i + 1;
          }
        } else {
          return new Error(undefined);
        }
      } else {
        return new Error(undefined);
      }
    }
  }
}

/**
 * The numbers SUM-like functions use. A value given directly is coerced
 * (so SUM("2", TRUE) is 3); inside a range only real numbers count and
 * text or logicals are skipped. Errors anywhere win.
 * 
 * @ignore
 */
function numbers(vals) {
  let _pipe = $list.try_fold(
    vals,
    $List$Empty$const,
    (acc, v) => {
      if (v instanceof Scalar) {
        let x = v[0];
        let $ = $value.to_number(x);
        if ($ instanceof Ok) {
          let n = $[0];
          return new Ok(listPrepend(n, acc));
        } else {
          return $;
        }
      } else {
        return $list.try_fold(
          $env.flatten(v),
          acc,
          (acc, x) => {
            if (x instanceof Number) {
              let n = x[0];
              return new Ok(listPrepend(n, acc));
            } else if (x instanceof Err) {
              let e = x[0];
              return new Error(e);
            } else {
              return new Ok(acc);
            }
          },
        );
      }
    },
  );
  return $result.map(_pipe, $list.reverse);
}

function irr(flows, guess) {
  let $ = numbers(listPrepend(flows, $List$Empty$const));
  if ($ instanceof Ok) {
    let xs = $[0];
    let $1 = $list.any(xs, (x) => { return x > 0.0; }) && $list.any(
      xs,
      (x) => { return x < 0.0; },
    );
    if ($1) {
      let $2 = newton(xs, guess, 0);
      if ($2 instanceof Ok) {
        let r = $2[0];
        return new Scalar(new Number(r));
      } else {
        let $3 = bisect(xs, -0.9999, 100.0, 0);
        if ($3 instanceof Ok) {
          let r = $3[0];
          return new Scalar(new Number(r));
        } else {
          return fail($value.ErrorKind$NumErr$const);
        }
      }
    } else {
      return fail($value.ErrorKind$NumErr$const);
    }
  } else {
    let k = $[0];
    return fail(k);
  }
}

function nper(rate, payment, pv, fv, t) {
  let $ = rate === 0.0;
  if ($) {
    return $num.div($float.negate(pv + fv), payment);
  } else {
    let p = payment * (1.0 + (rate * t));
    return $result.try$(
      $num.div(p - (fv * rate), p + (pv * rate)),
      (ratio) => {
        return $result.try$(
          (() => {
            let $1 = ratio <= 0.0;
            if ($1) {
              return new Error($value.ErrorKind$NumErr$const);
            } else {
              return $num.ln(ratio);
            }
          })(),
          (top) => {
            return $result.try$(
              $num.ln(1.0 + rate),
              (bottom) => { return $num.div(top, bottom); },
            );
          },
        );
      },
    );
  }
}

function opt(args, i, default$) {
  let $ = $env.nth(args, i);
  if ($ instanceof Ok) {
    let $1 = $[0];
    if ($1 instanceof Empty) {
      return default$;
    } else {
      let v = $1;
      return v;
    }
  } else {
    return default$;
  }
}

function arg(args, i) {
  return opt(args, i, Value$Empty$const);
}

function finance(f) {
  return (a) => {
    return $num.number(
      arg(a, 0),
      (x1) => {
        return $num.number(
          arg(a, 1),
          (x2) => {
            return $num.number(
              arg(a, 2),
              (x3) => {
                return $num.number(
                  opt(a, 3, new Number(0.0)),
                  (x4) => {
                    return $num.number(
                      opt(a, 4, new Number(0.0)),
                      (t) => {
                        let _block;
                        let $ = t !== 0.0;
                        if ($) {
                          _block = 1.0;
                        } else {
                          _block = 0.0;
                        }
                        let t$1 = _block;
                        return $num.result(f(x1, x2, x3, x4, t$1));
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  };
}

/**
 * A scalar function lifted over arrays.
 * 
 * @ignore
 */
function lifted(vals, min, max, f) {
  return arity(vals, min, max, () => { return $env.lift(vals, f); });
}

function fv(rate, nper, payment, pv, t) {
  let $ = rate === 0.0;
  if ($) {
    return new Ok($float.negate(pv + (payment * nper)));
  } else {
    return $result.try$(
      growth(rate, nper),
      (g) => {
        return $result.try$(
          $num.div((payment * (1.0 + (rate * t))) * (g - 1.0), rate),
          (annuity) => {
            return $result.try$(
              $num.mul(pv, g),
              (grown) => { return new Ok($float.negate(grown + annuity)); },
            );
          },
        );
      },
    );
  }
}

function pv(rate, nper, payment, fv, t) {
  let $ = rate === 0.0;
  if ($) {
    return new Ok($float.negate(fv + (payment * nper)));
  } else {
    return $result.try$(
      growth(rate, nper),
      (g) => {
        return $result.try$(
          $num.div((payment * (1.0 + (rate * t))) * (g - 1.0), rate),
          (annuity) => { return $num.div($float.negate(fv + annuity), g); },
        );
      },
    );
  }
}

function pmt(rate, nper, pv, fv, t) {
  let $ = rate === 0.0;
  if ($) {
    return $num.div($float.negate(pv + fv), nper);
  } else {
    return $result.try$(
      growth(rate, nper),
      (g) => {
        return $result.try$(
          $num.mul(rate, fv + (pv * g)),
          (top) => {
            return $result.try$(
              $num.mul(1.0 + (rate * t), g - 1.0),
              (bottom) => { return $num.div($float.negate(top), bottom); },
            );
          },
        );
      },
    );
  }
}

function average(xs) {
  if (xs instanceof $Empty) {
    return new Err($value.ErrorKind$Div0$const);
  } else {
    let $ = $num.sum(xs);
    if ($ instanceof Ok) {
      let s = $[0];
      return $num.result($num.div(s, $int.to_float($list.length(xs))));
    } else {
      let k = $[0];
      return new Err(k);
    }
  }
}

function first_error(values) {
  let $ = $list.find(values, $value.is_error);
  if ($ instanceof Ok) {
    let $1 = $[0];
    if ($1 instanceof Err) {
      let e = $1[0];
      return new Error(e);
    } else {
      return new Ok(undefined);
    }
  } else {
    return new Ok(undefined);
  }
}

function correl(vals) {
  return arity(
    vals,
    2,
    2,
    () => {
      let a;
      let b;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1674,
          "correl",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 45731,
            end: 45755,
            pattern_start: 45742,
            pattern_end: 45748
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1674,
            "correl",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 45731,
              end: 45755,
              pattern_start: 45742,
              pattern_end: 45748
            }
          )
        } else if ($.tail instanceof $Empty) {
          a = vals.head;
          b = $.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1674,
            "correl",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 45731,
              end: 45755,
              pattern_start: 45742,
              pattern_end: 45748
            }
          )
        }
      }
      let xs = $env.flatten(a);
      let ys = $env.flatten(b);
      let $1 = $list.length(xs) === $list.length(ys);
      let $2 = first_error($list.append(xs, ys));
      if ($1) {
        if ($2 instanceof Ok) {
          let _block;
          let _pipe = $list.map2(xs, ys, (x, y) => { return [x, y]; });
          _block = $list.filter_map(
            _pipe,
            (p) => {
              let $3 = p[0];
              if ($3 instanceof Number) {
                let $4 = p[1];
                if ($4 instanceof Number) {
                  let x = $3[0];
                  let y = $4[0];
                  return new Ok([x, y]);
                } else {
                  return new Error(undefined);
                }
              } else {
                return new Error(undefined);
              }
            },
          );
          let pairs = _block;
          let n = $int.to_float($list.length(pairs));
          let mx = divideFloat(
            $list.fold(pairs, 0.0, (acc, p) => { return acc + p[0]; }),
            $float.max(n, 1.0)
          );
          let my = divideFloat(
            $list.fold(pairs, 0.0, (acc, p) => { return acc + p[1]; }),
            $float.max(n, 1.0)
          );
          let $3 = $list.fold(
            pairs,
            [0.0, 0.0, 0.0],
            (acc, p) => {
              let dx = p[0] - mx;
              let dy = p[1] - my;
              return [
                acc[0] + (dx * dy),
                acc[1] + (dx * dx),
                acc[2] + (dy * dy),
              ];
            },
          );
          let sxy = $3[0];
          let sxx = $3[1];
          let syy = $3[2];
          let $4 = ((n < 2.0) || (sxx === 0.0)) || (syy === 0.0);
          if ($4) {
            return fail($value.ErrorKind$Div0$const);
          } else {
            let $5 = $num.sqrt(sxx * syy);
            if ($5 instanceof Ok) {
              let d = $5[0];
              return new Scalar(new Number(divideFloat(sxy, d)));
            } else {
              let k = $5[0];
              return fail(k);
            }
          }
        } else {
          let k = $2[0];
          return fail(k);
        }
      } else {
        return fail($value.ErrorKind$NA$const);
      }
    },
  );
}

function sorted(xs) {
  return $list.sort(xs, $float.compare);
}

function percentile_of(xs, k) {
  let $ = sorted(xs);
  if ($ instanceof $Empty) {
    return new Err($value.ErrorKind$NumErr$const);
  } else {
    let s = $;
    let n = $list.length(s);
    let pos = k * $int.to_float(n - 1);
    let lo = $float.truncate(pos);
    let frac = pos - $int.to_float(lo);
    let _block;
    let _pipe = $env.nth(s, lo);
    _block = $result.unwrap(_pipe, 0.0);
    let a = _block;
    let _block$1;
    let _pipe$1 = $env.nth(s, $int.min(lo + 1, n - 1));
    _block$1 = $result.unwrap(_pipe$1, a);
    let b = _block$1;
    return new Number(a + (frac * (b - a)));
  }
}

function percentile(vals, scale) {
  return arity(
    vals,
    2,
    2,
    () => {
      let data;
      let k;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1564,
          "percentile",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 43060,
            end: 43087,
            pattern_start: 43071,
            pattern_end: 43080
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1564,
            "percentile",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 43060,
              end: 43087,
              pattern_start: 43071,
              pattern_end: 43080
            }
          )
        } else if ($.tail instanceof $Empty) {
          data = vals.head;
          k = $.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1564,
            "percentile",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 43060,
              end: 43087,
              pattern_start: 43071,
              pattern_end: 43080
            }
          )
        }
      }
      let $1 = numbers(listPrepend(data, $List$Empty$const));
      let $2 = $value.to_number($env.scalar(k));
      if ($1 instanceof Ok) {
        if ($2 instanceof Ok) {
          let xs = $1[0];
          let k$1 = $2[0];
          let _block;
          let $3 = scale === 1.0;
          if ($3) {
            _block = k$1;
          } else {
            _block = divideFloat($int.to_float($float.truncate(k$1)), scale);
          }
          let k$2 = _block;
          let $4 = (k$2 < 0.0) || (k$2 > 1.0);
          if ($4) {
            return fail($value.ErrorKind$NumErr$const);
          } else {
            return new Scalar(percentile_of(xs, k$2));
          }
        } else {
          let e = $2[0];
          return fail(e);
        }
      } else {
        let e = $1[0];
        return fail(e);
      }
    },
  );
}

function rank(vals) {
  return arity(
    vals,
    2,
    3,
    () => {
      let x;
      let data;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1648,
          "rank",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 44996,
            end: 45031,
            pattern_start: 45007,
            pattern_end: 45024
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1648,
            "rank",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 44996,
              end: 45031,
              pattern_start: 45007,
              pattern_end: 45024
            }
          )
        } else {
          x = vals.head;
          data = $.head;
          rest = $.tail;
        }
      }
      let _block;
      if (rest instanceof $Empty) {
        _block = new Ok(false);
      } else if (rest.tail instanceof $Empty) {
        let o = rest.head;
        _block = $result.map(
          $value.to_number($env.scalar(o)),
          (o) => { return o !== 0.0; },
        );
      } else {
        _block = new Ok(false);
      }
      let ascending = _block;
      let $1 = $value.to_number($env.scalar(x));
      let $2 = numbers(listPrepend(data, $List$Empty$const));
      if ($1 instanceof Ok) {
        if ($2 instanceof Ok) {
          if (ascending instanceof Ok) {
            let x$1 = $1[0];
            let xs = $2[0];
            let asc = ascending[0];
            let $3 = $list.any(xs, (y) => { return y === x$1; });
            if ($3) {
              let ahead = $list.count(
                xs,
                (y) => {
                  if (asc) {
                    return y < x$1;
                  } else {
                    return y > x$1;
                  }
                },
              );
              return new Scalar(new Number($int.to_float(ahead + 1)));
            } else {
              return fail($value.ErrorKind$NA$const);
            }
          } else {
            let e = ascending[0];
            return fail(e);
          }
        } else {
          let e = $2[0];
          return fail(e);
        }
      } else {
        let e = $1[0];
        return fail(e);
      }
    },
  );
}

function kth(vals, largest) {
  return arity(
    vals,
    2,
    2,
    () => {
      let data;
      let k;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1630,
          "kth",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 44566,
            end: 44593,
            pattern_start: 44577,
            pattern_end: 44586
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1630,
            "kth",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 44566,
              end: 44593,
              pattern_start: 44577,
              pattern_end: 44586
            }
          )
        } else if ($.tail instanceof $Empty) {
          data = vals.head;
          k = $.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1630,
            "kth",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 44566,
              end: 44593,
              pattern_start: 44577,
              pattern_end: 44586
            }
          )
        }
      }
      let $1 = numbers(listPrepend(data, $List$Empty$const));
      let $2 = scalar_int(k);
      if ($1 instanceof Ok) {
        if ($2 instanceof Ok) {
          let xs = $1[0];
          let k$1 = $2[0];
          let _block;
          if (largest) {
            _block = $list.reverse(sorted(xs));
          } else {
            _block = sorted(xs);
          }
          let s = _block;
          let $3 = $env.nth(s, k$1 - 1);
          if ($3 instanceof Ok && k$1 >= 1) {
            let x = $3[0];
            return new Scalar(new Number(x));
          } else {
            return fail($value.ErrorKind$NumErr$const);
          }
        } else {
          let e = $2[0];
          return fail(e);
        }
      } else {
        let e = $1[0];
        return fail(e);
      }
    },
  );
}

function variance(xs, sample) {
  let n = $list.length(xs);
  let _block;
  if (sample) {
    _block = n - 1;
  } else {
    _block = n;
  }
  let d = _block;
  let $ = d <= 0;
  if ($) {
    return new Err($value.ErrorKind$Div0$const);
  } else {
    let mean = divideFloat($float.sum(xs), $int.to_float(n));
    let ss = $list.fold(
      xs,
      0.0,
      (acc, x) => { return acc + ((x - mean) * (x - mean)); },
    );
    return new Number(divideFloat(ss, $int.to_float(d)));
  }
}

function with_numbers(vals, k) {
  let $ = numbers(vals);
  if ($ instanceof Ok) {
    let xs = $[0];
    return new Scalar(k(xs));
  } else {
    let e = $[0];
    return fail(e);
  }
}

function stdev(xs, sample) {
  let $ = variance(xs, sample);
  if ($ instanceof Number) {
    let v = $[0];
    return $num.result($num.sqrt(v));
  } else {
    return $;
  }
}

function mode(xs) {
  let counts = $list.fold(
    xs,
    $dict.new$(),
    (d, x) => {
      return $dict.upsert(
        d,
        x,
        (c) => {
          if (c instanceof Some) {
            let n = c[0];
            return n + 1;
          } else {
            return 1;
          }
        },
      );
    },
  );
  let $ = $list.fold(
    xs,
    [0.0, 1],
    (acc, x) => {
      let _block;
      let _pipe = $dict.get(counts, x);
      _block = $result.unwrap(_pipe, 0);
      let c = _block;
      let $1 = c > acc[1];
      if ($1) {
        return [x, c];
      } else {
        return acc;
      }
    },
  );
  let best$1 = $[0];
  let n = $[1];
  let $1 = n > 1;
  if ($1) {
    return new Number(best$1);
  } else {
    return new Err($value.ErrorKind$NA$const);
  }
}

function pairs_of(xs) {
  if (xs instanceof $Empty) {
    return $List$Empty$const;
  } else {
    let $ = xs.tail;
    if ($ instanceof $Empty) {
      return $List$Empty$const;
    } else {
      let a = xs.head;
      let b = $.head;
      let rest = $.tail;
      return listPrepend([a, b], pairs_of(rest));
    }
  }
}

/**
 * Indexes (into the flattened ranges) of cells meeting every criterion.
 * 
 * @ignore
 */
function selected(pairs, size) {
  return $list.try_fold(
    pairs,
    $list.repeat(true, size[0] * size[1]),
    (acc, pair) => {
      let range = pair[0];
      let crit = pair[1];
      let $ = isEqual($env.dims(range), size);
      if ($) {
        let c = $env.scalar(crit);
        if (c instanceof Err) {
          let k = c[0];
          return new Error(k);
        } else {
          let c$1 = $criteria.parse(c);
          return new Ok(
            $list.map2(
              acc,
              $env.flatten(range),
              (keep, cell) => { return keep && $criteria.matches(c$1, cell); },
            ),
          );
        }
      } else {
        return new Error($value.ErrorKind$ValueErr$const);
      }
    },
  );
}

function countifs(vals) {
  if (vals instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else if (!(vals instanceof $Empty)) {
    let first_range = vals.head;
    let $ = ($list.length(vals) % 2) === 0;
    if ($) {
      let $1 = selected(pairs_of(vals), $env.dims(first_range));
      if ($1 instanceof Ok) {
        let keep = $1[0];
        return new Scalar(
          new Number($int.to_float($list.count(keep, (k) => { return k; }))),
        );
      } else {
        let k = $1[0];
        return fail(k);
      }
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  } else {
    return fail($value.ErrorKind$ValueErr$const);
  }
}

function first_or(xs) {
  if (xs instanceof $Empty) {
    return 0.0;
  } else {
    let x = xs.head;
    return x;
  }
}

function conditional(target, pairs, aggregate) {
  let size = $env.dims(target);
  let $ = selected(pairs, size);
  if ($ instanceof Ok) {
    let keep = $[0];
    let _block;
    let _pipe = $list.map2(
      keep,
      $env.flatten(target),
      (k, x) => { return [k, x]; },
    );
    let _pipe$1 = $list.filter(_pipe, (p) => { return p[0]; });
    _block = $list.map(_pipe$1, (p) => { return p[1]; });
    let picked = _block;
    let $1 = first_error(picked);
    if ($1 instanceof Ok) {
      return new Scalar(
        aggregate(
          $list.filter_map(
            picked,
            (x) => {
              if (x instanceof Number) {
                let n = x[0];
                return new Ok(n);
              } else {
                return new Error(undefined);
              }
            },
          ),
        ),
      );
    } else {
      let k = $1[0];
      return fail(k);
    }
  } else {
    let k = $[0];
    return fail(k);
  }
}

function ifs_aggregate(vals, aggregate) {
  if (vals instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let target = vals.head;
    let pairs = vals.tail;
    let $ = ($list.length(pairs) >= 2) && (($list.length(pairs) % 2) === 0);
    if ($) {
      return conditional(target, pairs_of(pairs), aggregate);
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  }
}

function sum_value(xs) {
  return $num.result($num.sum(xs));
}

function countif(vals) {
  return arity(
    vals,
    2,
    2,
    () => {
      let range;
      let crit;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1521,
          "countif",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 41888,
            end: 41919,
            pattern_start: 41899,
            pattern_end: 41912
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1521,
            "countif",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 41888,
              end: 41919,
              pattern_start: 41899,
              pattern_end: 41912
            }
          )
        } else if ($.tail instanceof $Empty) {
          range = vals.head;
          crit = $.head;
        } else {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1521,
            "countif",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 41888,
              end: 41919,
              pattern_start: 41899,
              pattern_end: 41912
            }
          )
        }
      }
      return countifs(listPrepend(range, listPrepend(crit, $List$Empty$const)));
    },
  );
}

function sumif(vals, aggregate) {
  return arity(
    vals,
    2,
    3,
    () => {
      let range;
      let crit;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1435,
          "sumif",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 39785,
            end: 39824,
            pattern_start: 39796,
            pattern_end: 39817
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1435,
            "sumif",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 39785,
              end: 39824,
              pattern_start: 39796,
              pattern_end: 39817
            }
          )
        } else {
          range = vals.head;
          crit = $.head;
          rest = $.tail;
        }
      }
      let _block;
      if (rest instanceof $Empty) {
        _block = range;
      } else if (rest.tail instanceof $Empty) {
        let t = rest.head;
        _block = t;
      } else {
        _block = range;
      }
      let target = _block;
      return conditional(
        target,
        listPrepend([range, crit], $List$Empty$const),
        aggregate,
      );
    },
  );
}

function pick_row(rows, i) {
  let $ = $env.nth(rows, i);
  if ($ instanceof Ok) {
    let $1 = $[0];
    if ($1 instanceof $Empty) {
      let row = $1;
      return new Grid(listPrepend(row, $List$Empty$const));
    } else if ($1.tail instanceof $Empty) {
      let x = $1.head;
      return new Scalar(x);
    } else {
      let row = $1;
      return new Grid(listPrepend(row, $List$Empty$const));
    }
  } else {
    return fail($value.ErrorKind$NA$const);
  }
}

function index(vals) {
  return arity(
    vals,
    2,
    3,
    () => {
      let array;
      let r;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1401,
          "index",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 38758,
            end: 38794,
            pattern_start: 38769,
            pattern_end: 38787
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1401,
            "index",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 38758,
              end: 38794,
              pattern_start: 38769,
              pattern_end: 38787
            }
          )
        } else {
          array = vals.head;
          r = $.head;
          rest = $.tail;
        }
      }
      let rows = $env.rows(array);
      let $1 = $env.dims(array);
      let height = $1[0];
      let width = $1[1];
      let _block;
      if (rest instanceof $Empty) {
        _block = new Ok(-1);
      } else if (rest.tail instanceof $Empty) {
        let c = rest.head;
        _block = scalar_int(c);
      } else {
        _block = new Ok(-1);
      }
      let c = _block;
      let $2 = scalar_int(r);
      if ($2 instanceof Ok) {
        if (c instanceof Ok) {
          let r$1 = $2[0];
          let c$1 = c[0];
          let _block$1;
          let $4 = c$1 === -1;
          let $5 = (height === 1) && (width > 1);
          if ($4) {
            if ($5) {
              _block$1 = [1, r$1];
            } else {
              _block$1 = [r$1, 1];
            }
          } else {
            _block$1 = [r$1, c$1];
          }
          let $3 = _block$1;
          let r$2 = $3[0];
          let c$2 = $3[1];
          let $6 = (((r$2 < 0) || (c$2 < 0)) || (r$2 > height)) || (c$2 > width);
          if ($6) {
            return fail($value.ErrorKind$RefErr$const);
          } else {
            if (r$2 === 0) {
              if (c$2 === 0) {
                return new Grid(rows);
              } else {
                return new Grid(
                  $list.map(
                    rows,
                    (row) => {
                      return listPrepend(
                        $env.at(listPrepend(row, $List$Empty$const), 0, c$2 - 1),
                        $List$Empty$const,
                      );
                    },
                  ),
                );
              }
            } else if (c$2 === 0) {
              return pick_row(rows, r$2 - 1);
            } else {
              return new Scalar($env.at(rows, r$2 - 1, c$2 - 1));
            }
          }
        } else {
          let k = c[0];
          return fail(k);
        }
      } else {
        let k = $2[0];
        return fail(k);
      }
    },
  );
}

function comparable(a, b) {
  if (a instanceof Number && b instanceof Number) {
    return true;
  } else if (a instanceof Text && b instanceof Text) {
    return true;
  } else if (a instanceof Boolean && b instanceof Boolean) {
    return true;
  } else {
    return false;
  }
}

/**
 * The closest item on the given side of `needle` (Lt: largest smaller
 * value; Gt: smallest larger value). Ties go to the last one, as Excel's
 * approximate match does on sorted data.
 * 
 * @ignore
 */
function best(indexed, needle, side) {
  let _pipe = $list.fold(
    indexed,
    new Error(undefined),
    (acc, p) => {
      let x = p[0];
      let i = p[1];
      let $ = comparable(x, needle) && (isEqual($value.compare(x, needle), side));
      if ($) {
        if (acc instanceof Ok) {
          let y = acc[0][0];
          let $1 = $value.compare(x, y);
          if ($1 instanceof $order.Eq) {
            return new Ok([x, i]);
          } else {
            let o = $1;
            if (isEqual(o, side)) {
              return acc;
            } else {
              return new Ok([x, i]);
            }
          }
        } else {
          return new Ok([x, i]);
        }
      } else {
        return acc;
      }
    },
  );
  return $result.map(_pipe, (p) => { return p[1]; });
}

/**
 * Exact-match test used by the lookup functions. Text compares without
 * case and honours wildcards when asked; blank cells never match.
 * 
 * @ignore
 */
function lookup_equal(needle, cell, wildcards) {
  if (cell instanceof Text && needle instanceof Text && wildcards) {
    let s = cell[0];
    let p = needle[0];
    return $criteria.wildcard(p, s);
  } else if (cell instanceof Empty) {
    return false;
  } else {
    return same(needle, cell);
  }
}

/**
 * Position (0-based) of `needle` in `items`.
 * 
 * @ignore
 */
function position(needle, items, mode, wildcards, reverse) {
  let indexed = $list.index_map(items, (x, i) => { return [x, i]; });
  let _block;
  if (reverse) {
    _block = $list.reverse(indexed);
  } else {
    _block = indexed;
  }
  let ordered = _block;
  let $ = $list.find(
    ordered,
    (p) => { return lookup_equal(needle, p[0], wildcards); },
  );
  if ($ instanceof Ok) {
    let i = $[0][1];
    return new Ok(i);
  } else {
    if (mode instanceof Exact) {
      return new Error(undefined);
    } else if (mode instanceof NextSmaller) {
      return best(indexed, needle, $order.Order$Lt$const);
    } else {
      return best(indexed, needle, $order.Order$Gt$const);
    }
  }
}

/**
 * A one-dimensional array: a single row or a single column.
 * 
 * @ignore
 */
function vector(v) {
  let $ = $env.dims(v);
  let r = $[0];
  let c = $[1];
  let $1 = (r === 1) || (c === 1);
  if ($1) {
    return new Ok($env.flatten(v));
  } else {
    return new Error($value.ErrorKind$ValueErr$const);
  }
}

function xmatch(vals) {
  return arity(
    vals,
    2,
    4,
    () => {
      let needle;
      let items;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1373,
          "xmatch",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 38035,
            end: 38076,
            pattern_start: 38046,
            pattern_end: 38069
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1373,
            "xmatch",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 38035,
              end: 38076,
              pattern_start: 38046,
              pattern_end: 38069
            }
          )
        } else {
          needle = vals.head;
          items = $.head;
          rest = $.tail;
        }
      }
      let _block;
      if (rest instanceof $Empty) {
        _block = new Ok(0);
      } else {
        let m = rest.head;
        _block = scalar_int(m);
      }
      let mm = _block;
      let _block$1;
      let $1 = $env.nth(rest, 1);
      if ($1 instanceof Ok) {
        let s = $1[0];
        _block$1 = scalar_int(s);
      } else {
        _block$1 = new Ok(1);
      }
      let sm = _block$1;
      let $2 = $env.scalar(needle);
      let $3 = vector(items);
      if ($2 instanceof Err) {
        let k = $2[0];
        return fail(k);
      } else if ($3 instanceof Ok) {
        if (mm instanceof Ok) {
          if (sm instanceof Ok) {
            let n = $2;
            let xs = $3[0];
            let mm$1 = mm[0];
            let sm$1 = sm[0];
            let _block$2;
            if (mm$1 === -1) {
              _block$2 = Approx$NextSmaller$const;
            } else if (mm$1 === 1) {
              _block$2 = Approx$NextLarger$const;
            } else {
              _block$2 = Approx$Exact$const;
            }
            let mode$1 = _block$2;
            let $4 = position(n, xs, mode$1, mm$1 === 2, sm$1 === -1);
            if ($4 instanceof Ok) {
              let i = $4[0];
              return new Scalar(new Number($int.to_float(i + 1)));
            } else {
              return fail($value.ErrorKind$NA$const);
            }
          } else {
            let k = sm[0];
            return fail(k);
          }
        } else {
          let k = mm[0];
          return fail(k);
        }
      } else {
        let k = $3[0];
        return fail(k);
      }
    },
  );
}

function match_(vals) {
  return arity(
    vals,
    2,
    3,
    () => {
      let needle;
      let items;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1349,
          "match_",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 37430,
            end: 37471,
            pattern_start: 37441,
            pattern_end: 37464
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1349,
            "match_",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 37430,
              end: 37471,
              pattern_start: 37441,
              pattern_end: 37464
            }
          )
        } else {
          needle = vals.head;
          items = $.head;
          rest = $.tail;
        }
      }
      let _block;
      if (rest instanceof $Empty) {
        _block = new Ok(1);
      } else if (rest.tail instanceof $Empty) {
        let k = rest.head;
        _block = scalar_int(k);
      } else {
        _block = new Ok(1);
      }
      let kind = _block;
      let $1 = $env.scalar(needle);
      let $2 = vector(items);
      if ($1 instanceof Err) {
        let k = $1[0];
        return fail(k);
      } else if ($2 instanceof Ok) {
        if (kind instanceof Ok) {
          let n = $1;
          let xs = $2[0];
          let kind$1 = kind[0];
          let _block$1;
          if (kind$1 === 0) {
            _block$1 = Approx$Exact$const;
          } else {
            let k = kind$1;
            if (k > 0) {
              _block$1 = Approx$NextSmaller$const;
            } else {
              _block$1 = Approx$NextLarger$const;
            }
          }
          let mode$1 = _block$1;
          let $3 = position(n, xs, mode$1, kind$1 === 0, false);
          if ($3 instanceof Ok) {
            let i = $3[0];
            return new Scalar(new Number($int.to_float(i + 1)));
          } else {
            return fail($value.ErrorKind$NA$const);
          }
        } else {
          let k = kind[0];
          return fail(k);
        }
      } else {
        let k = $2[0];
        return fail(k);
      }
    },
  );
}

function as_column(v) {
  if (v instanceof Grid) {
    let $ = v[0];
    if ($ instanceof $Empty) {
      return v;
    } else if ($.tail instanceof $Empty) {
      let row = $.head;
      return new Grid(
        $list.map(row, (x) => { return listPrepend(x, $List$Empty$const); }),
      );
    } else {
      return v;
    }
  } else {
    return v;
  }
}

function xlookup(vals) {
  return arity(
    vals,
    3,
    6,
    () => {
      let needle;
      let keys_val;
      let results;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1277,
          "xlookup",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 35513,
            end: 35566,
            pattern_start: 35524,
            pattern_end: 35559
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1277,
            "xlookup",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 35513,
              end: 35566,
              pattern_start: 35524,
              pattern_end: 35559
            }
          )
        } else {
          let $1 = $.tail;
          if ($1 instanceof $Empty) {
            throw makeError(
              "let_assert",
              FILEPATH,
              "sutra/functions",
              1277,
              "xlookup",
              "Pattern match failed, no pattern matched the value.",
              {
                value: vals,
                start: 35513,
                end: 35566,
                pattern_start: 35524,
                pattern_end: 35559
              }
            )
          } else {
            needle = vals.head;
            keys_val = $.head;
            results = $1.head;
            rest = $1.tail;
          }
        }
      }
      let needle$1 = $env.scalar(needle);
      let _block;
      if (rest instanceof $Empty) {
        _block = new Error(undefined);
      } else {
        let m = rest.head;
        if (m instanceof Scalar && m[0] instanceof Empty) {
          _block = new Error(undefined);
        } else {
          _block = new Ok(m);
        }
      }
      let if_missing = _block;
      let _block$1;
      let $2 = $env.nth(rest, 1);
      if ($2 instanceof Ok) {
        let v = $2[0];
        _block$1 = scalar_int(v);
      } else {
        _block$1 = new Ok(0);
      }
      let match_mode = _block$1;
      let _block$2;
      let $3 = $env.nth(rest, 2);
      if ($3 instanceof Ok) {
        let v = $3[0];
        _block$2 = scalar_int(v);
      } else {
        _block$2 = new Ok(1);
      }
      let search_mode = _block$2;
      let $4 = $env.dims(keys_val);
      let kr = $4[0];
      let kc = $4[1];
      let $5 = $env.dims(results);
      let rr = $5[0];
      let rc = $5[1];
      let $6 = vector(keys_val);
      if (needle$1 instanceof Err) {
        let k = needle$1[0];
        return fail(k);
      } else if ($6 instanceof Ok) {
        if (match_mode instanceof Ok) {
          if (search_mode instanceof Ok) {
            let keys = $6[0];
            let mm = match_mode[0];
            let sm = search_mode[0];
            let _block$3;
            if (mm === -1) {
              _block$3 = new Ok(Approx$NextSmaller$const);
            } else if (mm === 1) {
              _block$3 = new Ok(Approx$NextLarger$const);
            } else if (mm === 0) {
              _block$3 = new Ok(Approx$Exact$const);
            } else if (mm === 2) {
              _block$3 = new Ok(Approx$Exact$const);
            } else {
              _block$3 = new Error(undefined);
            }
            let mode$1 = _block$3;
            let vertical = ((kc === 1) && (kr > 1)) || (((kr === 1) && (kc === 1)) && (rr > 1));
            let _block$4;
            if (vertical) {
              _block$4 = rr === kr;
            } else {
              _block$4 = rc === kc;
            }
            let fits = _block$4;
            let $7 = (sm === 1) || (sm === -1);
            if (mode$1 instanceof Ok && fits && $7) {
              let mode$2 = mode$1[0];
              let $8 = position(needle$1, keys, mode$2, mm === 2, sm === -1);
              if ($8 instanceof Ok) {
                let i = $8[0];
                if (vertical) {
                  return pick_row($env.rows(results), i);
                } else {
                  let _pipe = pick_row(transpose($env.rows(results)), i);
                  return as_column(_pipe);
                }
              } else {
                if (if_missing instanceof Ok) {
                  let v = if_missing[0];
                  return v;
                } else {
                  return fail($value.ErrorKind$NA$const);
                }
              }
            } else {
              return fail($value.ErrorKind$ValueErr$const);
            }
          } else {
            let k = search_mode[0];
            return fail(k);
          }
        } else {
          let k = match_mode[0];
          return fail(k);
        }
      } else {
        let k = $6[0];
        return fail(k);
      }
    },
  );
}

function vlookup(vals, horizontal) {
  return arity(
    vals,
    3,
    4,
    () => {
      let needle;
      let table;
      let col;
      let rest;
      if (vals instanceof $Empty) {
        throw makeError(
          "let_assert",
          FILEPATH,
          "sutra/functions",
          1234,
          "vlookup",
          "Pattern match failed, no pattern matched the value.",
          {
            value: vals,
            start: 34312,
            end: 34358,
            pattern_start: 34323,
            pattern_end: 34351
          }
        )
      } else {
        let $ = vals.tail;
        if ($ instanceof $Empty) {
          throw makeError(
            "let_assert",
            FILEPATH,
            "sutra/functions",
            1234,
            "vlookup",
            "Pattern match failed, no pattern matched the value.",
            {
              value: vals,
              start: 34312,
              end: 34358,
              pattern_start: 34323,
              pattern_end: 34351
            }
          )
        } else {
          let $1 = $.tail;
          if ($1 instanceof $Empty) {
            throw makeError(
              "let_assert",
              FILEPATH,
              "sutra/functions",
              1234,
              "vlookup",
              "Pattern match failed, no pattern matched the value.",
              {
                value: vals,
                start: 34312,
                end: 34358,
                pattern_start: 34323,
                pattern_end: 34351
              }
            )
          } else {
            needle = vals.head;
            table = $.head;
            col = $1.head;
            rest = $1.tail;
          }
        }
      }
      let needle$1 = $env.scalar(needle);
      let _block;
      if (rest instanceof $Empty) {
        _block = new Ok(true);
      } else if (rest.tail instanceof $Empty) {
        let a = rest.head;
        _block = $value.to_bool($env.scalar(a));
      } else {
        _block = new Ok(true);
      }
      let approx = _block;
      let _block$1;
      if (horizontal) {
        _block$1 = transpose($env.rows(table));
      } else {
        _block$1 = $env.rows(table);
      }
      let rows = _block$1;
      let $2 = scalar_int(col);
      if (needle$1 instanceof Err) {
        let k = needle$1[0];
        return fail(k);
      } else if ($2 instanceof Ok) {
        if (approx instanceof Ok) {
          let c = $2[0];
          let approx$1 = approx[0];
          let _block$2;
          if (rows instanceof $Empty) {
            _block$2 = 0;
          } else {
            let r = rows.head;
            _block$2 = $list.length(r);
          }
          let width = _block$2;
          let $3 = c < 1;
          let $4 = c > width;
          if ($3) {
            return fail($value.ErrorKind$ValueErr$const);
          } else if ($4) {
            return fail($value.ErrorKind$RefErr$const);
          } else {
            let keys = $list.map(
              rows,
              (r) => {
                let _pipe = $list.first(r);
                return $result.unwrap(_pipe, Value$Empty$const);
              },
            );
            let _block$3;
            if (approx$1) {
              _block$3 = Approx$NextSmaller$const;
            } else {
              _block$3 = Approx$Exact$const;
            }
            let mode$1 = _block$3;
            let $5 = position(needle$1, keys, mode$1, !approx$1, false);
            if ($5 instanceof Ok) {
              let i = $5[0];
              let $6 = $env.nth(rows, i);
              let row;
              if ($6 instanceof Ok) {
                row = $6[0];
              } else {
                throw makeError(
                  "let_assert",
                  FILEPATH,
                  "sutra/functions",
                  1264,
                  "vlookup",
                  "Pattern match failed, no pattern matched the value.",
                  {
                    value: $6,
                    start: 35247,
                    end: 35284,
                    pattern_start: 35258,
                    pattern_end: 35265
                  }
                )
              }
              return new Scalar(
                (() => {
                  let _pipe = $env.nth(row, c - 1);
                  return $result.unwrap(_pipe, Value$Empty$const);
                })(),
              );
            } else {
              return fail($value.ErrorKind$NA$const);
            }
          }
        } else {
          let k = approx[0];
          return fail(k);
        }
      } else {
        let k = $2[0];
        return fail(k);
      }
    },
  );
}

/**
 * "2024-01-31" or "2024/1/31".
 * 
 * @ignore
 */
function parse_iso_date(s) {
  let _block;
  let $ = $string.contains(s, "-");
  if ($) {
    _block = $string.split($string.trim(s), "-");
  } else {
    _block = $string.split($string.trim(s), "/");
  }
  let parts = _block;
  let $1 = $list.try_map(parts, $int.parse);
  if ($1 instanceof Ok) {
    let $2 = $1[0];
    if ($2 instanceof $Empty) {
      return new Error(undefined);
    } else {
      let $3 = $2.tail;
      if ($3 instanceof $Empty) {
        return new Error(undefined);
      } else {
        let $4 = $3.tail;
        if ($4 instanceof $Empty) {
          return new Error(undefined);
        } else if ($4.tail instanceof $Empty) {
          let y = $2.head;
          let m = $3.head;
          let d = $4.head;
          if ((((y >= 1900) && (m >= 1)) && (m <= 12)) && (d >= 1)) {
            let $5 = d <= $dates.days_in_month(y, m);
            if ($5) {
              return $dates.serial(y, m, d);
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
  } else {
    return new Error(undefined);
  }
}

function serial_arg(v, k) {
  return $num.number(
    v,
    (x) => {
      let $ = (x < 0.0) || (x > 2958465.0);
      if ($) {
        return new Err($value.ErrorKind$NumErr$const);
      } else {
        return k($float.truncate(x));
      }
    },
  );
}

function datedif(a) {
  return serial_arg(
    arg(a, 0),
    (start) => {
      return serial_arg(
        arg(a, 1),
        (end) => {
          return $num.text(
            arg(a, 2),
            (unit) => {
              let $ = start > end;
              if ($) {
                return new Err($value.ErrorKind$NumErr$const);
              } else {
                let $1 = $dates.ymd(start);
                let y1 = $1[0];
                let m1 = $1[1];
                let d1 = $1[2];
                let $2 = $dates.ymd(end);
                let y2 = $2[0];
                let m2 = $2[1];
                let d2 = $2[2];
                let months = (((y2 - y1) * 12 + m2) - m1) - (() => {
                  let $3 = d2 < d1;
                  if ($3) {
                    return 1;
                  } else {
                    return 0;
                  }
                })();
                let $3 = $string.uppercase(unit);
                if ($3 === "D") {
                  return new Number($int.to_float(end - start));
                } else if ($3 === "M") {
                  return new Number($int.to_float(months));
                } else if ($3 === "Y") {
                  return new Number(
                    $int.to_float(globalThis.Math.trunc(months / 12)),
                  );
                } else if ($3 === "YM") {
                  return new Number($int.to_float(months % 12));
                } else if ($3 === "MD") {
                  let $4 = d2 >= d1;
                  if ($4) {
                    return new Number($int.to_float(d2 - d1));
                  } else {
                    let _block;
                    let $6 = m2 === 1;
                    if ($6) {
                      _block = [y2 - 1, 12];
                    } else {
                      _block = [y2, m2 - 1];
                    }
                    let $5 = _block;
                    let py = $5[0];
                    let pm = $5[1];
                    return new Number(
                      $int.to_float(($dates.days_in_month(py, pm) - d1) + d2),
                    );
                  }
                } else {
                  return new Err($value.ErrorKind$NumErr$const);
                }
              }
            },
          );
        },
      );
    },
  );
}

function shift_months(end_of_month) {
  return (a) => {
    return serial_arg(
      arg(a, 0),
      (n) => {
        return $num.integer(
          arg(a, 1),
          (months) => {
            let $ = $dates.ymd(n);
            let y = $[0];
            let m = $[1];
            let d = $[2];
            let total = ((y * 12 + m) - 1) + months;
            let y2 = globalThis.Math.trunc(total / 12);
            let m2 = (total % 12) + 1;
            let last = $dates.days_in_month(y2, m2);
            let _block;
            if (end_of_month) {
              _block = last;
            } else {
              _block = $int.min(d, last);
            }
            let d2 = _block;
            let $1 = total < 0;
            let $2 = $dates.serial(y2, m2, d2);
            if (!$1 && $2 instanceof Ok) {
              let s = $2[0];
              return new Number($int.to_float(s));
            } else {
              return new Err($value.ErrorKind$NumErr$const);
            }
          },
        );
      },
    );
  };
}

function date_part(vals, pick) {
  return lifted(
    vals,
    1,
    1,
    (a) => {
      return serial_arg(
        arg(a, 0),
        (n) => { return new Number($int.to_float(pick($dates.ymd(n)))); },
      );
    },
  );
}

function format_text(x, code) {
  let $ = $format.text(x, code);
  if ($ instanceof Ok) {
    let s = $[0];
    return new Text(s);
  } else {
    return new Err($value.ErrorKind$ValueErr$const);
  }
}

function find(normalise) {
  return (a) => {
    return $num.text(
      arg(a, 0),
      (needle) => {
        return $num.text(
          arg(a, 1),
          (hay) => {
            return $num.integer(
              opt(a, 2, new Number(1.0)),
              (start) => {
                let len = $string.length(hay);
                let $ = (start < 1) || (start > (len + 1));
                if ($) {
                  return new Err($value.ErrorKind$ValueErr$const);
                } else {
                  let rest = normalise($string.drop_start(hay, start - 1));
                  if (needle === "") {
                    return new Number($int.to_float(start));
                  } else {
                    let $1 = $string.split_once(rest, normalise(needle));
                    if ($1 instanceof Ok) {
                      let before = $1[0][0];
                      return new Number(
                        $int.to_float(start + $string.length(before)),
                      );
                    } else {
                      return new Err($value.ErrorKind$ValueErr$const);
                    }
                  }
                }
              },
            );
          },
        );
      },
    );
  };
}

function substitute_nth(s, old, new$, n) {
  if (old === "") {
    return s;
  } else {
    let pieces = $string.split(s, old);
    let $ = $list.length(pieces) > n;
    if ($) {
      let $1 = $list.split(pieces, n);
      let before = $1[0];
      let after = $1[1];
      return ($string.join(before, old) + new$) + $string.join(after, old);
    } else {
      return s;
    }
  }
}

function textjoin(vals) {
  if (vals instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let $ = vals.tail;
    if ($ instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let items = $.tail;
      if (!(items instanceof $Empty)) {
        let delim = vals.head;
        let skip = $.head;
        let d = $value.to_text($env.scalar(delim));
        let s = $value.to_bool($env.scalar(skip));
        if (d instanceof Ok) {
          if (s instanceof Ok) {
            let d$1 = d[0];
            let skip_empty = s[0];
            let $1 = $list.try_map(
              $list.flat_map(items, $env.flatten),
              $value.to_text,
            );
            if ($1 instanceof Ok) {
              let parts = $1[0];
              let _block;
              if (skip_empty) {
                _block = $list.filter(parts, (p) => { return p !== ""; });
              } else {
                _block = parts;
              }
              let parts$1 = _block;
              return new Scalar(new Text($string.join(parts$1, d$1)));
            } else {
              let k = $1[0];
              return fail(k);
            }
          } else {
            let k = s[0];
            return fail(k);
          }
        } else {
          let k = d[0];
          return fail(k);
        }
      } else {
        return fail($value.ErrorKind$ValueErr$const);
      }
    }
  }
}

function text1(vals, f) {
  return lifted(
    vals,
    1,
    1,
    (a) => { return $num.text(arg(a, 0), (s) => { return new Text(f(s)); }); },
  );
}

function trim(s) {
  let _pipe = s;
  let _pipe$1 = $string.split(_pipe, " ");
  let _pipe$2 = $list.filter(_pipe$1, (w) => { return w !== ""; });
  return $string.join(_pipe$2, " ");
}

function proper(s) {
  let $ = $list.fold(
    $string.to_graphemes(s),
    ["", false],
    (acc, c) => {
      let out = acc[0];
      let in_word = acc[1];
      let is_letter = $string.lowercase(c) !== $string.uppercase(c);
      let _block;
      if (is_letter) {
        if (in_word) {
          _block = $string.lowercase(c);
        } else {
          _block = $string.uppercase(c);
        }
      } else {
        _block = c;
      }
      let c$1 = _block;
      return [out + c$1, is_letter];
    },
  );
  let out = $[0];
  return out;
}

function first_val(vals) {
  if (vals instanceof $Empty) {
    return new Scalar(Value$Empty$const);
  } else {
    let v = vals.head;
    return v;
  }
}

function boolean(b) {
  return new Boolean(b);
}

function is(vals, check) {
  return lifted(vals, 1, 1, (a) => { return boolean(check(arg(a, 0))); });
}

function logical(vals, combine) {
  let collected = $list.try_fold(
    vals,
    $List$Empty$const,
    (acc, v) => {
      if (v instanceof Scalar) {
        let x = v[0];
        let $ = $value.to_bool(x);
        if ($ instanceof Ok) {
          let b = $[0];
          return new Ok(listPrepend(b, acc));
        } else {
          return $;
        }
      } else {
        return $list.try_fold(
          $env.flatten(v),
          acc,
          (acc, x) => {
            if (x instanceof Number) {
              let n = x[0];
              return new Ok(listPrepend(n !== 0.0, acc));
            } else if (x instanceof Boolean) {
              let b = x[0];
              return new Ok(listPrepend(b, acc));
            } else if (x instanceof Err) {
              let k = x[0];
              return new Error(k);
            } else {
              return new Ok(acc);
            }
          },
        );
      }
    },
  );
  if (collected instanceof Ok) {
    let $ = collected[0];
    if ($ instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let bs = $;
      return new Scalar(new Boolean(combine(bs)));
    }
  } else {
    let k = collected[0];
    return fail(k);
  }
}

function grid_or_scalar(rows) {
  if (rows instanceof $Empty) {
    return fail($value.ErrorKind$Calc$const);
  } else if (rows.head instanceof $Empty && rows.tail instanceof $Empty) {
    return fail($value.ErrorKind$Calc$const);
  } else {
    return new Grid(rows);
  }
}

function sequence(vals) {
  return arity(
    vals,
    1,
    4,
    () => {
      let get = (i, default$) => {
        let $ = $env.nth(vals, i);
        if ($ instanceof Ok) {
          let $1 = $[0];
          if ($1 instanceof Scalar && $1[0] instanceof Empty) {
            return new Ok(default$);
          } else {
            let v = $1;
            return $value.to_number($env.scalar(v));
          }
        } else {
          return new Ok(default$);
        }
      };
      let $ = get(0, 1.0);
      let $1 = get(1, 1.0);
      let $2 = get(2, 1.0);
      let $3 = get(3, 1.0);
      if ($ instanceof Ok) {
        if ($1 instanceof Ok) {
          if ($2 instanceof Ok) {
            if ($3 instanceof Ok) {
              let r = $[0];
              let c = $1[0];
              let start = $2[0];
              let by = $3[0];
              let r$1 = $float.truncate(r);
              let c$1 = $float.truncate(c);
              let $4 = ((r$1 < 1) || (c$1 < 1)) || (r$1 * c$1 > 100_000);
              if ($4) {
                return fail($value.ErrorKind$ValueErr$const);
              } else {
                return new Grid(
                  (() => {
                    let _pipe = $int.range(
                      0,
                      r$1,
                      $List$Empty$const,
                      (acc, i) => {
                        return listPrepend(
                          (() => {
                            let _pipe = $int.range(
                              0,
                              c$1,
                              $List$Empty$const,
                              (acc, j) => {
                                return listPrepend(
                                  new Number(
                                    start + (by * $int.to_float(i * c$1 + j)),
                                  ),
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
              }
            } else {
              let k = $3[0];
              return fail(k);
            }
          } else {
            let k = $2[0];
            return fail(k);
          }
        } else {
          let k = $1[0];
          return fail(k);
        }
      } else {
        let k = $[0];
        return fail(k);
      }
    },
  );
}

function sumproduct(vals) {
  if (vals instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let first_arg = vals.head;
    let size = $env.dims(first_arg);
    let $ = $list.all(vals, (v) => { return isEqual($env.dims(v), size); });
    if ($) {
      let columns = $list.map(vals, $env.flatten);
      let $1 = first_error($list.flatten(columns));
      if ($1 instanceof Ok) {
        let _block;
        let _pipe = $list.transpose(columns);
        _block = $list.map(
          _pipe,
          (cells) => {
            return $list.fold(
              cells,
              new Ok(1.0),
              (acc, x) => {
                return $result.try$(
                  acc,
                  (p) => {
                    if (x instanceof Number) {
                      let n = x[0];
                      return $num.mul(p, n);
                    } else {
                      return new Ok(0.0);
                    }
                  },
                );
              },
            );
          },
        );
        let products = _block;
        let $2 = $result.all(products);
        if ($2 instanceof Ok) {
          let ps = $2[0];
          return new Scalar(sum_value(ps));
        } else {
          let k = $2[0];
          return fail(k);
        }
      } else {
        let k = $1[0];
        return fail(k);
      }
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  }
}

function log(x, base) {
  let $ = (x <= 0.0) || (base <= 0.0);
  if ($) {
    return new Error($value.ErrorKind$NumErr$const);
  } else {
    return $result.try$(
      $num.ln(x),
      (a) => {
        return $result.try$($num.ln(base), (b) => { return $num.div(a, b); });
      },
    );
  }
}

function number1(f) {
  return (args) => {
    return $num.number(arg(args, 0), (x) => { return $num.result(f(x)); });
  };
}

function step(f) {
  return (a) => {
    return $num.number(
      arg(a, 0),
      (x) => {
        return $num.number(
          opt(a, 1, new Number(1.0)),
          (sig) => {
            let $ = sig === 0.0;
            let $1 = (x > 0.0) && (sig < 0.0);
            if ($) {
              return new Number(0.0);
            } else if ($1) {
              return new Err($value.ErrorKind$NumErr$const);
            } else {
              let q = divideFloat(x, sig);
              let q$1 = $num.round(q, 12, $num.Rounding$HalfUp$const);
              return $num.result($num.mul(f(q$1), sig));
            }
          },
        );
      },
    );
  };
}

function rounding(mode) {
  return (a) => {
    return $num.number(
      arg(a, 0),
      (x) => {
        return $num.integer(
          opt(a, 1, new Number(0.0)),
          (places) => { return new Number($num.round(x, places, mode)); },
        );
      },
    );
  };
}

function count(vals) {
  return $list.fold(
    vals,
    0,
    (acc, v) => {
      if (v instanceof Scalar) {
        let $ = v[0];
        if ($ instanceof Number) {
          return acc + 1;
        } else if ($ instanceof Text) {
          let s = $[0];
          let $1 = $value.parse_number(s);
          if ($1 instanceof Ok) {
            return acc + 1;
          } else {
            return acc;
          }
        } else if ($ instanceof Boolean) {
          return acc + 1;
        } else {
          return acc;
        }
      } else {
        return acc + $list.count(
          $env.flatten(v),
          (x) => {
            if (x instanceof Number) {
              return true;
            } else {
              return false;
            }
          },
        );
      }
    },
  );
}

function eager(name, vals) {
  if (name === "SUM") {
    return with_numbers(vals, sum_value);
  } else if (name === "SUMSQ") {
    return with_numbers(
      vals,
      (xs) => {
        let _pipe = $list.try_map(xs, (x) => { return $num.mul(x, x); });
        let _pipe$1 = $result.try$(_pipe, $num.sum);
        return $num.result(_pipe$1);
      },
    );
  } else if (name === "PRODUCT") {
    return with_numbers(
      vals,
      (xs) => {
        if (xs instanceof $Empty) {
          return new Number(0.0);
        } else {
          let _pipe = $list.try_fold(xs, 1.0, $num.mul);
          return $num.result(_pipe);
        }
      },
    );
  } else if (name === "AVERAGE") {
    return with_numbers(vals, average);
  } else if (name === "MIN") {
    return with_numbers(
      vals,
      (xs) => { return new Number($list.fold(xs, first_or(xs), $float.min)); },
    );
  } else if (name === "MAX") {
    return with_numbers(
      vals,
      (xs) => { return new Number($list.fold(xs, first_or(xs), $float.max)); },
    );
  } else if (name === "COUNT") {
    return new Scalar(new Number($int.to_float(count(vals))));
  } else if (name === "COUNTA") {
    return new Scalar(
      new Number(
        $int.to_float(
          $list.fold(
            vals,
            0,
            (acc, v) => {
              return acc + $list.count(
                $env.flatten(v),
                (x) => { return !(x instanceof Empty); },
              );
            },
          ),
        ),
      ),
    );
  } else if (name === "COUNTBLANK") {
    return new Scalar(
      new Number(
        $int.to_float(
          $list.fold(
            vals,
            0,
            (acc, v) => {
              return acc + $list.count(
                $env.flatten(v),
                (x) => {
                  return (x instanceof Empty) || (isEqual(x, new Text("")));
                },
              );
            },
          ),
        ),
      ),
    );
  } else if (name === "ABS") {
    return lifted(
      vals,
      1,
      1,
      number1((x) => { return new Ok($float.absolute_value(x)); }),
    );
  } else if (name === "SIGN") {
    return lifted(
      vals,
      1,
      1,
      number1(
        (x) => {
          return new Ok(
            (() => {
              let $ = x > 0.0;
              let $1 = x < 0.0;
              if ($) {
                return 1.0;
              } else if ($1) {
                return -1.0;
              } else {
                return 0.0;
              }
            })(),
          );
        },
      ),
    );
  } else if (name === "INT") {
    return lifted(
      vals,
      1,
      1,
      number1((x) => { return new Ok($float.floor(x)); }),
    );
  } else if (name === "ROUND") {
    return lifted(vals, 1, 2, rounding($num.Rounding$HalfUp$const));
  } else if (name === "ROUNDUP") {
    return lifted(vals, 1, 2, rounding($num.Rounding$Up$const));
  } else if (name === "ROUNDDOWN") {
    return lifted(vals, 1, 2, rounding($num.Rounding$Down$const));
  } else if (name === "TRUNC") {
    return lifted(vals, 1, 2, rounding($num.Rounding$Down$const));
  } else if (name === "MROUND") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.number(
          arg(a, 0),
          (x) => {
            return $num.number(
              arg(a, 1),
              (m) => {
                let $ = m === 0.0;
                let $1 = (x * m) < 0.0;
                if ($) {
                  return new Number(0.0);
                } else if ($1) {
                  return new Err($value.ErrorKind$NumErr$const);
                } else {
                  let q = $num.round(
                    divideFloat(x, m),
                    0,
                    $num.Rounding$HalfUp$const,
                  );
                  return $num.result($num.mul(q, m));
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "CEILING") {
    return lifted(vals, 1, 2, step($float.ceiling));
  } else if (name === "CEILING.MATH") {
    return lifted(vals, 1, 2, step($float.ceiling));
  } else if (name === "FLOOR") {
    return lifted(vals, 1, 2, step($float.floor));
  } else if (name === "FLOOR.MATH") {
    return lifted(vals, 1, 2, step($float.floor));
  } else if (name === "MOD") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.number(
          arg(a, 0),
          (n) => {
            return $num.number(
              arg(a, 1),
              (d) => {
                let $ = d === 0.0;
                if ($) {
                  return new Err($value.ErrorKind$Div0$const);
                } else {
                  return new Number(n - (d * $float.floor(divideFloat(n, d))));
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "QUOTIENT") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.number(
          arg(a, 0),
          (n) => {
            return $num.number(
              arg(a, 1),
              (d) => {
                let $ = $num.div(n, d);
                if ($ instanceof Ok) {
                  let q = $[0];
                  return new Number($int.to_float($float.truncate(q)));
                } else {
                  let k = $[0];
                  return new Err(k);
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "POWER") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.number(
          arg(a, 0),
          (b) => {
            return $num.number(
              arg(a, 1),
              (e) => { return $num.result($num.pow(b, e)); },
            );
          },
        );
      },
    );
  } else if (name === "SQRT") {
    return lifted(vals, 1, 1, number1($num.sqrt));
  } else if (name === "EXP") {
    return lifted(vals, 1, 1, number1($num.exp));
  } else if (name === "LN") {
    return lifted(vals, 1, 1, number1($num.ln));
  } else if (name === "LOG10") {
    return lifted(vals, 1, 1, number1((x) => { return log(x, 10.0); }));
  } else if (name === "LOG") {
    return lifted(
      vals,
      1,
      2,
      (a) => {
        return $num.number(
          arg(a, 0),
          (x) => {
            return $num.number(
              opt(a, 1, new Number(10.0)),
              (base) => { return $num.result(log(x, base)); },
            );
          },
        );
      },
    );
  } else if (name === "PI") {
    return arity(
      vals,
      0,
      0,
      () => { return new Scalar(new Number(3.141592653589793)); },
    );
  } else if (name === "FACT") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.integer(
          arg(a, 0),
          (n) => {
            let $ = (n < 0) || (n > 170);
            if ($) {
              return new Err($value.ErrorKind$NumErr$const);
            } else {
              return new Number(
                $int.range(
                  1,
                  n + 1,
                  1.0,
                  (acc, i) => { return acc * $int.to_float(i); },
                ),
              );
            }
          },
        );
      },
    );
  } else if (name === "SUMPRODUCT") {
    return sumproduct(vals);
  } else if (name === "SEQUENCE") {
    return sequence(vals);
  } else if (name === "TRANSPOSE") {
    return arity(
      vals,
      1,
      1,
      () => { return grid_or_scalar(transpose($env.rows(first_val(vals)))); },
    );
  } else if (name === "TRUE") {
    return arity(vals, 0, 0, () => { return new Scalar(new Boolean(true)); });
  } else if (name === "FALSE") {
    return arity(vals, 0, 0, () => { return new Scalar(new Boolean(false)); });
  } else if (name === "NOT") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.boolean(arg(a, 0), (b) => { return new Boolean(!b); });
      },
    );
  } else if (name === "AND") {
    return logical(
      vals,
      (bs) => { return $list.all(bs, (b) => { return b; }); },
    );
  } else if (name === "OR") {
    return logical(
      vals,
      (bs) => { return $list.any(bs, (b) => { return b; }); },
    );
  } else if (name === "XOR") {
    return logical(
      vals,
      (bs) => { return ($list.count(bs, (b) => { return b; }) % 2) === 1; },
    );
  } else if (name === "ISNUMBER") {
    return is(
      vals,
      (x) => {
        if (x instanceof Number) {
          return true;
        } else {
          return false;
        }
      },
    );
  } else if (name === "ISTEXT") {
    return is(
      vals,
      (x) => {
        if (x instanceof Text) {
          return true;
        } else {
          return false;
        }
      },
    );
  } else if (name === "ISNONTEXT") {
    return is(
      vals,
      (x) => {
        if (x instanceof Text) {
          return false;
        } else {
          return true;
        }
      },
    );
  } else if (name === "ISLOGICAL") {
    return is(
      vals,
      (x) => {
        if (x instanceof Boolean) {
          return true;
        } else {
          return false;
        }
      },
    );
  } else if (name === "ISBLANK") {
    return is(vals, (x) => { return x instanceof Empty; });
  } else if (name === "ISERROR") {
    return is(vals, $value.is_error);
  } else if (name === "ISERR") {
    return is(
      vals,
      (x) => {
        return $value.is_error(x) && (!isEqual(
          x,
          new Err($value.ErrorKind$NA$const)
        ));
      },
    );
  } else if (name === "ISNA") {
    return is(
      vals,
      (x) => { return isEqual(x, new Err($value.ErrorKind$NA$const)); },
    );
  } else if (name === "ISEVEN") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.integer(
          arg(a, 0),
          (n) => { return new Boolean($int.is_even(n)); },
        );
      },
    );
  } else if (name === "ISODD") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.integer(
          arg(a, 0),
          (n) => { return new Boolean($int.is_odd(n)); },
        );
      },
    );
  } else if (name === "NA") {
    return arity(vals, 0, 0, () => { return fail($value.ErrorKind$NA$const); });
  } else if (name === "ROWS") {
    return arity(
      vals,
      1,
      1,
      () => {
        return new Scalar(
          new Number($int.to_float($env.dims(first_val(vals))[0])),
        );
      },
    );
  } else if (name === "COLUMNS") {
    return arity(
      vals,
      1,
      1,
      () => {
        return new Scalar(
          new Number($int.to_float($env.dims(first_val(vals))[1])),
        );
      },
    );
  } else if (name === "LEN") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => { return new Number($int.to_float($string.length(s))); },
        );
      },
    );
  } else if (name === "LEFT") {
    return lifted(
      vals,
      1,
      2,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.integer(
              opt(a, 1, new Number(1.0)),
              (n) => {
                let $ = n < 0;
                if ($) {
                  return new Err($value.ErrorKind$ValueErr$const);
                } else {
                  return new Text($string.slice(s, 0, n));
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "RIGHT") {
    return lifted(
      vals,
      1,
      2,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.integer(
              opt(a, 1, new Number(1.0)),
              (n) => {
                let $ = n < 0;
                if ($) {
                  return new Err($value.ErrorKind$ValueErr$const);
                } else {
                  let len = $string.length(s);
                  return new Text($string.drop_start(s, $int.max(0, len - n)));
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "MID") {
    return lifted(
      vals,
      3,
      3,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.integer(
              arg(a, 1),
              (start) => {
                return $num.integer(
                  arg(a, 2),
                  (n) => {
                    let $ = (start < 1) || (n < 0);
                    if ($) {
                      return new Err($value.ErrorKind$ValueErr$const);
                    } else {
                      return new Text($string.slice(s, start - 1, n));
                    }
                  },
                );
              },
            );
          },
        );
      },
    );
  } else if (name === "UPPER") {
    return text1(vals, $string.uppercase);
  } else if (name === "LOWER") {
    return text1(vals, $string.lowercase);
  } else if (name === "PROPER") {
    return text1(vals, proper);
  } else if (name === "TRIM") {
    return text1(vals, trim);
  } else if (name === "CLEAN") {
    return text1(
      vals,
      (s) => { return $string.replace($string.replace(s, "\n", ""), "\r", ""); },
    );
  } else if (name === "CONCATENATE") {
    return lifted(
      vals,
      1,
      255,
      (a) => {
        let $ = $list.try_map(a, $value.to_text);
        if ($ instanceof Ok) {
          let parts = $[0];
          return new Text($string.concat(parts));
        } else {
          let k = $[0];
          return new Err(k);
        }
      },
    );
  } else if (name === "CONCAT") {
    let $ = $list.try_map($list.flat_map(vals, $env.flatten), $value.to_text);
    if ($ instanceof Ok) {
      let parts = $[0];
      return new Scalar(new Text($string.concat(parts)));
    } else {
      let k = $[0];
      return fail(k);
    }
  } else if (name === "TEXTJOIN") {
    return textjoin(vals);
  } else if (name === "SUBSTITUTE") {
    return lifted(
      vals,
      3,
      4,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.text(
              arg(a, 1),
              (old) => {
                return $num.text(
                  arg(a, 2),
                  (new$) => {
                    let $ = $env.nth(a, 3);
                    if ($ instanceof Ok) {
                      let n = $[0];
                      return $num.integer(
                        n,
                        (n) => {
                          let $1 = n < 1;
                          if ($1) {
                            return new Err($value.ErrorKind$ValueErr$const);
                          } else {
                            return new Text(substitute_nth(s, old, new$, n));
                          }
                        },
                      );
                    } else {
                      if (old === "") {
                        return new Text(s);
                      } else {
                        return new Text($string.replace(s, old, new$));
                      }
                    }
                  },
                );
              },
            );
          },
        );
      },
    );
  } else if (name === "REPLACE") {
    return lifted(
      vals,
      4,
      4,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.integer(
              arg(a, 1),
              (start) => {
                return $num.integer(
                  arg(a, 2),
                  (n) => {
                    return $num.text(
                      arg(a, 3),
                      (new$) => {
                        let $ = (start < 1) || (n < 0);
                        if ($) {
                          return new Err($value.ErrorKind$ValueErr$const);
                        } else {
                          return new Text(
                            ($string.slice(s, 0, start - 1) + new$) + $string.drop_start(
                              s,
                              (start - 1) + n,
                            ),
                          );
                        }
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  } else if (name === "FIND") {
    return lifted(vals, 2, 3, find((s) => { return s; }));
  } else if (name === "SEARCH") {
    return lifted(vals, 2, 3, find($string.lowercase));
  } else if (name === "REPT") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            return $num.integer(
              arg(a, 1),
              (n) => {
                let $ = (n < 0) || (n * $string.length(s) > 32_767);
                if ($) {
                  return new Err($value.ErrorKind$ValueErr$const);
                } else {
                  return new Text($string.repeat(s, n));
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "EXACT") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.text(
          arg(a, 0),
          (x) => {
            return $num.text(arg(a, 1), (y) => { return new Boolean(x === y); });
          },
        );
      },
    );
  } else if (name === "VALUE") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        let $ = arg(a, 0);
        if ($ instanceof Number) {
          return $;
        } else if ($ instanceof Text) {
          let s = $[0];
          let $1 = $value.parse_number(s);
          if ($1 instanceof Ok) {
            let x = $1[0];
            return new Number(x);
          } else {
            return new Err($value.ErrorKind$ValueErr$const);
          }
        } else if ($ instanceof Boolean) {
          return new Err($value.ErrorKind$ValueErr$const);
        } else if ($ instanceof Empty) {
          return new Number(0.0);
        } else {
          return $;
        }
      },
    );
  } else if (name === "TEXT") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return $num.text(
          arg(a, 1),
          (code) => {
            let $ = arg(a, 0);
            if ($ instanceof Text) {
              let s = $[0];
              let $1 = $value.parse_number(s);
              if ($1 instanceof Ok) {
                let x = $1[0];
                return format_text(x, code);
              } else {
                return new Text(s);
              }
            } else {
              let v = $;
              return $num.number(v, (x) => { return format_text(x, code); });
            }
          },
        );
      },
    );
  } else if (name === "FIXED") {
    return lifted(
      vals,
      1,
      3,
      (a) => {
        return $num.number(
          arg(a, 0),
          (x) => {
            return $num.integer(
              opt(a, 1, new Number(2.0)),
              (d) => {
                return $num.boolean(
                  opt(a, 2, new Boolean(false)),
                  (no_commas) => {
                    let x$1 = $num.round(x, d, $num.Rounding$HalfUp$const);
                    let body = $format.fixed(
                      x$1,
                      $int.max(d, 0),
                      $int.max(d, 0),
                      1,
                      !no_commas,
                    );
                    let $ = x$1 < 0.0;
                    if ($) {
                      return new Text("-" + body);
                    } else {
                      return new Text(body);
                    }
                  },
                );
              },
            );
          },
        );
      },
    );
  } else if (name === "CHAR") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.integer(
          arg(a, 0),
          (n) => {
            let $ = (n >= 1) && (n <= 255);
            let $1 = $string.utf_codepoint(n);
            if ($ && $1 instanceof Ok) {
              let cp = $1[0];
              return new Text(
                $string.from_utf_codepoints(listPrepend(cp, $List$Empty$const)),
              );
            } else {
              return new Err($value.ErrorKind$ValueErr$const);
            }
          },
        );
      },
    );
  } else if (name === "CODE") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            let $ = $string.to_utf_codepoints(s);
            if ($ instanceof $Empty) {
              return new Err($value.ErrorKind$ValueErr$const);
            } else {
              let cp = $.head;
              return new Number($int.to_float($string.utf_codepoint_to_int(cp)));
            }
          },
        );
      },
    );
  } else if (name === "DATE") {
    return lifted(
      vals,
      3,
      3,
      (a) => {
        return $num.integer(
          arg(a, 0),
          (y) => {
            return $num.integer(
              arg(a, 1),
              (m) => {
                return $num.integer(
                  arg(a, 2),
                  (d) => {
                    let $ = $dates.serial(y, m, d);
                    if ($ instanceof Ok) {
                      let n = $[0];
                      return new Number($int.to_float(n));
                    } else {
                      return new Err($value.ErrorKind$NumErr$const);
                    }
                  },
                );
              },
            );
          },
        );
      },
    );
  } else if (name === "YEAR") {
    return date_part(vals, (ymd) => { return ymd[0]; });
  } else if (name === "MONTH") {
    return date_part(vals, (ymd) => { return ymd[1]; });
  } else if (name === "DAY") {
    return date_part(vals, (ymd) => { return ymd[2]; });
  } else if (name === "WEEKDAY") {
    return lifted(
      vals,
      1,
      2,
      (a) => {
        return serial_arg(
          arg(a, 0),
          (n) => {
            return $num.integer(
              opt(a, 1, new Number(1.0)),
              (kind) => {
                let sunday_first = $dates.weekday(n);
                if (kind === 1) {
                  return new Number($int.to_float(sunday_first));
                } else if (kind === 2) {
                  return new Number($int.to_float(((sunday_first + 5) % 7) + 1));
                } else if (kind === 3) {
                  return new Number($int.to_float((sunday_first + 5) % 7));
                } else {
                  return new Err($value.ErrorKind$NumErr$const);
                }
              },
            );
          },
        );
      },
    );
  } else if (name === "EDATE") {
    return lifted(vals, 2, 2, shift_months(false));
  } else if (name === "EOMONTH") {
    return lifted(vals, 2, 2, shift_months(true));
  } else if (name === "DAYS") {
    return lifted(
      vals,
      2,
      2,
      (a) => {
        return serial_arg(
          arg(a, 0),
          (end) => {
            return serial_arg(
              arg(a, 1),
              (start) => { return new Number($int.to_float(end - start)); },
            );
          },
        );
      },
    );
  } else if (name === "DATEDIF") {
    return lifted(vals, 3, 3, datedif);
  } else if (name === "DATEVALUE") {
    return lifted(
      vals,
      1,
      1,
      (a) => {
        return $num.text(
          arg(a, 0),
          (s) => {
            let $ = parse_iso_date(s);
            if ($ instanceof Ok) {
              let n = $[0];
              return new Number($int.to_float(n));
            } else {
              return new Err($value.ErrorKind$ValueErr$const);
            }
          },
        );
      },
    );
  } else if (name === "VLOOKUP") {
    return vlookup(vals, false);
  } else if (name === "HLOOKUP") {
    return vlookup(vals, true);
  } else if (name === "XLOOKUP") {
    return xlookup(vals);
  } else if (name === "MATCH") {
    return match_(vals);
  } else if (name === "XMATCH") {
    return xmatch(vals);
  } else if (name === "INDEX") {
    return index(vals);
  } else if (name === "SUMIF") {
    return sumif(vals, sum_value);
  } else if (name === "AVERAGEIF") {
    return sumif(vals, average);
  } else if (name === "COUNTIF") {
    return countif(vals);
  } else if (name === "SUMIFS") {
    return ifs_aggregate(vals, sum_value);
  } else if (name === "AVERAGEIFS") {
    return ifs_aggregate(vals, average);
  } else if (name === "MAXIFS") {
    return ifs_aggregate(
      vals,
      (xs) => { return new Number($list.fold(xs, first_or(xs), $float.max)); },
    );
  } else if (name === "MINIFS") {
    return ifs_aggregate(
      vals,
      (xs) => { return new Number($list.fold(xs, first_or(xs), $float.min)); },
    );
  } else if (name === "COUNTIFS") {
    return countifs(vals);
  } else if (name === "MEDIAN") {
    return with_numbers(vals, (xs) => { return percentile_of(xs, 0.5); });
  } else if (name === "MODE") {
    return with_numbers(vals, mode);
  } else if (name === "MODE.SNGL") {
    return with_numbers(vals, mode);
  } else if (name === "STDEV") {
    return with_numbers(vals, (xs) => { return stdev(xs, true); });
  } else if (name === "STDEV.S") {
    return with_numbers(vals, (xs) => { return stdev(xs, true); });
  } else if (name === "STDEVP") {
    return with_numbers(vals, (xs) => { return stdev(xs, false); });
  } else if (name === "STDEV.P") {
    return with_numbers(vals, (xs) => { return stdev(xs, false); });
  } else if (name === "VAR") {
    return with_numbers(vals, (xs) => { return variance(xs, true); });
  } else if (name === "VAR.S") {
    return with_numbers(vals, (xs) => { return variance(xs, true); });
  } else if (name === "VARP") {
    return with_numbers(vals, (xs) => { return variance(xs, false); });
  } else if (name === "VAR.P") {
    return with_numbers(vals, (xs) => { return variance(xs, false); });
  } else if (name === "LARGE") {
    return kth(vals, true);
  } else if (name === "SMALL") {
    return kth(vals, false);
  } else if (name === "RANK") {
    return rank(vals);
  } else if (name === "RANK.EQ") {
    return rank(vals);
  } else if (name === "PERCENTILE") {
    return percentile(vals, 1.0);
  } else if (name === "PERCENTILE.INC") {
    return percentile(vals, 1.0);
  } else if (name === "QUARTILE") {
    return percentile(vals, 4.0);
  } else if (name === "QUARTILE.INC") {
    return percentile(vals, 4.0);
  } else if (name === "CORREL") {
    return correl(vals);
  } else if (name === "AVERAGEA") {
    let $ = $list.try_fold(
      vals,
      $List$Empty$const,
      (acc, v) => {
        return $list.try_fold(
          $env.flatten(v),
          acc,
          (acc, x) => {
            if (x instanceof Number) {
              let n = x[0];
              return new Ok(listPrepend(n, acc));
            } else if (x instanceof Boolean && x[0]) {
              return new Ok(listPrepend(1.0, acc));
            } else if (x instanceof Empty) {
              return new Ok(acc);
            } else if (x instanceof Err) {
              let k = x[0];
              return new Error(k);
            } else {
              return new Ok(listPrepend(0.0, acc));
            }
          },
        );
      },
    );
    if ($ instanceof Ok) {
      let xs = $[0];
      return new Scalar(average(xs));
    } else {
      let k = $[0];
      return fail(k);
    }
  } else if (name === "PMT") {
    return lifted(vals, 3, 5, finance(pmt));
  } else if (name === "PV") {
    return lifted(vals, 3, 5, finance(pv));
  } else if (name === "FV") {
    return lifted(vals, 3, 5, finance(fv));
  } else if (name === "NPER") {
    return lifted(vals, 3, 5, finance(nper));
  } else if (name === "NPV") {
    if (vals instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let flows = vals.tail;
      if (!(flows instanceof $Empty)) {
        let rate = vals.head;
        let $ = $value.to_number($env.scalar(rate));
        let $1 = numbers(flows);
        if ($ instanceof Ok) {
          if ($1 instanceof Ok) {
            let r = $[0];
            let xs = $1[0];
            return new Scalar($num.result(npv(r, xs, 1)));
          } else {
            let k = $1[0];
            return fail(k);
          }
        } else {
          let k = $[0];
          return fail(k);
        }
      } else {
        return fail($value.ErrorKind$ValueErr$const);
      }
    }
  } else if (name === "IRR") {
    if (vals instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let $ = vals.tail;
      if ($ instanceof $Empty) {
        let flows = vals.head;
        return irr(flows, 0.1);
      } else if ($.tail instanceof $Empty) {
        let flows = vals.head;
        let guess = $.head;
        let $1 = $value.to_number($env.scalar(guess));
        if ($1 instanceof Ok) {
          let g = $1[0];
          return irr(flows, g);
        } else {
          let k = $1[0];
          return fail(k);
        }
      } else {
        return fail($value.ErrorKind$ValueErr$const);
      }
    }
  } else if (name === "SORT") {
    return sort(vals);
  } else if (name === "UNIQUE") {
    return unique(vals);
  } else if (name === "FILTER") {
    return filter(vals);
  } else {
    return fail($value.ErrorKind$NameErr$const);
  }
}

function let_(loop$args, loop$ctx) {
  while (true) {
    let args = loop$args;
    let ctx = loop$ctx;
    if (args instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let $ = args.tail;
      if ($ instanceof $Empty) {
        let body = args.head;
        return ctx.eval(body, ctx);
      } else {
        let $1 = args.head;
        if ($1 instanceof $ast.Name) {
          let rest = $.tail;
          if (!(rest instanceof $Empty)) {
            let bound = $.head;
            let name = $1[0];
            let v = ctx.eval(bound, ctx);
            let ctx$1 = new $env.Env(
              ctx.sheet,
              ctx.get,
              ctx.resolve_sheet,
              ctx.extent,
              $dict.insert(ctx.locals, name, v),
              ctx.eval,
            );
            loop$args = rest;
            loop$ctx = ctx$1;
          } else {
            return fail($value.ErrorKind$ValueErr$const);
          }
        } else {
          return fail($value.ErrorKind$ValueErr$const);
        }
      }
    }
  }
}

function choose(args, ctx) {
  if (args instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let options = args.tail;
    if (!(options instanceof $Empty)) {
      let index$1 = args.head;
      let $ = scalar_int(ctx.eval(index$1, ctx));
      if ($ instanceof Ok) {
        let i = $[0];
        let $1 = $env.nth(options, i - 1);
        if ($1 instanceof Ok) {
          let e = $1[0];
          return ctx.eval(e, ctx);
        } else {
          return fail($value.ErrorKind$ValueErr$const);
        }
      } else {
        let k = $[0];
        return fail(k);
      }
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  }
}

function switch_cases(loop$s, loop$cases, loop$ctx) {
  while (true) {
    let s = loop$s;
    let cases = loop$cases;
    let ctx = loop$ctx;
    if (cases instanceof $Empty) {
      return fail($value.ErrorKind$NA$const);
    } else {
      let $ = cases.tail;
      if ($ instanceof $Empty) {
        let default$ = cases.head;
        return ctx.eval(default$, ctx);
      } else {
        let candidate = cases.head;
        let result = $.head;
        let rest = $.tail;
        let c = $env.scalar(ctx.eval(candidate, ctx));
        if (c instanceof Err) {
          let k = c[0];
          return fail(k);
        } else {
          let $1 = same(s, c);
          if ($1) {
            return ctx.eval(result, ctx);
          } else {
            loop$s = s;
            loop$cases = rest;
            loop$ctx = ctx;
          }
        }
      }
    }
  }
}

function switch$(args, ctx) {
  if (args instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let cases = args.tail;
    if (!(cases instanceof $Empty)) {
      let subject = args.head;
      let s = $env.scalar(ctx.eval(subject, ctx));
      if (s instanceof Err) {
        let k = s[0];
        return fail(k);
      } else {
        return switch_cases(s, cases, ctx);
      }
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  }
}

function if_error(args, ctx, catches) {
  if (args instanceof $Empty) {
    return fail($value.ErrorKind$ValueErr$const);
  } else {
    let $ = args.tail;
    if ($ instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else if ($.tail instanceof $Empty) {
      let x = args.head;
      let alt = $.head;
      let v = ctx.eval(x, ctx);
      let caught = (val) => {
        if (val instanceof Err) {
          let k = val[0];
          return catches(k);
        } else {
          return false;
        }
      };
      if (v instanceof Scalar) {
        let val = v[0];
        let $1 = caught(val);
        if ($1) {
          return ctx.eval(alt, ctx);
        } else {
          return v;
        }
      } else {
        let $1 = $env.is_multi(v);
        if ($1) {
          let $2 = $list.any($env.flatten(v), caught);
          if ($2) {
            let replacement = $env.scalar(ctx.eval(alt, ctx));
            return $env.map(
              v,
              (x) => {
                let $3 = caught(x);
                if ($3) {
                  return replacement;
                } else {
                  return x;
                }
              },
            );
          } else {
            return v;
          }
        } else {
          let $2 = caught($env.scalar(v));
          if ($2) {
            return ctx.eval(alt, ctx);
          } else {
            return v;
          }
        }
      }
    } else {
      return fail($value.ErrorKind$ValueErr$const);
    }
  }
}

function ifs(loop$args, loop$ctx) {
  while (true) {
    let args = loop$args;
    let ctx = loop$ctx;
    if (args instanceof $Empty) {
      return fail($value.ErrorKind$ValueErr$const);
    } else {
      let $ = args.tail;
      if ($ instanceof $Empty) {
        return fail($value.ErrorKind$ValueErr$const);
      } else {
        let c = args.head;
        let v = $.head;
        let rest = $.tail;
        let $1 = $value.to_bool($env.scalar(ctx.eval(c, ctx)));
        if ($1 instanceof Ok) {
          if ($1[0]) {
            return ctx.eval(v, ctx);
          } else {
            if (rest instanceof $Empty) {
              return fail($value.ErrorKind$NA$const);
            } else {
              loop$args = rest;
              loop$ctx = ctx;
            }
          }
        } else {
          let k = $1[0];
          return fail(k);
        }
      }
    }
  }
}

/**
 * Argument `i`, or `default` when it was not written at all. An argument
 * left empty, as in IF(A1,,1), is Empty, which shows as 0.
 * 
 * @ignore
 */
function branch(args, i, default$, ctx) {
  let $ = $env.nth(args, i);
  if ($ instanceof Ok) {
    let e = $[0];
    return ctx.eval(e, ctx);
  } else {
    return new Scalar(default$);
  }
}

function first(args) {
  if (args instanceof $Empty) {
    return $ast.Expr$Missing$const;
  } else {
    let a = args.head;
    return a;
  }
}

function if_(args, ctx) {
  return arity(
    args,
    1,
    3,
    () => {
      let cond = ctx.eval(first(args), ctx);
      let then$ = () => { return branch(args, 1, new Boolean(true), ctx); };
      let else_ = () => { return branch(args, 2, new Boolean(false), ctx); };
      let $ = $env.is_multi(cond);
      if ($) {
        let t = then$();
        let e = else_();
        return $env.lift(
          listPrepend(cond, listPrepend(t, listPrepend(e, $List$Empty$const))),
          (xs) => {
            let c;
            let t$1;
            let e$1;
            if (xs instanceof $Empty) {
              throw makeError(
                "let_assert",
                FILEPATH,
                "sutra/functions",
                184,
                "if_",
                "Pattern match failed, no pattern matched the value.",
                {
                  value: xs,
                  start: 4637,
                  end: 4662,
                  pattern_start: 4648,
                  pattern_end: 4657
                }
              )
            } else {
              let $1 = xs.tail;
              if ($1 instanceof $Empty) {
                throw makeError(
                  "let_assert",
                  FILEPATH,
                  "sutra/functions",
                  184,
                  "if_",
                  "Pattern match failed, no pattern matched the value.",
                  {
                    value: xs,
                    start: 4637,
                    end: 4662,
                    pattern_start: 4648,
                    pattern_end: 4657
                  }
                )
              } else {
                let $2 = $1.tail;
                if ($2 instanceof $Empty) {
                  throw makeError(
                    "let_assert",
                    FILEPATH,
                    "sutra/functions",
                    184,
                    "if_",
                    "Pattern match failed, no pattern matched the value.",
                    {
                      value: xs,
                      start: 4637,
                      end: 4662,
                      pattern_start: 4648,
                      pattern_end: 4657
                    }
                  )
                } else if ($2.tail instanceof $Empty) {
                  c = xs.head;
                  t$1 = $1.head;
                  e$1 = $2.head;
                } else {
                  throw makeError(
                    "let_assert",
                    FILEPATH,
                    "sutra/functions",
                    184,
                    "if_",
                    "Pattern match failed, no pattern matched the value.",
                    {
                      value: xs,
                      start: 4637,
                      end: 4662,
                      pattern_start: 4648,
                      pattern_end: 4657
                    }
                  )
                }
              }
            }
            let $3 = $value.to_bool(c);
            if ($3 instanceof Ok) {
              if ($3[0]) {
                return t$1;
              } else {
                return e$1;
              }
            } else {
              let k = $3[0];
              return new Err(k);
            }
          },
        );
      } else {
        let $1 = $value.to_bool($env.scalar(cond));
        if ($1 instanceof Ok) {
          if ($1[0]) {
            return then$();
          } else {
            return else_();
          }
        } else {
          let k = $1[0];
          return fail(k);
        }
      }
    },
  );
}

export function call(name, args, ctx) {
  if (name === "IF") {
    return if_(args, ctx);
  } else if (name === "IFS") {
    return ifs(args, ctx);
  } else if (name === "IFERROR") {
    return if_error(args, ctx, (_) => { return true; });
  } else if (name === "IFNA") {
    return if_error(args, ctx, (k) => { return k instanceof $value.NA; });
  } else if (name === "SWITCH") {
    return switch$(args, ctx);
  } else if (name === "CHOOSE") {
    return choose(args, ctx);
  } else if (name === "LET") {
    return let_(args, ctx);
  } else {
    return eager(name, $list.map(args, (a) => { return ctx.eval(a, ctx); }));
  }
}

export function catalogue() {
  return toList([
    ["Math", "SUM", "SUM(number1, [number2], ...)"],
    ["Math", "SUMPRODUCT", "SUMPRODUCT(array1, [array2], ...)"],
    ["Math", "SUMSQ", "SUMSQ(number1, ...)"],
    ["Math", "PRODUCT", "PRODUCT(number1, ...)"],
    ["Math", "ABS", "ABS(number)"],
    ["Math", "SIGN", "SIGN(number)"],
    ["Math", "INT", "INT(number)"],
    ["Math", "ROUND", "ROUND(number, digits)"],
    ["Math", "ROUNDUP", "ROUNDUP(number, digits)"],
    ["Math", "ROUNDDOWN", "ROUNDDOWN(number, digits)"],
    ["Math", "TRUNC", "TRUNC(number, [digits])"],
    ["Math", "MROUND", "MROUND(number, multiple)"],
    ["Math", "CEILING", "CEILING(number, [significance])"],
    ["Math", "FLOOR", "FLOOR(number, [significance])"],
    ["Math", "MOD", "MOD(number, divisor)"],
    ["Math", "QUOTIENT", "QUOTIENT(numerator, denominator)"],
    ["Math", "POWER", "POWER(number, power)"],
    ["Math", "SQRT", "SQRT(number)"],
    ["Math", "EXP", "EXP(number)"],
    ["Math", "LN", "LN(number)"],
    ["Math", "LOG", "LOG(number, [base])"],
    ["Math", "LOG10", "LOG10(number)"],
    ["Math", "PI", "PI()"],
    ["Math", "FACT", "FACT(number)"],
    ["Logic", "IF", "IF(test, [then], [else])"],
    ["Logic", "IFS", "IFS(test1, value1, [test2, value2], ...)"],
    ["Logic", "IFERROR", "IFERROR(value, value_if_error)"],
    ["Logic", "IFNA", "IFNA(value, value_if_na)"],
    ["Logic", "SWITCH", "SWITCH(expr, value1, result1, ..., [default])"],
    ["Logic", "CHOOSE", "CHOOSE(index, value1, value2, ...)"],
    ["Logic", "LET", "LET(name1, value1, ..., calculation)"],
    ["Logic", "AND", "AND(logical1, ...)"],
    ["Logic", "OR", "OR(logical1, ...)"],
    ["Logic", "XOR", "XOR(logical1, ...)"],
    ["Logic", "NOT", "NOT(logical)"],
    ["Logic", "TRUE", "TRUE()"],
    ["Logic", "FALSE", "FALSE()"],
    ["Lookup", "VLOOKUP", "VLOOKUP(value, table, column, [approximate])"],
    ["Lookup", "HLOOKUP", "HLOOKUP(value, table, row, [approximate])"],
    [
      "Lookup",
      "XLOOKUP",
      "XLOOKUP(value, lookup, return, [if_missing], [match_mode], [search_mode])",
    ],
    ["Lookup", "MATCH", "MATCH(value, array, [type])"],
    ["Lookup", "XMATCH", "XMATCH(value, array, [match_mode], [search_mode])"],
    ["Lookup", "INDEX", "INDEX(array, row, [column])"],
    ["Lookup", "ROWS", "ROWS(array)"],
    ["Lookup", "COLUMNS", "COLUMNS(array)"],
    ["Conditional", "SUMIF", "SUMIF(range, criteria, [sum_range])"],
    ["Conditional", "SUMIFS", "SUMIFS(sum_range, range1, criteria1, ...)"],
    ["Conditional", "COUNTIF", "COUNTIF(range, criteria)"],
    ["Conditional", "COUNTIFS", "COUNTIFS(range1, criteria1, ...)"],
    ["Conditional", "AVERAGEIF", "AVERAGEIF(range, criteria, [average_range])"],
    [
      "Conditional",
      "AVERAGEIFS",
      "AVERAGEIFS(average_range, range1, criteria1, ...)",
    ],
    ["Conditional", "MAXIFS", "MAXIFS(max_range, range1, criteria1, ...)"],
    ["Conditional", "MINIFS", "MINIFS(min_range, range1, criteria1, ...)"],
    ["Statistics", "AVERAGE", "AVERAGE(number1, ...)"],
    ["Statistics", "AVERAGEA", "AVERAGEA(value1, ...)"],
    ["Statistics", "COUNT", "COUNT(value1, ...)"],
    ["Statistics", "COUNTA", "COUNTA(value1, ...)"],
    ["Statistics", "COUNTBLANK", "COUNTBLANK(range)"],
    ["Statistics", "MIN", "MIN(number1, ...)"],
    ["Statistics", "MAX", "MAX(number1, ...)"],
    ["Statistics", "MEDIAN", "MEDIAN(number1, ...)"],
    ["Statistics", "MODE.SNGL", "MODE.SNGL(number1, ...)"],
    ["Statistics", "STDEV.S", "STDEV.S(number1, ...)"],
    ["Statistics", "STDEV.P", "STDEV.P(number1, ...)"],
    ["Statistics", "VAR.S", "VAR.S(number1, ...)"],
    ["Statistics", "VAR.P", "VAR.P(number1, ...)"],
    ["Statistics", "LARGE", "LARGE(array, k)"],
    ["Statistics", "SMALL", "SMALL(array, k)"],
    ["Statistics", "RANK.EQ", "RANK.EQ(number, ref, [ascending])"],
    ["Statistics", "PERCENTILE.INC", "PERCENTILE.INC(array, k)"],
    ["Statistics", "QUARTILE.INC", "QUARTILE.INC(array, quart)"],
    ["Statistics", "CORREL", "CORREL(array1, array2)"],
    ["Text", "LEN", "LEN(text)"],
    ["Text", "LEFT", "LEFT(text, [count])"],
    ["Text", "RIGHT", "RIGHT(text, [count])"],
    ["Text", "MID", "MID(text, start, count)"],
    ["Text", "UPPER", "UPPER(text)"],
    ["Text", "LOWER", "LOWER(text)"],
    ["Text", "PROPER", "PROPER(text)"],
    ["Text", "TRIM", "TRIM(text)"],
    ["Text", "CLEAN", "CLEAN(text)"],
    ["Text", "CONCAT", "CONCAT(text1, ...)"],
    ["Text", "CONCATENATE", "CONCATENATE(text1, ...)"],
    ["Text", "TEXTJOIN", "TEXTJOIN(delimiter, ignore_empty, text1, ...)"],
    ["Text", "SUBSTITUTE", "SUBSTITUTE(text, old, new, [instance])"],
    ["Text", "REPLACE", "REPLACE(text, start, count, new)"],
    ["Text", "FIND", "FIND(find, within, [start])"],
    ["Text", "SEARCH", "SEARCH(find, within, [start])"],
    ["Text", "REPT", "REPT(text, times)"],
    ["Text", "EXACT", "EXACT(text1, text2)"],
    ["Text", "VALUE", "VALUE(text)"],
    ["Text", "TEXT", "TEXT(value, format)"],
    ["Text", "FIXED", "FIXED(number, [decimals], [no_commas])"],
    ["Text", "CHAR", "CHAR(number)"],
    ["Text", "CODE", "CODE(text)"],
    ["Date", "DATE", "DATE(year, month, day)"],
    ["Date", "DATEVALUE", "DATEVALUE(\"yyyy-mm-dd\")"],
    ["Date", "YEAR", "YEAR(date)"],
    ["Date", "MONTH", "MONTH(date)"],
    ["Date", "DAY", "DAY(date)"],
    ["Date", "WEEKDAY", "WEEKDAY(date, [type])"],
    ["Date", "EDATE", "EDATE(date, months)"],
    ["Date", "EOMONTH", "EOMONTH(date, months)"],
    ["Date", "DAYS", "DAYS(end, start)"],
    ["Date", "DATEDIF", "DATEDIF(start, end, unit)"],
    ["Finance", "PMT", "PMT(rate, nper, pv, [fv], [type])"],
    ["Finance", "PV", "PV(rate, nper, pmt, [fv], [type])"],
    ["Finance", "FV", "FV(rate, nper, pmt, [pv], [type])"],
    ["Finance", "NPER", "NPER(rate, pmt, pv, [fv], [type])"],
    ["Finance", "NPV", "NPV(rate, value1, ...)"],
    ["Finance", "IRR", "IRR(values, [guess])"],
    ["Information", "ISNUMBER", "ISNUMBER(value)"],
    ["Information", "ISTEXT", "ISTEXT(value)"],
    ["Information", "ISNONTEXT", "ISNONTEXT(value)"],
    ["Information", "ISLOGICAL", "ISLOGICAL(value)"],
    ["Information", "ISBLANK", "ISBLANK(value)"],
    ["Information", "ISERROR", "ISERROR(value)"],
    ["Information", "ISERR", "ISERR(value)"],
    ["Information", "ISNA", "ISNA(value)"],
    ["Information", "ISEVEN", "ISEVEN(number)"],
    ["Information", "ISODD", "ISODD(number)"],
    ["Information", "NA", "NA()"],
    ["Dynamic arrays", "SEQUENCE", "SEQUENCE(rows, [columns], [start], [step])"],
    ["Dynamic arrays", "SORT", "SORT(array, [index], [order], [by_column])"],
    ["Dynamic arrays", "UNIQUE", "UNIQUE(array, [by_column], [exactly_once])"],
    ["Dynamic arrays", "FILTER", "FILTER(array, include, [if_empty])"],
    ["Dynamic arrays", "TRANSPOSE", "TRANSPOSE(array)"],
  ]);
}
