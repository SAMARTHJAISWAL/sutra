//// Excel date serial numbers (the 1900 date system).
////
//// Serial 1 is 1900-01-01. Excel keeps Lotus 1-2-3's bug of treating 1900
//// as a leap year, so serial 60 is the non-existent 1900-02-29 and every
//// date from 1900-03-01 on is one higher than a true day count. We keep the
//// bug too, so serials match real spreadsheets.

/// Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's
/// algorithm). Month may be any integer; it is normalised first.
pub fn days_from_civil(year: Int, month: Int, day: Int) -> Int {
  let total = year * 12 + month - 1
  let y = floor_div(total, 12)
  let m = total - y * 12 + 1
  let y = case m <= 2 {
    True -> y - 1
    False -> y
  }
  let era = floor_div(y, 400)
  let yoe = y - era * 400
  let mp = case m > 2 {
    True -> m - 3
    False -> m + 9
  }
  let doy = { 153 * mp + 2 } / 5 + day - 1
  let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
  era * 146_097 + doe - 719_468
}

/// The inverse of `days_from_civil`.
pub fn civil_from_days(days: Int) -> #(Int, Int, Int) {
  let z = days + 719_468
  let era = floor_div(z, 146_097)
  let doe = z - era * 146_097
  let yoe = { doe - doe / 1460 + doe / 36_524 - doe / 146_096 } / 365
  let y = yoe + era * 400
  let doy = doe - { 365 * yoe + yoe / 4 - yoe / 100 }
  let mp = { 5 * doy + 2 } / 153
  let d = doy - { 153 * mp + 2 } / 5 + 1
  let m = case mp < 10 {
    True -> mp + 3
    False -> mp - 9
  }
  case m <= 2 {
    True -> #(y + 1, m, d)
    False -> #(y, m, d)
  }
}

fn floor_div(a: Int, b: Int) -> Int {
  let q = a / b
  case a % b != 0 && { a < 0 } != { b < 0 } {
    True -> q - 1
    False -> q
  }
}

const epoch = -25_569

// days_from_civil(1899, 12, 30)

/// DATE(year, month, day) as a serial. Months and days overflow into the
/// next unit (DATE(2024, 14, 1) is 2025-02-01); years 0-1899 add 1900.
pub fn serial(year: Int, month: Int, day: Int) -> Result(Int, Nil) {
  let year = case year >= 0 && year < 1900 {
    True -> year + 1900
    False -> year
  }
  case year < 0 || year > 9999 {
    True -> Error(Nil)
    False -> {
      let n = days_from_civil(year, month, 1) + day - 1 - epoch
      // before 1900-03-01 Excel's serials are one lower than the true count
      let n = case n <= 60 {
        True -> n - 1
        False -> n
      }
      case n < 0 || n > 2_958_465 {
        True -> Error(Nil)
        False -> Ok(n)
      }
    }
  }
}

/// Serial -> #(year, month, day). Serial 0 is Excel's 1900-01-00.
pub fn ymd(serial: Int) -> #(Int, Int, Int) {
  case serial {
    0 -> #(1900, 1, 0)
    60 -> #(1900, 2, 29)
    _ if serial < 60 -> civil_from_days(serial + 1 + epoch)
    _ -> civil_from_days(serial + epoch)
  }
}

pub fn is_leap(year: Int) -> Bool {
  { year % 4 == 0 && year % 100 != 0 } || year % 400 == 0
}

pub fn days_in_month(year: Int, month: Int) -> Int {
  case month {
    2 ->
      case is_leap(year) || year == 1900 {
        True -> 29
        False -> 28
      }
    4 | 6 | 9 | 11 -> 30
    _ -> 31
  }
}

/// Weekday with Sunday = 1 .. Saturday = 7 (WEEKDAY's default).
pub fn weekday(serial: Int) -> Int {
  { serial - 1 } % 7 + 1
}
