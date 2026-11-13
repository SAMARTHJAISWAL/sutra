import * as $float from "../../gleam_stdlib/gleam/float.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $option from "../../gleam_stdlib/gleam/option.mjs";
import { Some, Option$None$const } from "../../gleam_stdlib/gleam/option.mjs";
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
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $value from "../sutra/value.mjs";

const FILEPATH = "src/sutra/parser.gleam";

export class ParseError extends $CustomType {
  constructor(message, position) {
    super();
    this.message = message;
    this.position = position;
  }
}
export const ParseError$ParseError = (message, position) =>
  new ParseError(message, position);
export const ParseError$isParseError = (value) => value instanceof ParseError;
export const ParseError$ParseError$message = (value) => value.message;
export const ParseError$ParseError$0 = (value) => value.message;
export const ParseError$ParseError$position = (value) => value.position;
export const ParseError$ParseError$1 = (value) => value.position;

class TNum extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TStr extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TBool extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TErr extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TCell extends $CustomType {
  constructor(col, row) {
    super();
    this.col = col;
    this.row = row;
  }
}

class TCols extends $CustomType {
  constructor($0, $1) {
    super();
    this[0] = $0;
    this[1] = $1;
  }
}

class TRows extends $CustomType {
  constructor($0, $1) {
    super();
    this[0] = $0;
    this[1] = $1;
  }
}

class TSheet extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TIdent extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TOp extends $CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class TLParen extends $CustomType {}
const Tok$TLParen$const = new TLParen();

class TRParen extends $CustomType {}
const Tok$TRParen$const = new TRParen();

class TComma extends $CustomType {}
const Tok$TComma$const = new TComma();

class TSemi extends $CustomType {}
const Tok$TSemi$const = new TSemi();

class TLBrace extends $CustomType {}
const Tok$TLBrace$const = new TLBrace();

class TRBrace extends $CustomType {}
const Tok$TRBrace$const = new TRBrace();

class TColon extends $CustomType {}
const Tok$TColon$const = new TColon();

class TEnd extends $CustomType {}
const Tok$TEnd$const = new TEnd();

const error_literals = /* @__PURE__ */ toList([
  "#DIV/0!",
  "#N/A",
  "#NAME?",
  "#NULL!",
  "#NUM!",
  "#REF!",
  "#VALUE!",
  "#SPILL!",
  "#CYCLE!",
  "#CALC!",
  "#ERROR!",
]);

function describe(tok) {
  if (tok instanceof TNum) {
    let x = tok[0];
    return $value.format_number(x, 15);
  } else if (tok instanceof TStr) {
    let s = tok[0];
    return ("\"" + s) + "\"";
  } else if (tok instanceof TBool) {
    if (tok[0]) {
      return "TRUE";
    } else {
      return "FALSE";
    }
  } else if (tok instanceof TErr) {
    let k = tok[0];
    return $value.error_to_string(k);
  } else if (tok instanceof TCell) {
    let c = tok.col;
    let r = tok.row;
    return $ast.cell_name(c, r);
  } else if (tok instanceof TCols) {
    let a = tok[0];
    let b = tok[1];
    return ($ast.column_name(a) + ":") + $ast.column_name(b);
  } else if (tok instanceof TRows) {
    let a = tok[0];
    let b = tok[1];
    return ($int.to_string(a + 1) + ":") + $int.to_string(b + 1);
  } else if (tok instanceof TSheet) {
    let s = tok[0];
    return s + "!";
  } else if (tok instanceof TIdent) {
    let s = tok[0];
    return s;
  } else if (tok instanceof TOp) {
    let s = tok[0];
    return s;
  } else if (tok instanceof TLParen) {
    return "(";
  } else if (tok instanceof TRParen) {
    return ")";
  } else if (tok instanceof TComma) {
    return ",";
  } else if (tok instanceof TSemi) {
    return ";";
  } else if (tok instanceof TLBrace) {
    return "{";
  } else if (tok instanceof TRBrace) {
    return "}";
  } else if (tok instanceof TColon) {
    return ":";
  } else {
    return "end of formula";
  }
}

function binary_op(op) {
  if (op === "=") {
    return new Ok([$ast.BinOp$Eq$const, 1]);
  } else if (op === "<>") {
    return new Ok([$ast.BinOp$Ne$const, 1]);
  } else if (op === "<") {
    return new Ok([$ast.BinOp$Lt$const, 1]);
  } else if (op === "<=") {
    return new Ok([$ast.BinOp$Le$const, 1]);
  } else if (op === ">") {
    return new Ok([$ast.BinOp$Gt$const, 1]);
  } else if (op === ">=") {
    return new Ok([$ast.BinOp$Ge$const, 1]);
  } else if (op === "&") {
    return new Ok([$ast.BinOp$Concat$const, 2]);
  } else if (op === "+") {
    return new Ok([$ast.BinOp$Add$const, 3]);
  } else if (op === "-") {
    return new Ok([$ast.BinOp$Sub$const, 3]);
  } else if (op === "*") {
    return new Ok([$ast.BinOp$Mul$const, 4]);
  } else if (op === "/") {
    return new Ok([$ast.BinOp$Div$const, 4]);
  } else if (op === "^") {
    return new Ok([$ast.BinOp$Pow$const, 5]);
  } else {
    return new Error(undefined);
  }
}

function percents(loop$e, loop$tokens) {
  while (true) {
    let e = loop$e;
    let tokens = loop$tokens;
    if (tokens instanceof $Empty) {
      return [e, tokens];
    } else {
      let $ = tokens.head[0];
      if ($ instanceof TOp && $[0] === "%") {
        let rest = tokens.tail;
        loop$e = new $ast.Percent(e);
        loop$tokens = rest;
      } else {
        return [e, tokens];
      }
    }
  }
}

function array_item(tokens) {
  if (tokens instanceof $Empty) {
    return new Error(new ParseError("missing } in array constant", 0));
  } else {
    let $ = tokens.tail;
    if ($ instanceof $Empty) {
      let $1 = tokens.head[0];
      if ($1 instanceof TNum) {
        let rest = $;
        let x = $1[0];
        return new Ok([new $ast.Num(x), rest]);
      } else if ($1 instanceof TStr) {
        let rest = $;
        let s = $1[0];
        return new Ok([new $ast.Str(s), rest]);
      } else if ($1 instanceof TBool) {
        let rest = $;
        let b = $1[0];
        return new Ok([new $ast.Bool(b), rest]);
      } else if ($1 instanceof TErr) {
        let rest = $;
        let k = $1[0];
        return new Ok([new $ast.ErrorLit(k), rest]);
      } else {
        let pos = tokens.head[1];
        return new Error(
          new ParseError("array constants may only hold values", pos),
        );
      }
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof TNum) {
        let rest = $;
        let x = $1[0];
        return new Ok([new $ast.Num(x), rest]);
      } else if ($1 instanceof TStr) {
        let rest = $;
        let s = $1[0];
        return new Ok([new $ast.Str(s), rest]);
      } else if ($1 instanceof TBool) {
        let rest = $;
        let b = $1[0];
        return new Ok([new $ast.Bool(b), rest]);
      } else if ($1 instanceof TErr) {
        let rest = $;
        let k = $1[0];
        return new Ok([new $ast.ErrorLit(k), rest]);
      } else if ($1 instanceof TOp) {
        let $2 = $.head[0];
        if ($2 instanceof TNum && $1[0] === "-") {
          let rest = $.tail;
          let x = $2[0];
          return new Ok([new $ast.Num($float.negate(x)), rest]);
        } else {
          let pos = tokens.head[1];
          return new Error(
            new ParseError("array constants may only hold values", pos),
          );
        }
      } else {
        let pos = tokens.head[1];
        return new Error(
          new ParseError("array constants may only hold values", pos),
        );
      }
    }
  }
}

function array(tokens, start, row, rows) {
  return $result.try$(
    array_item(tokens),
    (_use0) => {
      let item = _use0[0];
      let rest = _use0[1];
      let row$1 = listPrepend(item, row);
      if (rest instanceof $Empty) {
        return new Error(new ParseError("missing } in array constant", start));
      } else {
        let $ = rest.head[0];
        if ($ instanceof TComma) {
          let rest$1 = rest.tail;
          return array(rest$1, start, row$1, rows);
        } else if ($ instanceof TSemi) {
          let rest$1 = rest.tail;
          return array(
            rest$1,
            start,
            $List$Empty$const,
            listPrepend($list.reverse(row$1), rows),
          );
        } else if ($ instanceof TRBrace) {
          let rest$1 = rest.tail;
          let rows$1 = $list.reverse(listPrepend($list.reverse(row$1), rows));
          let width = $list.length(
            (() => {
              let _pipe = $list.first(rows$1);
              return $result.unwrap(_pipe, $List$Empty$const);
            })(),
          );
          let $1 = $list.all(
            rows$1,
            (r) => { return $list.length(r) === width; },
          );
          if ($1) {
            return new Ok([new $ast.ArrayLit(rows$1), rest$1]);
          } else {
            return new Error(
              new ParseError("array rows must be the same length", start),
            );
          }
        } else {
          return new Error(new ParseError("missing } in array constant", start));
        }
      }
    },
  );
}

function reference(sheet, tokens) {
  if (tokens instanceof $Empty) {
    return new Error(new ParseError("expected a reference", 0));
  } else {
    let $ = tokens.tail;
    if ($ instanceof $Empty) {
      let $1 = tokens.head[0];
      if ($1 instanceof TCell) {
        let rest = $;
        let c = $1.col;
        let r = $1.row;
        return new Ok([new $ast.Ref(sheet, c, r), rest]);
      } else if ($1 instanceof TCols) {
        let rest = $;
        let c1 = $1[0];
        let c2 = $1[1];
        return new Ok(
          [
            new $ast.Area(sheet, new $ast.Range(0, c1, $ast.max_rows - 1, c2)),
            rest,
          ],
        );
      } else if ($1 instanceof TRows) {
        let rest = $;
        let r1 = $1[0];
        let r2 = $1[1];
        return new Ok(
          [
            new $ast.Area(sheet, new $ast.Range(r1, 0, r2, $ast.max_cols - 1)),
            rest,
          ],
        );
      } else {
        return new Error(new ParseError("expected a reference", 0));
      }
    } else {
      let $1 = $.tail;
      if ($1 instanceof $Empty) {
        let $2 = tokens.head[0];
        if ($2 instanceof TCell) {
          if ($.head[0] instanceof TColon) {
            let pos = $.head[1];
            return new Error(
              new ParseError("a range needs a cell on both sides of :", pos),
            );
          } else {
            let rest = $;
            let c = $2.col;
            let r = $2.row;
            return new Ok([new $ast.Ref(sheet, c, r), rest]);
          }
        } else if ($2 instanceof TCols) {
          let rest = $;
          let c1 = $2[0];
          let c2 = $2[1];
          return new Ok(
            [
              new $ast.Area(sheet, new $ast.Range(0, c1, $ast.max_rows - 1, c2)),
              rest,
            ],
          );
        } else if ($2 instanceof TRows) {
          let rest = $;
          let r1 = $2[0];
          let r2 = $2[1];
          return new Ok(
            [
              new $ast.Area(sheet, new $ast.Range(r1, 0, r2, $ast.max_cols - 1)),
              rest,
            ],
          );
        } else {
          return new Error(new ParseError("expected a reference", 0));
        }
      } else {
        let $2 = tokens.head[0];
        if ($2 instanceof TCell) {
          if ($.head[0] instanceof TColon) {
            let $3 = $1.head[0];
            if ($3 instanceof TCell) {
              let rest = $1.tail;
              let c1 = $2.col;
              let r1 = $2.row;
              let c2 = $3.col;
              let r2 = $3.row;
              return new Ok(
                [new $ast.Area(sheet, $ast.range_of(c1, r1, c2, r2)), rest],
              );
            } else {
              let pos = $.head[1];
              return new Error(
                new ParseError("a range needs a cell on both sides of :", pos),
              );
            }
          } else {
            let rest = $;
            let c = $2.col;
            let r = $2.row;
            return new Ok([new $ast.Ref(sheet, c, r), rest]);
          }
        } else if ($2 instanceof TCols) {
          let rest = $;
          let c1 = $2[0];
          let c2 = $2[1];
          return new Ok(
            [
              new $ast.Area(sheet, new $ast.Range(0, c1, $ast.max_rows - 1, c2)),
              rest,
            ],
          );
        } else if ($2 instanceof TRows) {
          let rest = $;
          let r1 = $2[0];
          let r2 = $2[1];
          return new Ok(
            [
              new $ast.Area(sheet, new $ast.Range(r1, 0, r2, $ast.max_cols - 1)),
              rest,
            ],
          );
        } else {
          return new Error(new ParseError("expected a reference", 0));
        }
      }
    }
  }
}

function climb(left, tokens, min) {
  if (tokens instanceof $Empty) {
    return new Ok([left, tokens]);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof TOp) {
      let rest = tokens.tail;
      let op = $[0];
      let $1 = binary_op(op);
      if ($1 instanceof Ok) {
        let prec = $1[0][1];
        if (prec >= min) {
          let bin = $1[0][0];
          return $result.try$(
            expression(rest, prec + 1),
            (_use0) => {
              let right = _use0[0];
              let rest$1 = _use0[1];
              return climb(new $ast.Binary(bin, left, right), rest$1, min);
            },
          );
        } else {
          return new Ok([left, tokens]);
        }
      } else {
        return new Ok([left, tokens]);
      }
    } else {
      return new Ok([left, tokens]);
    }
  }
}

function arguments$(tokens, acc) {
  if (tokens instanceof $Empty) {
    return $result.try$(
      (() => {
        if (tokens instanceof $Empty) {
          return expression(tokens, 0);
        } else {
          let $ = tokens.head[0];
          if ($ instanceof TRParen) {
            return new Ok([$ast.Expr$Missing$const, tokens]);
          } else if ($ instanceof TComma) {
            return new Ok([$ast.Expr$Missing$const, tokens]);
          } else {
            return expression(tokens, 0);
          }
        }
      })(),
      (_use0) => {
        let arg = _use0[0];
        let rest = _use0[1];
        if (rest instanceof $Empty) {
          return new Error(new ParseError("missing )", 0));
        } else {
          let $ = rest.head[0];
          if ($ instanceof TRParen) {
            let rest$1 = rest.tail;
            return new Ok([$list.reverse(listPrepend(arg, acc)), rest$1]);
          } else if ($ instanceof TComma) {
            let rest$1 = rest.tail;
            return arguments$(rest$1, listPrepend(arg, acc));
          } else if ($ instanceof TEnd) {
            let pos = rest.head[1];
            return new Error(new ParseError("missing ) after arguments", pos));
          } else {
            let tok = $;
            let pos = rest.head[1];
            return new Error(
              new ParseError(
                ("unexpected " + describe(tok)) + " in arguments",
                pos,
              ),
            );
          }
        }
      },
    );
  } else if (acc instanceof $Empty && tokens.head[0] instanceof TRParen) {
    let rest = tokens.tail;
    return new Ok([$List$Empty$const, rest]);
  } else {
    return $result.try$(
      (() => {
        if (tokens instanceof $Empty) {
          return expression(tokens, 0);
        } else {
          let $ = tokens.head[0];
          if ($ instanceof TRParen) {
            return new Ok([$ast.Expr$Missing$const, tokens]);
          } else if ($ instanceof TComma) {
            return new Ok([$ast.Expr$Missing$const, tokens]);
          } else {
            return expression(tokens, 0);
          }
        }
      })(),
      (_use0) => {
        let arg = _use0[0];
        let rest = _use0[1];
        if (rest instanceof $Empty) {
          return new Error(new ParseError("missing )", 0));
        } else {
          let $ = rest.head[0];
          if ($ instanceof TRParen) {
            let rest$1 = rest.tail;
            return new Ok([$list.reverse(listPrepend(arg, acc)), rest$1]);
          } else if ($ instanceof TComma) {
            let rest$1 = rest.tail;
            return arguments$(rest$1, listPrepend(arg, acc));
          } else if ($ instanceof TEnd) {
            let pos = rest.head[1];
            return new Error(new ParseError("missing ) after arguments", pos));
          } else {
            let tok = $;
            let pos = rest.head[1];
            return new Error(
              new ParseError(
                ("unexpected " + describe(tok)) + " in arguments",
                pos,
              ),
            );
          }
        }
      },
    );
  }
}

function primary(tokens) {
  if (tokens instanceof $Empty) {
    return new Error(new ParseError("formula ends too early", 0));
  } else {
    let $ = tokens.head[0];
    if ($ instanceof TNum) {
      let rest = tokens.tail;
      let x = $[0];
      return new Ok([new $ast.Num(x), rest]);
    } else if ($ instanceof TStr) {
      let rest = tokens.tail;
      let s = $[0];
      return new Ok([new $ast.Str(s), rest]);
    } else if ($ instanceof TBool) {
      let rest = tokens.tail;
      let b = $[0];
      return new Ok([new $ast.Bool(b), rest]);
    } else if ($ instanceof TErr) {
      let rest = tokens.tail;
      let k = $[0];
      return new Ok([new $ast.ErrorLit(k), rest]);
    } else if ($ instanceof TCell) {
      return reference(Option$None$const, tokens);
    } else if ($ instanceof TCols) {
      return reference(Option$None$const, tokens);
    } else if ($ instanceof TRows) {
      return reference(Option$None$const, tokens);
    } else if ($ instanceof TSheet) {
      let rest = tokens.tail;
      let pos = tokens.head[1];
      let name = $[0];
      if (rest instanceof $Empty) {
        return new Error(
          new ParseError(("expected a cell or range after " + name) + "!", pos),
        );
      } else {
        let $1 = rest.head[0];
        if ($1 instanceof TCell) {
          return reference(new Some(name), rest);
        } else if ($1 instanceof TCols) {
          return reference(new Some(name), rest);
        } else if ($1 instanceof TRows) {
          return reference(new Some(name), rest);
        } else {
          return new Error(
            new ParseError(
              ("expected a cell or range after " + name) + "!",
              pos,
            ),
          );
        }
      }
    } else if ($ instanceof TIdent) {
      let $1 = tokens.tail;
      if ($1 instanceof $Empty) {
        let rest = $1;
        let name = $[0];
        return new Ok([new $ast.Name(name), rest]);
      } else if ($1.head[0] instanceof TLParen) {
        let name = $[0];
        let rest = $1.tail;
        return $result.try$(
          arguments$(rest, $List$Empty$const),
          (_use0) => {
            let args = _use0[0];
            let rest$1 = _use0[1];
            return new Ok([new $ast.Call(name, args), rest$1]);
          },
        );
      } else {
        let rest = $1;
        let name = $[0];
        return new Ok([new $ast.Name(name), rest]);
      }
    } else if ($ instanceof TLParen) {
      let rest = tokens.tail;
      let pos = tokens.head[1];
      return $result.try$(
        expression(rest, 0),
        (_use0) => {
          let e = _use0[0];
          let rest$1 = _use0[1];
          if (rest$1 instanceof $Empty) {
            return new Error(new ParseError("missing )", pos));
          } else if (rest$1.head[0] instanceof TRParen) {
            let rest$2 = rest$1.tail;
            return new Ok([e, rest$2]);
          } else {
            return new Error(new ParseError("missing )", pos));
          }
        },
      );
    } else if ($ instanceof TLBrace) {
      let rest = tokens.tail;
      let pos = tokens.head[1];
      return array(rest, pos, $List$Empty$const, $List$Empty$const);
    } else if ($ instanceof TEnd) {
      let pos = tokens.head[1];
      return new Error(new ParseError("formula ends too early", pos));
    } else {
      let tok = $;
      let pos = tokens.head[1];
      return new Error(new ParseError("unexpected " + describe(tok), pos));
    }
  }
}

function unary(loop$tokens) {
  while (true) {
    let tokens = loop$tokens;
    if (tokens instanceof $Empty) {
      return $result.try$(
        primary(tokens),
        (_use0) => {
          let e = _use0[0];
          let rest = _use0[1];
          return new Ok(percents(e, rest));
        },
      );
    } else {
      let $ = tokens.head[0];
      if ($ instanceof TOp) {
        let $1 = $[0];
        if ($1 === "-") {
          let rest = tokens.tail;
          return $result.try$(
            unary(rest),
            (_use0) => {
              let e = _use0[0];
              let rest$1 = _use0[1];
              return new Ok([new $ast.Neg(e), rest$1]);
            },
          );
        } else if ($1 === "+") {
          let rest = tokens.tail;
          loop$tokens = rest;
        } else {
          return $result.try$(
            primary(tokens),
            (_use0) => {
              let e = _use0[0];
              let rest = _use0[1];
              return new Ok(percents(e, rest));
            },
          );
        }
      } else {
        return $result.try$(
          primary(tokens),
          (_use0) => {
            let e = _use0[0];
            let rest = _use0[1];
            return new Ok(percents(e, rest));
          },
        );
      }
    }
  }
}

function expression(tokens, min) {
  return $result.try$(
    unary(tokens),
    (_use0) => {
      let left = _use0[0];
      let rest = _use0[1];
      return climb(left, rest, min);
    },
  );
}

function column_word(text) {
  let _pipe = $ast.parse_column($string.replace(text, "$", ""));
  return $result.try$(
    _pipe,
    (col) => {
      let $ = $string.ends_with(text, "$");
      if ($) {
        return new Error(undefined);
      } else {
        return new Ok(col);
      }
    },
  );
}

function is_word_char(c) {
  return ((((c === "_") || (c === "$")) || (c === "\\")) || $value.is_digit(c)) || ($string.lowercase(
    c,
  ) !== $string.uppercase(c));
}

/**
 * A1, $A$1, a1 — but not A$ or 1A.
 * 
 * @ignore
 */
function cell_ref(text) {
  let chars = $string.to_graphemes(text);
  let _block;
  if (chars instanceof $Empty) {
    _block = [$List$Empty$const, chars];
  } else if (chars.head === "$") {
    let rest = chars.tail;
    _block = [listPrepend("$", $List$Empty$const), rest];
  } else {
    _block = [$List$Empty$const, chars];
  }
  let $ = _block;
  let col_part = $[0];
  let rest = $[1];
  let $1 = $list.split_while(
    rest,
    (c) => { return !$value.is_digit(c) && (c !== "$"); },
  );
  let letters = $1[0];
  let rest$1 = $1[1];
  let _block$1;
  if (rest$1 instanceof $Empty) {
    _block$1 = [$List$Empty$const, rest$1];
  } else if (rest$1.head === "$") {
    let d = rest$1.tail;
    _block$1 = [listPrepend("$", $List$Empty$const), d];
  } else {
    _block$1 = [$List$Empty$const, rest$1];
  }
  let $2 = _block$1;
  let dollar = $2[0];
  let digits = $2[1];
  
  
  let $3 = $list.all(digits, $value.is_digit);
  if (letters instanceof $Empty) {
    return new Error(undefined);
  } else if (digits instanceof $Empty) {
    return new Error(undefined);
  } else if ($3) {
    return $ast.parse_cell($string.concat(letters) + $string.concat(digits));
  } else {
    return new Error(undefined);
  }
}

function rows_of(a, b) {
  return $result.try$(
    $int.parse($string.concat(a)),
    (r1) => {
      return $result.try$(
        $int.parse($string.concat(b)),
        (r2) => {
          let $ = (((r1 >= 1) && (r2 >= 1)) && (r1 <= $ast.max_rows)) && (r2 <= $ast.max_rows);
          if ($) {
            return new Ok([$int.min(r1, r2) - 1, $int.max(r1, r2) - 1]);
          } else {
            return new Error(undefined);
          }
        },
      );
    },
  );
}

function count(items, item) {
  return $list.count(items, (x) => { return x === item; });
}

function quoted_sheet(loop$chars, loop$start, loop$acc) {
  while (true) {
    let chars = loop$chars;
    let start = loop$start;
    let acc = loop$acc;
    if (chars instanceof $Empty) {
      return new Error(new ParseError("unterminated sheet name", start));
    } else {
      let $ = chars.tail;
      if ($ instanceof $Empty) {
        let $1 = chars.head;
        if ($1 === "'") {
          let rest = $;
          let text = $string.concat($list.reverse(acc));
          return new Ok(
            [text, rest, (2 + $string.length(text)) + count(acc, "'")],
          );
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$start = start;
          loop$acc = listPrepend(c, acc);
        }
      } else {
        let $1 = chars.head;
        if ($1 === "'") {
          if ($.head === "'") {
            let rest = $.tail;
            loop$chars = rest;
            loop$start = start;
            loop$acc = listPrepend("'", acc);
          } else {
            let rest = $;
            let text = $string.concat($list.reverse(acc));
            return new Ok(
              [text, rest, (2 + $string.length(text)) + count(acc, "'")],
            );
          }
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$start = start;
          loop$acc = listPrepend(c, acc);
        }
      }
    }
  }
}

function string_body(loop$chars, loop$start, loop$acc) {
  while (true) {
    let chars = loop$chars;
    let start = loop$start;
    let acc = loop$acc;
    if (chars instanceof $Empty) {
      return new Error(new ParseError("unterminated string", start));
    } else {
      let $ = chars.tail;
      if ($ instanceof $Empty) {
        let $1 = chars.head;
        if ($1 === "\"") {
          let rest = $;
          let text = $string.concat($list.reverse(acc));
          return new Ok(
            [text, rest, (2 + $string.length(text)) + count(acc, "\"")],
          );
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$start = start;
          loop$acc = listPrepend(c, acc);
        }
      } else {
        let $1 = chars.head;
        if ($1 === "\"") {
          if ($.head === "\"") {
            let rest = $.tail;
            loop$chars = rest;
            loop$start = start;
            loop$acc = listPrepend("\"", acc);
          } else {
            let rest = $;
            let text = $string.concat($list.reverse(acc));
            return new Ok(
              [text, rest, (2 + $string.length(text)) + count(acc, "\"")],
            );
          }
        } else {
          let c = $1;
          let rest = $;
          loop$chars = rest;
          loop$start = start;
          loop$acc = listPrepend(c, acc);
        }
      }
    }
  }
}

function ident(upper, rest, next, pos, acc) {
  let _block;
  if (upper === "TRUE") {
    _block = new TBool(true);
  } else if (upper === "FALSE") {
    _block = new TBool(false);
  } else {
    _block = new TIdent(upper);
  }
  let tok = _block;
  return lex(rest, next, listPrepend([tok, pos], acc));
}

function word(chars, pos, acc) {
  let $ = $list.split_while(
    chars,
    (c) => { return is_word_char(c) || (c === "."); },
  );
  let letters = $[0];
  let rest = $[1];
  let text = $string.concat(letters);
  let used = $list.length(letters);
  let next = pos + used;
  let upper = $string.uppercase(text);
  if (rest instanceof $Empty) {
    let $1 = cell_ref(text);
    if ($1 instanceof Ok) {
      let col = $1[0][0];
      let row = $1[0][1];
      return lex(rest, next, listPrepend([new TCell(col, row), pos], acc));
    } else {
      let $2 = column_word(text);
      if ($2 instanceof Ok) {
        if (rest instanceof $Empty) {
          return ident(upper, rest, next, pos, acc);
        } else if (rest.head === ":") {
          let c1 = $2[0];
          let after = rest.tail;
          let $3 = $list.split_while(after, (c) => { return is_word_char(c); });
          let second = $3[0];
          let rest2 = $3[1];
          let $4 = column_word($string.concat(second));
          if ($4 instanceof Ok) {
            let c2 = $4[0];
            let used2 = (used + 1) + $list.length(second);
            return lex(
              rest2,
              pos + used2,
              listPrepend(
                [new TCols($int.min(c1, c2), $int.max(c1, c2)), pos],
                acc,
              ),
            );
          } else {
            return ident(upper, rest, next, pos, acc);
          }
        } else {
          return ident(upper, rest, next, pos, acc);
        }
      } else {
        return ident(upper, rest, next, pos, acc);
      }
    }
  } else {
    let $1 = rest.head;
    if ($1 === "!") {
      let rest$1 = rest.tail;
      return lex(rest$1, next + 1, listPrepend([new TSheet(text), pos], acc));
    } else if ($1 === "(") {
      let _block;
      if (upper.startsWith("_XLFN.")) {
        let n = upper.slice(6);
        _block = n;
      } else {
        _block = upper;
      }
      let name = _block;
      return lex(rest, next, listPrepend([new TIdent(name), pos], acc));
    } else {
      let $2 = cell_ref(text);
      if ($2 instanceof Ok) {
        let col = $2[0][0];
        let row = $2[0][1];
        return lex(rest, next, listPrepend([new TCell(col, row), pos], acc));
      } else {
        let $3 = column_word(text);
        if ($3 instanceof Ok) {
          if (rest instanceof $Empty) {
            return ident(upper, rest, next, pos, acc);
          } else if (rest.head === ":") {
            let c1 = $3[0];
            let after = rest.tail;
            let $4 = $list.split_while(
              after,
              (c) => { return is_word_char(c); },
            );
            let second = $4[0];
            let rest2 = $4[1];
            let $5 = column_word($string.concat(second));
            if ($5 instanceof Ok) {
              let c2 = $5[0];
              let used2 = (used + 1) + $list.length(second);
              return lex(
                rest2,
                pos + used2,
                listPrepend(
                  [new TCols($int.min(c1, c2), $int.max(c1, c2)), pos],
                  acc,
                ),
              );
            } else {
              return ident(upper, rest, next, pos, acc);
            }
          } else {
            return ident(upper, rest, next, pos, acc);
          }
        } else {
          return ident(upper, rest, next, pos, acc);
        }
      }
    }
  }
}

function plain_number(chars, pos, acc) {
  let $ = $list.split_while(
    chars,
    (c) => { return $value.is_digit(c) || (c === "."); },
  );
  let mantissa = $[0];
  let rest = $[1];
  let _block;
  if (rest instanceof $Empty) {
    _block = [$List$Empty$const, rest];
  } else {
    let $2 = rest.tail;
    if ($2 instanceof $Empty) {
      _block = [$List$Empty$const, rest];
    } else {
      let $3 = $2.tail;
      if ($3 instanceof $Empty) {
        let e = rest.head;
        if (((e === "e") || (e === "E"))) {
          let d = $2.head;
          let more = $3;
          let $4 = $value.is_digit(d);
          if ($4) {
            let $5 = $list.split_while(listPrepend(d, more), $value.is_digit);
            let ds = $5[0];
            let rest$1 = $5[1];
            _block = [listPrepend(e, ds), rest$1];
          } else {
            _block = [$List$Empty$const, rest];
          }
        } else {
          _block = [$List$Empty$const, rest];
        }
      } else {
        let e = rest.head;
        let sign = $2.head;
        if (((e === "e") || (e === "E")) && ((sign === "+") || (sign === "-"))) {
          let d = $3.head;
          let more = $3.tail;
          let $4 = $value.is_digit(d);
          if ($4) {
            let $5 = $list.split_while(listPrepend(d, more), $value.is_digit);
            let ds = $5[0];
            let rest$1 = $5[1];
            _block = [listPrepend(e, listPrepend(sign, ds)), rest$1];
          } else {
            _block = [$List$Empty$const, rest];
          }
        } else {
          let e$1 = rest.head;
          if (((e$1 === "e") || (e$1 === "E"))) {
            let d$1 = $2.head;
            let more$1 = $3;
            let $5 = $value.is_digit(d$1);
            if ($5) {
              let $6 = $list.split_while(
                listPrepend(d$1, more$1),
                $value.is_digit,
              );
              let ds = $6[0];
              let rest$1 = $6[1];
              _block = [listPrepend(e$1, ds), rest$1];
            } else {
              _block = [$List$Empty$const, rest];
            }
          } else {
            _block = [$List$Empty$const, rest];
          }
        }
      }
    }
  }
  let $1 = _block;
  let exponent = $1[0];
  let rest$1 = $1[1];
  let text = $string.concat($list.append(mantissa, exponent));
  let $2 = $value.parse_number(text);
  if ($2 instanceof Ok) {
    let x = $2[0];
    return lex(
      rest$1,
      pos + $string.length(text),
      listPrepend([new TNum(x), pos], acc),
    );
  } else {
    return new Error(new ParseError("bad number " + text, pos));
  }
}

function number(chars, pos, acc) {
  let $ = $list.split_while(chars, $value.is_digit);
  let whole = $[0];
  let rest = $[1];
  if (whole instanceof $Empty) {
    return plain_number(chars, pos, acc);
  } else if (rest instanceof $Empty) {
    return plain_number(chars, pos, acc);
  } else if (rest.head === ":") {
    let after = rest.tail;
    let _block;
    if (after instanceof $Empty) {
      _block = [after, 0];
    } else if (after.head === "$") {
      let a = after.tail;
      _block = [a, 1];
    } else {
      _block = [after, 0];
    }
    let $1 = _block;
    let after_dollar = $1[0];
    let skip = $1[1];
    let $2 = $list.split_while(after_dollar, $value.is_digit);
    let second = $2[0];
    let rest2 = $2[1];
    let $3 = rows_of(whole, second);
    if (second instanceof $Empty) {
      return plain_number(chars, pos, acc);
    } else if ($3 instanceof Ok) {
      let r1 = $3[0][0];
      let r2 = $3[0][1];
      let used = (($list.length(whole) + 1) + skip) + $list.length(second);
      return lex(rest2, pos + used, listPrepend([new TRows(r1, r2), pos], acc));
    } else {
      return plain_number(chars, pos, acc);
    }
  } else {
    return plain_number(chars, pos, acc);
  }
}

function lex(loop$chars, loop$pos, loop$acc) {
  while (true) {
    let chars = loop$chars;
    let pos = loop$pos;
    let acc = loop$acc;
    if (chars instanceof $Empty) {
      return new Ok($list.reverse(listPrepend([Tok$TEnd$const, pos], acc)));
    } else {
      let c = chars.head;
      if (((((c === " ") || (c === "\t")) || (c === "\n")) || (c === "\r"))) {
        let rest = chars.tail;
        loop$chars = rest;
        loop$pos = pos + 1;
        loop$acc = acc;
      } else {
        let $ = chars.head;
        if ($ === "\"") {
          let rest$1 = chars.tail;
          return $result.try$(
            string_body(rest$1, pos, $List$Empty$const),
            (_use0) => {
              let text = _use0[0];
              let rest$2 = _use0[1];
              let used = _use0[2];
              return lex(
                rest$2,
                pos + used,
                listPrepend([new TStr(text), pos], acc),
              );
            },
          );
        } else if ($ === "'") {
          let rest$1 = chars.tail;
          return $result.try$(
            quoted_sheet(rest$1, pos, $List$Empty$const),
            (_use0) => {
              let name = _use0[0];
              let rest$2 = _use0[1];
              let used = _use0[2];
              if (rest$2 instanceof $Empty) {
                return new Error(
                  new ParseError(
                    "expected ! after a quoted sheet name",
                    pos + used,
                  ),
                );
              } else if (rest$2.head === "!") {
                let rest$3 = rest$2.tail;
                return lex(
                  rest$3,
                  (pos + used) + 1,
                  listPrepend([new TSheet(name), pos], acc),
                );
              } else {
                return new Error(
                  new ParseError(
                    "expected ! after a quoted sheet name",
                    pos + used,
                  ),
                );
              }
            },
          );
        } else if ($ === "#") {
          let upper = $string.uppercase($string.concat($list.take(chars, 7)));
          let $1 = $list.find(
            error_literals,
            (e) => { return $string.starts_with(upper, e); },
          );
          if ($1 instanceof Ok) {
            let lit = $1[0];
            let n = $string.length(lit);
            let $2 = $value.error_from_string(lit);
            let kind;
            if ($2 instanceof Ok) {
              kind = $2[0];
            } else {
              throw makeError(
                "let_assert",
                FILEPATH,
                "sutra/parser",
                96,
                "lex",
                "Pattern match failed, no pattern matched the value.",
                {
                  value: $2,
                  start: 2596,
                  end: 2646,
                  pattern_start: 2607,
                  pattern_end: 2615
                }
              )
            }
            loop$chars = $list.drop(chars, n);
            loop$pos = pos + n;
            loop$acc = listPrepend([new TErr(kind), pos], acc);
          } else {
            return new Error(new ParseError("unknown error value", pos));
          }
        } else if ($ === "<") {
          let $1 = chars.tail;
          if ($1 instanceof $Empty) {
            let c$1 = $;
            if (
              ((((((((((c$1 === "+") || (c$1 === "-")) || (c$1 === "*")) || (c$1 === "/")) || (c$1 === "^")) || (c$1 === "&")) || (c$1 === "%")) || (c$1 === "=")) || (c$1 === "<")) || (c$1 === ">"))
            ) {
              let rest$1 = $1;
              loop$chars = rest$1;
              loop$pos = pos + 1;
              loop$acc = listPrepend([new TOp(c$1), pos], acc);
            } else {
              let c$2 = $;
              let $2 = $value.is_digit(c$2) || (c$2 === ".");
              if ($2) {
                return number(chars, pos, acc);
              } else {
                let $3 = is_word_char(c$2);
                if ($3) {
                  return word(chars, pos, acc);
                } else {
                  return new Error(
                    new ParseError("unexpected character " + c$2, pos),
                  );
                }
              }
            }
          } else {
            let $2 = $1.head;
            if ($2 === ">") {
              let rest$1 = $1.tail;
              loop$chars = rest$1;
              loop$pos = pos + 2;
              loop$acc = listPrepend([new TOp("<>"), pos], acc);
            } else if ($2 === "=") {
              let rest$1 = $1.tail;
              loop$chars = rest$1;
              loop$pos = pos + 2;
              loop$acc = listPrepend([new TOp("<="), pos], acc);
            } else {
              let c$1 = $;
              if (
                ((((((((((c$1 === "+") || (c$1 === "-")) || (c$1 === "*")) || (c$1 === "/")) || (c$1 === "^")) || (c$1 === "&")) || (c$1 === "%")) || (c$1 === "=")) || (c$1 === "<")) || (c$1 === ">"))
              ) {
                let rest$1 = $1;
                loop$chars = rest$1;
                loop$pos = pos + 1;
                loop$acc = listPrepend([new TOp(c$1), pos], acc);
              } else {
                let c$2 = $;
                let $3 = $value.is_digit(c$2) || (c$2 === ".");
                if ($3) {
                  return number(chars, pos, acc);
                } else {
                  let $4 = is_word_char(c$2);
                  if ($4) {
                    return word(chars, pos, acc);
                  } else {
                    return new Error(
                      new ParseError("unexpected character " + c$2, pos),
                    );
                  }
                }
              }
            }
          }
        } else if ($ === ">") {
          let $1 = chars.tail;
          if ($1 instanceof $Empty) {
            let c$1 = $;
            if (
              ((((((((((c$1 === "+") || (c$1 === "-")) || (c$1 === "*")) || (c$1 === "/")) || (c$1 === "^")) || (c$1 === "&")) || (c$1 === "%")) || (c$1 === "=")) || (c$1 === "<")) || (c$1 === ">"))
            ) {
              let rest$1 = $1;
              loop$chars = rest$1;
              loop$pos = pos + 1;
              loop$acc = listPrepend([new TOp(c$1), pos], acc);
            } else {
              let c$2 = $;
              let $2 = $value.is_digit(c$2) || (c$2 === ".");
              if ($2) {
                return number(chars, pos, acc);
              } else {
                let $3 = is_word_char(c$2);
                if ($3) {
                  return word(chars, pos, acc);
                } else {
                  return new Error(
                    new ParseError("unexpected character " + c$2, pos),
                  );
                }
              }
            }
          } else if ($1.head === "=") {
            let rest$1 = $1.tail;
            loop$chars = rest$1;
            loop$pos = pos + 2;
            loop$acc = listPrepend([new TOp(">="), pos], acc);
          } else {
            let c$1 = $;
            if (
              ((((((((((c$1 === "+") || (c$1 === "-")) || (c$1 === "*")) || (c$1 === "/")) || (c$1 === "^")) || (c$1 === "&")) || (c$1 === "%")) || (c$1 === "=")) || (c$1 === "<")) || (c$1 === ">"))
            ) {
              let rest$1 = $1;
              loop$chars = rest$1;
              loop$pos = pos + 1;
              loop$acc = listPrepend([new TOp(c$1), pos], acc);
            } else {
              let c$2 = $;
              let $2 = $value.is_digit(c$2) || (c$2 === ".");
              if ($2) {
                return number(chars, pos, acc);
              } else {
                let $3 = is_word_char(c$2);
                if ($3) {
                  return word(chars, pos, acc);
                } else {
                  return new Error(
                    new ParseError("unexpected character " + c$2, pos),
                  );
                }
              }
            }
          }
        } else if ($ === "(") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TLParen$const, pos], acc);
        } else if ($ === ")") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TRParen$const, pos], acc);
        } else if ($ === ",") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TComma$const, pos], acc);
        } else if ($ === ";") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TSemi$const, pos], acc);
        } else if ($ === "{") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TLBrace$const, pos], acc);
        } else if ($ === "}") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TRBrace$const, pos], acc);
        } else if ($ === ":") {
          let rest$1 = chars.tail;
          loop$chars = rest$1;
          loop$pos = pos + 1;
          loop$acc = listPrepend([Tok$TColon$const, pos], acc);
        } else {
          let c$1 = $;
          if (
            ((((((((((c$1 === "+") || (c$1 === "-")) || (c$1 === "*")) || (c$1 === "/")) || (c$1 === "^")) || (c$1 === "&")) || (c$1 === "%")) || (c$1 === "=")) || (c$1 === "<")) || (c$1 === ">"))
          ) {
            let rest$1 = chars.tail;
            loop$chars = rest$1;
            loop$pos = pos + 1;
            loop$acc = listPrepend([new TOp(c$1), pos], acc);
          } else {
            let c$2 = $;
            let $1 = $value.is_digit(c$2) || (c$2 === ".");
            if ($1) {
              return number(chars, pos, acc);
            } else {
              let $2 = is_word_char(c$2);
              if ($2) {
                return word(chars, pos, acc);
              } else {
                return new Error(
                  new ParseError("unexpected character " + c$2, pos),
                );
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Parse a formula. A leading "=" is optional.
 */
export function parse(text) {
  let _block;
  if (text.charCodeAt(0) === 61) {
    let rest = text.slice(1);
    _block = rest;
  } else {
    _block = text;
  }
  let body = _block;
  let offset = $string.length(text) - $string.length(body);
  return $result.try$(
    lex($string.to_graphemes(body), offset, $List$Empty$const),
    (tokens) => {
      return $result.try$(
        expression(tokens, 0),
        (_use0) => {
          let expr = _use0[0];
          let rest = _use0[1];
          if (rest instanceof $Empty) {
            return new Ok(expr);
          } else {
            let $ = rest.head[0];
            if ($ instanceof TEnd) {
              return new Ok(expr);
            } else {
              let tok = $;
              let pos = rest.head[1];
              return new Error(
                new ParseError("unexpected " + describe(tok), pos),
              );
            }
          }
        },
      );
    },
  );
}
