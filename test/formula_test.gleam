//// Formula results, checked against what Excel returns for the same input.

import gleam/list
import gleam/string
import sutra/env
import sutra/eval
import sutra/functions
import sutra/parser
import sutra/value

/// Evaluate a formula with no workbook. Arrays print as rows joined by ";"
/// and columns joined by ",", like an array constant.
pub fn calc(formula: String) -> String {
  case parser.parse(formula) {
    Error(e) -> "parse error: " <> e.message
    Ok(expr) ->
      case eval.standalone(expr) {
        env.Scalar(v) -> value.to_string(v)
        env.Grid(rows) ->
          "{"
          <> string.join(
            list.map(rows, fn(r) {
              string.join(list.map(r, value.to_string), ",")
            }),
            ";",
          )
          <> "}"
      }
  }
}

fn check(cases: List(#(String, String))) -> Nil {
  list.each(cases, fn(c) {
    let #(formula, expected) = c
    let got = calc(formula)
    assert #(formula, got) == #(formula, expected)
  })
}

pub fn arithmetic_test() {
  check([
    #("=1+2*3", "7"),
    #("=(1+2)*3", "9"),
    #("=10/4", "2.5"),
    #("=7-10", "-3"),
    // unary minus binds tighter than ^, and ^ is left-associative
    #("=-2^2", "4"),
    #("=2^3^2", "64"),
    #("=2^-1", "0.5"),
    #("=50%", "0.5"),
    #("=200*15%", "30"),
    #("=1/0", "#DIV/0!"),
    #("=0^0", "#NUM!"),
    #("=\"3\"+4", "7"),
    #("=\"x\"+1", "#VALUE!"),
    #("=TRUE+TRUE", "2"),
    #("=1E+300*1E+300", "#NUM!"),
    #("=2^1024", "#NUM!"),
    #("=1.5E-11", "1.5E-11"),
  ])
}

pub fn precision_test() {
  check([
    // Excel shows 15 significant digits
    #("=0.1+0.2", "0.3"),
    #("=1/3", "0.333333333333333"),
    #("=2/3", "0.666666666666667"),
    #("=123456789012345678", "1.23456789012346E+17"),
    #("=1E+15", "1E+15"),
    #("=123456789012345", "123456789012345"),
    #("=0.000000001", "0.000000001"),
    #("=0.0000000001", "1E-10"),
    #("=-0.000001234", "-0.000001234"),
    // comparisons forgive the last bits of binary noise
    #("=0.1+0.2=0.3", "TRUE"),
    #("=1+1E-16=1", "TRUE"),
  ])
}

pub fn comparison_and_text_test() {
  check([
    #("=\"abc\"=\"ABC\"", "TRUE"),
    #("=\"a\"<\"b\"", "TRUE"),
    #("=1<\"a\"", "TRUE"),
    #("=\"z\"<TRUE", "TRUE"),
    #("=1=\"1\"", "FALSE"),
    #("=\"a\"&1&TRUE", "a1TRUE"),
    #("=\"Total: \"&1/4", "Total: 0.25"),
  ])
}

pub fn rounding_test() {
  check([
    // Excel rounds the decimal number you see, not the binary float
    #("=ROUND(1.005,2)", "1.01"),
    #("=ROUND(2.675,2)", "2.68"),
    #("=ROUND(2.5,0)", "3"),
    #("=ROUND(-2.5,0)", "-3"),
    #("=ROUND(1234.567,-2)", "1200"),
    #("=ROUND(0.004,2)", "0"),
    #("=ROUND(0.005,2)", "0.01"),
    #("=ROUNDUP(3.2,0)", "4"),
    #("=ROUNDUP(-3.2,0)", "-4"),
    #("=ROUNDDOWN(3.99,1)", "3.9"),
    #("=TRUNC(-4.7)", "-4"),
    #("=INT(-4.7)", "-5"),
    #("=MROUND(10,3)", "9"),
    #("=CEILING(2.1,0.5)", "2.5"),
    #("=FLOOR(2.9,0.5)", "2.5"),
    #("=CEILING(-2.5,-2)", "-4"),
    #("=MOD(-3,2)", "1"),
    #("=MOD(3,-2)", "-1"),
    #("=QUOTIENT(-7,2)", "-3"),
  ])
}

pub fn math_test() {
  check([
    #("=SUM(1,2,\"3\",TRUE)", "7"),
    #("=SUM({1,2;3,4})", "10"),
    #("=PRODUCT(2,3,4)", "24"),
    #("=SUMSQ(3,4)", "25"),
    #("=SQRT(16)", "4"),
    #("=SQRT(-1)", "#NUM!"),
    #("=POWER(2,10)", "1024"),
    #("=LOG(1000)", "3"),
    #("=LOG(8,2)", "3"),
    #("=LN(1)", "0"),
    #("=EXP(0)", "1"),
    #("=ABS(-3)", "3"),
    #("=SIGN(-0.5)", "-1"),
    #("=FACT(5)", "120"),
    #("=PI()", "3.14159265358979"),
    #("=SUMPRODUCT({1,2,3},{4,5,6})", "32"),
    #("=SUMPRODUCT(({1,2,3}>1)*{4,5,6})", "11"),
    #("=SUM({1,2,3}*{4,5,6})", "32"),
    #("=MAX({1,5,3})+MIN(4,2)", "7"),
  ])
}

pub fn logic_test() {
  check([
    #("=IF(1>2,\"yes\",\"no\")", "no"),
    #("=IF(FALSE,1)", "FALSE"),
    #("=IF(TRUE,,1)", "0"),
    #("=IF(1/0>1,1,2)", "#DIV/0!"),
    // the branch not taken is never evaluated
    #("=IF(TRUE,1,1/0)", "1"),
    #("=IFS(1>2,\"a\",2>1,\"b\")", "b"),
    #("=IFS(1>2,\"a\")", "#N/A"),
    #("=IFERROR(1/0,\"none\")", "none"),
    #("=IFNA(NA(),0)", "0"),
    #("=IFNA(1/0,0)", "#DIV/0!"),
    #("=SWITCH(2,1,\"one\",2,\"two\",\"other\")", "two"),
    #("=SWITCH(9,1,\"one\",\"other\")", "other"),
    #("=CHOOSE(2,\"a\",\"b\",\"c\")", "b"),
    #("=AND(TRUE,1>0)", "TRUE"),
    #("=OR(FALSE,0)", "FALSE"),
    #("=XOR(TRUE,TRUE,TRUE)", "TRUE"),
    #("=NOT(0)", "TRUE"),
    #("=LET(x,5,y,x*2,x+y)", "15"),
    #("=LET(r,0.05,n,12,ROUND((1+r/n)^n-1,6))", "0.051162"),
    #("=undefined_name", "#NAME?"),
    #("=NOSUCHFUNCTION(1)", "#NAME?"),
  ])
}

pub fn text_functions_test() {
  check([
    #("=LEN(\"hello\")", "5"),
    #("=LEFT(\"Sutra\",3)", "Sut"),
    #("=RIGHT(\"Sutra\",2)", "ra"),
    #("=MID(\"spreadsheet\",7,5)", "sheet"),
    #("=UPPER(\"gleam\")", "GLEAM"),
    #("=PROPER(\"hello wORLD-wide\")", "Hello World-Wide"),
    #("=TRIM(\"  a   b  \")", "a b"),
    #("=SUBSTITUTE(\"a-b-c\",\"-\",\"+\")", "a+b+c"),
    #("=SUBSTITUTE(\"a-b-c\",\"-\",\"+\",2)", "a-b+c"),
    #("=REPLACE(\"abcdef\",2,3,\"X\")", "aXef"),
    #("=FIND(\"c\",\"abcabc\",4)", "6"),
    #("=FIND(\"C\",\"abc\")", "#VALUE!"),
    #("=SEARCH(\"C\",\"abc\")", "3"),
    #("=REPT(\"ab\",3)", "ababab"),
    #("=EXACT(\"a\",\"A\")", "FALSE"),
    #("=CONCAT({\"a\",\"b\";\"c\",\"d\"})", "abcd"),
    #("=TEXTJOIN(\", \",TRUE,\"a\",\"\",\"b\")", "a, b"),
    #("=VALUE(\"1,234.5\")", "1234.5"),
    #("=VALUE(\"12%\")", "0.12"),
    #("=VALUE(\"abc\")", "#VALUE!"),
    #("=CHAR(65)&CODE(\"a\")", "A97"),
    #("=FIXED(1234.567,1)", "1,234.6"),
    #("=FIXED(-1234.567,0,TRUE)", "-1235"),
  ])
}

pub fn text_format_test() {
  check([
    #("=TEXT(1234567.891,\"#,##0.00\")", "1,234,567.89"),
    #("=TEXT(0.256,\"0.0%\")", "25.6%"),
    #("=TEXT(5,\"000\")", "005"),
    #("=TEXT(1234.5,\"$#,##0.00\")", "$1,234.50"),
    #("=TEXT(-1234,\"#,##0;(#,##0)\")", "(1,234)"),
    #("=TEXT(0,\"0;-0;\"\"zero\"\"\")", "zero"),
    #("=TEXT(12345,\"0.00E+00\")", "1.23E+04"),
    #("=TEXT(DATE(2024,1,31),\"yyyy-mm-dd\")", "2024-01-31"),
    #("=TEXT(DATE(2024,1,31),\"dd mmm yyyy\")", "31 Jan 2024"),
    #("=TEXT(DATE(2024,1,31),\"dddd, mmmm d\")", "Wednesday, January 31"),
  ])
}

pub fn date_test() {
  check([
    #("=DATE(2024,1,31)", "45322"),
    #("=DATE(1900,1,1)", "1"),
    // Excel's 1900 leap-year bug, kept for compatibility
    #("=DATE(1900,3,1)", "61"),
    #("=DATE(2024,13,1)=DATE(2025,1,1)", "TRUE"),
    #("=DATE(2024,3,0)=DATE(2024,2,29)", "TRUE"),
    #("=YEAR(45322)&\"-\"&MONTH(45322)&\"-\"&DAY(45322)", "2024-1-31"),
    #("=WEEKDAY(DATE(2024,1,1))", "2"),
    #("=WEEKDAY(DATE(2024,1,1),2)", "1"),
    #("=EDATE(DATE(2024,1,31),1)=DATE(2024,2,29)", "TRUE"),
    #("=EOMONTH(DATE(2023,1,15),1)=DATE(2023,2,28)", "TRUE"),
    #("=DAYS(DATE(2024,12,25),DATE(2024,1,1))", "359"),
    #("=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),\"Y\")", "4"),
    #("=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),\"M\")", "49"),
    #("=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),\"MD\")", "24"),
    #("=DATEVALUE(\"2024-01-31\")", "45322"),
  ])
}

pub fn lookup_test() {
  check([
    #("=VLOOKUP(\"b\",{\"a\",1;\"b\",2;\"c\",3},2,FALSE)", "2"),
    #("=VLOOKUP(\"B\",{\"a\",1;\"b\",2},2,FALSE)", "2"),
    #("=VLOOKUP(\"z\",{\"a\",1;\"b\",2},2,FALSE)", "#N/A"),
    #("=VLOOKUP(\"b*\",{\"apple\",1;\"banana\",2},2,FALSE)", "2"),
    // approximate match: the largest key not above the value (tax bands)
    #("=VLOOKUP(42000,{0,0;25000,0.1;50000,0.2},2)", "0.1"),
    #("=VLOOKUP(1,{\"a\",1},3,FALSE)", "#REF!"),
    #("=HLOOKUP(\"q2\",{\"q1\",\"q2\";10,20},2,FALSE)", "20"),
    #("=XLOOKUP(\"b\",{\"a\";\"b\"},{10;20})", "20"),
    #("=XLOOKUP(\"z\",{\"a\";\"b\"},{10;20},\"none\")", "none"),
    #("=XLOOKUP(25,{10;20;30},{\"x\";\"y\";\"z\"},,-1)", "y"),
    #("=XLOOKUP(25,{10;20;30},{\"x\";\"y\";\"z\"},,1)", "z"),
    #("=XLOOKUP(1,{1;2;1},{\"first\";\"mid\";\"last\"},,0,-1)", "last"),
    #("=XLOOKUP(2,{1;2},{\"a\",\"b\";\"c\",\"d\"})", "{c,d}"),
    #("=MATCH(25,{10,20,30})", "2"),
    #("=MATCH(\"c\",{\"a\",\"b\",\"c\"},0)", "3"),
    #("=MATCH(25,{30,20,10},-1)", "1"),
    #("=XMATCH(20,{10,20,30})", "2"),
    #("=INDEX({1,2;3,4},2,1)", "3"),
    #("=INDEX({10,20,30},3)", "30"),
    #("=INDEX({1,2;3,4},0,2)", "{2;4}"),
    #("=INDEX({1,2},5)", "#REF!"),
    #("=ROWS({1;2;3})*COLUMNS({1,2})", "6"),
  ])
}

pub fn conditional_aggregate_test() {
  check([
    #("=COUNTIF({1,5,10},\">3\")", "2"),
    #("=COUNTIF({\"apple\",\"avocado\",\"kiwi\"},\"a*\")", "2"),
    #("=COUNTIF({\"x\",\"\",\"y\"},\"<>\")", "2"),
    #("=COUNTIF({\"a?c\",\"abc\"},\"a~?c\")", "1"),
    #("=SUMIF({1,2,3,4},\">=3\")", "7"),
    #("=SUMIF({\"a\",\"b\",\"a\"},\"a\",{1,2,3})", "4"),
    #("=SUMIFS({1,2,3},{\"a\",\"b\",\"a\"},\"a\",{5,5,6},\">5\")", "3"),
    #("=COUNTIFS({\"a\",\"b\",\"a\"},\"a\",{1,2,3},\"<3\")", "1"),
    #("=AVERAGEIF({1,2,3,4},\">1\")", "3"),
    #("=AVERAGEIF({1,2},\">5\")", "#DIV/0!"),
    #("=MAXIFS({1,9,3},{\"a\",\"b\",\"a\"},\"a\")", "3"),
    #("=MINIFS({1,9,3},{\"a\",\"b\",\"a\"},\"b\")", "9"),
    #("=SUMIFS({1,2},{1,2,3},1)", "#VALUE!"),
  ])
}

pub fn statistics_test() {
  check([
    #("=AVERAGE(2,4,9)", "5"),
    #("=AVERAGE({\"a\"})", "#DIV/0!"),
    #("=COUNT(1,\"2\",\"x\",TRUE)", "3"),
    #("=COUNT({1,\"2\",TRUE})", "1"),
    #("=COUNTA({1,\"\",\"x\"})", "3"),
    #("=MEDIAN({1,3,2,4})", "2.5"),
    #("=MODE.SNGL({1,2,2,3,3})", "2"),
    #("=MODE.SNGL({1,2,3})", "#N/A"),
    #("=STDEV.S({2,4,4,4,5,5,7,9})", "2.1380899352994"),
    #("=STDEV.P({2,4,4,4,5,5,7,9})", "2"),
    #("=VAR.S({1,2,3,4})", "1.66666666666667"),
    #("=LARGE({3,9,1,7},2)", "7"),
    #("=SMALL({3,9,1,7},1)", "1"),
    #("=RANK.EQ(7,{3,9,1,7})", "2"),
    #("=RANK.EQ(7,{3,9,1,7},1)", "3"),
    #("=PERCENTILE.INC({1,2,3,4},0.25)", "1.75"),
    #("=QUARTILE.INC({1,2,3,4,5},3)", "4"),
    #("=CORREL({1,2,3},{2,4,6})", "1"),
  ])
}

pub fn finance_test() {
  check([
    // Excel's documented examples
    #("=ROUND(PMT(8%/12,10,10000),2)", "-1037.03"),
    #("=ROUND(PMT(0.05/12,360,200000),2)", "-1073.64"),
    #("=ROUND(FV(6%/12,10,-200,-500,1),2)", "2581.4"),
    #("=ROUND(PV(8%/12,12*20,500),2)", "-59777.15"),
    #("=ROUND(NPER(1%,-100,-1000,10000,1),2)", "59.67"),
    #("=ROUND(NPV(10%,-10000,3000,4200,6800),2)", "1188.44"),
    #("=ROUND(IRR({-70000,12000,15000,18000,21000,26000}),4)", "0.0866"),
    #("=ROUND(IRR({-70000,12000,15000,18000,21000}),4)", "-0.0212"),
    #("=PMT(0,12,1200)", "-100"),
    #("=IRR({1,2,3})", "#NUM!"),
  ])
}

pub fn dynamic_array_test() {
  check([
    #("=SEQUENCE(2,3)", "{1,2,3;4,5,6}"),
    #("=SEQUENCE(3,1,10,-5)", "{10;5;0}"),
    #("=SORT({3;1;2})", "{1;2;3}"),
    #("=SORT({3;1;2},1,-1)", "{3;2;1}"),
    #("=SORT({\"b\",2;\"a\",1;\"c\",3},2)", "{a,1;b,2;c,3}"),
    #("=UNIQUE({1;2;1;3})", "{1;2;3}"),
    #("=UNIQUE({\"a\";\"A\";\"b\"})", "{a;b}"),
    #("=UNIQUE({1;2;1;3},,TRUE)", "{2;3}"),
    #("=FILTER({1;2;3;4},{1;2;3;4}>2)", "{3;4}"),
    #("=FILTER({1;2},{FALSE;FALSE})", "#CALC!"),
    #("=FILTER({1;2},{FALSE;FALSE},\"none\")", "none"),
    #("=TRANSPOSE({1,2,3})", "{1;2;3}"),
    #("=SUM(SEQUENCE(100))", "5050"),
    #("=COUNTA(UNIQUE({\"x\";\"y\";\"x\"}))", "2"),
    // scalar functions lift over arrays
    #("=LEN({\"a\",\"bb\"})", "{1,2}"),
    #("={1,2}+{10;20}", "{11,12;21,22}"),
    #("=IF({1,0},\"y\",\"n\")", "{y,n}"),
    #("={1,2,3}*{1,2}", "{1,4,#N/A}"),
  ])
}

pub fn errors_test() {
  check([
    #("=#N/A", "#N/A"),
    #("=ISERROR(1/0)", "TRUE"),
    #("=ISERR(NA())", "FALSE"),
    #("=ISNA(NA())", "TRUE"),
    #("=ISNUMBER(\"1\")", "FALSE"),
    #("=ISTEXT(\"1\")", "TRUE"),
    #("=ISBLANK(A1)", "TRUE"),
    #("=ISEVEN(4)", "TRUE"),
    #("=Sheet9!A1", "#REF!"),
    #("=1/0+NA()", "#DIV/0!"),
    #("=ROUND(1,2,3)", "#VALUE!"),
  ])
}

/// Every function in the catalogue must dispatch to an implementation.
pub fn catalogue_is_implemented_test() {
  list.each(functions.catalogue(), fn(entry) {
    let #(_, name, _) = entry
    let got = calc("=" <> name <> "()")
    assert #(name, got != "#NAME?") == #(name, True)
  })
  assert list.length(functions.catalogue()) >= 120
}
