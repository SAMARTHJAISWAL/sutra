import * as $dict from "../../gleam_stdlib/gleam/dict.mjs";
import * as $int from "../../gleam_stdlib/gleam/int.mjs";
import * as $list from "../../gleam_stdlib/gleam/list.mjs";
import * as $result from "../../gleam_stdlib/gleam/result.mjs";
import * as $set from "../../gleam_stdlib/gleam/set.mjs";
import * as $string from "../../gleam_stdlib/gleam/string.mjs";
import {
  Ok,
  Error,
  Empty as $Empty,
  List$Empty$const as $List$Empty$const,
  prepend as listPrepend,
  CustomType as $CustomType,
  isEqual,
} from "../gleam.mjs";
import * as $ast from "../sutra/ast.mjs";
import * as $csv from "../sutra/csv.mjs";
import * as $env from "../sutra/env.mjs";
import * as $eval from "../sutra/eval.mjs";
import * as $functions from "../sutra/functions.mjs";
import * as $parser from "../sutra/parser.mjs";
import * as $value from "../sutra/value.mjs";
import * as $workbook from "../sutra/workbook.mjs";
import { Key } from "../sutra/workbook.mjs";

export class Output extends $CustomType {
  constructor(stdout, stderr, code) {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
    this.code = code;
  }
}
export const Output$Output = (stdout, stderr, code) =>
  new Output(stdout, stderr, code);
export const Output$isOutput = (value) => value instanceof Output;
export const Output$Output$stdout = (value) => value.stdout;
export const Output$Output$0 = (value) => value.stdout;
export const Output$Output$stderr = (value) => value.stderr;
export const Output$Output$1 = (value) => value.stderr;
export const Output$Output$code = (value) => value.code;
export const Output$Output$2 = (value) => value.code;

class Options extends $CustomType {
  constructor(format) {
    super();
    this.format = format;
  }
}

const usage = "sutra — an Excel formula engine\n\nUsage:\n  sutra eval <file.csv>... [--format table|csv|json]   compute every formula\n  sutra check <file.csv>...                           list formula errors\n  sutra explain <file.csv>... <cell>                  trace where a value comes from\n  sutra calc \"=formula\"                               evaluate one formula\n  sutra functions                                     list supported functions\n\nEach CSV file is one sheet, named after the file (sales.csv -> Sales!A1\nis written sales!A1). Cells starting with = are formulas.\n\nOptions:\n  -f, --format    eval output: table (default), csv or json\n  -h, --help      show this help\n  -v, --version   show the version\n";

const max_listed = 8;

const max_depth = 6;

export const version = "0.1.0";

function usage_error(message) {
  return new Output("", (("error: " + message) + "\n\n") + usage, 2);
}

function sum(xs) {
  return $list.fold(xs, 0.0, (a, b) => { return a + b; });
}

function dep_cells(book, dep) {
  if (dep instanceof $workbook.OnCell) {
    let k = dep[0];
    return listPrepend(k, $List$Empty$const);
  } else {
    let sheet = dep.sheet;
    let range = dep.range;
    let $ = $workbook.extent(book, sheet);
    let rows = $[0];
    let cols = $[1];
    let bottom = $int.min(range.bottom, rows - 1);
    let right = $int.min(range.right, cols - 1);
    let _pipe = $int.range(
      range.top,
      bottom + 1,
      $List$Empty$const,
      (acc, r) => {
        return $int.range(
          range.left,
          right + 1,
          acc,
          (acc, c) => { return listPrepend(new Key(sheet, c, r), acc); },
        );
      },
    );
    return $list.reverse(_pipe);
  }
}

function describe(book, key) {
  let sheet = $workbook.sheet_name(book, key.sheet);
  let v = $workbook.value(book, sheet, key.col, key.row);
  let _block;
  if (v instanceof $value.Text) {
    let s = v[0];
    _block = ("\"" + s) + "\"";
  } else if (v instanceof $value.Empty) {
    _block = "(empty)";
  } else {
    _block = $value.to_string(v);
  }
  let shown = _block;
  let input = $workbook.input(book, sheet, key.col, key.row);
  let _block$1;
  let $ = $workbook.spilled_from(book, key);
  if ($ instanceof Ok) {
    let anchor = $[0];
    _block$1 = ("   (spilled from " + $workbook.key_name(book, anchor)) + ")";
  } else {
    let $1 = $string.starts_with(input, "=");
    if ($1) {
      _block$1 = "   " + input;
    } else {
      _block$1 = "";
    }
  }
  let origin = _block$1;
  return (($workbook.key_name(book, key) + " = ") + shown) + origin;
}

function trace_dep(book, dep, indent, depth, seen) {
  if (dep instanceof $workbook.OnCell) {
    let k = dep[0];
    return trace(book, k, indent, depth, seen);
  } else {
    let sheet = dep.sheet;
    let range = dep.range;
    let cells = dep_cells(book, dep);
    let name = ($workbook.sheet_name(book, sheet) + "!") + $ast.range_name(
      range,
    );
    let values = $list.map(
      cells,
      (k) => {
        return $workbook.value(
          book,
          $workbook.sheet_name(book, k.sheet),
          k.col,
          k.row,
        );
      },
    );
    let numbers = $list.filter_map(
      values,
      (v) => {
        if (v instanceof $value.Number) {
          let x = v[0];
          return new Ok(x);
        } else {
          return new Error(undefined);
        }
      },
    );
    let summary = ((((((indent + name) + "   ") + $int.to_string(
      $list.length(cells),
    )) + " cells, ") + $int.to_string($list.length(numbers))) + " numbers") + (() => {
      if (numbers instanceof $Empty) {
        return "";
      } else {
        return ", sum " + $value.format_number(sum(numbers), 15);
      }
    })();
    let computed = $list.filter(
      cells,
      (k) => {
        let s = $workbook.sheet_name(book, k.sheet);
        return $string.starts_with($workbook.input(book, s, k.col, k.row), "=") || $result.is_ok(
          $workbook.spilled_from(book, k),
        );
      },
    );
    let already = $set.contains(seen, name);
    let seen$1 = $set.insert(seen, name);
    let _block;
    if (already) {
      _block = $List$Empty$const;
    } else {
      _block = $list.take(computed, max_listed);
    }
    let shown = _block;
    let $ = $list.fold(
      shown,
      [$List$Empty$const, seen$1],
      (acc, k) => {
        let lines = acc[0];
        let seen$2 = acc[1];
        let $1 = trace(book, k, indent + "  ", depth, seen$2);
        let more = $1[0];
        let seen$3 = $1[1];
        return [$list.append(lines, more), seen$3];
      },
    );
    let lines = $[0];
    let seen$2 = $[1];
    let _block$1;
    if (already) {
      _block$1 = 0;
    } else {
      _block$1 = $list.length(computed) - $list.length(shown);
    }
    let extra = _block$1;
    let _block$2;
    let $1 = already && (!(computed instanceof $Empty));
    if ($1) {
      _block$2 = summary + "   (shown above)";
    } else {
      _block$2 = summary;
    }
    let summary$1 = _block$2;
    let _block$3;
    let $2 = extra > 0;
    if ($2) {
      _block$3 = $list.append(
        lines,
        listPrepend(
          ((indent + "  … ") + $int.to_string(extra)) + " more computed cells",
          $List$Empty$const,
        ),
      );
    } else {
      _block$3 = lines;
    }
    let lines$1 = _block$3;
    return [listPrepend(summary$1, lines$1), seen$2];
  }
}

function trace(book, key, indent, depth, seen) {
  let line = indent + describe(book, key);
  let id = $workbook.key_name(book, key);
  let $ = $set.contains(seen, id);
  if ($) {
    return [listPrepend(line + "   (shown above)", $List$Empty$const), seen];
  } else {
    let seen$1 = $set.insert(seen, id);
    let _block;
    let $1 = $workbook.spilled_from(book, key);
    if ($1 instanceof Ok) {
      let anchor = $1[0];
      _block = listPrepend(new $workbook.OnCell(anchor), $List$Empty$const);
    } else {
      _block = $workbook.precedents(book, key);
    }
    let deps = _block;
    let $2 = depth >= max_depth;
    if (deps instanceof $Empty) {
      return [listPrepend(line, $List$Empty$const), seen$1];
    } else if ($2) {
      return [
        listPrepend(line, listPrepend(indent + "  …", $List$Empty$const)),
        seen$1,
      ];
    } else {
      let $3 = $list.fold(
        deps,
        [$List$Empty$const, seen$1],
        (acc, dep) => {
          let lines = acc[0];
          let seen$2 = acc[1];
          let $4 = trace_dep(book, dep, indent + "  ", depth + 1, seen$2);
          let more = $4[0];
          let seen$3 = $4[1];
          return [$list.append(lines, more), seen$3];
        },
      );
      let lines = $3[0];
      let seen$2 = $3[1];
      return [listPrepend(line, lines), seen$2];
    }
  }
}

/**
 * Where a cell's value comes from, as an indented tree.
 */
export function explain(book, key) {
  return $string.join(trace(book, key, "", 0, $set.new$())[0], "\n");
}

/**
 * "B7" (first sheet) or "Sales!B7".
 * 
 * @ignore
 */
function find_cell(book, text) {
  let _block;
  let $1 = $string.split_once(text, "!");
  if ($1 instanceof Ok) {
    let s = $1[0][0];
    let a = $1[0][1];
    _block = [$string.replace(s, "'", ""), a];
  } else {
    _block = [
      (() => {
        let _pipe = $list.first($workbook.sheets(book));
        return $result.unwrap(_pipe, "");
      })(),
      text,
    ];
  }
  let $ = _block;
  let sheet = $[0];
  let address = $[1];
  let $2 = $ast.parse_cell(address);
  let $3 = $list.find(
    $workbook.sheets(book),
    (s) => { return $string.lowercase(s) === $string.lowercase(sheet); },
  );
  if ($2 instanceof Ok) {
    if ($3 instanceof Ok) {
      let s = $3[0];
      let c = $2[0][0];
      let r = $2[0][1];
      return new Ok(new Key($string.lowercase(s), c, r));
    } else {
      return new Error("no sheet named " + sheet);
    }
  } else {
    return new Error("not a cell address: " + text);
  }
}

function explain_command(book, cell) {
  let $ = find_cell(book, cell);
  if ($ instanceof Ok) {
    let key = $[0];
    return new Output(explain(book, key) + "\n", "", 0);
  } else {
    let message = $[0];
    return new Output("", ("error: " + message) + "\n", 2);
  }
}

function separator(path) {
  let $ = $string.ends_with($string.lowercase(path), ".tsv");
  if ($) {
    return "\t";
  } else {
    return ",";
  }
}

/**
 * sales.csv -> "sales"; data/q3-report.tsv -> "q3-report".
 */
export function sheet_name(path) {
  let _block;
  let $ = $list.last($string.split(path, "/"));
  if ($ instanceof Ok) {
    let b = $[0];
    _block = b;
  } else {
    _block = path;
  }
  let base = _block;
  let $1 = $string.split(base, ".");
  if ($1 instanceof $Empty) {
    let parts = $1;
    return $string.join($list.take(parts, $list.length(parts) - 1), ".");
  } else if ($1.tail instanceof $Empty) {
    let single = $1.head;
    return single;
  } else {
    let parts = $1;
    return $string.join($list.take(parts, $list.length(parts) - 1), ".");
  }
}

export function load(files, read) {
  return $result.try$(
    $list.try_map(
      files,
      (f) => {
        let _pipe = read(f);
        return $result.map(
          _pipe,
          (text) => { return [sheet_name(f), separator(f), text]; },
        );
      },
    ),
    (texts) => {
      let names = $list.map(texts, (t) => { return t[0]; });
      let $ = $list.length($list.unique($list.map(names, $string.lowercase))) === $list.length(
        names,
      );
      if ($) {
        let cells = $list.flat_map(
          texts,
          (t) => {
            let name = t[0];
            let sep = t[1];
            let text = t[2];
            let _pipe = $csv.parse(text, sep);
            let _pipe$1 = $list.index_map(
              _pipe,
              (row, r) => {
                return $list.index_map(
                  row,
                  (input, c) => { return [name, c, r, input]; },
                );
              },
            );
            let _pipe$2 = $list.flatten(_pipe$1);
            return $list.filter(_pipe$2, (cell) => { return cell[3] !== ""; });
          },
        );
        let $1 = $workbook.from_cells(names, cells);
        let book = $1[0];
        return new Ok(book);
      } else {
        return new Error("two files would make sheets with the same name");
      }
    },
  );
}

function parse_options(loop$args, loop$files, loop$options) {
  while (true) {
    let args = loop$args;
    let files = loop$files;
    let options = loop$options;
    if (args instanceof $Empty) {
      return new Ok([$list.reverse(files), options]);
    } else {
      let $ = args.tail;
      if ($ instanceof $Empty) {
        let $1 = args.head;
        if ($1 === "-f") {
          return new Error("--format needs a value");
        } else if ($1 === "--format") {
          return new Error("--format needs a value");
        } else if ($1.charCodeAt(0) === 45) {
          let flag = $1.slice(1);
          return new Error("unknown option -" + flag);
        } else {
          let file = $1;
          let rest = $;
          loop$args = rest;
          loop$files = listPrepend(file, files);
          loop$options = options;
        }
      } else {
        let $1 = args.head;
        if ($1 === "-f") {
          let f = $.head;
          let rest = $.tail;
          if (f === "table") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else if (f === "csv") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else if (f === "json") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else {
            return new Error("unknown format " + f);
          }
        } else if ($1 === "--format") {
          let f = $.head;
          let rest = $.tail;
          if (f === "table") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else if (f === "csv") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else if (f === "json") {
            loop$args = rest;
            loop$files = files;
            loop$options = new Options(f);
          } else {
            return new Error("unknown format " + f);
          }
        } else if ($1.charCodeAt(0) === 45) {
          let flag = $1.slice(1);
          return new Error("unknown option -" + flag);
        } else {
          let file = $1;
          let rest = $;
          loop$args = rest;
          loop$files = listPrepend(file, files);
          loop$options = options;
        }
      }
    }
  }
}

function with_book(args, read, k) {
  let $ = parse_options(args, $List$Empty$const, new Options("table"));
  if ($ instanceof Ok) {
    let $1 = $[0][0];
    if ($1 instanceof $Empty) {
      return usage_error("no input files");
    } else {
      let files = $1;
      let options = $[0][1];
      let $2 = load(files, read);
      if ($2 instanceof Ok) {
        let book = $2[0];
        return k(book, options);
      } else {
        let message = $2[0];
        return new Output("", ("error: " + message) + "\n", 1);
      }
    }
  } else {
    let message = $[0];
    return usage_error(message);
  }
}

function explain_error(book, key, kind) {
  let _block;
  let _pipe = $workbook.precedents(book, key);
  let _pipe$1 = $list.flat_map(_pipe, (dep) => { return dep_cells(book, dep); });
  _block = $list.find(
    _pipe$1,
    (k) => {
      let sheet = $workbook.sheet_name(book, k.sheet);
      return isEqual(
        $workbook.value(book, sheet, k.col, k.row),
        new $value.Err(kind)
      );
    },
  );
  let from = _block;
  if (kind instanceof $value.Div0) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "division by zero";
    }
  } else if (kind instanceof $value.NA) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "value not available (a lookup found no match)";
    }
  } else if (kind instanceof $value.NameErr) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "unknown function or name";
    }
  } else if (kind instanceof $value.NumErr) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "invalid number (too large, or no solution)";
    }
  } else if (kind instanceof $value.RefErr) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "reference to a sheet that does not exist";
    }
  } else if (kind instanceof $value.ValueErr) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "wrong type of argument, or wrong number of arguments";
    }
  } else if (kind instanceof $value.Spill) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "the array result has no room to spill: cells below or to the right are not empty";
    }
  } else if (kind instanceof $value.Cycle) {
    return "circular reference: this cell depends on itself";
  } else if (kind instanceof $value.Calc) {
    if (from instanceof Ok) {
      let k = from[0];
      return "comes from " + $workbook.key_name(book, k);
    } else {
      return "the array result is empty";
    }
  } else if (from instanceof Ok) {
    let k = from[0];
    return "comes from " + $workbook.key_name(book, k);
  } else {
    return $value.error_to_string(kind);
  }
}

function check_command(book, _) {
  let _block;
  let _pipe = $workbook.cells(book);
  _block = $list.filter_map(
    _pipe,
    (key) => {
      let sheet = $workbook.sheet_name(book, key.sheet);
      let content = $workbook.content(book, sheet, key.col, key.row);
      let v = $workbook.value(book, sheet, key.col, key.row);
      if (content instanceof $workbook.Formula && v instanceof $value.Err) {
        let input = content.input;
        let kind = v[0];
        return new Ok(
          ((((($workbook.key_name(book, key) + "  ") + $value.error_to_string(
            kind,
          )) + "  ") + input) + "\n    ") + explain_error(book, key, kind),
        );
      } else if (content instanceof $workbook.Broken) {
        let input = content.input;
        let e = content.error;
        return new Ok(
          (((((($workbook.key_name(book, key) + "  #ERROR!  ") + input) + "\n    cannot parse: ") + e.message) + " (at character ") + $int.to_string(
            e.position + 1,
          )) + ")",
        );
      } else {
        return new Error(undefined);
      }
    },
  );
  let problems = _block;
  if (problems instanceof $Empty) {
    return new Output("No formula errors.\n", "", 0);
  } else {
    return new Output(
      (((($string.join(problems, "\n") + "\n\n") + $int.to_string(
        $list.length(problems),
      )) + " formula error") + (() => {
        if (problems instanceof $Empty) {
          return "s";
        } else if (problems.tail instanceof $Empty) {
          return "";
        } else {
          return "s";
        }
      })()) + "\n",
      "",
      1,
    );
  }
}

/**
 * Cell text for a sheet. Tables show 10 significant digits, like a
 * spreadsheet column; CSV keeps all 15.
 * 
 * @ignore
 */
function grid(book, sheet, digits) {
  let $ = $workbook.extent(book, sheet);
  let rows = $[0];
  let cols = $[1];
  let _pipe = $int.range(
    0,
    rows,
    $List$Empty$const,
    (acc, r) => {
      return listPrepend(
        (() => {
          let _pipe = $int.range(
            0,
            cols,
            $List$Empty$const,
            (acc, c) => {
              return listPrepend(
                $value.display($workbook.value(book, sheet, c, r), digits),
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
}

/**
 * A grid with column letters and row numbers, right-aligning numbers.
 * 
 * @ignore
 */
function table(rows) {
  let width = $list.fold(
    rows,
    0,
    (acc, r) => { return $int.max(acc, $list.length(r)); },
  );
  let _block;
  let _pipe = $int.range(
    0,
    width,
    $List$Empty$const,
    (acc, c) => { return listPrepend($ast.column_name(c), acc); },
  );
  _block = $list.reverse(_pipe);
  let header = _block;
  let body = $list.index_map(
    rows,
    (r, i) => { return listPrepend($int.to_string(i + 1), r); },
  );
  let all = listPrepend(listPrepend("", header), body);
  let _block$1;
  let _pipe$1 = $int.range(
    0,
    width + 1,
    $List$Empty$const,
    (acc, c) => {
      return listPrepend(
        $list.fold(
          all,
          0,
          (m, row) => {
            return $int.max(
              m,
              $string.length(
                (() => {
                  let _pipe$1 = $env.nth(row, c);
                  return $result.unwrap(_pipe$1, "");
                })(),
              ),
            );
          },
        ),
        acc,
      );
    },
  );
  _block$1 = $list.reverse(_pipe$1);
  let widths = _block$1;
  let _pipe$2 = all;
  let _pipe$3 = $list.map(
    _pipe$2,
    (row) => {
      let _pipe$3 = $list.index_map(
        widths,
        (w, c) => {
          let _block$2;
          let _pipe$3 = $env.nth(row, c);
          _block$2 = $result.unwrap(_pipe$3, "");
          let cell = _block$2;
          let $ = $value.parse_number(cell);
          if ($ instanceof Ok) {
            return $string.pad_start(cell, w, " ");
          } else {
            return $string.pad_end(cell, w, " ");
          }
        },
      );
      let _pipe$4 = $string.join(_pipe$3, "  ");
      return $string.trim_end(_pipe$4);
    },
  );
  let _pipe$4 = $string.join(_pipe$3, "\n");
  return $string.append(_pipe$4, "\n");
}

export function json_string(s) {
  let _block;
  let _pipe = s;
  let _pipe$1 = $string.replace(_pipe, "\\", "\\\\");
  let _pipe$2 = $string.replace(_pipe$1, "\"", "\\\"");
  let _pipe$3 = $string.replace(_pipe$2, "\n", "\\n");
  let _pipe$4 = $string.replace(_pipe$3, "\r", "\\r");
  _block = $string.replace(_pipe$4, "\t", "\\t");
  let escaped = _block;
  return ("\"" + escaped) + "\"";
}

export function json_value(v) {
  if (v instanceof $value.Number) {
    return $value.to_string(v);
  } else if (v instanceof $value.Text) {
    let s = v[0];
    return json_string(s);
  } else if (v instanceof $value.Boolean) {
    if (v[0]) {
      return "true";
    } else {
      return "false";
    }
  } else if (v instanceof $value.Empty) {
    return "null";
  } else {
    let k = v[0];
    return ("{\"error\":" + json_string($value.error_to_string(k))) + "}";
  }
}

function grid_values(book, sheet) {
  let $ = $workbook.extent(book, sheet);
  let rows = $[0];
  let cols = $[1];
  let _pipe = $int.range(
    0,
    rows,
    $List$Empty$const,
    (acc, r) => {
      return listPrepend(
        (() => {
          let _pipe = $int.range(
            0,
            cols,
            $List$Empty$const,
            (acc, c) => {
              return listPrepend($workbook.value(book, sheet, c, r), acc);
            },
          );
          return $list.reverse(_pipe);
        })(),
        acc,
      );
    },
  );
  return $list.reverse(_pipe);
}

function json(book) {
  let sheets = $list.map(
    $workbook.sheets(book),
    (s) => {
      let _block;
      let _pipe = grid_values(book, s);
      _block = $list.map(
        _pipe,
        (row) => {
          return ("[" + $string.join($list.map(row, json_value), ",")) + "]";
        },
      );
      let rows = _block;
      return ((json_string(s) + ":[") + $string.join(rows, ",")) + "]";
    },
  );
  return ("{" + $string.join(sheets, ",")) + "}\n";
}

function eval_command(book, options) {
  let sheets = $workbook.sheets(book);
  let _block;
  let $ = options.format;
  if ($ === "csv") {
    if (sheets instanceof $Empty) {
      let _pipe = $list.map(
        sheets,
        (s) => { return (("# " + s) + "\n") + $csv.write(grid(book, s, 15)); },
      );
      _block = $string.join(_pipe, "\n");
    } else if (sheets.tail instanceof $Empty) {
      let only = sheets.head;
      _block = $csv.write(grid(book, only, 15));
    } else {
      let _pipe = $list.map(
        sheets,
        (s) => { return (("# " + s) + "\n") + $csv.write(grid(book, s, 15)); },
      );
      _block = $string.join(_pipe, "\n");
    }
  } else if ($ === "json") {
    _block = json(book);
  } else {
    let _pipe = $list.map(
      sheets,
      (s) => {
        if (sheets instanceof $Empty) {
          return (s + "\n") + table(grid(book, s, 10));
        } else if (sheets.tail instanceof $Empty) {
          return table(grid(book, s, 10));
        } else {
          return (s + "\n") + table(grid(book, s, 10));
        }
      },
    );
    _block = $string.join(_pipe, "\n");
  }
  let text = _block;
  return new Output(text, "", 0);
}

function function_list() {
  let entries = $functions.catalogue();
  let _block;
  let _pipe = $list.fold(
    entries,
    $List$Empty$const,
    (acc, e) => {
      let $ = $list.contains(acc, e[0]);
      if ($) {
        return acc;
      } else {
        return listPrepend(e[0], acc);
      }
    },
  );
  _block = $list.reverse(_pipe);
  let groups = _block;
  let by_group = $list.group(entries, (e) => { return e[0]; });
  let _pipe$1 = $list.map(
    groups,
    (g) => {
      let _block$1;
      let _pipe$1 = $dict.get(by_group, g);
      let _pipe$2 = $result.unwrap(_pipe$1, $List$Empty$const);
      _block$1 = $list.reverse(_pipe$2);
      let items = _block$1;
      return (((g + " (") + $int.to_string($list.length(items))) + ")\n") + $string.join(
        $list.map(items, (e) => { return "  " + e[2]; }),
        "\n",
      );
    },
  );
  let _pipe$2 = $string.join(_pipe$1, "\n\n");
  return $string.append(
    _pipe$2,
    ("\n\n" + $int.to_string($list.length(entries))) + " functions\n",
  );
}

function calc(formula) {
  let _block;
  let $ = $string.starts_with(formula, "=");
  if ($) {
    _block = formula;
  } else {
    _block = "=" + formula;
  }
  let formula$1 = _block;
  let $1 = $parser.parse(formula$1);
  if ($1 instanceof Ok) {
    let expr = $1[0];
    let $2 = $eval.standalone(expr);
    if ($2 instanceof $env.Scalar) {
      let v = $2[0];
      return new Output($value.to_string(v) + "\n", "", 0);
    } else {
      let rows = $2[0];
      return new Output(
        table(
          $list.map(rows, (r) => { return $list.map(r, $value.to_string); }),
        ),
        "",
        0,
      );
    }
  } else {
    let e = $1[0];
    return new Output(
      "",
      ((((("error: cannot parse: " + e.message) + "\n  ") + formula$1) + "\n  ") + $string.repeat(
        " ",
        e.position,
      )) + "^\n",
      1,
    );
  }
}

export function run(args, read) {
  if (args instanceof $Empty) {
    return new Output(usage, "", 0);
  } else {
    let $ = args.tail;
    if ($ instanceof $Empty) {
      let $1 = args.head;
      if ($1 === "-h") {
        return new Output(usage, "", 0);
      } else if ($1 === "--help") {
        return new Output(usage, "", 0);
      } else if ($1 === "help") {
        return new Output(usage, "", 0);
      } else if ($1 === "-v") {
        return new Output(("sutra " + version) + "\n", "", 0);
      } else if ($1 === "--version") {
        return new Output(("sutra " + version) + "\n", "", 0);
      } else if ($1 === "functions") {
        return new Output(function_list(), "", 0);
      } else if ($1 === "eval") {
        let rest = $;
        return with_book(rest, read, eval_command);
      } else if ($1 === "check") {
        let rest = $;
        return with_book(rest, read, check_command);
      } else if ($1 === "explain") {
        let rest = $;
        let $2 = $list.reverse(rest);
        if ($2 instanceof $Empty) {
          return usage_error("explain needs files and a cell");
        } else {
          let cell = $2.head;
          let files = $2.tail;
          return with_book(
            $list.reverse(files),
            read,
            (book, _) => { return explain_command(book, cell); },
          );
        }
      } else {
        let cmd = $1;
        return usage_error("unknown command " + cmd);
      }
    } else if ($.tail instanceof $Empty) {
      let $1 = args.head;
      if ($1 === "calc") {
        let formula = $.head;
        return calc(formula);
      } else if ($1 === "eval") {
        let rest = $;
        return with_book(rest, read, eval_command);
      } else if ($1 === "check") {
        let rest = $;
        return with_book(rest, read, check_command);
      } else if ($1 === "explain") {
        let rest = $;
        let $2 = $list.reverse(rest);
        if ($2 instanceof $Empty) {
          return usage_error("explain needs files and a cell");
        } else {
          let cell = $2.head;
          let files = $2.tail;
          return with_book(
            $list.reverse(files),
            read,
            (book, _) => { return explain_command(book, cell); },
          );
        }
      } else {
        let cmd = $1;
        return usage_error("unknown command " + cmd);
      }
    } else {
      let $1 = args.head;
      if ($1 === "eval") {
        let rest = $;
        return with_book(rest, read, eval_command);
      } else if ($1 === "check") {
        let rest = $;
        return with_book(rest, read, check_command);
      } else if ($1 === "explain") {
        let rest = $;
        let $2 = $list.reverse(rest);
        if ($2 instanceof $Empty) {
          return usage_error("explain needs files and a cell");
        } else {
          let cell = $2.head;
          let files = $2.tail;
          return with_book(
            $list.reverse(files),
            read,
            (book, _) => { return explain_command(book, cell); },
          );
        }
      } else {
        let cmd = $1;
        return usage_error("unknown command " + cmd);
      }
    }
  }
}
