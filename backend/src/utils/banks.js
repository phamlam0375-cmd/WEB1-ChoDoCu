"use strict";

// Ngân hàng hỗ trợ mã QR chuyển khoản theo chuẩn VietQR (mã BIN do NAPAS cấp).
// Mã QR được sinh ở giao diện (frontend/src/lib/vietqr.js).
const BANKS = [
  { code: "970436", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam" },
  { code: "970415", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { code: "970418", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { code: "970405", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn" },
  { code: "970407", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { code: "970422", shortName: "MBBank", name: "Ngân hàng TMCP Quân đội" },
  { code: "970416", shortName: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { code: "970432", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { code: "970423", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { code: "970403", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { code: "970441", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { code: "970443", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { code: "970437", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP.HCM" },
  { code: "970448", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { code: "970426", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải" },
  { code: "970431", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { code: "970440", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { code: "970449", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
];

const BANK_BY_CODE = Object.fromEntries(BANKS.map((bank) => [bank.code, bank]));

module.exports = { BANKS, BANK_BY_CODE };
