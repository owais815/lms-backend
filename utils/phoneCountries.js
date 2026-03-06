/**
 * Shared phone country rules used for server-side validation.
 * Keep in sync with new-frontend/src/lib/phoneCountries.ts
 */
const PHONE_COUNTRIES = [
  { dialCode: '+92',  digits: 10 }, // PK - Pakistan
  { dialCode: '+91',  digits: 10 }, // IN - India
  { dialCode: '+1',   digits: 10 }, // US / CA - United States / Canada
  { dialCode: '+52',  digits: 10 }, // MX - Mexico
  { dialCode: '+44',  digits: 10 }, // GB - United Kingdom
  { dialCode: '+49',  digits: 10 }, // DE - Germany
  { dialCode: '+33',  digits: 9  }, // FR - France
  { dialCode: '+39',  digits: 10 }, // IT - Italy
  { dialCode: '+34',  digits: 9  }, // ES - Spain
  { dialCode: '+31',  digits: 9  }, // NL - Netherlands
  { dialCode: '+7',   digits: 10 }, // RU - Russia
  { dialCode: '+90',  digits: 10 }, // TR - Turkey
  { dialCode: '+971', digits: 9  }, // AE - UAE
  { dialCode: '+966', digits: 9  }, // SA - Saudi Arabia
  { dialCode: '+86',  digits: 11 }, // CN - China
  { dialCode: '+81',  digits: 10 }, // JP - Japan
  { dialCode: '+82',  digits: 10 }, // KR - South Korea
  { dialCode: '+65',  digits: 8  }, // SG - Singapore
  { dialCode: '+60',  digits: 9  }, // MY - Malaysia
  { dialCode: '+61',  digits: 9  }, // AU - Australia
  { dialCode: '+64',  digits: 9  }, // NZ - New Zealand
  { dialCode: '+55',  digits: 11 }, // BR - Brazil
  { dialCode: '+27',  digits: 9  }, // ZA - South Africa
  { dialCode: '+234', digits: 10 }, // NG - Nigeria
];

/**
 * express-validator custom validator for phone numbers.
 * Usage: body('contact').trim().notEmpty().custom(validatePhone)
 */
function validatePhone(value) {
  const country = PHONE_COUNTRIES.find(c => value.startsWith(c.dialCode));
  if (!country) throw new Error('Invalid country code in phone number.');
  const national = value.slice(country.dialCode.length).replace(/\D/g, '');
  if (national.length !== country.digits) {
    throw new Error(`Phone number must be exactly ${country.digits} digits for ${country.dialCode}.`);
  }
  return true;
}

module.exports = { PHONE_COUNTRIES, validatePhone };
