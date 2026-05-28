export function isValidPhoneNumber(value: string) {
  const phone = value.trim();

  if (!phone) return false;
  if (!/^[+\d][\d\s().-]{7,20}$/.test(phone)) return false;

  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
