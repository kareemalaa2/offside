// Domain: customers & bookings rules.
import { norm, sum, digits, PHONE_RE } from '../core/utils.js';

export function customerStats(S, c) {
  const D = S.sessions.filter((s) => s.end && norm(s.customer) === norm(c.name));
  return {
    n: D.length,
    tot: sum(D, (s) => s.amount),
    un: sum(D.filter((s) => s.pay === 'unpaid'), (s) => s.amount),
    last: D.reduce((m, s) => Math.max(m, s.end), 0),
  };
}

export const findCustomerByName = (S, name) => S.custs.find((c) => norm(c.name) === norm(name));

/** Normalises and validates a phone. Returns {phone} or {error}. */
export function cleanPhone(raw) {
  const phone = digits(raw);
  if (phone && !PHONE_RE.test(phone)) return { error: 'رقم الموبايل غير صحيح' };
  return { phone };
}

/** Booking clashes with another waiting booking for the same room within 1 hour. */
export const bookingClash = (S, room, at, exceptId) =>
  S.books.some((b) => b.id !== exceptId && b.st === 'wait' && norm(b.room) === norm(room) && Math.abs(b.at - at) < 36e5);

/** Waiting bookings from 2h ago to 1h ahead. */
export const upcomingBookings = (S, now = Date.now()) =>
  S.books.filter((b) => b.st === 'wait' && b.at <= now + 36e5 && b.at >= now - 72e5);
