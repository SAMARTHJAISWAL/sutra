import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $order from "../../gleam_stdlib/gleam/order.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
} from "../gleam.mjs";

export class Div0 extends $CustomType {}
export const ErrorKind$Div0$const = new Div0();
export const ErrorKind$Div0 = () => ErrorKind$Div0$const;
export const ErrorKind$isDiv0 = (value) => value instanceof Div0;

export class NA extends $CustomType {}
export const ErrorKind$NA$const = new NA();
export const ErrorKind$NA = () => ErrorKind$NA$const;
export const ErrorKind$isNA = (value) => value instanceof NA;

export class NameErr extends $CustomType {}
export const ErrorKind$NameErr$const = new NameErr();
export const ErrorKind$NameErr = () => ErrorKind$NameErr$const;
export const ErrorKind$isNameErr = (value) => value instanceof NameErr;

export class NullErr extends $CustomType {}
export const ErrorKind$NullErr$const = new NullErr();
export const ErrorKind$NullErr = () => ErrorKind$NullErr$const;
export const ErrorKind$isNullErr = (value) => value instanceof NullErr;

export class NumErr extends $CustomType {}
export const ErrorKind$NumErr$const = new NumErr();
export const ErrorKind$NumErr = () => ErrorKind$NumErr$const;
export const ErrorKind$isNumErr = (value) => value instanceof NumErr;

export class RefErr extends $CustomType {}
export const ErrorKind$RefErr$const = new RefErr();
export const ErrorKind$RefErr = () => ErrorKind$RefErr$const;
export const ErrorKind$isRefErr = (value) => value instanceof RefErr;

export class ValueErr extends $CustomType {}
export const ErrorKind$ValueErr$const = new ValueErr();
export const ErrorKind$ValueErr = () => ErrorKind$ValueErr$const;
export const ErrorKind$isValueErr = (value) => value instanceof ValueErr;

/**
 * A dynamic array could not spill because something is in the way.
 */
export class Spill extends $CustomType {}
export const ErrorKind$Spill$const = new Spill();
export const ErrorKind$Spill = () => ErrorKind$Spill$const;
export const ErrorKind$isSpill = (value) => value instanceof Spill;

/**
 * The cell takes part in a circular reference.
 */
export class Cycle extends $CustomType {}
export const ErrorKind$Cycle$const = new Cycle();
export const ErrorKind$Cycle = () => ErrorKind$Cycle$const;
export const ErrorKind$isCycle = (value) => value instanceof Cycle;

/**
 * A function produced an empty array, e.g. FILTER with no matches.
 */
export class Calc extends $CustomType {}
export const ErrorKind$Calc$const = new Calc();
export const ErrorKind$Calc = () => ErrorKind$Calc$const;
export const ErrorKind$isCalc = (value) => value instanceof Calc;

/**
 * The formula could not be parsed.
 */
export class ParseError extends $CustomType {}
export const ErrorKind$ParseError$const = new ParseError();
export const ErrorKind$ParseError = () => ErrorKind$ParseError$const;
export const ErrorKind$isParseError = (value) => value instanceof ParseError;

export class Number extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Value$Number = ($0) => new Number($0);
export const Value$isNumber = (value) => value instanceof Number;
export const Value$Number$0 = (value) => value[0];

export class Text extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Value$Text = ($0) => new Text($0);
export const Value$isText = (value) => value instanceof Text;
export const Value$Text$0 = (value) => value[0];

export class Boolean extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Value$Boolean = ($0) => new Boolean($0);
export const Value$isBoolean = (value) => value instanceof Boolean;
export const Value$Boolean$0 = (value) => value[0];

export class Empty extends $CustomType {}
export const Value$Empty$const = new Empty();
export const Value$Empty = () => Value$Empty$const;
export const Value$isEmpty = (value) => value instanceof Empty;

export class Err extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
export const Value$Err = ($0) => new Err($0);
export const Value$isErr = (value) => value instanceof Err;
export const Value$Err$0 = (value) => value[0];

export function error_to_string(kind) {
  if (kind instanceof Div0) {
    return "#DIV/0!";
  } else if (kind instanceof NA) {
    return "#N/A";
  } else if (kind instanceof NameErr) {
    return "#NAME?";
  } else if (kind instanceof NullErr) {
    return "#NULL!";
  } else if (kind instanceof NumErr) {
    return "#NUM!";
  } else if (kind instanceof RefErr) {
    return "#REF!";
  } else if (kind instanceof ValueErr) {
    return "#VALUE!";
  } else if (kind instanceof Spill) {
    return "#SPILL!";
  } else if (kind instanceof Cycle) {
    return "#CYCLE!";
  } else if (kind instanceof Calc) {
    return "#CALC!";
  } else {
    return "#ERROR!";
  }
}

export function error_from_string(text) {
  let $ = $string.uppercase(text);
  if ($ === "#DIV/0!") {
    return new Ok(ErrorKind$Div0$const);
  } else if ($ === "#N/A") {
    return new Ok(ErrorKind$NA$const);
  } else if ($ === "#NAME?") {
    return new Ok(ErrorKind$NameErr$const);
  } else if ($ === "#NULL!") {
    return new Ok(ErrorKind$NullErr$const);
  } else if ($ === "#NUM!") {
    return new Ok(ErrorKind$NumErr$const);
  } else if ($ === "#REF!") {
    return new Ok(ErrorKind$RefErr$const);
  } else if ($ === "#VALUE!") {
    return new Ok(ErrorKind$ValueErr$const);
  } else if ($ === "#SPILL!") {
    return new Ok(ErrorKind$Spill$const);
  } else if ($ === "#CYCLE!") {
    return new Ok(ErrorKind$Cycle$const);
  } else if ($ === "#CALC!") {
    return new Ok(ErrorKind$Calc$const);
  } else if ($ === "#ERROR!") {
    return new Ok(ErrorKind$ParseError$const);
  } else {
    return new Error(undefined);
  }
}

function scientific(digits, e) {
  let head = $string.slice(digits, 0, 1);
  let tail = $string.drop_start(digits, 1);
  let _block;
  if (tail === "") {
    _block = head;
  } else {
    _block = (head + ".") + tail;
  }
  let mantissa = _block;
  let _block$1;
  let $ = e < 0;
  if ($) {
    _block$1 = "-";
  } else {
    _block$1 = "+";
  }
  let sign = _block$1;
  return ((mantissa + "E") + sign) + $string.pad_start(
    $int.to_string($int.absolute_value(e)),
    2,
    "0",
  );
}

function plain(digits, point) {
  let n = $string.length(digits);
  let $ = point <= 0;
  let $1 = point >= n;
  if ($) {
    return ("0." + $string.repeat("0", - point)) + digits;
  } else if ($1) {
    return digits + $string.repeat("0", point - n);
  } else {
    return ($string.slice(digits, 0, point) + ".") + $string.drop_start(
      digits,
      point,
    );
  }
}

function strip_trailing_zeros(loop$digits) {
  while (true) {
    let digits = loop$digits;
    let $ = $string.ends_with(digits, "0");
    if ($) {
      loop$digits = $string.drop_end(digits, 1);
    } else {
      return digits;
    }
  }
}

function result_or(r, default$) {
  if (r instanceof Ok) {
    let x = r[0];
    return x;
  } else {
    return default$;
  }
}

/**
 * Add one to a string of decimal digits. Returns the new digits (same
 * length) and whether a carry came out of the top.
 */
export function increment(digits) {
  let _block;
  let _pipe = digits;
  let _pipe$1 = $string.to_graphemes(_pipe);
  let _pipe$2 = $list.reverse(_pipe$1);
  _block = $list.fold(
    _pipe$2,
    [$List$Empty$const, true],
    (acc, d) => {
      let out = acc[0];
      let carry = acc[1];
      if (carry) {
        if (d === "9") {
          return [listPrepend("0", out), true];
        } else {
          return [
            listPrepend($int.to_string(result_or($int.parse(d), 0) + 1), out),
            false,
          ];
        }
      } else {
        return [listPrepend(d, out), false];
      }
    },
  );
  let $ = _block;
  let out = $[0];
  let carry = $[1];
  return [$string.concat(out), carry];
}

/**
 * Round a digit string to `n` significant digits.
 */
export function round_digits(digits, point, n) {
  let $ = $string.length(digits) <= n;
  if ($) {
    return [digits, point];
  } else {
    let kept = $string.slice(digits, 0, n);
    let next = $string.slice(digits, n, 1);
    let $1 = result_or($int.parse(next), 0) >= 5;
    if ($1) {
      let $2 = increment(kept);
      let bumped = $2[0];
      let carried = $2[1];
      if (carried) {
        return [strip_trailing_zeros("1" + bumped), point + 1];
      } else {
        return [strip_trailing_zeros(bumped), point];
      }
    } else {
      return [strip_trailing_zeros(kept), point];
    }
  }
}

function strip_leading_zeros(loop$digits, loop$point) {
  while (true) {
    let digits = loop$digits;
    let point = loop$point;
    if (digits.charCodeAt(0) === 48) {
      let rest = digits.slice(1);
      loop$digits = rest;
      loop$point = point - 1;
    } else {
      return [digits, point];
    }
  }
}

/**
 * A finite float as `0.DIGITS × 10^point`, with no leading or trailing
 * zeros in DIGITS. Zero is `#("", 0)`.
 */
export function decompose(x) {
  let _block;
  let $ = $float.to_string(x);
  if ($.charCodeAt(0) === 45) {
    let rest = $.slice(1);
    _block = rest;
  } else {
    _block = $;
  }
  let text = _block;
  let _block$1;
  let $2 = $string.split_once(text, "e");
  if ($2 instanceof Ok) {
    let m = $2[0][0];
    let e = $2[0][1];
    _block$1 = [m, result_or($int.parse($string.replace(e, "+", "")), 0)];
  } else {
    _block$1 = [text, 0];
  }
  let $1 = _block$1;
  let mantissa = $1[0];
  let exponent = $1[1];
  let _block$2;
  let $4 = $string.split_once(mantissa, ".");
  if ($4 instanceof Ok) {
    let pair = $4[0];
    _block$2 = pair;
  } else {
    _block$2 = [mantissa, ""];
  }
  let $3 = _block$2;
  let whole = $3[0];
  let fraction = $3[1];
  let digits = whole + fraction;
  let point = $string.length(whole) + exponent;
  let $5 = strip_leading_zeros(digits, point);
  let digits$1 = $5[0];
  let point$1 = $5[1];
  let digits$2 = strip_trailing_zeros(digits$1);
  if (digits$2 === "") {
    return ["", 0];
  } else {
    return [digits$2, point$1];
  }
}

function round_digits_of(x, sig) {
  let $ = decompose(x);
  let digits = $[0];
  let point = $[1];
  return round_digits(digits, point, sig);
}

/**
 * Excel's "General" format with `sig` significant digits: plain decimals
 * for ordinary magnitudes, scientific notation (1.5E+20) otherwise.
 */
export function format_number(x, sig) {
  let $ = round_digits_of(x, sig);
  let digits = $[0];
  let point = $[1];
  if (digits === "") {
    return "0";
  } else {
    let _block;
    let $1 = x < 0.0;
    if ($1) {
      _block = "-";
    } else {
      _block = "";
    }
    let sign = _block;
    let e = point - 1;
    let $2 = (e >= -9) && (e < sig);
    if ($2) {
      return sign + plain(digits, point);
    } else {
      return sign + scientific(digits, e);
    }
  }
}

/**
 * The text Excel would show for a value converted to a string, e.g. by `&`.
 * Numbers keep up to 15 significant digits, Excel's precision.
 */
export function to_string(value) {
  if (value instanceof Number) {
    let x = value[0];
    return format_number(x, 15);
  } else if (value instanceof Text) {
    let s = value[0];
    return s;
  } else if (value instanceof Boolean) {
    if (value[0]) {
      return "TRUE";
    } else {
      return "FALSE";
    }
  } else if (value instanceof Empty) {
    return "";
  } else {
    let kind = value[0];
    return error_to_string(kind);
  }
}

/**
 * Like `to_string`, but numbers are cut to `digits` significant digits,
 * which is what a narrow grid cell shows.
 */
export function display(value, digits) {
  if (value instanceof Number) {
    let x = value[0];
    return format_number(x, digits);
  } else {
    return to_string(value);
  }
}

/**
 * "1,234,567" is fine; "1,23" and ",123" are not numbers.
 * 
 * @ignore
 */
function valid_grouping(whole) {
  let $ = $string.split(whole, ",");
  if ($ instanceof $Empty) {
    return true;
  } else {
    let $1 = $.tail;
    if ($1 instanceof $Empty) {
      return true;
    } else {
      let first = $.head;
      let rest = $1;
      return ((first !== "") && ($string.length(first) <= 3)) && $list.all(
        rest,
        (g) => { return $string.length(g) === 3; },
      );
    }
  }
}

export function is_digit(c) {
  if (c === "0") {
    return true;
  } else if (c === "1") {
    return true;
  } else if (c === "2") {
    return true;
  } else if (c === "3") {
    return true;
  } else if (c === "4") {
    return true;
  } else if (c === "5") {
    return true;
  } else if (c === "6") {
    return true;
  } else if (c === "7") {
    return true;
  } else if (c === "8") {
    return true;
  } else if (c === "9") {
    return true;
  } else {
    return false;
  }
}

function take_digits(chars, allow_comma) {
  let $ = $list.split_while(
    chars,
    (c) => { return is_digit(c) || (allow_comma && (c === ",")); },
  );
  let taken = $[0];
  let rest = $[1];
  return [$string.concat(taken), rest];
}

function scan_number(chars) {
  let $ = take_digits(chars, true);
  let whole = $[0];
  let rest = $[1];
  let _block;
  if (rest instanceof $Empty) {
    _block = ["", rest];
  } else if (rest.head === ".") {
    let rest$1 = rest.tail;
    _block = take_digits(rest$1, false);
  } else {
    _block = ["", rest];
  }
  let $1 = _block;
  let fraction = $1[0];
  let rest$1 = $1[1];
  let _block$1;
  if (rest$1 instanceof $Empty) {
    _block$1 = ["0", rest$1];
  } else {
    let e = rest$1.head;
    if (((e === "e") || (e === "E"))) {
      let rest$2 = rest$1.tail;
      let _block$2;
      if (rest$2 instanceof $Empty) {
        _block$2 = ["", rest$2];
      } else {
        let $4 = rest$2.head;
        if ($4 === "-") {
          let rest$3 = rest$2.tail;
          _block$2 = ["-", rest$3];
        } else if ($4 === "+") {
          let rest$3 = rest$2.tail;
          _block$2 = ["", rest$3];
        } else {
          _block$2 = ["", rest$2];
        }
      }
      let $3 = _block$2;
      let sign = $3[0];
      let rest$3 = $3[1];
      let $4 = take_digits(rest$3, false);
      let digits = $4[0];
      let rest$4 = $4[1];
      if (digits === "") {
        _block$1 = ["bad", rest$4];
      } else {
        _block$1 = [sign + digits, rest$4];
      }
    } else {
      _block$1 = ["0", rest$1];
    }
  }
  let $2 = _block$1;
  let exponent = $2[0];
  let rest$2 = $2[1];
  let whole_digits = $string.replace(whole, ",", "");
  if (exponent === "bad") {
    return new Error(undefined);
  } else if (rest$2 instanceof $Empty) {
    if (whole_digits === "" && fraction === "") {
      return new Error(undefined);
    } else {
      let $3 = valid_grouping(whole);
      if ($3) {
        let _block$2;
        if (whole_digits === "") {
          _block$2 = "0";
        } else {
          _block$2 = whole_digits;
        }
        let w = _block$2;
        let _block$3;
        if (fraction === "") {
          _block$3 = "0";
        } else {
          _block$3 = fraction;
        }
        let f = _block$3;
        return $float.parse((((w + ".") + f) + "e") + exponent);
      } else {
        return new Error(undefined);
      }
    }
  } else {
    return new Error(undefined);
  }
}

/**
 * Parse a number the way Excel reads one typed into a cell or passed to
 * VALUE: optional sign, thousands separators, decimals, an exponent and a
 * trailing percent sign. "1,234.5", "-3e2", "12.5%" and ".5" all parse.
 */
export function parse_number(text) {
  let text$1 = $string.trim(text);
  let _block;
  let $1 = $string.ends_with(text$1, "%");
  if ($1) {
    _block = [$string.trim_end($string.drop_end(text$1, 1)), 0.01];
  } else {
    _block = [text$1, 1.0];
  }
  let $ = _block;
  let text$2 = $[0];
  let scale = $[1];
  let _block$1;
  let $3 = text$2.charCodeAt(0);
  if ($3 === 45) {
    let rest = text$2.slice(1);
    _block$1 = [true, rest];
  } else if ($3 === 43) {
    let rest = text$2.slice(1);
    _block$1 = [false, rest];
  } else {
    _block$1 = [false, text$2];
  }
  let $2 = _block$1;
  let negative = $2[0];
  let text$3 = $2[1];
  let $4 = scan_number($string.to_graphemes(text$3));
  if ($4 instanceof Ok) {
    let x = $4[0];
    let x$1 = x * scale;
    if (negative) {
      return new Ok($float.negate(x$1));
    } else {
      return new Ok(x$1);
    }
  } else {
    return new Error(undefined);
  }
}

/**
 * What a person typed into a cell, as a constant value. Formulas are
 * handled by the parser; this only covers literals.
 */
export function from_input(text) {
  if (text === "") {
    return Value$Empty$const;
  } else if (text.charCodeAt(0) === 39) {
    let rest = text.slice(1);
    return new Text(rest);
  } else {
    let $ = parse_number(text);
    if ($ instanceof Ok) {
      let x = $[0];
      return new Number(x);
    } else {
      let $1 = $string.uppercase($string.trim(text));
      if ($1 === "TRUE") {
        return new Boolean(true);
      } else if ($1 === "FALSE") {
        return new Boolean(false);
      } else {
        let upper = $1;
        let $2 = error_from_string(upper);
        if ($2 instanceof Ok) {
          let kind = $2[0];
          return new Err(kind);
        } else {
          return new Text(text);
        }
      }
    }
  }
}

export function to_number(value) {
  if (value instanceof Number) {
    let x = value[0];
    return new Ok(x);
  } else if (value instanceof Text) {
    let s = value[0];
    let $ = parse_number(s);
    if ($ instanceof Ok) {
      return $;
    } else {
      return new Error(ErrorKind$ValueErr$const);
    }
  } else if (value instanceof Boolean) {
    if (value[0]) {
      return new Ok(1.0);
    } else {
      return new Ok(0.0);
    }
  } else if (value instanceof Empty) {
    return new Ok(0.0);
  } else {
    let kind = value[0];
    return new Error(kind);
  }
}

export function to_text(value) {
  if (value instanceof Err) {
    let kind = value[0];
    return new Error(kind);
  } else {
    return new Ok(to_string(value));
  }
}

export function to_bool(value) {
  if (value instanceof Number) {
    let x = value[0];
    return new Ok(x !== 0.0);
  } else if (value instanceof Text) {
    let s = value[0];
    let $ = $string.uppercase(s);
    if ($ === "TRUE") {
      return new Ok(true);
    } else if ($ === "FALSE") {
      return new Ok(false);
    } else {
      return new Error(ErrorKind$ValueErr$const);
    }
  } else if (value instanceof Boolean) {
    let b = value[0];
    return new Ok(b);
  } else if (value instanceof Empty) {
    return new Ok(false);
  } else {
    let kind = value[0];
    return new Error(kind);
  }
}

/**
 * Two numbers are equal if they agree to about 15 significant digits, so
 * =0.1+0.2=0.3 is TRUE, as in Excel.
 */
export function compare_numbers(a, b) {
  let $ = a === b;
  if ($) {
    return $order.Order$Eq$const;
  } else {
    let scale = $float.max($float.absolute_value(a), $float.absolute_value(b));
    let $1 = $float.absolute_value(a - b) <= (scale * 1e-15);
    if ($1) {
      return $order.Order$Eq$const;
    } else {
      return $float.compare(a, b);
    }
  }
}

function rank(value) {
  if (value instanceof Number) {
    return 0;
  } else if (value instanceof Text) {
    return 1;
  } else if (value instanceof Boolean) {
    return 2;
  } else if (value instanceof Empty) {
    return 0;
  } else {
    return 3;
  }
}

/**
 * Excel's ordering for comparison operators and sorting: numbers sort
 * before text, text before logicals; text compares case-insensitively; an
 * empty cell acts as 0, "" or FALSE depending on the other side.
 */
export function compare(loop$a, loop$b) {
  while (true) {
    let a = loop$a;
    let b = loop$b;
    if (a instanceof Number) {
      if (b instanceof Number) {
        let x = a[0];
        let y = b[0];
        return compare_numbers(x, y);
      } else if (b instanceof Empty) {
        loop$a = a;
        loop$b = new Number(0.0);
      } else {
        return $int.compare(rank(a), rank(b));
      }
    } else if (a instanceof Text) {
      if (b instanceof Text) {
        let x = a[0];
        let y = b[0];
        return $string.compare($string.lowercase(x), $string.lowercase(y));
      } else if (b instanceof Empty) {
        loop$a = a;
        loop$b = new Text("");
      } else {
        return $int.compare(rank(a), rank(b));
      }
    } else if (a instanceof Boolean) {
      if (b instanceof Boolean) {
        let x = a[0];
        let y = b[0];
        if (x) {
          if (!y) {
            return $order.Order$Gt$const;
          } else {
            return $order.Order$Eq$const;
          }
        } else if (y) {
          return $order.Order$Lt$const;
        } else {
          return $order.Order$Eq$const;
        }
      } else if (b instanceof Empty) {
        loop$a = a;
        loop$b = new Boolean(false);
      } else {
        return $int.compare(rank(a), rank(b));
      }
    } else if (a instanceof Empty) {
      if (b instanceof Text) {
        loop$a = new Text("");
        loop$b = b;
      } else if (b instanceof Boolean) {
        loop$a = new Boolean(false);
        loop$b = b;
      } else if (b instanceof Empty) {
        return $order.Order$Eq$const;
      } else {
        loop$a = new Number(0.0);
        loop$b = b;
      }
    } else if (b instanceof Empty) {
      loop$a = a;
      loop$b = new Number(0.0);
    } else {
      return $int.compare(rank(a), rank(b));
    }
  }
}

export function is_error(value) {
  if (value instanceof Err) {
    return true;
  } else {
    return false;
  }
}
