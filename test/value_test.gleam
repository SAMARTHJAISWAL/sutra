import sutra/csv
import sutra/dates
import sutra/value

pub fn general_format_test() {
  assert value.format_number(0.0, 15) == "0"
  assert value.format_number(-0.0, 15) == "0"
  assert value.format_number(1234.5, 15) == "1234.5"
  assert value.format_number(1.0e21, 15) == "1E+21"
  assert value.format_number(-1.5e-12, 15) == "-1.5E-12"
  assert value.format_number(0.1 +. 0.2, 15) == "0.3"
  assert value.format_number(2.0 /. 3.0, 10) == "0.6666666667"
  assert value.format_number(99_999_999_999.0, 10) == "1E+11"
  assert value.format_number(9.999999999999999e14, 15) == "1E+15"
}

pub fn parse_number_test() {
  assert value.parse_number("42") == Ok(42.0)
  assert value.parse_number(" -1,234.50 ") == Ok(-1234.5)
  assert value.parse_number("12.5%") == Ok(0.125)
  assert value.parse_number("1e3") == Ok(1000.0)
  assert value.parse_number(".5") == Ok(0.5)
  assert value.parse_number("1,23") == Error(Nil)
  assert value.parse_number("12abc") == Error(Nil)
  assert value.parse_number("") == Error(Nil)
  assert value.parse_number("-") == Error(Nil)
}

pub fn input_test() {
  assert value.from_input("") == value.Empty
  assert value.from_input("3.5") == value.Number(3.5)
  assert value.from_input("False") == value.Boolean(False)
  assert value.from_input("'123") == value.Text("123")
  assert value.from_input("#div/0!") == value.Err(value.Div0)
  assert value.from_input("hello") == value.Text("hello")
}

pub fn dates_round_trip_test() {
  assert dates.serial(2024, 2, 29) == Ok(45_351)
  assert dates.ymd(45_351) == #(2024, 2, 29)
  assert dates.ymd(60) == #(1900, 2, 29)
  assert dates.ymd(61) == #(1900, 3, 1)
  assert dates.ymd(1) == #(1900, 1, 1)
  assert dates.serial(9999, 12, 31) == Ok(2_958_465)
  assert dates.serial(10_000, 1, 1) == Error(Nil)
  // every day of 2000-2030 survives the round trip
  let assert Ok(start) = dates.serial(2000, 1, 1)
  let assert Ok(end) = dates.serial(2030, 12, 31)
  check_days(start, end)
}

fn check_days(n: Int, end: Int) -> Nil {
  case n > end {
    True -> Nil
    False -> {
      let #(y, m, d) = dates.ymd(n)
      assert dates.serial(y, m, d) == Ok(n)
      check_days(n + 1, end)
    }
  }
}

pub fn csv_test() {
  assert csv.parse("a,b\n1,2\n", ",") == [["a", "b"], ["1", "2"]]
  assert csv.parse("\"x, y\",\"say \"\"hi\"\"\"\r\nz,\n", ",")
    == [["x, y", "say \"hi\""], ["z", ""]]
  assert csv.parse("\"multi\nline\",2", ",") == [["multi\nline", "2"]]
  assert csv.parse("a\tb", "\t") == [["a", "b"]]
  assert csv.write([["=SUM(A1,A2)", "plain"]]) == "\"=SUM(A1,A2)\",plain\n"
}
