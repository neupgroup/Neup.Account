# Skip OTP Verification During Signup

## Summary
Removed the OTP verification step from the signup flow. Users can now proceed directly from entering their phone number to choosing their NeupID.

## Changes Made

### 1. Frontend - Contact Page
**File**: `/src/app/auth/signup/contact/page.tsx`

- **Line 54**: Changed redirect from `/auth/signup/otp` to `/auth/signup/neupid`
- **Line 75**: Changed button text from "Send Verification Code" to "Continue"

### 2. Backend - Signup Action
**File**: `/src/actions/auth/signup.ts`

- **Lines 168-169**: Updated console log message to indicate OTP verification is skipped
- **Lines 171-174**: Modified `submitContactStep` to:
  - Set `phoneVerified: true` automatically
  - Change status from `pending_otp` to `pending_neupid`

## New Signup Flow

**Before:**
1. Name → Demographics → Nationality → Contact (Phone) → **OTP Verification** → NeupID → Password → Terms

**After:**
1. Name → Demographics → Nationality → Contact (Phone) → NeupID → Password → Terms

## Technical Details

- Phone numbers are now automatically marked as verified (`phoneVerified: true`)
- The OTP page (`/auth/signup/otp/page.tsx`) still exists but is no longer accessible in the flow
- The `submitOtpStep` function in signup actions is no longer called
- No database schema changes required - the `phoneVerified` field is still set, just automatically

## Future Considerations

If you want to re-enable OTP verification later:
1. Revert changes in `/src/app/auth/signup/contact/page.tsx` (line 54 and 75)
2. Revert changes in `/src/actions/auth/signup.ts` (lines 168-174)
3. Implement actual OTP sending/verification logic in `submitContactStep` and `submitOtpStep`

## Testing

To test the new flow:
1. Start the signup process at `/auth/signup`
2. Fill in Name, Demographics, Nationality
3. Enter a phone number on the Contact page
4. Click "Continue"
5. You should be redirected directly to the NeupID selection page
