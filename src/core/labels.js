// Core: display labels / enums.

export const PAY = { cash: 'نقدي', insta: 'InstaPay', unpaid: 'لم يُدفع' };
export const MODE = { single: 'Single', multi: 'Multi' };
export const BOOK_STATUS = { wait: 'منتظر', came: 'حضر', cancel: 'ملغي' };
export const MOVE_TYPE = { buy: 'شراء', sale: 'بيع مباشر', sess: 'جلسة', adj: 'جرد/تعديل', ret: 'مرتجع' };
export const EXPENSE_CATS = ['كهرباء', 'صيانة', 'مشتريات', 'إيجار', 'أخرى'];
export const DEVICE_TYPES = ['ps5', 'ps4'];
export const ROUND_OPTIONS = [
  ['exact', 'بدون تقريب (بالثانية)'],
  ['min', 'لأعلى دقيقة'],
  ['5', 'لأعلى 5 دقائق'],
  ['15', 'لأعلى 15 دقيقة'],
];
export const REPORT_RANGES = [
  ['p', 'الفترة الحالية'],
  ['today', 'اليوم'],
  ['7', '7 أيام'],
  ['month', 'الشهر'],
  ['all', 'الكل'],
];
