import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  toList,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
} from "../gleam.mjs";
import * as $dates from "../sutra/dates.mjs";
import * as $num from "../sutra/num.mjs";
import * as $value from "../sutra/value.mjs";

class Literal extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class Digits extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

const day_names = /* @__PURE__ */ listPrepend(
  "Sunday",
  listPrepend(
    "Monday",
    listPrepend(
      "Tuesday",
      listPrepend(
        "Wednesday",
        listPrepend(
          "Thursday",
          listPrepend("Friday", listPrepend("Saturday", $List$Empty$const)),
        ),
      ),
    ),
  ),
);

const month_names = /* @__PURE__ */ toList([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

function group(digits) {
  let _pipe = digits;
  let _pipe$1 = $string.to_graphemes(_pipe);
  let _pipe$2 = $list.reverse(_pipe$1);
  let _pipe$3 = $list.sized_chunk(_pipe$2, 3);
  let _pipe$4 = $list.map(
    _pipe$3,
    (chunk) => { return $string.concat($list.reverse(chunk)); },
  );
  let _pipe$5 = $list.reverse(_pipe$4);
  return $string.join(_pipe$5, ",");
}

export function fixed(x, decimals, min_dec, min_int, grouping) {
  let rounded = $num.round(
    $float.absolute_value(x),
    decimals,
    $num.Rounding$HalfUp$const,
  );
  let $ = $value.decompose(rounded);
  let digits$1 = $[0];
  let point = $[1];
  let _block;
  if (digits$1 === "") {
    _block = ["", ""];
  } else {
    let $2 = point <= 0;
    if ($2) {
      _block = ["", $string.repeat("0", - point) + digits$1];
    } else {
      let $3 = point >= $string.length(digits$1);
      if ($3) {
        _block = [
          digits$1 + $string.repeat("0", point - $string.length(digits$1)),
          "",
        ];
      } else {
        _block = [
          $string.slice(digits$1, 0, point),
          $string.drop_start(digits$1, point),
        ];
      }
    }
  }
  let $1 = _block;
  let int_digits = $1[0];
  let frac_digits = $1[1];
  let int_digits$1 = $string.pad_start(int_digits, min_int, "0");
  let _block$1;
  if (grouping) {
    _block$1 = group(int_digits$1);
  } else {
    _block$1 = int_digits$1;
  }
  let int_digits$2 = _block$1;
  let frac = $string.slice(frac_digits, 0, decimals);
  let _block$2;
  let $2 = $string.length(frac) < min_dec;
  if ($2) {
    _block$2 = $string.pad_end(frac, min_dec, "0");
  } else {
    _block$2 = frac;
  }
  let frac$1 = _block$2;
  if (frac$1 === "") {
    return int_digits$2;
  } else {
    return (int_digits$2 + ".") + frac$1;
  }
}

function count(s, c) {
  return $list.count($string.to_graphemes(s), (x) => { return x === c; });
}

function scientific(x, mantissa_pattern) {
  let _block;
  let $1 = $string.split_once(mantissa_pattern, ".");
  if ($1 instanceof Ok) {
    let pair = $1[0];
    _block = pair;
  } else {
    _block = [mantissa_pattern, ""];
  }
  let $ = _block;
  let frac_pat = $[1];
  let decimals = $string.length(frac_pat);
  let $2 = $value.decompose(x);
  let digits$1 = $2[0];
  let point = $2[1];
  if (digits$1 === "") {
    return fixed(0.0, decimals, decimals, 1, false) + "E+00";
  } else {
    let $3 = $value.round_digits(digits$1, point, decimals + 1);
    let digits$2 = $3[0];
    let point$1 = $3[1];
    let mantissa = $num.from_digits(digits$2, 1);
    let e = point$1 - 1;
    let _block$1;
    let $4 = e < 0;
    if ($4) {
      _block$1 = "-";
    } else {
      _block$1 = "+";
    }
    let sign = _block$1;
    return ((fixed(mantissa, decimals, decimals, 1, false) + "E") + sign) + $string.pad_start(
      $int.to_string($int.absolute_value(e)),
      2,
      "0",
    );
  }
}

/**
 * Format |x| with one placeholder run such as "#,##0.00" or "0.0E+00".
 * 
 * @ignore
 */
function digits(x, pattern) {
  let upper = $string.uppercase(pattern);
  let $ = $string.split_once(upper, "E");
  if ($ instanceof Ok) {
    let mantissa = $[0][0];
    return scientific(x, mantissa);
  } else {
    let _block;
    let $2 = $string.split_once(pattern, ".");
    if ($2 instanceof Ok) {
      let pair = $2[0];
      _block = pair;
    } else {
      _block = [pattern, ""];
    }
    let $1 = _block;
    let int_pat = $1[0];
    let frac_pat = $1[1];
    let grouping = $string.contains(int_pat, ",");
    let min_int = count(int_pat, "0");
    let decimals = count(frac_pat, "0") + count(frac_pat, "#");
    let min_dec = count(frac_pat, "0");
    return fixed(x, decimals, min_dec, min_int, grouping);
  }
}

function flush(parts, cur, kind) {
  if (cur === "") {
    return parts;
  } else if (kind === "num") {
    return listPrepend(new Digits(cur), parts);
  } else {
    return listPrepend(new Literal(cur), parts);
  }
}

function append(parts, cur, kind, new_kind, c, quoted) {
  let $ = kind === new_kind;
  if ($) {
    return [parts, cur + c, kind, quoted];
  } else {
    return [flush(parts, cur, kind), c, new_kind, quoted];
  }
}

function is_placeholder(c) {
  return (((((((c === "0") || (c === "#")) || (c === ",")) || (c === ".")) || (c === "?")) || (c === "E")) || (c === "e")) || (c === "+");
}

/**
 * Break a section into literal text and the one run of digit placeholders.
 * 
 * @ignore
 */
function parts(section) {
  let $ = $list.fold(
    $string.to_graphemes(section),
    [$List$Empty$const, "", "lit", false],
    (acc, c) => {
      let parts$1 = acc[0];
      let cur = acc[1];
      let kind = acc[2];
      let quoted = acc[3];
      if (quoted) {
        if (c === "\"") {
          return [parts$1, cur, kind, false];
        } else {
          return append(parts$1, cur, kind, "lit", c, true);
        }
      } else if (c === "\"") {
        return [parts$1, cur, kind, true];
      } else {
        let $1 = is_placeholder(c);
        if ($1) {
          return append(parts$1, cur, kind, "num", c, false);
        } else {
          if (c === "\\") {
            return [parts$1, cur, kind, quoted];
          } else {
            return append(parts$1, cur, kind, "lit", c, false);
          }
        }
      }
    },
  );
  let parts$1 = $[0];
  let cur = $[1];
  let kind = $[2];
  return $list.reverse(flush(parts$1, cur, kind));
}

function number(x, section) {
  let ps = parts(section);
  let percent = $list.any(
    ps,
    (p) => {
      if (p instanceof Literal) {
        let s = p[0];
        return $string.contains(s, "%");
      } else {
        return false;
      }
    },
  );
  let _block;
  if (percent) {
    _block = x * 100.0;
  } else {
    _block = x;
  }
  let x$1 = _block;
  let $ = $list.fold(
    ps,
    ["", false],
    (acc, p) => {
      let out = acc[0];
      let used = acc[1];
      if (p instanceof Literal) {
        let s = p[0];
        return [out + s, used];
      } else if (used) {
        let d = p[0];
        return [out + d, true];
      } else {
        let d = p[0];
        return [out + digits(x$1, d), true];
      }
    },
  );
  let out = $[0];
  return new Ok(out);
}

function map_ok(r, f) {
  if (r instanceof Ok) {
    let x = r[0];
    return new Ok(f(x));
  } else {
    return r;
  }
}

function name(names, i) {
  let $ = $list.drop(names, i);
  if ($ instanceof $Empty) {
    return "";
  } else {
    let n = $.head;
    return n;
  }
}

function render_date(loop$chars, loop$y, loop$m, loop$d, loop$wd, loop$out) {
  while (true) {
    let chars = loop$chars;
    let y = loop$y;
    let m = loop$m;
    let d = loop$d;
    let wd = loop$wd;
    let out = loop$out;
    if (chars instanceof $Empty) {
      return out;
    } else {
      let $ = chars.head;
      if ($ === "\"") {
        let rest = chars.tail;
        let $1 = $list.split_while(rest, (c) => { return c !== "\""; });
        let lit = $1[0];
        let rest$1 = $1[1];
        loop$chars = $list.drop(rest$1, 1);
        loop$y = y;
        loop$m = m;
        loop$d = d;
        loop$wd = wd;
        loop$out = out + $string.concat(lit);
      } else {
        let c = $;
        let lower = $string.lowercase(c);
        let $1 = ((lower === "y") || (lower === "m")) || (lower === "d");
        if ($1) {
          let $2 = $list.split_while(
            chars,
            (x) => { return $string.lowercase(x) === lower; },
          );
          let run = $2[0];
          let rest = $2[1];
          let n = $list.length(run);
          let _block;
          if (lower === "y") {
            if (n === 1) {
              _block = $string.pad_start($int.to_string(y % 100), 2, "0");
            } else if (n === 2) {
              _block = $string.pad_start($int.to_string(y % 100), 2, "0");
            } else {
              _block = $int.to_string(y);
            }
          } else if (lower === "m") {
            if (n === 1) {
              _block = $int.to_string(m);
            } else if (n === 2) {
              _block = $string.pad_start($int.to_string(m), 2, "0");
            } else if (n === 3) {
              _block = $string.slice(name(month_names, m - 1), 0, 3);
            } else if (n === 5) {
              _block = $string.slice(name(month_names, m - 1), 0, 1);
            } else {
              _block = name(month_names, m - 1);
            }
          } else if (lower === "d") {
            if (n === 1) {
              _block = $int.to_string(d);
            } else if (n === 2) {
              _block = $string.pad_start($int.to_string(d), 2, "0");
            } else if (n === 3) {
              _block = $string.slice(name(day_names, wd - 1), 0, 3);
            } else {
              _block = name(day_names, wd - 1);
            }
          } else {
            _block = name(day_names, wd - 1);
          }
          let piece = _block;
          loop$chars = rest;
          loop$y = y;
          loop$m = m;
          loop$d = d;
          loop$wd = wd;
          loop$out = out + piece;
        } else {
          loop$chars = $list.drop(chars, 1);
          loop$y = y;
          loop$m = m;
          loop$d = d;
          loop$wd = wd;
          loop$out = out + c;
        }
      }
    }
  }
}

function date(x, code) {
  let $ = (x < 0.0) || (x > 2958465.0);
  if ($) {
    return new Error(undefined);
  } else {
    let serial = $float.truncate(x);
    let $1 = $dates.ymd(serial);
    let y = $1[0];
    let m = $1[1];
    let d = $1[2];
    let wd = $dates.weekday(serial);
    return new Ok(render_date($string.to_graphemes(code), y, m, d, wd, ""));
  }
}

function strip_quoted(code) {
  let $ = $list.fold(
    $string.to_graphemes(code),
    ["", false],
    (acc, c) => {
      let out = acc[0];
      let quoted = acc[1];
      if (c === "\"") {
        return [out, !quoted];
      } else if (quoted) {
        return [out, true];
      } else {
        return [out + c, false];
      }
    },
  );
  let out = $[0];
  return out;
}

function is_date_format(code) {
  let bare = $string.lowercase(strip_quoted(code));
  let has_digit_placeholder = $string.contains(bare, "0") || $string.contains(
    bare,
    "#",
  );
  return ($string.contains(bare, "y") || $string.contains(bare, "d")) || ($string.contains(
    bare,
    "m",
  ) && !has_digit_placeholder);
}

/**
 * Split on ';' outside quotes.
 * 
 * @ignore
 */
function split_sections(code) {
  let $ = $list.fold(
    $string.to_graphemes(code),
    [$List$Empty$const, "", false],
    (acc, c) => {
      let done = acc[0];
      let cur = acc[1];
      let quoted = acc[2];
      if (c === "\"") {
        return [done, cur + c, !quoted];
      } else if (c === ";" && !quoted) {
        return [listPrepend(cur, done), "", false];
      } else {
        return [done, cur + c, quoted];
      }
    },
  );
  let sections = $[0];
  let current = $[1];
  return $list.reverse(listPrepend(current, sections));
}

export function text(x, code) {
  let sections = split_sections(code);
  let $ = is_date_format(code);
  if ($) {
    return date(x, code);
  } else {
    let $1 = x < 0.0;
    let $2 = x === 0.0;
    if (sections instanceof $Empty) {
      return new Ok($value.format_number(x, 15));
    } else {
      let $3 = sections.tail;
      if ($3 instanceof $Empty) {
        if ($1) {
          let pos = sections.head;
          let _pipe = number($float.negate(x), pos);
          return map_ok(_pipe, (s) => { return "-" + s; });
        } else {
          let pos = sections.head;
          return number(x, pos);
        }
      } else if ($2) {
        let $4 = $3.tail;
        if ($4 instanceof $Empty) {
          if ($1) {
            let neg = $3.head;
            return number($float.negate(x), neg);
          } else {
            let pos = sections.head;
            return number(x, pos);
          }
        } else {
          let zero = $4.head;
          return number(0.0, zero);
        }
      } else if ($1) {
        let neg = $3.head;
        return number($float.negate(x), neg);
      } else {
        let pos = sections.head;
        return number(x, pos);
      }
    }
  }
}
