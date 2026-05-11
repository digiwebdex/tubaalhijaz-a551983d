## লক্ষ্য
চারটি বুকিং টাইপের জন্য আলাদা টেবিল রেখে একটি সরল ফ্লো তৈরি করব:
**কাস্টমার সাবমিট → এডমিন প্যানেলে Pending → এডমিন Confirm → কাস্টমার পোর্টালে স্ট্যাটাস আপডেট**

## চারটি বুকিং টেবিল
| টাইপ | টেবিল | অবস্থা |
|---|---|---|
| Umrah | `bookings` | আছে |
| Transport Voucher | `transport_voucher_orders` | আছে |
| Catering | `catering_orders` | আছে |
| Visa | `visa_orders` | নতুন তৈরি করব |

## ডাটাবেস পরিবর্তন
1. প্রতিটি orders টেবিলে নিশ্চিত করব: `user_id`, `status` (`pending`/`confirmed`/`cancelled`/`completed`), `confirmed_by`, `confirmed_at`, `tracking_id` (TT- prefix)
2. নতুন `visa_orders` টেবিল তৈরি (passport info, travel dates, visa type, fees, ইত্যাদি)
3. RLS: কাস্টমার শুধু নিজের রো দেখবে (`user_id = auth.uid()`); এডমিন সব ম্যানেজ করবে
4. Transport voucher থেকে স্বয়ংক্রিয় `bookings` রো ডুপ্লিকেট তৈরি বন্ধ করব (যেটা আগে যোগ করেছিলাম)

## এডমিন প্যানেল
- নতুন একটা পেজ: **Admin → Pending Bookings** (`/admin/pending-bookings`)
- ৪টি ট্যাব: Umrah / Transport / Catering / Visa
- প্রতি রো-তে: ডিটেইল মোডাল + **Confirm** + **Cancel** বাটন
- Confirm করলে status='confirmed', SMS/notification পাঠাবে কাস্টমারকে
- বিদ্যমান AdminTransportVouchersPage-এর "Submitted Voucher Orders" সেকশনটা এর সাথে সমন্বয় থাকবে

## কাস্টমার পোর্টাল (Dashboard)
- "My Bookings" সেকশনে ৪টি ট্যাব: Umrah / Transport / Catering / Visa
- প্রতিটি রো-তে: tracking ID, type-specific summary, status badge (Pending/Confirmed/Cancelled), তারিখ
- কাস্টমার লগইন (phone OTP) থাকলে সব দেখতে পাবে নিজের user_id দিয়ে
- ক্যানসেল করার অপশন (শুধু pending হলে)

## Customer Booking ফর্ম
- TransportOrderDialog, CateringOrderDialog, UmrahOrderDialog সব লগইন user_id সেভ করবে
- নতুন **VisaOrderDialog** কম্পোনেন্ট তৈরি করব
- হোমপেজে/সার্ভিস পেজে Visa Booking বাটন যোগ করব

## কাজের ধাপ
1. মাইগ্রেশন: visa_orders টেবিল + অন্য টেবিলে missing কলাম যোগ + RLS
2. AdminPendingBookingsPage তৈরি (৪ ট্যাব unified inbox)
3. Customer Dashboard-এ ৪ ট্যাব
4. VisaOrderDialog তৈরি ও Services পেজে যোগ
5. Confirm/Cancel actions + customer notification

## সরলীকরণ যা হচ্ছে
- AdminTransportVouchersPage-এ যে duplicate "Submitted Voucher Orders" সেকশন যোগ করেছিলাম সেটা সরিয়ে নতুন unified Pending Bookings পেজে নিয়ে যাব
- TransportOrderDialog থেকে bookings টেবিলে duplicate insert বন্ধ করব
