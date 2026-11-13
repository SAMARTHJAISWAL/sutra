import { Ok, Error, remainderInt, divideInt } from "../gleam.mjs";

const epoch = -25_569;

function floor_div(a, b) {
  let q = divideInt(a, b);
  let $ = ((remainderInt(a, b)) !== 0) && ((a < 0) !== (b < 0));
  if ($) {
    return q - 1;
  } else {
    return q;
  }
}

/**
 * Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's
 * algorithm). Month may be any integer; it is normalised first.
 */
export function days_from_civil(year, month, day) {
  let total = (year * 12 + month) - 1;
  let y = floor_div(total, 12);
  let m = (total - y * 12) + 1;
  let _block;
  let $ = m <= 2;
  if ($) {
    _block = y - 1;
  } else {
    _block = y;
  }
  let y$1 = _block;
  let era = floor_div(y$1, 400);
  let yoe = y$1 - era * 400;
  let _block$1;
  let $1 = m > 2;
  if ($1) {
    _block$1 = m - 3;
  } else {
    _block$1 = m + 9;
  }
  let mp = _block$1;
  let doy = ((globalThis.Math.trunc((153 * mp + 2) / 5)) + day) - 1;
  let doe = ((yoe * 365 + (globalThis.Math.trunc(yoe / 4))) - (globalThis.Math.trunc(
    yoe / 100
  ))) + doy;
  return (era * 146_097 + doe) - 719_468;
}

/**
 * The inverse of `days_from_civil`.
 */
export function civil_from_days(days) {
  let z = days + 719_468;
  let era = floor_div(z, 146_097);
  let doe = z - era * 146_097;
  let yoe = globalThis.Math.trunc(
    (((doe - (globalThis.Math.trunc(doe / 1460))) + (globalThis.Math.trunc(
      doe / 36_524
    ))) - (globalThis.Math.trunc(doe / 146_096))) / 365
  );
  let y = yoe + era * 400;
  let doy = doe - ((365 * yoe + (globalThis.Math.trunc(yoe / 4))) - (globalThis.Math.trunc(
    yoe / 100
  )));
  let mp = globalThis.Math.trunc((5 * doy + 2) / 153);
  let d = (doy - (globalThis.Math.trunc((153 * mp + 2) / 5))) + 1;
  let _block;
  let $ = mp < 10;
  if ($) {
    _block = mp + 3;
  } else {
    _block = mp - 9;
  }
  let m = _block;
  let $1 = m <= 2;
  if ($1) {
    return [y + 1, m, d];
  } else {
    return [y, m, d];
  }
}

/**
 * DATE(year, month, day) as a serial. Months and days overflow into the
 * next unit (DATE(2024, 14, 1) is 2025-02-01); years 0-1899 add 1900.
 */
export function serial(year, month, day) {
  let _block;
  let $ = (year >= 0) && (year < 1900);
  if ($) {
    _block = year + 1900;
  } else {
    _block = year;
  }
  let year$1 = _block;
  let $1 = (year$1 < 0) || (year$1 > 9999);
  if ($1) {
    return new Error(undefined);
  } else {
    let n = ((days_from_civil(year$1, month, 1) + day) - 1) - epoch;
    let _block$1;
    let $2 = n <= 60;
    if ($2) {
      _block$1 = n - 1;
    } else {
      _block$1 = n;
    }
    let n$1 = _block$1;
    let $3 = (n$1 < 0) || (n$1 > 2_958_465);
    if ($3) {
      return new Error(undefined);
    } else {
      return new Ok(n$1);
    }
  }
}

/**
 * Serial -> #(year, month, day). Serial 0 is Excel's 1900-01-00.
 */
export function ymd(serial) {
  if (serial === 0) {
    return [1900, 1, 0];
  } else if (serial === 60) {
    return [1900, 2, 29];
  } else if (serial < 60) {
    return civil_from_days((serial + 1) + epoch);
  } else {
    return civil_from_days(serial + epoch);
  }
}

export function is_leap(year) {
  return (((year % 4) === 0) && ((year % 100) !== 0)) || ((year % 400) === 0);
}

export function days_in_month(year, month) {
  if (month === 2) {
    let $ = is_leap(year) || (year === 1900);
    if ($) {
      return 29;
    } else {
      return 28;
    }
  } else if (month === 4) {
    return 30;
  } else if (month === 6) {
    return 30;
  } else if (month === 9) {
    return 30;
  } else if (month === 11) {
    return 30;
  } else {
    return 31;
  }
}

/**
 * Weekday with Sunday = 1 .. Saturday = 7 (WEEKDAY's default).
 */
export function weekday(serial) {
  return ((serial - 1) % 7) + 1;
}
